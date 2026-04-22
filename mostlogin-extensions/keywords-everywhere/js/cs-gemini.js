var Tool = (function(){

  var source = 'gemini';

  var rootSel = '.header__search';
  var observer;
  var suggestionsTimer;
  var suggestionsList = {};
  var cachedSuggestions = {};
  var darkMode = false;
  var fanOutWidget = null;
  var fanOutQueries = [];
  var isMonitoring = false;
  var isCheckingQueries = false; // Prevent concurrent executions

  var btnSelector = 'side-nav-action-button[data-test-id="settings-and-help-button"]';


  var init = async function(){
    setTimeout(checkPendingRequests, 1000);
    await headerReady();
    addWidgetButton();
    initBodyClassObserver();
    initMutationObserver(document.body);
    initWindowMessaging();
    initFanOutQueriesMonitoring();
    var settings = Starter.getSettings();
    if (settings.showChatGPTactions) {
      addPersuasions();
    }
    initURLChangeListener(function(url){
      clearFanOutQueries();
    });
  };


  var checkPendingRequests = function(){
    let limit = 31847;
    chrome.runtime.sendMessage({
      cmd: 'yt.transcript.summarize.get'
    }, function(data){
      if (!data) return;
      let points = data.text.length > 2000 ? 10 : 5;
      let prompt = `Summarize the transcript of a YouTube video in ${points} bullet points - ${data.videoUrl}`;
      prompt = prompt.substr(0, limit);
      chooseTemplate({
        prompt: prompt
      });
    });
    chrome.runtime.sendMessage({
      cmd: 'prompt_pending.get'
    }, function(prompt){
      if (!prompt) return;
      prompt = prompt.substr(0, limit);
      chooseTemplate({
        prompt: prompt
      });
    });
  };


  const headerReady = function(){
    return new Promise(resolve => {
      let attempt = 100;
      let timer = setInterval(() => {
        if (attempt-- <= 0) {
          clearInterval(timer);
          resolve();
        }
        let div = document.querySelector(btnSelector);
        if (div) {
          resolve(div);
          clearInterval(timer);
        }
      }, 600);
    });
  };


  var initBodyClassObserver = function(){
    const body = document.body;
    const onClassChange = (mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (mutation.target.className.indexOf('-theme') !== -1) {
            OpenaiWidgetController.post('darkmode', isDarkMode());
          }
        }
      }
    };
    const observer = new MutationObserver(onClassChange);
    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
  };


  var initMutationObserver = function( target ){
    if (observer) observer.disconnect();
    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          if (!mutation.addedNodes.length) return;
          for (var i = 0, len = mutation.addedNodes.length; i < len; i++) {
            var node = mutation.addedNodes[i];
            // console.log(node);
            if (node.nodeType === Node.ELEMENT_NODE && node.querySelector('nav')) {
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
        if (source === 'gemini_sidebar') selector = '#xt-gemini-sidebar-iframe';
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
    console.log(data);
    const $form = $('input-area-v2');
    if ($form[0]) {
      let $textarea = $form.find('.ql-editor.textarea p');
      if (!$textarea[0]) $textarea = $form.find('div[contenteditable=true]');
      $textarea[0].focus();
      $textarea.removeClass('placeholder');
      $textarea.html(data.prompt);
      const event = new Event('input', { bubbles: true });
      $textarea[0].dispatchEvent(new Event('change', { bubbles: true }));
      $textarea[0].dispatchEvent(new Event('keydown', { bubbles: true }));
      $textarea[0].dispatchEvent(new Event('keyup', { bubbles: true }));
      $textarea[0].dispatchEvent(event);
      $textarea.parent().addClass('ng-dirty').removeClass('ng-pristine');
      let $button = $form.find('button.send-button');
      setTimeout(function(){
        $button.click();
      }, 500);
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
        let sidebar = document.querySelector('side-nav-action-button[mattooltip="Help"]');
        if (sidebar) {
          resolve(sidebar);
          clearInterval(timer);
        }
      }, 500);
    });
  };


  var menuItemTemplate = function(darkmode){
    if (!darkmode) LOGO_SVG = LOGO_SVG.replace(/#fff/g, '#000');
    return `
      <side-nav-action-button icon="help" data-test-id="desktop-support-control" mattooltip="Templates" mattooltipposition="right" class="xt-gemini-btn mat-mdc-tooltip-trigger mat-mdc-menu-trigger" aria-haspopup="menu" aria-expanded="false"><button mat-list-item="" class="mat-mdc-list-item mdc-list-item side-nav-action-button explicit-gmat-override mat-mdc-list-item-interactive mdc-list-item--with-leading-icon mat-mdc-list-item-single-line mdc-list-item--with-one-line ng-star-inserted" type="button" aria-label="Templates" aria-disabled="false" style=""><mat-icon role="img" data-test-id="side-nav-action-button-icon" matlistitemicon="" class="mat-icon notranslate mat-mdc-list-item-icon google-symbols mat-icon-no-color mdc-list-item__start" aria-hidden="true" data-mat-icon-type="font">${LOGO_SVG}</mat-icon><span class="mdc-list-item__content"><span class="mat-mdc-list-item-unscoped-content mdc-list-item__primary-text"><span data-test-id="side-nav-action-button-content" class="gmat-subtitle-2"> Templates </span></span></span><div class="mat-mdc-focus-indicator"></div></button></side-nav-action-button>
    `;
  };


  var btnSecTemplate = function(darkmode){
    return `
      <button style="margin-top: 6px" mat-flat-button="" role="link" aria-describedby="describe-links-opening-new-window" class="mdc-button mat-mdc-button-base gds-upsell-button ng-tns-c3681016587-11 mdc-button--unelevated mat-mdc-unelevated-button mat-unthemed _mat-animation-noopable" mat-ripple-loader-class-name="mat-mdc-button-ripple"><span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span><mat-icon role="img" data-test-id="side-nav-action-button-icon" matlistitemicon="" class="mat-icon notranslate mat-mdc-list-item-icon google-symbols mat-icon-no-color mdc-list-item__start" aria-hidden="true" data-mat-icon-type="font">${LOGO_SVG}</mat-icon><span class="mdc-button__label"><span class="upsell-label gds-label-m ng-tns-c3681016587-11 ng-trigger ng-trigger-labelEnterLeaveAnimation ng-star-inserted"> Templates </span><!----></span><span class="mat-focus-indicator"></span><span class="mat-mdc-button-touch-target"></span><span class="mat-ripple mat-mdc-button-ripple"></span></button>
    `;
  };

  var refreshButtonTemplate = function(darkmode){
    return `
      <button style="margin-top: 6px; margin-left: 8px;" mat-flat-button="" role="link" aria-describedby="describe-links-opening-new-window" class="mdc-button mat-mdc-button-base gds-upsell-button ng-tns-c3681016587-11 mdc-button--unelevated mat-mdc-unelevated-button mat-unthemed _mat-animation-noopable xt-gemini-refresh-btn-sec" mat-ripple-loader-class-name="mat-mdc-button-ripple"><span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span><span class="mdc-button__label"><span class="upsell-label gds-label-m ng-tns-c3681016587-11 ng-trigger ng-trigger-labelEnterLeaveAnimation ng-star-inserted" style="font-size: 12px; white-space: nowrap;"> Load Fan-out Queries </span><!----></span><span class="mat-focus-indicator"></span><span class="mat-mdc-button-touch-target"></span><span class="mat-ripple mat-mdc-button-ripple"></span></button>
    `;
  };

  var addWidgetButton = function() {
    if (!$('.xt-gemini-btn')[0]) {
      darkMode = isDarkMode();
      let $modeButton = $( $('side-nav-action-button[data-test-id="settings-and-help-button"]')[0] );
      console.log($modeButton);
      let $btn = $(menuItemTemplate(darkMode)).insertBefore($modeButton);
      $btn.click(function(e) {
        toggleWidget();
      });
      addSidebarIframe($btn);
    }
    if (!$('.xt-gemini-btn-sec')[0]) {
      darkMode = isDarkMode();
      let $topbar = $('top-bar-actions');
      let $btn = $(btnSecTemplate(darkMode)).appendTo($topbar);
      $btn.click(function(e) {
        toggleWidget();
      });
      
      // Add refresh button next to Templates button (initially hidden)
      let $refreshBtn = $(refreshButtonTemplate(darkMode)).appendTo($topbar);
      $refreshBtn.hide(); // Start hidden
      $refreshBtn.click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        // Refresh the page
        window.location.reload();
      });
    }
  };


  var addSidebarIframe = function($templatesBtn){
    if ($('#xt-gemini-sidebar-iframe')[0]) return;
    if (!$templatesBtn || !$templatesBtn[0]) return;
    var html = Common.renderIframeHTML({
      query: '',
      settingEnabled: true,
      darkMode: darkMode,
      iframeSrcParam: 'gemini_sidebar'
    });
    var $root = $('<div>', {id: 'xt-gemini-sidebar-iframe'}).html(html);
    $root.insertBefore($templatesBtn);
  };


  var addPersuasions = function(){
    chrome.runtime.sendMessage({
      cmd: 'api.openAIfetchPersuasions',
      data: ''
    }, function(response){
      if (typeof response !== 'object') return;
      let isEmpty = Object.keys(response).length === 0;
      if (isEmpty) {
        $('.xt-buttons-container').remove();
        return;
      }
      let $div = $('<div>');
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
    return document.body.classList.contains('dark-theme');
  };


  var toggleWidget = function(){
    OpenaiWidgetController.toggle({
      darkMode: darkMode,
      source: source
    });
  };


  // Extract chat ID from URL
  var getChatIdFromUrl = function(url) {
    if (!url) url = window.location.href;
    const match = url.match(/\/app\/([^\/\?]+)/);
    return match ? match[1] : null;
  };

  // Check if first conversation item has .selected class (indicating new conversation)
  var isNewConversation = function() {
    try {
      const firstConversation = document.querySelector('[data-test-id="conversation"]');
      if (firstConversation && firstConversation.classList.contains('selected')) {
        return true;
      }
    } catch (e) {
      console.error('Error checking new conversation:', e);
    }
    return false;
  };

  var initURLChangeListener = function( cbProcessPage ){
    var url = document.location.href;
    var previousChatId = getChatIdFromUrl();
    
    var timer = setInterval(function(){
      if ( url !== document.location.href ) {
        var oldUrl = url;
        url = document.location.href;
        
        var oldChatId = previousChatId;
        var newChatId = getChatIdFromUrl(url);
        previousChatId = newChatId;
        
        // Check if we switched to a different conversation
        if (oldChatId !== newChatId) {
          // Clear existing queries when switching conversations
          fanOutQueries = [];
          if (fanOutWidget) {
            fanOutWidget.remove();
            fanOutWidget = null;
          }
          
          // Check if fan-out queries have already been loaded for this chat
          if (newChatId) {
            setTimeout(function() {
              attemptGeminiExtraction();
            }, 500);
          }
        }
        
        // Check if we transitioned to a new chat:
        // Case 1: No chatId → chatId (starting from empty chat)
        // Case 2: chatId → different chatId (creating new chat from existing chat)
        var isNewChatTransition = (!oldChatId && newChatId) || 
                                  (oldChatId && newChatId && oldChatId !== newChatId);
        if (isNewChatTransition) {
          // Wait a bit for DOM to update, then check if it's a new conversation
          setTimeout(function() {
            if (isNewConversation()) {
              // It's a new conversation - show refresh button
              updateRefreshButtonVisibility();
            } else {
              // Not a new conversation - hide refresh button
              const $refreshBtn = $('.xt-gemini-refresh-btn-sec');
              if ($refreshBtn.length) {
                $refreshBtn.hide();
              }
            }
          }, 500);
        }
        
        cbProcessPage( url );
      }
    }, 1000);
  };


  function initFanOutQueriesMonitoring() {
    var settings = Starter.getSettings();
    if (!settings.sourceList.gptfan) return;
    if (isMonitoring) return;
    isMonitoring = true;

    // Listen for intercepted queries from ajax interceptor
    window.addEventListener('xt-gemini-queries', function(event) {
      const queries = event.detail.queries;
      if (queries && queries.length > 0) {
        let hasNewQueries = false;
        queries.forEach(newQuery => {
          if (!fanOutQueries.some(existing => existing.q === newQuery.q)) {
            fanOutQueries.push(newQuery);
            hasNewQueries = true;
          }
        });

        if (hasNewQueries) {
          showFanOutQueriesWidget();
        }
      }
    });

    // Monitor DOM changes in chat area to trigger checks
    let writingTimeout;
    let significantChangeTimeout;
    const observer = new MutationObserver((mutations) => {
      // Check for significant content changes
      const hasSignificantChanges = mutations.some(mutation => {
        return mutation.addedNodes.length > 0 && 
               Array.from(mutation.addedNodes).some(node => {
                 return node.nodeType === Node.ELEMENT_NODE && 
                        node.textContent && 
                        node.textContent.length > 100;
               });
      });
      
      if (hasSignificantChanges) {
        if (significantChangeTimeout) {
          clearTimeout(significantChangeTimeout);
        }
        significantChangeTimeout = setTimeout(() => attemptGeminiExtraction(), 3000);
      }
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          // Check if mutation is in chat area (adjust selectors for Gemini)
          let isInChatArea = false;
          if (mutation.target.nodeType === Node.TEXT_NODE) {
            let parent = mutation.target.parentElement;
            while (parent && parent !== document.body) {
              if (parent.querySelector('.model-response-text, .response-text, [role="assistant"]') || 
                  parent.closest('.model-response-text, .response-text, [role="assistant"]')) {
                isInChatArea = true;
                break;
              }
              parent = parent.parentElement;
            }
          } else if (mutation.target.nodeType === Node.ELEMENT_NODE) {
            if (mutation.target.querySelector('.model-response-text, .response-text, [role="assistant"]') || 
                mutation.target.closest('.model-response-text, .response-text, [role="assistant"]')) {
              isInChatArea = true;
            }
          }

          if (isInChatArea) {
            if (writingTimeout) {
              clearTimeout(writingTimeout);
            }
            writingTimeout = setTimeout(() => {
              // Check templates for new queries
              attemptGeminiExtraction();
            }, 1500);
          }
        }
      });
    });

    const mainElement = document.querySelector('main') || document.body;
    observer.observe(mainElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  // Attempt automatic Gemini extraction (from buffer)
  async function attemptGeminiExtraction() {
    try {
      if (isCheckingQueries) return;
      
      // Get current chat ID - don't proceed if no chatId
      const currentChatId = getChatIdFromUrl();
      if (!currentChatId) return;
      
      isCheckingQueries = true;
      
      // Check templates for intercepted queries - only for current chat ID
      var templates = document.querySelectorAll('template[data-type="gemini-queries"]');
      var foundQueries = [];
      
      templates.forEach(template => {
        try {
          // Only process templates that belong to current chat
          const templateChatId = template.getAttribute('data-chat-id');
          if (currentChatId && templateChatId !== currentChatId) {
            return; // Skip templates from other chats
          }
          
          var data = JSON.parse(template.textContent);
          var queries = data.queries || [];
          queries.forEach(newQuery => {
            if (!fanOutQueries.some(existing => existing.q === newQuery.q)) {
              fanOutQueries.push(newQuery);
              foundQueries.push(newQuery);
            }
          });
          // Don't remove template - keep it for future reference
        } catch (e) {
          console.log(e);
        }
      });
      
      if (foundQueries.length > 0) {
        showFanOutQueriesWidget();
      }
      
      isCheckingQueries = false;
    } catch (error) {
      console.error('Error in attemptGeminiExtraction:', error);
      isCheckingQueries = false;
    }
  }

  /** Queries to show: exclude single query that is one word with underscores (e.g. foo_bar_something). */
  var getEffectiveFanOutQueries = function() {
    if (fanOutQueries.length === 0) return [];
    if (fanOutQueries.length === 1) {
      var q = (fanOutQueries[0].q || '').trim();
      if (/^[a-zA-Z0-9_]+$/.test(q)) return [];
      if (/^http/i.test(q)) return [];
    }
    return fanOutQueries;
  };

  var refreshFanOutQueriesWidget = function() {
    if (!fanOutWidget || getEffectiveFanOutQueries().length === 0) return;
    
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

  // Show/hide refresh button based on fan-out queries availability and new conversation state
  var updateRefreshButtonVisibility = function() {
    const $refreshBtn = $('.xt-gemini-refresh-btn-sec');
    if (!$refreshBtn.length) return;
    
    // Hide button if we have queries and widget is shown
    if (getEffectiveFanOutQueries().length > 0 && fanOutWidget) {
      $refreshBtn.hide();
      return;
    }
    
    // Show button only if it's currently a new conversation (first item has .selected)
    // The URL change listener handles showing the button when transitions occur
    if (isNewConversation()) {
      // It's a new conversation - show button
      $refreshBtn.show();
    } else {
      // Not a new conversation - hide button (default state)
      $refreshBtn.hide();
    }
  };

  var showFanOutQueriesWidget = function() {
    if (getEffectiveFanOutQueries().length === 0) {
      updateRefreshButtonVisibility();
      return;
    }
    
    if (fanOutWidget) {
      fanOutWidget.remove();
    }
    
    createFanOutQueriesWidget();
    updateRefreshButtonVisibility();
  };


  var createFanOutQueriesWidget = function(manual) {
    fanOutWidget = document.createElement('div');
    fanOutWidget.id = 'xt-fan-out-queries-widget';
    fanOutWidget.className = 'xt-widget-table';

    const content = document.createElement('div');
    content.id = 'xt-widget-content';
    document.body.appendChild(fanOutWidget);
    
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
    var iframeSrcParam = 'geminifanout';
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
    var filename = `gemini-fanout-queries-${dateTime}`;
    
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
      onClosed: function(){
        // Show refresh button when widget is closed
        updateRefreshButtonVisibility();
      },
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
      
      // Don't start dragging if clicking on the expand button
      if (e.target.closest('.xt-expand-button')) return;
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === handle || handle.contains(e.target)) {
        // Don't start dragging if clicking on the expand button
        if (!e.target.closest('.xt-expand-button')) {
          isDragging = true;
        }
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

  var toggleWidgetCollapse = function(userControlled) {
    if (!fanOutWidget) return;
    
    const isCollapsed = fanOutWidget.classList.contains('xt-widget-collapsed');
    const expandButton = fanOutWidget.querySelector('.xt-expand-button');
    
    if (isCollapsed) {
      // Expand widget
      fanOutWidget.classList.remove('xt-widget-collapsed');
      if (userControlled) {
        fanOutWidget.dataset.userControlled = 'true';
      }
      if (expandButton) {
        // Update icon to up arrow for collapse
        expandButton.innerHTML = COLLAPSE_SVG_HTML + 'Collapse';
      }
    } else {
      // Collapse widget
      fanOutWidget.classList.add('xt-widget-collapsed');
      if (userControlled) {
        fanOutWidget.dataset.userControlled = 'true';
      }
      if (expandButton) {
        // Update icon to down arrow for expand
        expandButton.innerHTML = EXPAND_SVG_HTML + 'Expand';
      }
    }
  };

  var clearFanOutQueries = function() {
    fanOutQueries = [];
    if (fanOutWidget) {
      fanOutWidget.remove();
      fanOutWidget = null;
    }
    
    // Show refresh button when queries are cleared
    updateRefreshButtonVisibility();
    
    isMonitoring = false;
    setTimeout(() => {
      initFanOutQueriesMonitoring();
    }, 500);
  };

  var showFanOutQueriesWidgetManually = async function() {
    // Use attemptGeminiExtraction to check for queries
    await attemptGeminiExtraction();
    
    if (fanOutQueries.length === 0) {
      alert("No fan-out queries found in this conversation.");
      return;
    }
    
    showFanOutQueriesWidget();
  };


  var getSource = function(){
    return source;
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
