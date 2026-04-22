(()=>{
  // Store original functions
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalAddEventListener = XMLHttpRequest.prototype.addEventListener;

  // Shape-based matching functions (from buffer)
  function isUserPromptShape(arr) {
    return (
      Array.isArray(arr) &&
      arr.length === 6 &&
      Array.isArray(arr[0]) &&
      typeof arr[0][0] === 'string' &&
      typeof arr[1] === 'number' &&
      arr[2] === null &&
      typeof arr[4] === 'string'
    );
  }

  function isFanOutQueriesShape(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return false;
    }
    // Check if every item in the array matches the pattern ["query string", number]
    return arr.every(
      item =>
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === 'string' &&
        typeof item[1] === 'number'
    );
  }

  function findDataByShape(data, predicate) {
    let results = [];

    function search(item) {
      if (predicate(item)) {
        results.push(item);
      }

      if (Array.isArray(item)) {
        for (const subItem of item) {
          search(subItem);
        }
      }
    }

    search(data);
    return results;
  }

  // Extract user prompt from Gemini page
  function extractGeminiUserPrompt() {
    try {
      const inputSelectors = [
        'textarea[aria-label*="Message"]',
        'textarea[placeholder*="Enter a prompt"]',
        'rich-textarea textarea',
        '.ql-editor'
      ];
      
      for (const selector of inputSelectors) {
        const element = document.querySelector(selector);
        if (element && element.value) {
          return element.value.substring(0, 200);
        }
      }
      
      const messageSelectors = [
        '[data-message-author-role="user"]',
        '.user-message',
        '[role="presentation"] p'
      ];
      
      for (const selector of messageSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          const lastElement = elements[elements.length - 1];
          if (lastElement && lastElement.textContent) {
            return lastElement.textContent.substring(0, 200);
          }
        }
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  // Get conversation ID from URL
  function getConversationId() {
    const pathMatch = location.pathname.match(/\/app\/([^/]+)/);
    return pathMatch ? pathMatch[1] : `gemini_${Date.now()}`;
  }

  // Process intercepted Gemini response
  function processGeminiResponse(responseText, retryCount = 0) {
    try {
      const queries = extractQueriesFromGeminiResponse(responseText);
      
      if (queries && queries.length > 0) {
        // Get current chat ID from URL
        const chatId = getConversationId();
        
        // Create template element
        let node = document.createElement("template");
        node.setAttribute("data-type", "gemini-queries");
        node.setAttribute("data-url", window.location.href);
        node.setAttribute("data-chat-id", chatId);
        node.textContent = JSON.stringify({ queries: queries, responseText: responseText });
        document.body.appendChild(node);

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('xt-gemini-queries', {
          detail: { queries: queries, responseText: responseText }
        }));
      } else if (retryCount < 2 && responseText && responseText.length > 0) {
        // Retry processing after a delay - response might not be fully populated yet
        // This is especially important for new queries which might stream data
        setTimeout(() => {
          processGeminiResponse(responseText, retryCount + 1);
        }, 1000);
      }
    } catch (error) {
      console.error('Error processing Gemini response:', error);
    }
  }

  // Extract queries from Gemini response using shape-based matching
  function extractQueriesFromGeminiResponse(responseText) {
    const queries = [];
    const userPrompt = extractGeminiUserPrompt();
    const conversationId = getConversationId();
    
    try {
      // Parse the complex response structure
      const lines = responseText.split('\n').filter(line => line.trim().length > 0);
      if (lines.length < 3) {
        return extractQueriesFromGeminiResponseFallback(responseText);
      }

      const outerJsonString = lines[2];
      const outerData = JSON.parse(outerJsonString);
      const innerJsonString = outerData[0][2];
      const parsedData = JSON.parse(innerJsonString);
      
      // Use shape-based matching to find fan-out queries
      const userPromptArray = findDataByShape(parsedData, isUserPromptShape)[0];
      const fanOutQueriesList = findDataByShape(parsedData, isFanOutQueriesShape)[0];
      
      const detectedUserPrompt = userPromptArray ? userPromptArray[0][0] : userPrompt;
      
      if (Array.isArray(fanOutQueriesList) && fanOutQueriesList.length > 0) {
        fanOutQueriesList.forEach(queryArray => {
          const query = queryArray[0];
          if (query && query.length > 2) {
            queries.push({ q: query });
          }
        });
      } else {
        return extractQueriesFromGeminiResponseFallback(responseText);
      }
      
    } catch (error) {
      return extractQueriesFromGeminiResponseFallback(responseText);
    }
    
    return queries.length > 0 ? queries : null;
  }

  // Fallback parsing method
  function extractQueriesFromGeminiResponseFallback(responseText) {
    const queries = [];
    
    try {
      // Look for the original search query pattern: [["query text"],1,null,0,"id",0]
      const searchQueryPattern = /\[\[\"([^"]+)\"\],1,null,0,\"[^"]+\",0\]/g;
      let match;
      
      while ((match = searchQueryPattern.exec(responseText)) !== null) {
        const query = match[1];
        if (query && query.length > 2) {
          queries.push({ q: query });
        }
      }
      
      // Also look for suggested related queries at the end
      const relatedQueriesPattern = /\[\"([^"]+)\",\d+\]/g;
      const seen = new Set(queries.map(q => q.q.toLowerCase()));
      
      while ((match = relatedQueriesPattern.exec(responseText)) !== null) {
        const query = match[1];
        if (query && query.length > 5 && query.includes(' ') && !seen.has(query.toLowerCase())) {
          queries.push({ q: query });
          seen.add(query.toLowerCase());
        }
      }
      
    } catch (error) {
      console.error('Error in fallback parsing:', error);
    }
    
    return queries.length > 0 ? queries : null;
  }

  // Override fetch to intercept Gemini API calls
  window.fetch = async function(...args) {
    const url = args[0];
    // Handle both string URLs and Request objects
    let urlString = '';
    if (typeof url === 'string') {
      urlString = url;
    } else if (url && typeof url === 'object') {
      // Could be a Request object or URL object
      urlString = url.url || url.href || url.toString() || '';
    }
    
    // Check for Gemini batchexecute requests - use broader pattern matching
    // Also intercept any requests to gemini.google.com that might contain query data
    const isGeminiRequest = urlString && (
      urlString.includes('/_/BardChatUi/data/batchexecute') || 
      urlString.includes('rpcids=hNvQHb') ||
      urlString.includes('batchexecute') ||
      urlString.includes('/data/batchexecute') ||
      (urlString.includes('gemini.google.com') && (
        urlString.includes('batchexecute') ||
        urlString.includes('/_/BardChatUi/') ||
        urlString.includes('/data/')
      ))
    );
    
    if (isGeminiRequest) {
      const response = await originalFetch.apply(this, args);
      
      // Clone the response so we can read it without consuming it
      const responseClone = response.clone();
      
      try {
        const responseText = await responseClone.text();
        
        // Process the response in the background - increase delay for new queries
        // New queries might take longer to fully populate the response
        setTimeout(() => {
          processGeminiResponse(responseText);
        }, 500);
      } catch (error) {
        // Ignore errors
      }
      
      return response;
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Override XMLHttpRequest to intercept Gemini API calls
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._url = url;
    // Use broader pattern matching for Gemini requests
    if (typeof url === 'string' && (
      url.includes('/_/BardChatUi/data/batchexecute') || 
      url.includes('rpcids=hNvQHb') ||
      url.includes('batchexecute') ||
      url.includes('/data/batchexecute') ||
      (url.includes('gemini.google.com') && url.includes('batchexecute'))
    )) {
      this._isGeminiBatch = true;
    }
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._isGeminiBatch) {
      // Set up response handler
      const originalOnReadyStateChange = this.onreadystatechange;
      this.onreadystatechange = function() {
        if (this.readyState === 4 && this.status === 200) {
          try {
            const responseText = this.responseText;
            // Increase delay for new queries - they might take longer to fully populate
            setTimeout(() => {
              processGeminiResponse(responseText);
            }, 500);
          } catch (error) {
            // Ignore errors
          }
        }
        
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.apply(this, arguments);
        }
      };
    }
    
    return originalXHRSend.apply(this, args);
  };

  // Also intercept using addEventListener approach
  XMLHttpRequest.prototype.addEventListener = function(type, listener, ...args) {
    if ((type === 'load' || type === 'readystatechange') && this._isGeminiBatch) {
      const originalListener = listener;
      const wrappedListener = function(event) {
        if (this.readyState === 4 && this.status === 200) {
          try {
            const responseText = this.responseText;
            // Increase delay for new queries
            setTimeout(() => {
              processGeminiResponse(responseText);
            }, 500);
          } catch (error) {
            // Ignore errors
          }
        }
        
        if (originalListener) {
          originalListener.apply(this, arguments);
        }
      };
      
      return originalAddEventListener.call(this, type, wrappedListener, ...args);
    }
    
    return originalAddEventListener.call(this, type, listener, ...args);
  };
})();

