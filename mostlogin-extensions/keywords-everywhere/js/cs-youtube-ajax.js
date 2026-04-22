(()=>{
  // Intercept fetch requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    const urlString = typeof url === 'string' ? url : (url?.url || '');
    // Check if this is a transcript-related request
    // YouTube uses /youtubei/v1/next with continuation tokens to load transcript panels
    const isTranscriptRequest = urlString.indexOf('/youtubei/v1/get_transcript') !== -1 || 
                                 urlString.indexOf('/youtubei/v1/next') !== -1 ||
                                 urlString.indexOf('/youtubei/v1/browse') !== -1;
    if (isTranscriptRequest) {
      return originalFetch.apply(this, args).then(response => {
        // Clone the response so we can read it without consuming it
        const clonedResponse = response.clone();
        
        // Read the response and intercept it
        clonedResponse.json().then(data => {
          // Check if this response contains transcript data
          const transcriptData = extractTranscriptFromResponse(data);
          if (transcriptData) {
            // Create a template element with the transcript data
            let node = document.createElement("template");
            node.setAttribute("data-type", "transcript");
            node.setAttribute("data-url", urlString);
            node.textContent = JSON.stringify(data);
            document.body.appendChild(node);
            
            // Dispatch a custom event for easier listening
            window.dispatchEvent(new CustomEvent('xt-youtube-transcript', {
              detail: { data: data, transcript: transcriptData }
            }));
          }
        }).catch(e => {
          // Not JSON or error reading, ignore
        });
        
        return response;
      });
    }
    
    return originalFetch.apply(this, args);
  };

  // Intercept XMLHttpRequest as backup
  let xhr = XMLHttpRequest.prototype;
  let send = xhr.send;
  xhr.send = function() {
    this.addEventListener("load", function() {
      let url = this.responseURL;
      
      // Check if this is a transcript-related request
      const isTranscriptRequest = url.indexOf('/youtubei/v1/get_transcript') !== -1 || 
                                   url.indexOf('/youtubei/v1/next') !== -1 ||
                                   url.indexOf('/youtubei/v1/browse') !== -1;
      
      if (isTranscriptRequest) {
        if (this.responseType === '' || this.responseType === 'text') {
          try {
            let response = this.responseText;
            var json = JSON.parse(response);
            
            // Check if this response contains transcript data
            const transcriptData = extractTranscriptFromResponse(json);
            if (transcriptData) {
              let node = document.createElement("template");
              node.setAttribute("data-type", "transcript");
              node.setAttribute("data-url", url);
              node.textContent = response;
              document.body.appendChild(node);
              
              // Dispatch a custom event
              window.dispatchEvent(new CustomEvent('xt-youtube-transcript', {
                detail: { data: json, transcript: transcriptData }
              }));
            }
          } catch (e) {
            // Not JSON or error parsing, ignore
          }
        }
      }
    });
    return send.apply(this, arguments);
  };

  // Helper function to extract transcript from response
  function extractTranscriptFromResponse(json) {
    try {
      // Check for transcript in various possible locations
      const segments = json?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments;
      
      if (segments && Array.isArray(segments) && segments.length > 0) {
        return segments;
      }
      
      // Alternative location
      const altSegments = json?.onResponseReceivedEndpoints?.[0]?.reloadContinuationItemsCommand?.continuationItems?.[0]?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments;
      
      if (altSegments && Array.isArray(altSegments) && altSegments.length > 0) {
        return altSegments;
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }
})();

