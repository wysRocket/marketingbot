var Tool = (function(){

  var source = 'claude';

  var rootSel = '.header__search';
  var observer;
  var suggestionsTimer;
  var suggestionsList = {};
  var cachedSuggestions = {};
  var darkMode = false;


  var init = async function(){
    console.log('init');
    await formReady();
    setTimeout(checkPendingRequests, 1000);
    if (document.location.pathname.indexOf('/chats') !== -1) {}
    // else await headerReady();
    addWidgetButton();
    initBodyClassObserver();
    initWindowMessaging();
    initMutationObserver(document.body);
    var settings = Starter.getSettings();
    if (settings.showChatGPTactions) {
      addPersuasions();
    }
    initURLChangeListener(function(){
      addWidgetButton();
    })
  };


  const formReady = function(){
    return new Promise(resolve => {
      let attempt = 10;
      let timer = setInterval(() => {
        if (attempt-- <= 0) {
          clearInterval(timer);
          resolve();
        }
        let div = document.querySelector('fieldset div[contenteditable="true"]');
        if (div) {
          resolve(div);
          clearInterval(timer);
        }
      }, 500);
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
        let div = document.querySelector('[data-testid="menu-sidebar"]');
        if (div) {
          resolve(div);
          clearInterval(timer);
        }
      }, 600);
    });
  };


  var checkPendingRequests = function(){
    let limit = 39000;
    chrome.runtime.sendMessage({
      cmd: 'yt.transcript.summarize.get'
    }, function(data){
      if (!data) return;
      let points = data.text.length > 2000 ? 10 : 5;
      let prompt = `Summarize the transcript of a YouTube video in ${points} bullet points. The video is by ${data.channelName} and is titled ${data.title}. The entire transcript is given below.\n` + data.text;
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


  var initBodyClassObserver = function(){
    const doc = document.documentElement;
    const onClassChange = (mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-mode') {
          OpenaiWidgetController.post('darkmode', isDarkMode());
        }
      }
    };
    const observer = new MutationObserver(onClassChange);
    observer.observe(doc, { attributes: true, attributeFilter: ['data-mode'] });
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
            if (node.nodeType === Node.ELEMENT_NODE && node.querySelector('[data-testid="chat-controls"]')) {
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
        if (source === 'claude_sidebar') selector = '#xt-claude-sidebar-iframe';
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


  var chooseTemplate = async function(data){
    const $form = $('fieldset');
    if ($form[0]) {
      let $textarea = $form.find('div[contenteditable="true"]');
      $textarea[0].innerHTML = '<p>' + data.prompt.replace(/\n/g, '</p><p>') + '</p>';
      $textarea[0].dispatchEvent(new Event('input', {bubbles: true}));
      setTimeout(function(){
        let $button = $form.find('button[aria-label="Send message"]');
        console.log($button);
        $button.removeAttr('disabled').click();
      }, 500);
    }
  };


  var menuItemTemplate = function(darkmode){
    if (!darkmode) LOGO_SVG = LOGO_SVG.replace(/#fff/g, '#000');
    return `
    <div class="relative group" data-state="closed"><a target="_self" class="inline-flex
      items-center
      justify-center
      relative
      shrink-0
      can-focus
      select-none
      disabled:pointer-events-none
      disabled:opacity-50
      disabled:shadow-none
      disabled:drop-shadow-none text-text-300
              border-transparent
              transition
              font-styrene
              duration-300
              ease-[cubic-bezier(0.165,0.85,0.45,1)]
              hover:bg-bg-400
              aria-pressed:bg-bg-400
              aria-checked:bg-bg-400
              aria-expanded:bg-bg-300
              hover:text-text-100
              aria-pressed:text-text-100
              aria-checked:text-text-100
              aria-expanded:text-text-100 h-9 px-4 py-2 rounded-lg min-w-[5rem] active:scale-[0.985] whitespace-nowrap text-sm w-full hover:bg-bg-300 overflow-hidden !min-w-0 group active:bg-bg-400 active:scale-[0.99] px-4" aria-label="Templates" href="#"><div class="-translate-x-2 w-full flex flex-row items-center justify-start gap-3"><div class="size-4 flex items-center justify-center group-hover:!text-text-200 text-text-400">${LOGO_SVG}</div><span class="truncate group-hover:[mask-image:linear-gradient(to_right,hsl(var(--always-black))_78%,transparent_95%)] text-sm whitespace-nowrap w-full [mask-size:100%_100%]"><div class="transition-all duration-200">Templates</div></span></div></a><div class="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover:block"></div></div>
            `;
    return `
      <button class="xt-claude-btn inline-flex
        items-center
        justify-center
        relative
        shrink-0
        ring-offset-2
        ring-offset-bg-300
        ring-accent-main-100
        focus-visible:outline-none
        focus-visible:ring-1
        disabled:pointer-events-none
        disabled:opacity-50
        disabled:shadow-none
        disabled:drop-shadow-none text-text-200
                transition-all
                font-styrene
                active:bg-bg-400
                hover:bg-bg-500/40
                hover:text-text-100 h-9 w-9 rounded-md active:scale-95 shrink-0 relative" data-testid="chat-controls" data-state="closed">${LOGO_SVG}</button>
    `;
  };


  var addWidgetButton = function() {
    console.log( $('.xt-claude-btn')[0] );
    if ($('.xt-claude-btn')[0]) return;
    darkMode = isDarkMode();
    // let menuButton = $('[data-testid="chat-controls"]')[0];
    let menuButton = $('[aria-label="Chats"]')[0];
    let header = $('header > .flex')[0];
    let $btn;
    if (menuButton) {
      const parent = menuButton.parentNode.parentNode;
      parent.style.gridTemplateColumns = 'auto auto 1fr auto';
      const afterBtn = parent.querySelector('div.group');
      $btn = $(menuItemTemplate(darkMode)).addClass('xt-claude-btn').insertAfter(afterBtn);
      $btn.click(function(e) {
        toggleWidget();
      });
      addSidebarIframe($btn);
    }
    else {
      $btn = $(menuItemTemplate(darkMode)).prependTo('header').css({
        position: 'absolute',
        right: '100px',
        top: '10px'
      });
      $btn.click(function(e) {
        toggleWidget();
      });
      addSidebarIframe($btn);
    }
  };


  var addSidebarIframe = function($btn){
    if ($('#xt-claude-sidebar-iframe')[0]) return;
    var html = Common.renderIframeHTML({
      query: '',
      settingEnabled: true,
      darkMode: darkMode,
      iframeSrcParam: 'claude_sidebar'
    });
    var $root = $('<div>', {id: 'xt-claude-sidebar-iframe'}).html(html);
    var $flexParent = $btn && $btn[0] ? $btn.closest('.flex') : null;
    if ($flexParent && $flexParent[0]) {
      $root.insertAfter($flexParent);
      return;
    }
    if ($btn && $btn[0]) {
      $root.insertAfter($btn);
    }
  };


  var addPersuasions = function(){
    chrome.runtime.sendMessage({
      cmd: 'api.openAIfetchPersuasions',
      data: ''
    }, function(response){
      let isEmpty = Object.keys(response).length === 0;
      if (isEmpty) {
        $('.xt-buttons-container').remove();
        return;
      }
      if (typeof response !== 'object') return;
      let $div = $('<div>');
      for (const key in response) {
        const value = response[key];
        $div.append(`<a data-prompt="${value}">${key}</a>`);
      }
      $('.xt-icon').append($div).find('a').click(function(){
        const prompt = this.dataset.prompt;
        chooseTemplate({prompt: prompt});
      });
    });
  };


  var isDarkMode = function() {
    return document.documentElement.dataset.mode === 'dark';
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


  let LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 262.77 262.77"><g id="Layer_2" data-name="Layer 2"><g id="Layer_1-2" data-name="Layer 1"><g><circle cx="131.38" cy="131.38" r="126.38" style="fill: none;stroke-miterlimit: 10;stroke-width: 10px; stroke: #fff;"/><path d="M109.38,106.42c7.54-9,14-17.2,20.94-25,7.63-8.58,15.73-16.73,23.48-25.2,4.32-4.72,9.2-5.71,14.78-2.85,5.07,2.59,10,5.43,14.34,7.81-12.71,12-24.57,23.42-36.64,34.59-4.92,4.56-5.87,9.38-3.45,15.63,11.36,29.37,23.23,58.47,41.41,84.49.95,1.35,2,2.62,3.47,4.5C180.2,206.74,172,210.94,162.14,211c-1.48,0-3.48-2-4.39-3.54-5-8.63-10.36-17.12-14.36-26.2-6.75-15.37-12.57-31.15-18.78-46.77-1-2.6-2-5.22-3.51-9.14-5.47,8.17-12.51,14.31-12.51,23.93,0,16.81.38,33.63.91,50.44.11,3.63-.92,5.56-4.32,6.67-6.73,2.18-13.44,3.46-20.58,2.12-2.79-.52-3.69-1.83-3.77-4.22-.12-3.32-.23-6.65-.16-10q.93-41.44,1.94-82.89c.08-3.33.33-6.65.56-10,.84-11.8-.41-23.09-6-33.86-3.1-5.92-2.59-6.68,3.77-8.25a151.63,151.63,0,0,1,22.45-4c6.93-.64,7.1-.1,7,6.71-.23,12.48-.62,25-.93,37.44C109.34,101.33,109.38,103.16,109.38,106.42Z" style=""/></g></g></g></svg>`;


  return {
    init: init,
    getSource: getSource
  };

})();

