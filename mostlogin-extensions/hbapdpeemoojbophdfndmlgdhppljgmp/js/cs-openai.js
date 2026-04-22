var Tool = (function(){

  var source = 'openai';

  var rootSel = '.header__search';
  var observer;
  var suggestionsTimer;
  var suggestionsList = {};
  var cachedSuggestions = {};
  var darkMode = false;
  var limit3_5 = 24500;
  var fanOutWidget = null;
  var fanOutQueries = [];
  var isMonitoring = false;
  var isCheckingQueries = false; // Prevent concurrent executions


  var init = function(){
    chrome.runtime.sendMessage({cmd: 'api.getConfig'}, function(json){
      if (!json.error && json.data && json.data.openai) {
        limit3_5 = json.data.openai.limit3_5;
      }
      setTimeout(function(){
        checkPendingRequests();
      }, 1000);
    });
    addWidgetButton();
    setInterval(function(){
      addWidgetButton();
    }, 3000);
    initMutationObserver(document.body);
    initWindowMessaging();
    initFanOutQueriesMonitoring();
    var settings = Starter.getSettings();
    if (settings.showChatGPTactions) {
      addPersuasions();
    }
    // processPage();
    initURLChangeListener(function(url){
      clearFanOutQueries();
    });
    
    // Add window resize listener for widget overlap detection - only for initial state
    window.addEventListener('resize', function() {
      if (fanOutWidget && !fanOutWidget.dataset.userControlled) {
        setTimeout(() => {
          if (checkWidgetOverlap()) {
            toggleWidgetCollapse();
          }
        }, 100);
      }
    });
    
    // Periodically check for widget overlap (every 5 seconds) - only for initial state
    setInterval(function() {
      if (fanOutWidget && !fanOutWidget.classList.contains('xt-widget-collapsed') && !fanOutWidget.dataset.userControlled) {
        if (checkWidgetOverlap()) {
          fanOutWidget.classList.add('xt-widget-collapsed');
        }
      }
    }, 5000);
  };


  var checkPendingRequests = function(){
    let limit = limit3_5;
    chrome.runtime.sendMessage({
      cmd: 'yt.transcript.summarize.get'
    }, async function(data){
      if (!data) return;
      let points = data.text.length > 2000 ? 10 : 5;
      let prompt = `Summarize the transcript of a YouTube video in ${points} bullet points. The video is by ${data.channelName} and is titled ${data.title}. The entire transcript is given below.\n` + data.text;
      // let version = await waitVersion();
      await waitInput();
      // if (version === '4') limit = 256000;
      prompt = prompt.substr(0, limit);
      chooseTemplate({
        prompt: prompt
      });
    });
    chrome.runtime.sendMessage({
      cmd: 'prompt_pending.get'
    }, function(prompt){
      console.log(prompt);
      if (!prompt) return;
      prompt = prompt.substr(0, limit);
      chooseTemplate({
        prompt: prompt
      });
    });
  };


  var initMutationObserver = function( target ){
    if (observer) observer.disconnect();
    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          if (!mutation.addedNodes.length) return;
          for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
            var node = mutation.addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE && node.querySelector('nav')) {
              addWidgetButton();
            }
            if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('h-full')) {
              addWidgetButton();
            }
            if (node.nodeType === Node.ELEMENT_NODE && node.dataset.testid === 'profile-button') {
              addWidgetButton();
            }
          }
        }
      });
    });
    var config = { subtree: true, childList: true};
    observer.observe(target, config);
  };


  var initWindowMessaging = function(){
    // console.log('initWindowMessaging');
    window.addEventListener("message", function(event){
      var payload = event.data;
      if (typeof payload !== 'object') return;
      var cmd = payload.cmd;
      var data = payload.data;
      if (!cmd) return;
      if (cmd === 'xt.resize') {
        var height = data.height;
        var source = data.source;
        var selector = '#xt-openai-widget';
        if (source === 'chatgpt_sidebar') selector = '#xt-chatgpt-sidebar-iframe';
        if (!selector) return;
        if (height <= 0) return;
        $(selector + ' iframe').height(height + 10);
      }
      else if (cmd === 'xt-openai-choose-template') {
        chooseTemplate(data);
      }
      else if (cmd === 'xt-openai-get-settings') {
        OpenaiWidgetController.post('settings', {
          plan: Common.getPlan(),
          credits: Common.getCredits(),
          settings: Starter.getSettings()
        });
      }
    }, false);
  };


  var chooseTemplate = function(data){
    const $form = $('main form');
    if ($form[0]) {
      let $textarea = $form.find('textarea');
      if ($textarea[0] && $textarea.is(':visible')) {
        $textarea[0].value = data.prompt.replace(/\n/g, '\r\n');
        $textarea[0].dispatchEvent(new Event('input', {bubbles: true}));
      }
      else {
        var html = data.prompt;
        html = html.replace(/\n/g, '</p><p>');
        var $prompt = $form.find('#prompt-textarea');
        // $prompt.html('<p>' + html + '</p>');
        // $prompt.html(html);
        $prompt[0].innerHTML = html;
        $prompt[0].dispatchEvent(new Event('input', {bubbles: true}));
      }
      setTimeout(function(){
        let $button = $form.find('button');
        if ($button.length >= 2 && $form.find('[data-testid="send-button"]')[0]) {
          $button = $form.find('[data-testid="send-button"]');
        }
        else if ($button.length === 3) {
          $button = $($button[2]);
        }
        else if ($button.length === 2) {
          $button = $($button[1]);
        }
        $button.removeAttr('disabled').click();
      }, 100);
      setTimeout(function(){
        $form.find('[data-testid="send-button"]').click();
      }, 500);
      setTimeout(function(){
        Array.from(document.querySelectorAll('main button svg path')).map(item => {
          const d = item.getAttribute('d');
          if (d.startsWith("M15.1918 8.90615C15.6381")) {
            item.parentNode.parentNode.click();
          }
        })
      }, 4000);
    }
  };


  var waitSidebarReady = function(){
    return new Promise(resolve => {
      let attempt = 10;
      let timer = setInterval(() => {
        if (attempt-- <= 0) {
          clearInterval(timer);
          resolve();
        }
        let sidebar = document.querySelector('nav > .flex-col');
        if (sidebar) {
          resolve(sidebar);
          clearInterval(timer);
        }
      }, 500);
    });
  };


  var waitInput = function(){
    if ($('main form textarea, #prompt-textarea')[0]) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      let attempt = 20;
      let timer = setInterval(() => {
        if (attempt-- <= 0) {
          clearInterval(timer);
          resolve();
        }
        if ($('main form textarea, #prompt-textarea')[0]) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  };


  var waitVersion = function(){
    return new Promise(resolve => {
      let attempt = 20;
      let timer = setInterval(() => {
        if (attempt-- <= 0) {
          clearInterval(timer);
          resolve();
        }
        let version3_5 = $('div[type=button]').text().match(/ChatGPT 3\.5/);
        let version4 = $('div[type=button]').text().match(/ChatGPT 4/);
        if (version3_5 || version4) {
          if (version3_5) resolve('3.5');
          else if (version4) resolve('4');
          clearInterval(timer);
        }
      }, 500);
    });
  };


  var menuItemTemplate = function(darkmode, sec){
    var className = 'xt-openai-templates-btn';
    if (sec) className = 'xt-openai-templates-btn-sec';
    if (!darkmode) LOGO_SVG = LOGO_SVG.replace(/#fff/g, '#000');
    if (sec) {
      return `<a target="_blank" class="${className} flex py-3 px-3 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 ${ darkmode ? 'text-white' : ''} cursor-pointer text-sm">${LOGO_SVG}Templates</a>`;
    }
    return `
      <a tabindex="0" data-fill="" class="${className} group __menu-item hoverable gap-1.5"><div class="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon ${ darkmode ? 'text-white' : ''}">${LOGO_SVG}</div><div class="flex min-w-0 grow items-center gap-2.5"><div class="truncate">Templates</div></div></a>
    `;
  };


  var addWidgetButton = function() {
    darkMode = isDarkMode();
    let $modeButton = $( $('nav > aside')[0] );
    let $logoMenu = $( $('main [aria-haspopup="menu"]')[0] );
    let $loginBtn = $( $('main [data-testid="login-button"]')[0] );
    let $profileBtn = $( $('main [data-testid="profile-button"]')[0] );
    let $btn;
    let $secBtn;
    if (!$('.xt-openai-templates-btn')[0] && $modeButton[0]) {
      $btn = $(menuItemTemplate(darkMode)).appendTo($modeButton);
      $btn.click(function(e) {
        toggleWidget();
      });
      addSidebarIframe($btn, $modeButton);
    } else if ($modeButton[0]) {
      addSidebarIframe(null, $modeButton);
    }
    if (!$('.xt-openai-templates-btn-sec')[0]) {
      // if ($logoMenu[0]) $secBtn = $(menuItemTemplate(darkMode)).insertAfter($logoMenu);
      if ($loginBtn[0]) $secBtn = $(menuItemTemplate(darkMode, true)).insertBefore($loginBtn);
      else if ($profileBtn[0]) $secBtn = $(menuItemTemplate(darkMode, true)).insertBefore($profileBtn);
      var pageHeader = document.querySelector('header#page-header');
      if (pageHeader && !pageHeader.querySelector('.xt-openai-templates-btn-sec')) {
        // Find the rightmost .flex.items-center (actions container)
        var actionsContainers = pageHeader.querySelectorAll(':scope > .flex.items-center');
        var actionsContainer = actionsContainers[actionsContainers.length - 1];
        if (actionsContainer) {
          $secBtn = $(menuItemTemplate(darkMode, true)).appendTo(actionsContainer);
        }
      }
      if ($secBtn) {
        $secBtn.click(function(e) {
          toggleWidget();
        });
      }
    }
    $('nav > a').map((i, node) => {
      if (node.textContent.match(/(Light|Dark) mode/)) {
        $(node).click(function(e){
          OpenaiWidgetController.post('darkmode', !isDarkMode());
        });
      }
    });
  };


  var addSidebarIframe = function($btn, $modeButton){
    if ($('#xt-chatgpt-sidebar-iframe')[0]) return;
    var html = Common.renderIframeHTML({
      query: '',
      settingEnabled: true,
      darkMode: darkMode,
      iframeSrcParam: 'chatgpt_sidebar'
    });
    var $root = $('<div>', {id: 'xt-chatgpt-sidebar-iframe'}).html(html);
    var nav = document.querySelector('nav');
    var firstAside = nav ? nav.querySelector('aside') : null;
    if (firstAside && firstAside.parentNode) {
      firstAside.parentNode.insertBefore($root[0], firstAside);
      return;
    }
    if ($btn && $btn[0]) {
      $root.insertAfter($btn);
    } else if ($modeButton && $modeButton[0]) {
      $root.appendTo($modeButton);
    }
  };


  var addPersuasions = function(){
    chrome.runtime.sendMessage({
      cmd: 'api.openAIfetchPersuasions',
      data: ''
    }, function(response){
      if (typeof response !== 'object') return;
      let $div = $('<div>');
      let isEmpty = Object.keys(response).length === 0;
      if (isEmpty) {
        $('.xt-buttons-container').remove();
        return;
      }
      for (const key in response) {
        const value = response[key];
        $div.append(`<a data-prompt="${value}">${key}</a>`);
      }
      $div.append('<a data-templates="true">View Templates</a>')
      $div.append('<a data-fan="true">Fan-out Queries</a>')
      $('.xt-icon').append($div).find('a').click(function(){
        const prompt = this.dataset.prompt;
        if (prompt) chooseTemplate({prompt: prompt});
        else if (this.dataset.templates) {
          toggleWidget();
        }
        else if (this.dataset.fan) {
          showFanOutQueriesWidgetManually();
        }
      });
    });
  };


  var isDarkMode = function() {
    return document.documentElement.classList.contains('dark');
  };


  var toggleWidget = function(){
    OpenaiWidgetController.toggle({
      darkMode: darkMode,
      source: source
    });
  };


  var initURLChangeListener = function( cbProcessPage ){
    var url = document.location.href;
    var timer = setInterval(function(){
      if ( url !== document.location.href ) {
        url = document.location.href;
        cbProcessPage( url );
      }
    }, 1000);
  };


  var getSource = function(){
    return source;
  };


  function initFanOutQueriesMonitoring() {
    var settings = Starter.getSettings();
    if (!settings.sourceList.gptfan) return;
    if (isMonitoring) return;
    isMonitoring = true;

    let writingTimeout;

    // Monitor DOM changes specifically in the main chat area
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Only process mutations that are in the chat area
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          // Check if the mutation is within the main chat area
          let isInChatArea = false;
          
          if (mutation.target.nodeType === Node.TEXT_NODE) {
            // For text mutations, check if parent is in chat area
            let parent = mutation.target.parentElement;
            while (parent && parent !== document.body) {
              if (parent.querySelector('[data-message-author-role="assistant"]') || 
                  parent.closest('[data-message-author-role="assistant"]')) {
                isInChatArea = true;
                break;
              }
              parent = parent.parentElement;
            }
          } else if (mutation.target.nodeType === Node.ELEMENT_NODE) {
            // For element mutations, check if target is in chat area
            if (mutation.target.querySelector('[data-message-author-role="assistant"]') || 
                mutation.target.closest('[data-message-author-role="assistant"]')) {
              isInChatArea = true;
            }
          }

          if (isInChatArea) {
            // Clear existing timeout and start a new one
            if (writingTimeout) {
              clearTimeout(writingTimeout);
            }
            
            writingTimeout = setTimeout(() => {
              checkForFanOutQueriesInConversation();
            }, 1500);
          }
        }
      });
    });

    // Start observing the main chat area
    const mainElement = document.querySelector('main') || document.body;
    observer.observe(mainElement, {
      childList: true,
      characterData: true,
      subtree: true
    });

    // Initial check for existing queries
    setTimeout(() => {
      checkForFanOutQueriesInConversation();
    }, 1000);
  }

  async function checkForFanOutQueriesInConversation() {
      // Prevent concurrent executions
      if (isCheckingQueries) {
          console.log('Already checking queries, skipping...');
          return;
      }
      
      isCheckingQueries = true;
      try {
          // Get conversation ID from URL
          const cid = location.pathname.match(/\/c\/([^\/]+)/)?.[1];
          if (!cid) {
              console.log("No conversation ID found in URL");
              return;
          }
          console.log("Checking conversation:", cid);

          // Get session token
          const sessionResponse = await fetch("/api/auth/session");
          if (!sessionResponse.ok) {
              console.log("Failed to get session");
              return;
          }

          const session = await sessionResponse.json();
          if (!session.accessToken) {
              console.log("No access token in session");
              return;
          }
          // Fetch conversation data
          const response = await fetch(`/backend-api/conversation/${cid}`, {
              headers: {
                  "Authorization": `Bearer ${session.accessToken}`,
                  "Content-Type": "application/json"
              }
          });

          if (!response.ok) {
              console.log("Failed to fetch conversation:", response.status);
              return;
          }

          const data = await response.json();
          // console.log("Fetched conversation data:", data);

          // Extract queries using the bookmarklet's logic
          const queries = [];
          const extractQueries = (obj) => {
              if (typeof obj !== "object" || !obj) return;
              // Check for search_queries arrays
              if (Array.isArray(obj.search_queries)) {
                  obj.search_queries.forEach(sq => {
                      if (sq.q) {
                          queries.push({ q: sq.q });
                      }
                  });
              }
              // Check for metadata.search_queries
              if (obj.metadata && Array.isArray(obj.metadata.search_queries)) {
                  obj.metadata.search_queries.forEach(sq => {
                      if (sq.q) {
                          queries.push({ q: sq.q });
                      }
                  });
              }
              // Recursively check other properties
              for (const key in obj) {
                  if (key !== "search_queries" && key !== "metadata") {
                      extractQueries(obj[key]);
                  }
              }
          };

          extractQueries(data);
          // console.log("Extracted queries:", queries);

          // Update queries if new ones found
          if (queries.length > 0) {
              let hasNewQueries = false;
              queries.forEach(newQuery => {
                  if (!fanOutQueries.some(existing => existing.q === newQuery.q)) {
                      fanOutQueries.push(newQuery);
                      hasNewQueries = true;
                  }
              });

              if (hasNewQueries) {
                  // console.log("New queries found, showing widget");
                  showFanOutQueriesWidget();
              }
          } else {
              // console.log("No queries found in conversation data");
          }
      } catch (error) {
          console.error("Error checking for fan-out queries:", error);
      } finally {
          isCheckingQueries = false;
      }
  }

  function checkForFanOutQueriesInResponse() {
      // This function is now deprecated in favor of checkForFanOutQueriesInConversation
      // Keep for backward compatibility but redirect to the new method
      checkForFanOutQueriesInConversation();
  }

  var refreshFanOutQueriesWidget = function() {
    if (!fanOutWidget || fanOutQueries.length === 0) return;
    
    // Update the content
    const content = fanOutWidget.querySelector('.xt-widget-content');
    if (content) {
      content.innerHTML = '';
      fanOutQueries.forEach((query, index) => {
        const queryDiv = document.createElement('div');
        queryDiv.className = 'xt-query-item';
        
        const queryText = document.createElement('div');
        queryText.className = 'xt-query-text';
        queryText.textContent = query.q;
        
        queryDiv.appendChild(queryText);
        content.appendChild(queryDiv);
      });
    }
  };

  var showFanOutQueriesWidget = function() {
    if (fanOutQueries.length === 0) return;
    
    if (fanOutWidget) {
      fanOutWidget.remove();
    }
    
    createFanOutQueriesWidget();
  };

  var createFanOutQueriesWidget = function(manual) {
    fanOutWidget = document.createElement('div');
    fanOutWidget.id = 'xt-fan-out-queries-widget';
    fanOutWidget.className = 'xt-widget-table';

    const content = document.createElement('div');
    content.id = 'xt-widget-content';
    document.body.appendChild(fanOutWidget);
    
    console.log('Widget created, checking overlap in 1 second...');
    
    // Wait for the widget to be fully rendered before checking overlap
    setTimeout(() => {
      const shouldCollapse = checkWidgetOverlap();
      console.log('Overlap check result:', shouldCollapse);
      
      if (shouldCollapse) {
        toggleWidgetCollapse();
        console.log('Widget collapsed due to overlap');
        // Mark as automatically collapsed (not user controlled)
        fanOutWidget.dataset.userControlled = 'false';
      } else {
        console.log('Widget not collapsed - no overlap detected');
      }
    }, 1000); // Give enough time for Common.renderWidgetTable to complete
    
    const rows = [];
    const keywords = {};

    fanOutQueries.forEach((query, index) => {
      keywords[query.q] = true;
    });

    var settings = Starter.getSettings();
    var hasCredits = Common.getCredits() > 0;
    if ( (!settings.sourceList.gptfow && !manual) || !settings.apiKey || !hasCredits) {
      for (var keyword in keywords) {
        rows.push({keyword: keyword});
      }
      renderWidgetTable(rows, null);
      return;
    }
    Common.processKeywords({
      keywords: Object.keys(keywords),
      tableNode: null,
      src: source,
      from: 'fanout',
      noCheckCredits: true
    }, function(json){
      if (json.error_code === 'NOCREDITS' || json.error_code === 'INVALIDAPI') {
        for (var keyword in keywords) {
          rows.push({keyword: keyword});
        }
        renderWidgetTable(rows, null, 'nocredits');
      }
      else {
        processFanOutQueriesResponse(json, keywords, rows);
      }
    });
  };


  var processFanOutQueriesResponse = function(json, keywords, rows){
    if (typeof json.data !== 'object') return;
    for (var key in json.data) {
      var item = json.data[key];
      rows.push(item);
    }
    rows.sort(function(a,b){
      var aVol = parseInt(a.vol.replace(/[,.\s]/g, ''));
      var bVol = parseInt(b.vol.replace(/[,.\s]/g, ''));
      return bVol - aVol;
    });
    renderWidgetTable(rows, json);
  };


  var renderWidgetTable = function(rows, json, nocredits){
    var source = 'gptfow';
    var title = `Fan-out Queries (${rows.length})`;
    var rootSelector = 'xt-fan-out-queries-widget';
    var iframeSrcParam = 'chatgptfanout';
    var excludeCols = ['cpc', 'comp', 'trend'];
    var settings = Starter.getSettings();
    
    // Generate filename with date-time
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var hours = String(now.getHours()).padStart(2, '0');
    var minutes = String(now.getMinutes()).padStart(2, '0');
    var seconds = String(now.getSeconds()).padStart(2, '0');
    var dateTime = `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
    var filename = `chatgpt-fanout-queries-${dateTime}`;
    
    var params = {
      settingEnabled: settings.sourceList[source],
      source: source,
      darkMode: darkMode,
      title: title,
      json: json,
      columnName: 'Keyword',
      excludeCols: excludeCols,
      rootSelector: rootSelector,
      addTo: 'xt-fan-out-queries-widget',
      addMethod: 'appendTo',
      iframeSrcParam: iframeSrcParam,
      filename: filename,
      keywordsPerPage: 10,
      dragInit: function($root){
        makeDraggable(fanOutWidget, fanOutWidget.querySelector('h3'));
        
        // Always add expand/collapse button after the title
        const titleElement = fanOutWidget.querySelector('h3');
        if (titleElement) {
          // Create the button
          const expandButton = document.createElement('button');
          expandButton.className = 'xt-expand-button xt-ke-btn';
          
          // Set icon based on widget state
          if (fanOutWidget.classList.contains('xt-widget-collapsed')) {
            expandButton.textContent = 'Expand';
            expandButton.innerHTML = EXPAND_SVG_HTML + 'Expand';
          } else {
            expandButton.textContent = 'Collapse';
            expandButton.innerHTML = COLLAPSE_SVG_HTML + 'Collapse';
          }
          
          // Add click handler
          expandButton.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            toggleWidgetCollapse(true);
          });
          
          // Insert button inside the title element, after the text
          titleElement.appendChild(expandButton);
        }
      },
      onClosed: function(){},
      loadAll: function(){
        var $this = $(this);
        var $parent = $this.closest('.xt-widget-table');
        if (nocredits || !settings.apiKey) {
          chrome.runtime.sendMessage({
            cmd: 'new_tab',
            data: 'https://keywordseverywhere.com/ctl/subscriptions'
          });
          return;
        }
        $this.remove();
        $parent.remove();
        createFanOutQueriesWidget('manual');
      }
    };
    Common.renderWidgetTable(rows, params);
  };


  var makeDraggable = function(element, handle) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    // Set title to indicate dragging functionality only
    if (handle) {
      handle.style.cursor = 'move';
      handle.title = 'Drag to move widget';
    }
    
    handle.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
      // Only allow left mouse button (button 0) for dragging
      if (e.button !== 0) return;
      
      console.log(handle);
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === handle) {
        isDragging = true;
      }
    }
    
    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        xOffset = currentX;
        yOffset = currentY;
        
        setTranslate(currentX, currentY, element);
      }
    }
    
    function setTranslate(xPos, yPos, el) {
      el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
    
    function dragEnd() {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    }
  };

  var checkWidgetOverlap = function() {
    if (!fanOutWidget) return false;
    
    const widget = fanOutWidget;
    const widgetRect = widget.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    
    // Check if widget extends beyond screen boundaries
    if (widgetRect.right > screenWidth) {
      console.log('Widget extends beyond screen width');
      return true;
    }
    
    // Find the main content area and assistant message column
    const mainContent = document.querySelector('main');
    if (!mainContent) {
      console.log('Main content not found');
      return false;
    }
    
    const mainRect = mainContent.getBoundingClientRect();
    
    // Find the rightmost edge of the text column (assistant messages)
    let textColumnRightEdge = 0;
    const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    
    if (assistantMessages.length > 0) {
      // Find the rightmost edge of all assistant messages
      assistantMessages.forEach(message => {
        const messageRect = message.getBoundingClientRect();
        if (messageRect.right > textColumnRightEdge) {
          textColumnRightEdge = messageRect.right;
        }
      });
    } else {
      // Fallback to main content right edge if no assistant messages found
      textColumnRightEdge = mainRect.right;
    }
    
    console.log('Text column right edge:', textColumnRightEdge);
    console.log('Widget left edge:', widgetRect.left);
    console.log('Screen width:', screenWidth);
    
    // Calculate available space on the right
    const availableSpaceRight = screenWidth - textColumnRightEdge;
    const widgetWidth = widgetRect.width;
    
    console.log('Available space on right:', availableSpaceRight);
    console.log('Widget width:', widgetWidth);
    
    // Check if widget fits in available space on the right
    if (widgetWidth > availableSpaceRight) {
      console.log('Widget too wide for available space on right');
      return true;
    }
    
    // Check if widget overlaps with the text column
    if (widgetRect.left < textColumnRightEdge) {
      console.log('Widget overlaps with text column');
      return true;
    }
    
    // Check if there's enough buffer space (at least 20px)
    const bufferSpace = 20;
    if (availableSpaceRight < (widgetWidth + bufferSpace)) {
      console.log('Not enough buffer space on right');
      return true;
    }
    
    console.log('Widget fits properly on the right side');
    return false;
  };

  var toggleWidgetCollapse = function() {
    if (!fanOutWidget) return;
    
    const isCollapsed = fanOutWidget.classList.contains('xt-widget-collapsed');
    const expandButton = fanOutWidget.querySelector('.xt-expand-button');
    
    if (isCollapsed) {
      // Expand widget
      fanOutWidget.classList.remove('xt-widget-collapsed');
      fanOutWidget.dataset.userControlled = 'true';
      if (expandButton) {
        // Update only the text content, not the entire button content
        const textNode = expandButton.childNodes[1]; // Text node comes after the SVG icon
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          textNode.textContent = 'Collapse';
        }
        // Update icon to up arrow for collapse
        const svgIcon = expandButton.querySelector('svg');
        if (svgIcon) {
          expandButton.innerHTML = COLLAPSE_SVG_HTML + 'Collapse';
        }
      }
    } else {
      // Collapse widget
      fanOutWidget.classList.add('xt-widget-collapsed');
      fanOutWidget.dataset.userControlled = 'true';
      if (expandButton) {
        // Update only the text content, not the entire button content
        const textNode = expandButton.childNodes[1]; // Text node comes after the SVG icon
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          textNode.textContent = 'Expand';
        }
        // Update icon to down arrow for expand
        const svgIcon = expandButton.querySelector('svg');
        if (svgIcon) {
          expandButton.innerHTML = EXPAND_SVG_HTML + 'Expand';
        }
      }
    }
  };

  var clearFanOutQueries = function() {
    fanOutQueries = [];
    if (fanOutWidget) {
      fanOutWidget.remove();
      fanOutWidget = null;
    }
    
    // Reset monitoring state and re-initialize after a delay
    isMonitoring = false;
    setTimeout(() => {
      initFanOutQueriesMonitoring();
    }, 500);
  };

  var showFanOutQueriesWidgetManually = async function() {
    // Use the direct conversation fetching approach and wait for it to complete
    await checkForFanOutQueriesInConversation();
    
    // Now check if queries were found after the async operation completes
    if (fanOutQueries.length === 0) {
        alert("No fan-out queries found in this conversation.");
        return;
    }
    
    showFanOutQueriesWidget();
  };


  var isChatGPTPage = function() {
    return window.location.hostname === 'chat.openai.com' || 
           window.location.hostname === 'chatgpt.com' ||
           window.location.href.includes('chat.openai.com') ||
           window.location.href.includes('chatgpt.com');
  };

  let LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 262.77 262.77"><g id="Layer_2" data-name="Layer 2"><g id="Layer_1-2" data-name="Layer 1"><g><circle cx="131.38" cy="131.38" r="126.38" style="fill: none;stroke: #fff;stroke-miterlimit: 10;stroke-width: 10px"/><path d="M109.38,106.42c7.54-9,14-17.2,20.94-25,7.63-8.58,15.73-16.73,23.48-25.2,4.32-4.72,9.2-5.71,14.78-2.85,5.07,2.59,10,5.43,14.34,7.81-12.71,12-24.57,23.42-36.64,34.59-4.92,4.56-5.87,9.38-3.45,15.63,11.36,29.37,23.23,58.47,41.41,84.49.95,1.35,2,2.62,3.47,4.5C180.2,206.74,172,210.94,162.14,211c-1.48,0-3.48-2-4.39-3.54-5-8.63-10.36-17.12-14.36-26.2-6.75-15.37-12.57-31.15-18.78-46.77-1-2.6-2-5.22-3.51-9.14-5.47,8.17-12.51,14.31-12.51,23.93,0,16.81.38,33.63.91,50.44.11,3.63-.92,5.56-4.32,6.67-6.73,2.18-13.44,3.46-20.58,2.12-2.79-.52-3.69-1.83-3.77-4.22-.12-3.32-.23-6.65-.16-10q.93-41.44,1.94-82.89c.08-3.33.33-6.65.56-10,.84-11.8-.41-23.09-6-33.86-3.1-5.92-2.59-6.68,3.77-8.25a151.63,151.63,0,0,1,22.45-4c6.93-.64,7.1-.1,7,6.71-.23,12.48-.62,25-.93,37.44C109.34,101.33,109.38,103.16,109.38,106.42Z" style="fill: #fff"/></g></g></g></svg>`;

  // SVG constants for expand/collapse buttons
  const EXPAND_SVG_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
  const COLLAPSE_SVG_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`;

  return {
    init: init,
    getSource: getSource
  };

})();
