var Tool = (function(){

  var source = 'instgr';

  var rootSel = '.header__search';
  var sidebarSelector;// = '.x1dr59a3.x1n327nk';
  var observer;
  var suggestionsTimer;
  var suggestionsList = {};
  var cachedSuggestions = {};
  var darkMode = false;
  var restoreScrollTop = 0;

  var vendor = (navigator.userAgent.match(/(Chrome|Firefox)/) || [])[1];


  var init = function(){
    initWindowMessaging();
    chrome.runtime.sendMessage({cmd: 'api.getConfig'}, function(json){
      if (!json.error && json.data && json.data.instagram) {
        sidebarSelector = json.data.instagram.sidebarSelector;
        console.log(sidebarSelector);
      }
    });
    initAVGWidget();
    darkMode = isDarkMode();
    setTimeout( function(){
      processPage();
    }, 1500 );
    // initURLChangeListener(function(){
    //   setTimeout( function(){
    //     // processPage();
    //   }, 500 );
    // });
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
        var selector = '.xt-widget-iframe';
        if (!selector) return;
        if (height <= 0) return;
        if (source === 'instgr_sidebar') {
          selector = '#xt-instagram-sidebar-iframe'
        }
        else if (source === 'instgr_avg') {
          selector = '#xt-instagram-avg-widget-iframe';
        }
        $(selector + ' iframe').height(height + 10);
      }
    }, false);
  };


  function parseFollowers(raw) {
    if (!raw || typeof raw !== 'string') return 0;

    // Convert full-width digits (e.g. Arabic) to ASCII
    const normalizeDigits = (str) => str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) =>
      String.fromCharCode(d.charCodeAt(0) & 0xf));
    raw = normalizeDigits(raw).trim();
    // Handle localized multipliers
    const suffixes = {
      'K': 1e3, 'k': 1e3,
      'M': 1e6, 'm': 1e6,
      'B': 1e9, 'b': 1e9,
      '万': 1e4,  // Chinese/Japanese/Korean
      '억': 1e8,  // Korean 100 million
      '千万': 1e7, '百万': 1e6,  // Chinese, rarely used
      '만': 1e4,  // Korean
      'ألف': 1e3, 'مليون': 1e6 // Arabic
    };
    let multiplier = 1;
    for (const [suffix, factor] of Object.entries(suffixes)) {
      if (raw.includes(suffix)) {
        multiplier = factor;
        raw = raw.replace(suffix, '');
        break;
      }
    }
    // Replace comma or dot depending on locale (Instagram uses dot for decimal)
    let num = raw.replace(/[,\s]/g, '').replace(/[^\d.]/g, '');
    // Convert to float and apply multiplier
    let result = parseFloat(num);
    return isNaN(result) ? 0 : Math.round(result * multiplier);
  }


  var initAVGWidget = function(){
    var path = document.location.pathname;
    var $templates = $('body > template');
    var counts = {
      posts: 0,
      likes: 0,
      comments: 0,
      maxLikes: 0,
      maxLikesIndex: 0
    };
    let rawFollowers = '';
    // Look for followers link by href ending with "followers"
    $('a[href$="/followers/"]').each(function () {
      const $span = $(this).find('span[title]').first();
      if ($span.length) {
        rawFollowers = $span.attr('title') || $span.text();
        return false; // Stop after finding the first match
      }
    });
    var followers = parseFollowers(rawFollowers);
    var isTags = false;
    var igData = [];
    $templates.map(function(i, template){
      if (template.dataset.path !== path) {
        document.body.removeChild(template);
        return;
      }
      var text = template.textContent;
      try {
        var json = JSON.parse(text);
        console.log(json);
        if (template.dataset.url.indexOf(/fbsearch/) !== -1) isTags = true;
        // isTags = template.dataset.url.indexOf(/tags/) !== -1;
        if (isTags) {
          var sections = json.media_grid.sections;
          var index = 0;
          sections.map(function(section){
            var items = section.layout_content.fill_items;
            if (!items) items = section.layout_content.medias;
            items.map(function(item){
              counts.posts++;
              var likes = item.media.like_count;
              counts.likes += likes;
              if (likes > counts.maxLikes) {
                counts.maxLikes = likes;
                counts.maxLikesIndex = index;
              }
              index++;
              // counts.comments += item.media.comment_count;
              igData.push({
                code: item.media.code,
                likes: likes,
                // comments: item.media.comment_count
              });
            });
          });
          console.log(igData);
        }
        else if (json.items) {
          json.items.map(function(item, index){
            counts.posts++;
            counts.comments += item.comment_count;
            var likes = item.like_count;
            counts.likes += likes;
            if (likes > counts.maxLikes) {
              counts.maxLikes = likes;
              counts.maxLikesIndex = index;
            }
            igData.push({
              code: item.code,
              likes: likes,
              comments: item.comment_count,
            });
          });
        }
        else if (json.data && json.data.xdt_api__v1__feed__user_timeline_graphql_connection) {
          var edges = json.data.xdt_api__v1__feed__user_timeline_graphql_connection.edges;
          edges.map(function(edge, index){
            var item = edge.node;
            if (typeof item.like_count !== 'undefined') {
              counts.posts++;
              counts.comments += item.comment_count;
              var likes = item.like_count;
              counts.likes += likes;
              if (likes > counts.maxLikes) {
                counts.maxLikes = likes;
                counts.maxLikesIndex = index;
              }
              igData.push({
                code: item.code,
                likes: likes,
                comments: item.comment_count,
              });
            }
          });
        }
        else if (json.data && json.data.user && json.data.user.follower_count) {
          followers = json.data.user.follower_count;
        }
      } catch (e) {
        console.log(e);
      }
    });
    var avgLikes = '-';
    var avgComments = '-';
    if (counts.posts) {
      counts.likes -= counts.maxLikes;
      counts.posts--;
      avgLikes = Math.round((counts.likes / counts.posts));
      avgComments = Math.round((counts.comments / counts.posts));
    }
    var engagement = '-';
    // console.log(avgLikes, avgComments, followers);
    if (followers) engagement = ((avgLikes + avgComments) * 100 / followers).toFixed(2);
    var $widget = $('#xt-instagram-avg-widget');
    if (counts.posts) {
      if (!$widget[0]) {
        var selector = 'main header > section';
        var method = 'insertBefore';
        if (isTags) {
          selector = 'main [role=button]';
          method = 'insertBefore';
        }
        var $sibling = $(selector);
        if (isTags) $sibling = $($sibling[0]).parent();
        if ($sibling.length > 1) $sibling = $($sibling[0]);
        $widget = $('<div>', { id: 'xt-instagram-avg-widget' })[method]($sibling[0]);
        $widget.html(`
          <div id="xt-instagram-avg-widget-content"></div>
          <div id="xt-instagram-avg-widget-footer"></div>
        `);
        if (!isTags) {
          addIframe($widget.find('#xt-instagram-avg-widget-footer'), isDarkMode(), 'xt-instagram-avg-widget-iframe', 'instgr_avg');
        }
        else {
          $widget.addClass('xt-instagram-avg-widget-tags')
        }
      }
      var html = '';

      if (isTags) {
        html = `
          <a class="xt-instagram-stats-logo" href="https://keywordseverywhere.com/instagram-metrics.html" target="_blank">
            <img class="xt-ke-logo" src="${chrome.runtime.getURL('img/icon24.png')}">
          </a>
          <span>Avg Likes:</span> ${avgLikes.toLocaleString()}
          <button class="xt-instagram-stats-more-btn"><small>Analyze More</small></button>
        `;
      } else {
        html = `
          <a class="xt-instagram-stats-logo" href="https://keywordseverywhere.com/instagram-metrics.html" target="_blank">
            <img class="xt-ke-logo" src="${chrome.runtime.getURL('img/icon24.png')}">
          </a>
          <div><span>Avg Likes per Post:</span> ${avgLikes.toLocaleString()}</div>
          <div><span>Avg Comments per Post:</span> ${avgComments.toLocaleString()}</div>
          <div><span>Engagement Rate:</span> ${engagement}%</div>
          <small>
            <span><a href="https://keywordseverywhere.com/instagram-metrics.html" target="_blank">How these metrics are calculated</a></span>
            <a class="xt-ig-stats-btn" href="${chrome.runtime.getURL('html/igstats.html')}" target="_blank">Based on ${counts.posts} posts</a>
          </small>
          <div class="xt-instagram-stats-more-container">
            <button class="xt-instagram-stats-more-btn"><small>Analyze<br> More Posts</small></button>
          </div>
        `;
      }
      $widget.find('#xt-instagram-avg-widget-content').html(html);

      if (restoreScrollTop) {
        setTimeout(function(){
          window.scrollTo({left: 0, top: restoreScrollTop, behavior: 'smooth'});
          restoreScrollTop = 0;
        }, 1000);
      }
      $widget.find('.xt-ig-stats-btn').click(function(){
        chrome.runtime.sendMessage({cmd: 'ig.setData', data: {
          posts: igData, maxIndex: counts.maxLikesIndex, url: document.location.href}
        });
      });
      $widget.find('.xt-instagram-stats-more-btn').click(function(e){
        e.preventDefault();
        loadMoreClicked = true;
        restoreScrollTop = document.documentElement.scrollTop;
        if (!restoreScrollTop) restoreScrollTop = 1;
        window.scrollTo({left: 0, top: document.documentElement.scrollHeight, behavior: 'smooth'});
      });
    }
    setTimeout(function(){
      initAVGWidget();
    }, 3000);
  };


  var processPage = function(){
    addGenerateHashtagsBtn();
  };


  var waitSidebarReady = function(){
    return new Promise(resolve => {
      let attempt = 10;
      let timer = setInterval(() => {
        if (attempt-- <= 0) {
          clearInterval(timer);
          resolve();
        }
        let sidebar = document.querySelector(sidebarSelector);
        if (sidebar) {
          resolve(sidebar);
          clearInterval(timer);
        }
      }, 500);
    });
  };


  var menuItemTemplate = function(darkmode, text){
    var fill = darkmode ? 'white' : '';
    return `<span aria-describedby=":r4:" class="x4k7w5x x1h91t0o x1h9r5lt x1jfb8zj xv2umb2 x1beo9mf xaigb6o x12ejxvf x3igimt xarpa2k xedcshv x1lytzrv x1t2pt76 x7ja8zs x1qrby5j"><div class="x1n2onr6"><a class="x1i10hfl xjbqb8w x6umtig x1b1mbwd xaqea5y xav7gou x9f619 x1ypdohk xt0psk2 xe8uvvx xdj266r x11i5rnm xat24cr x1mh8g0r xexx8yu x4uap5 x18d9i69 xkhd6sd x16tdsg8 x1hl2dhg xggy1nq x1a2a7pz _a6hd" href="/explore/" role="link" tabindex="0"><div class="x9f619 x3nfvp2 xr9ek0c xjpr12u xo237n4 x6pnmvc x7nr27j x12dmmrz xz9dl7a xn6708d xsag5q8 x1ye3gou x80pfx3 x159b3zp x1dn74xm xif99yt x172qv1o x10djquj x1lhsz42 xzauu7c xdoji71 x1dejxi8 x9k3k5o xs3sg5q x11hdxyr x12ldp4w x1wj20lx x1lq5wgf xgqcy7u x30kzoy x9jhf4c"><div><div class="x9f619 xjbqb8w x78zum5 x168nmei x13lgxp2 x5pf9jr xo71vjh x1n2onr6 x1plvlek xryxfnj x1c4vz4f x2lah0s xdt5ytf xqjyukv x1qjc9v5 x1oa3qoh x1nhvcw1" style="margin-left: 14px;"><div class="x9f619 xxk0z11 xii2z7h x11xpdln x19c4wfv xvy4d1p"><svg height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg"><path fill="${fill}" d="m13.001 18c-.047 0-.094-.004-.142-.013-.406-.078-.674-.47-.596-.877l2-10.5c.077-.408.468-.673.877-.597.406.078.674.47.596.877l-2 10.5c-.068.36-.382.61-.735.61z"/><path fill="${fill}" d="m9.001 18c-.047 0-.094-.004-.142-.013-.406-.078-.674-.47-.596-.877l2-10.5c.077-.408.469-.673.877-.597.406.078.674.47.596.877l-2 10.5c-.068.36-.382.61-.735.61z"/><path fill="${fill}" d="m17.25 15h-10.5c-.414 0-.75-.336-.75-.75s.336-.75.75-.75h10.5c.414 0 .75.336.75.75s-.336.75-.75.75z"/><path fill="${fill}" d="m17.25 10.5h-10.5c-.414 0-.75-.336-.75-.75s.336-.75.75-.75h10.5c.414 0 .75.336.75.75s-.336.75-.75.75z"/><path fill="${fill}" d="m21.25 24h-18.5c-1.517 0-2.75-1.233-2.75-2.75v-18.5c0-1.517 1.233-2.75 2.75-2.75h18.5c1.517 0 2.75 1.233 2.75 2.75v18.5c0 1.517-1.233 2.75-2.75 2.75zm-18.5-22.5c-.689 0-1.25.561-1.25 1.25v18.5c0 .689.561 1.25 1.25 1.25h18.5c.689 0 1.25-.561 1.25-1.25v-18.5c0-.689-.561-1.25-1.25-1.25z"/></svg></div></div></div><div class="x6s0dn4 x9f619 xxk0z11 x6ikm8r xeq5yr9 x1swvt13 x1s85apg xzzcqpx" style="opacity: 1;"><div style="width: 100%;"><div class="" style="width: 100%;"><span class="x1lliihq x1plvlek xryxfnj x1n2onr6 x193iq5w xeuugli x1fj9vlw x13faqbe x1vvkbs x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x x1i0vuye xl565be xo1l8bm x5n08af x1tu3fi x3x7a5m x10wh9bi x1wdrske x8viiok x18hxmgj" dir="auto" style="line-height: var(--base-line-clamp-line-height); --base-line-clamp-line-height: 20px;"><span class="x1lliihq x193iq5w x6ikm8r x10wlt62 xlyipyv xuxw1ft" style="margin-left: 15px;">${text}</span></span></div></div></div></div></a></div></span>`;
  };


  var addGenerateHashtagsBtn = async function() {
    darkMode = isDarkMode();
    let sidebar = await waitSidebarReady();
    let widgetContainer = 'body';
    var $btn;
    var $btnBulk;
    if (sidebar) {
      let $newPost = $(sidebar).find('[aria-label="New post"]');
      if (!$newPost[0]) $newPost = $(sidebar).find('svg[aria-label]')[6];
      let $newPostItem = $($newPost).closest('a[role=link]').parent().parent().parent();
      $btn = $(menuItemTemplate(darkMode, 'Generate HashTags')).insertAfter($newPostItem);
      $btnBulk = $(menuItemTemplate(darkMode, 'Hashtags Metrics')).insertAfter($btn);
      if (vendor !== 'Firefox') {
        addIframe($newPostItem.parent(), darkMode,  'xt-instagram-sidebar-iframe', 'instgr_sidebar');
      }
    }
    else return;
    let btnURL = chrome.runtime.getURL(`html/page.html?page=hashtags&service=instagram`);
    let btnBulkURL = chrome.runtime.getURL(`html/page.html?page=hashtags_bulk&service=instagram`);
    $btn.click(function(e) {
      console.log(e);
      chrome.runtime.sendMessage({
        cmd: 'new_tab',
        data: btnURL
      });
    });
    $btnBulk.click(function(e) {
      console.log(e);
      chrome.runtime.sendMessage({
        cmd: 'new_tab',
        data: btnBulkURL
      });
    });

  };


  var isDarkMode = function() {
    let bgColor = getComputedStyle(document.body).backgroundColor;
    if (bgColor === "rgb(255, 255, 255)") res = false;
    else res = true;
    if (res) document.documentElement.setAttribute('dark', 'dark');
    return res;
  };


  var addIframe = function($parent, darkMode, id, source){
    var html = Common.renderIframeHTML({
      iframeSrcParam: source,
      darkMode: darkMode
    });
    var $div = $('<div>', {id: id}).html(html);
    $parent.append($div);
  };


  var processRelatedSearch = function(manual){
    var list = $('.related-searches__item-text');
    console.log(list);
    var keywords = {};
    for (var i = 0, len = list.length; i < len; i++) {
      var keyword = Common.cleanKeyword( list[i].textContent );
      keywords[ keyword ] = list[i];
    }
    var settings = Starter.getSettings();
    if ((!settings.sourceList.gprsea && !manual) || !settings.apiKey ) {
      var rows = [];
      for (var keyword in keywords) {
        rows.push({keyword: keyword});
      }
      Common.renderWidgetTable(rows, getRenderParams({json: null}));
      return;
    }
    processKeywords( keywords, {} );
  };


  var processKeywords = function( keywords, table ){
    Common.processKeywords({
        keywords: Object.keys( keywords ),
        tableNode: table,
        src: source
      },
      function(json){
        processRelatedSearchResponse( json, keywords );
      }
    );
  };


  var processRelatedSearchResponse = function( json, keywords ){
    var data = json.data;
    var rows = [];
    if (json.error_code === 'NOCREDITS') {
      for (var keyword in keywords) {
        rows.push({keyword: keyword});
      }
      Common.renderWidgetTable(rows, getRenderParams({json: null, nocredits: true}));
      return;
    }

    if (typeof json.data !== 'object') return;
    for (var key in json.data) {
      var item = json.data[key];
      rows.push(item);
    }
    if (!rows.length) return;
    rows.sort(function(a,b){
      var aVol = parseInt(a.vol.replace(/[,.\s]/g, ''));
      var bVol = parseInt(b.vol.replace(/[,.\s]/g, ''));
      return bVol - aVol;
    });
    Common.renderWidgetTable(rows, getRenderParams({json: json}));
  };


  var getRenderParams = function(params){
    var nocredits = params.nocredits;
    var settings = Starter.getSettings();
    var query = getQuery() || '';
    var res = {
      settingEnabled: settings.sourceList.bingco,
      type: 'related',
      title: 'Related Keywords',
      query: query,
      columnName: 'Keyword',
      rootSelector: 'xt-related-search',
      addTo: '.js-results-sidebar',
      addMethod: 'prependTo',
      iframeSrcParam: 'related',
      filename: 'ddg-' + query.replace(/\s+/g, '_'),
      fnGenerateLink: function(keywordEnc){
        return document.location.origin + '/search?q=' + keywordEnc;
      },
      onAdded: function($root){
        // checkWidgetPosition($root, $('#related'));
      },
      onClosed: function(){
        // clearTimeout(checkWidgetPositionTimer);
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
        processRelatedSearch('manual');
        $this.remove();
      }
    };
    for (var key in params) {
      res[key] = params[key];
    }
    return res;
  };


  var processQueryResponse = function( json ){
    var data;
    if (json.data) data = json.data[0];
    var $node = $('#xt-info');
    if (!$node.length) {
      $node = $('<link/>', {
          class: 'xt-ddg-query'
        })
        .attr('id', 'xt-info');
      var settings = Starter.getSettings();
      $node
        .insertAfter( $(rootSel) );
    }
    if (json.error_code === 'NOCREDITS') {
      return;
    }
    else if (!data) {
      Common.processEmptyData(json, $node);
      return;
    }
    else {
      if(data.vol != '-') {
        Common.addKeywords(data.keyword);
        var html = Common.getResultStrType2(data);
        html = Common.appendStar(html, data);
        html = Common.appendKeg(html, json, data);
        $node.html(html);
        var color = Common.highlight(data);
        if (color) {
          $node.addClass('xt-highlight');
          $node.css({background: color});
        }
      }
      else {
        $node.html('');
      }
    }
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


  var initMutationObserver = function( target ){
    var settings = Starter.getSettings();
    if (!settings.showMetricsForSuggestions) return;
    if (observer) observer.disconnect();
    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          if (!mutation.addedNodes.length) return;
          processChildList(mutation.addedNodes);
        }
      });
    });

    var config = { subtree: true, childList: true, characterData: true };
    observer.observe(target, config);
  };


  var processChildList = function(children){
    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];
      var $node = $(node);
      if ($node.hasClass('acp')) {
        processSuggestion(node);
      }
    }
  };


  var processSuggestion = function(node){
    var $node = $(node);
    var keyword = $.trim(node.textContent);
    if (!keyword) return;
    if (!suggestionsTimer) suggestionsList = {};
    suggestionsList[keyword] = node;
    if (suggestionsTimer) clearTimeout(suggestionsTimer);
    suggestionsTimer = setTimeout(function(){
      processSuggestionsList();
    }, 100);
  };



  var processSuggestionsList = function(){
    var list = $.extend({}, suggestionsList);
    var key = Object.keys(list).join('');
    if (cachedSuggestions[key]) {
      processSuggestionsListResponse(cachedSuggestions[key], list);
      return;
    }
    suggestionsTimer = null;
    Common.processKeywords({
        keywords: Object.keys( list ),
        tableNode: {},
        src: source
      },
      function(json){
        // console.log(json, list);
        processSuggestionsListResponse( json, list );
        cachedSuggestions[key] = json;
      }
    );
  };


  var processSuggestionsListResponse = function(json, keywords){
    var data = json.data;
    for (var key in data) {
      var item = data[key];
      var node = keywords[ item.keyword ];
      var $node = $(node);
      $node.find('.xt-suggestions-search').remove();
      var $span = $('<span/>').addClass('xt-suggestions-search');
      if (item.vol != '-' && item.vol != '0') {
        var html = Common.getResultStr(item);
        var color = Common.highlight(item);
        if (color) {
          $span.addClass('xt-highlight');
          $span.css({background: color});
        }
        // html = Common.appendStar(html, item);
        // html = Common.appendKeg(html, json, item);
        $span.html(html);
      }
      $node.append( $span );
    }
  };


  var getSource = function(){
    return source;
  };


  return {
    init: init,
    getSource: getSource
  };

})();
