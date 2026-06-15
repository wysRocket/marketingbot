var Tool = (function(){

  var source = 'reddit';
  var COMMENTS_TEXT_LIMIT = 30000;

  var rootSel = 'reddit-search-large';
  var observerTarget = 'reddit-search-large';
  var observer = null;

  var processSuggestionsTimer = null;
  var pageLoadingTimer = null;
  var isPageLoading = false;


  var init = function(){
    initWindowMessaging();
    initPage();
  };


  var initWindowMessaging = function(){
    window.addEventListener("message", function(event){
      var payload = event.data;
      if (typeof payload !== 'object') return;
      var cmd = payload.cmd;
      var data = payload.data;
      if (!cmd) return;
      if (cmd === 'xt.resize') {
        var height = data.height;
        var source = data.source;
        var selector = '.xt-widget-iframe';
        if (!selector) return;
        if (height <= 0) return;
        $(selector + ' iframe').height(height);
      }
    }, false);
  };


  var initPage = function(){
    checkTarget();
    setTimeout(function(){
      checkPost();
    }, 1000);
    var timer = setInterval(function(){
      var found = checkTarget();
      if (found) clearInterval(timer);
    }, 500);
    initURLChangeListener(function(url){
      isPageLoading = true;
      waitForPageLoad(function(){
        processPage();
        checkTarget();
        checkPost();
        isPageLoading = false;
      });
    });
    processPage();
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


  var waitForPageLoad = function(callback){
    if (pageLoadingTimer) clearTimeout(pageLoadingTimer);
    
    var checkLoading = function(){
      var navIndicator = document.querySelector('navigation-indicator');
      if (navIndicator && navIndicator.shadowRoot) {
        var loadingBar = navIndicator.shadowRoot.querySelector('.bar.bg-global-orangered.transition-transform.animating-in');
        if (loadingBar) {
          // Still loading, check again in 100ms
          pageLoadingTimer = setTimeout(checkLoading, 100);
          return;
        }
      }
      // Loading complete, wait a bit more for content to settle
      pageLoadingTimer = setTimeout(callback, 500);
    };
    
    checkLoading();
  };


  var isCommentsLoading = function(){
    var loadingElement = document.querySelector('shreddit-loading');
    return loadingElement !== null;
  };


  var processPage = function(){
    var query = getQuery();
    query = Common.cleanKeyword(query);
    chrome.runtime.sendMessage({
      cmd: 'api.getKeywordData',
      data: {
        keywords: [query],
        src: source
      }
    }, function( json ){
      processQueryResponse( json );
    });
  };


  var getQuery = function(){
    return $.trim($('input[name="q"]').val());
  };


  var checkPost = function(){
    if (document.location.href.indexOf('/comments/') !== -1) {
      renderSummarizeWidget();
    }
  };


  var processQueryResponse = function( json ){
    var data;
    var settings = Starter.getSettings();
    if (json.error) {
      console.log('Error', json);
      return;
    }
    if (json.data) data = json.data[0];
    var $node = $('#xt-info');
    if (!$node.length) {
      $node = $('<div/>', {
          class: 'xt-reddit-query'
        })
        .attr('id', 'xt-info');
      $node
        .insertAfter( $(rootSel) );
    }
    if (!data) {
      if (json.error_code === 'NOCREDITS' || json.error_code === 'NO_API_KEY') {
        // if (settings.showAutocompleteButton) {
        //   var html = Common.appendLTKBtn('', {
        //     query: getQuery(),
        //     title: 'Find Reddit keywords for',
        //     service: source
        //   });
        //   $node.html(html);
        // }
      }
      else Common.processEmptyData(json, $node);
      return;
    }
    else {
      if(data.vol != '-') {
        Common.addKeywords(data.keyword);
        var html = Common.getResultStrType2(data, {darkMode: true});
        html = Common.appendStar(html, data);
        html = Common.appendKeg(html, json, data);
        var settings = Starter.getSettings();
        // if (settings.showAutocompleteButton) {
        //   html = Common.appendLTKBtn(html, {
        //     query: getQuery(),
        //     service: 'amazon',
        //     title: 'Find Amazon keywords for',
        //     tld: getTLD()
        //   });
        // }
        $node.html(html);
        var color = Common.highlight(data);
        if (color) {
          $node.addClass('xt-highlight');
          var fontColor = getContrastYIQ(color.replace('#', ''));
          $node.css({
            background: color,
            color: fontColor
          });
        }
      }
      else {
        $node.html('');
      }
    }
  };


  var checkTarget = function(){
    var $target = $( observerTarget );
    if (!$target.length) return;
    if (!$target[0].shadowRoot) return;
    initMutationObserver( $target[0].shadowRoot );
    return true;
  };


  var initMutationObserver = function( target ){
    if (observer) observer.disconnect();
    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          processChildList(mutation.addedNodes);
        }
      });
    });

    var config = { subtree: true, childList: true, characterData: true };
    observer.observe(target, config);
  };


  function attachCssLink(sr) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('css/style.css');
    sr.prepend(link);
  }


  var processChildList = function(children){
    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      var item = node.querySelector('[data-testid="search-sdui-query-autocomplete"]')
      if (item) {
        if (processSuggestionsTimer) clearTimeout(processSuggestionsTimer);
        processSuggestionsTimer = setTimeout(function(){
          processSuggestions();
        });
        // keywordsList.push({
        //   keyword: item.dataset.label,
        //   node: item
        // });
      }
    }
  };


  var processSuggestions = function(){
    var keywordsList = [];
    var shadowRoot = $(observerTarget)[0].shadowRoot;
    var list = $(shadowRoot).find('[data-testid="search-sdui-query-autocomplete"]');
    for (var i = 0, len = list.length; i < len; i++) {
      var keyword = Common.cleanKeyword( list[i].dataset.label );
      keywordsList.push({
        keyword: keyword,
        node: list[i]
      });
    }
    console.log(keywordsList);
    processKeywords( keywordsList, null );
  };


  var processKeywords = function( keywordsList, table ){
    var keywords = {};
    for (var i = 0, len = keywordsList.length; i < len; i++) {
      keywords[ keywordsList[i].keyword ] = '';
    }
    Common.processKeywords({
        keywords: Object.keys( keywords ),
        tableNode: table,
        src: source
      },
      function(json){
        processJSON( json, keywordsList );
      }
    );
    Starter.initMouseEvents();
    Starter.addSettingsButton();
  };


  var processJSON = function( json, keywordsList ){
    var data = json.data;
    var dataByKeyword = {};
    for (var key in data) {
      var item = data[key];
      dataByKeyword[ item.keyword ] = item;
    }
    for (var i = 0, len = keywordsList.length; i < len; i++) {
      var keyword = keywordsList[i].keyword;
      var item = dataByKeyword[keyword];
      if ( item ) {
        var title = Common.getResultStr(item);
        var color = Common.highlight(item);
        if (title) title = '[' + title + ']';
        var $res = $('<span>')
          .css({
            fontSize: '12px',
            marginLeft: '10px',
            color: '#888'
          })
          .addClass('xt-reddit-line')
          .html(title);
        if (color) {
          $res.addClass('xt-highlight');
          $res.css('background', color);
        }
        Common.addKeywords(keyword, item);
        var $node = $( keywordsList[i].node );
        if (!$node.find('.xt-reddit-line')[0]) {
          var $titleHTML = $('<div/>');
          $('<div/>').html(title).appendTo($titleHTML);
          $node.find('a > span.flex:first-child').append( $res );
        }
      }
    }
  };


  const renderSummarizeWidget = function(data){
    let html = '';
    let settings = Starter.getSettings();
    var buttons =`
      <div class="xt-reddit-buttons-grid">
        <a class="xt-reddit-summarize-run-btn xt-ke-btn" data-url="https://chatgpt.com">${SVGIcons.chatgpt} ChatGPT</a>
        <a class="xt-reddit-summarize-run-btn xt-ke-btn" data-url="https://claude.ai/chats">${SVGIcons.claude} Claude</a>
        <a class="xt-reddit-summarize-run-btn xt-ke-btn" data-url="https://gemini.google.com">${SVGIcons.gemini} Gemini</a>
        <a class="xt-reddit-summarize-run-btn xt-ke-btn" data-url="https://chat.deepseek.com">${SVGIcons.deepseek} Deepseek</a>
      </div>
      `;
    html += `<div class="xt-ke-row">
      <div>
        <h3><img src="${chrome.runtime.getURL('/img/icon24.png')}" width="24" height="24"> Summarize Thread</h3>
      </div>
      <div id="xt-reddit-summarize-buttons">
      ${buttons}
      </div>
    `;
    html += Common.renderIframeHTML({
      query: '', //data.query,
      settingEnabled: true,
      darkMode: false, //darkMode,
      iframeSrcParam: 'reddit'
    });
    let params = {
      parentSelector: '#right-sidebar-contents',
      addMethod: 'prependTo',
      rootId:'xt-reddit-root',
      html: html,
      service: 'reddit',
      onAdded: function($root){
        $root.addClass('xt-reddit-root');
        var sidebarAside = document.querySelector('#right-sidebar-contents faceplate-partial aside');
        if (sidebarAside && sidebarAside.className) {
          $root.addClass(sidebarAside.className);
        } else {
          $root.addClass('bg-neutral-background-weak');
        }
      },
      onReady: function($root){
      }
    };
    let $root = Common.renderGenericWidget(params);
    $root.find('.xt-ke-btn').click(function(e){
      e.preventDefault();
      runSummarize(this.dataset.url);
    });
  };


  const runSummarize = async function(url){
    // Check if page is still loading
    if (isPageLoading) {
      alert('Page is still loading. Please wait for the page to finish loading before running AI analysis.');
      return;
    }
    
    // Check if comments are still loading
    if (isCommentsLoading()) {
      alert('Comments are still loading. Please wait for comments to finish loading before running AI analysis.');
      return;
    }
    
    const template = await getSummarizePromptTemplate();
    const data = prepareSummarizeTemplateData();
    const prompt = generatePrompt(template.prompt, data);
    chrome.runtime.sendMessage({
      cmd: 'prompt_pending.set',
      data: {
        url: url,
        prompt: prompt
      }
    }, function(){});
  };


  const getSummarizePromptTemplate = function(id){
    return new Promise(function(resolve){
      chrome.runtime.sendMessage({
        cmd: 'api.openAIFetchKEPrompt',
        data: {id: 'redditsummarizethread'}
      }, function(response){
        if (response && response.prompt) resolve(response);
        else {
          console.log('Investigate', response);
          resolve(response);
        }
      });
    })
  };


  const prepareSummarizeTemplateData = function(){
    var $postNode = $('shreddit-post');
    var $commentTree = $('#comment-tree');
    var $comments = $('shreddit-comment');
    console.log($commentTree, $comments, $postNode);

    var title = $postNode.attr('post-title') || '';
    var textBody = $('shreddit-post-text-body').text().replace(/\s+/g, ' ').trim();;
    title = title.substr(0, 80);

    var comments = [];
    var currentLength = 0;
    
    $comments.map(function(i, item){
      var $item = $(item);
      var depth = parseInt( $item.attr('depth') ) || 0;
      var depthStr = ">".repeat(depth + 1);
      var url = $item.attr('permalink');
      var author = $item.attr('author');
      var text = $item.find('[slot=comment]').text().replace(/\s+/g, ' ').trim();
      var commentLine = `${depthStr} [${url}] ${author}: ${text}`;
      
      // Check if adding this comment would exceed the limit
      if (currentLength + commentLine.length + 1 <= COMMENTS_TEXT_LIMIT) { // +1 for newline
        comments.push(commentLine);
        currentLength += commentLine.length + 1;
      }
    });
    var commentsText = comments.join('\n');

    return {
      reddit_thread_title: title,
      reddit_thread_comments: commentsText
    };
  };


  const generatePrompt = function(template, data){
    let prompt = template;
    for (const key in data) {
      const re = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(re, data[key]);
    }
    return prompt;
  };


  var getSource = function(){
    return source;
  };


  return {
    init: init,
    getSource: getSource
  };


})();
