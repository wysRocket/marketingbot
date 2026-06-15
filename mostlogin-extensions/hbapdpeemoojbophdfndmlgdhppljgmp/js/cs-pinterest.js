var Tool = (function(){

  var vendor = (navigator.userAgent.match(/(Chrome|Firefox)/) || [])[1];

  var source = 'pntrst';

  var settings;
  var rootSel = '#searchBoxContainer > div:last-child';
  var observer = null;

  var suggestionsTimer;
  var suggestionsList = {};
  var cachedSuggestions = {};

  var processedResponses = {};
  var cachedPinDetails = {};

  var relatedTimer = null;

  var $widgetsRoot;
  var metricsResponse;

  var configShowPinMetrics = true;
  var appVersion = '';
  var processedPins = {};

  var trendsChartEndDate;


  var init = function(){
    settings = Starter.getSettings();
    chrome.runtime.sendMessage({cmd: 'api.getConfig'}, function(json){
      if (!json.error && json.data && json.data.pinterest) {
        trendsChartEndDate = json.data.pinterest.endDate;
        configShowPinMetrics = json.data.pinterest.showPinMetrics;
      }
    });
    initWindowMessaging();
    $('body').addClass('xt-' + source);
    setTimeout( function(){
      processPage();
      initSuggestions();
    }, 1000 );
    initURLChangeListener(function(url){
      setTimeout( function(){
        processPage();
      }, 1100 );
    });
    setInterval(function(){
      processPins();
    }, 5000);
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
        var selector = '';
        if (source === 'pntrst') selector = '#xt-pinterest-widgets-root-iframe';
        if (!selector) return;
        if (height <= 0) return;
        $(selector + ' iframe').height(height + 10);
      }
    }, false);
  };


  var initSuggestions = function(){
    var timer = setInterval(function(){
      if (!observer) {
        // var node = $('#searchBoxContainer')[0];
        var node = $('[data-test-id="pro-partner-header"],#searchBoxContainer')[0];
        if (node) {
          clearInterval(timer);
          initMutationObserver(node);
        }
      }
    }, 500);
  };


  var processPage = function(){
    if (document.location.pathname.match(/\/pin\/\d+/)) {
      processPinPage();
      return;
    };
    if (document.location.pathname.match(/\/\w+\/_created\/?/)) {
      initSearchInsights();
      return;
    }
    if (!document.location.pathname.match(/\/(search|homefeed)/)) return;
    var query = getQuery();
    query = Common.cleanKeyword(query);
    chrome.runtime.sendMessage({
      cmd: 'api.getKeywordData',
      data: {
        keywords: [query],
        src: source
      }
    }, function( json ){
      metricsResponse = json;
      processQueryResponse( json );
      initWidgetsRoot();
      if (settings.showGoogleTrendChart || settings.sourceList.gprsea) {
        initTrendsChart(json);
      }
      initSearchInsights();
    });
  };


  var processPinPage = function(){
    var pinId = document.location.pathname.match(/\/pin\/(\d+)/)[1];
    $(`body template[data-resource][data-pinid=${pinId}]`).map(function(i, template){
      try {
        var json = JSON.parse(template.textContent);
        var item = json.resource_response.data;
        processSinglePin(item);
      } catch (e) {
        console.log(e);
      }
    })
  };


  var processSinglePin = async function(item){
    var data = await getPinData(item);
    var $shopBtn = $('[data-test-id="product-shop-button"]');
    var $content;
    if ($shopBtn[0]) {
      $content = $('<div>', {class: 'xt-single-pin-stats xt-pin'}).insertBefore($shopBtn);
    }
    else {
      var $prependTo = $('[data-test-id="canonical-card"]');
      $content = $('<div>', {class: 'xt-single-pin-stats xt-pin'}).prependTo($prependTo);
    }
    $content.html( pinterestPinStatTemplate(data) );
  };


  var processPins = function(args){
    $('body template[data-resource]').map(function(i, template){
      var id = template.dataset.resource;
      var res = template.dataset.res;
      if (template.dataset.pinid) return;
      try {
        var json = JSON.parse(template.textContent);
        var results = json.resource_response.data.results;
        if (!results && res === 'BoardContentRecommendationResource') {
          results = json.resource_response.data;
        }
        if (!results && res === 'UserActivityPinsResource') {
          results = json.resource_response.data;
        }
        results.map(function(item, index){
          processPin(item, index);
        });
      } catch (e) {
        console.log(e);
      }
    })
  }


  var processPin = async function(item, index){
    if (!configShowPinMetrics) return;
    if (!settings.showPinterestPinMetrics) return;
    var pinId = item.id;
    processedPins[pinId] = true;
    // if (Object.keys(processedPins).length > 5) return;
    var $nodes = $(`[data-test-pin-id="${pinId}"]`);
    if (!$nodes[0]) {
      // console.log('pin not found', pinId);
      return;
    }
    for (var i = 0, len = $nodes.length; i < len; i++) {
      var $node = $($nodes[i]);
      var className = 'xt-pin-root';
      var $footer = $node.find('[data-test-id="pinrep-footer"]');
      if (!$footer[0]) $footer = $node.find('[data-test-id="pointer-events-wrapper"]');
      if (!$footer[0]) {
        $footer = $node.find('[data-test-id="pinWrapper"]');
        className = 'xt-pin-root-bottom';
      }
      if (!$footer[0]) {
        // console.log('no footer found', pinId, $node, item);
        return;
      }
      if ($footer.find('.xt-pin')[0]) return;
      var $root = $('<div>', {class: className}).prependTo($footer[0]);
      var $content = $('<div>', {class: 'xt-pin'}).appendTo($root);
      var data = await getPinData(item);
      $content.html( pinterestPinStatTemplate(data) );
    };
  };


  var getPinData = async function(item){
    var pinId = item.id;
    if (typeof item.repin_count === 'undefined') item.repin_count = 0;
    var reactions = 0;
    if (item.reaction_counts) {
      reactions = Object.values(item.reaction_counts).reduce(function(a,b){return a + b}, 0);
    }
    var saves = 0;
    if (item.aggregated_pin_data && item.aggregated_pin_data.aggregated_stats) {
      saves = item.aggregated_pin_data.aggregated_stats.saves || 0;
    }
    var age = timeSince(new Date(item.created_at)) + ' ago';
    var pinDetails = cachedPinDetails[pinId];
    var comments = '';
    var shares = '';
    if (!pinDetails) {
      pinDetails = await getPinDetails(pinId);
      cachedPinDetails[pinId] = pinDetails;
    }
    if (!pinDetails.error) {
      comments = pinDetails.comments;
      shares = pinDetails.shares;
    }
    else {
      comments = 'n/a';
      shares = 'n/a';
    }
    var data = {
      likes: 0,
      repins: item.repin_count.toLocaleString(),
      saves: saves.toLocaleString(),
      reactions: reactions.toLocaleString(),
      comments: comments.toLocaleString(),
      shares: shares,
      age: age
    }
    return data;
  };


  var timeSince = function(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    var interval = seconds / 31536000;
    if (interval > 1) {
      return Math.floor(interval) + "y";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return Math.floor(interval) + "mo";
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return Math.floor(interval) + "d";
    }
    interval = seconds / 3600;
    if (interval > 1) {
      return Math.floor(interval) + "hrs";
    }
    interval = seconds / 60;
    if (interval > 1) {
      return Math.floor(interval) + "min";
    }
    return Math.floor(seconds) + "s";
  }


  var getPinDetails = async function(id){
    let path = {
      "source_url":`/pin/${id}/`,
      "data": `{"options":{"id":"${id}","field_set_key":"auth_web_main_pin","noCache":true,"fetch_visual_search_objects":true},"context":{}}`,
      "_": Date.now()
    };
    const url = new URL(document.location.origin + '/resource/PinResource/get/');
    url.search = new URLSearchParams(path).toString();
    let response = await fetch(url, {
      headers: {
          "x-app-version": appVersion,
          "x-pinterest-appstate": "active",
          "x-pinterest-experimenthash": undefined,
          "x-pinterest-source-url": '/search/pins/',
          "x-pinterest-pws-handler": 'www/search/[scope].js'
      }
    });
    if (response.status !== 200) {
      return {error: true};
    }
    let json = await response.json();
    let res = {};
    try {
      if (json.resource_response.data.id !== id) {
        console.log('wrong pin', json.resource_response.data.id, id);
        return {error: true};
      }
      res.comments = (json.resource_response.data.aggregated_pin_data || {}).comment_count;
      if (typeof res.comments === 'undefined') res.comments = '';
      res.shares = json.resource_response.data.share_count;
    } catch (e) {
      console.log(e);
      return {};
    }
    return res;
  };


  var initWidgetsRoot = function(){
    if ($widgetsRoot) $widgetsRoot.remove();
    var $divs = $('.mainContainer > .KvKvqR > div, #mweb-unauth-container > .KvKvqR > div');

    // if (!$divs[0]) {
    //   $divs = $('[data-test-id="header"] > .zI7 > div');
    //   inHeader = true;
    // }
    $widgetsRoot = $('<div>', {id: 'xt-pinterest-widgets-root'})
      .css({'flex-grow': 1});
      console.log($divs);
    if ($divs.length === 2) {
      $widgetsRoot.insertBefore($divs[0].parentNode);
      // var $banner = $($divs[0]);
      // console.log($banner[0]);
      // if ($banner.hasClass('qiB')) {
      //   $widgetsRoot.insertAfter($banner);
      // }
      // else {
      //   $banner.prepend($widgetsRoot);
      //   $banner
      //   .addClass('xt-pinterest-widgets-parent')
      //   .css({display: 'flex', height: 'auto'});
      // }
    }
    else if ($divs.length === 1) {
      $widgetsRoot.insertBefore($divs[0].parentNode);
    }
    else {
      if (typeof retry === 'undefined' || !retry) {
        console.log('Not found where to add widgets');
        setTimeout(function(){
          initWidgetsRoot();
          initTrendsChart(metricsResponse, true);
        }, 3000);
      }
      return;
    }
    console.log($widgetsRoot);

    var iframeHTML = Common.renderIframeHTML({
      query: getQuery(),
      settingEnabled: true,
      iframeSrcParam: source
    });

    $widgetsRoot.html(`
      <div id="xt-pinterest-widget-insights-container"></div>
      <div id="xt-pinterest-widget-chart-container"></div>
      <div id="xt-pinterest-widget-related-container"></div>
      <div id="xt-pinterest-widgets-root-iframe">
        ${iframeHTML}
      </div>
      `);
  };


  var getQuery = function(){
    var query = $('input[name=searchBoxInput]').val();
    if (!query) query = $('input[data-test-id="search-input"]').val();
    return $.trim(query);
  };


  var getTLD = function(){
    let tld = document.location.host.replace('www.', '').replace(/.*?\.pinterest\./, '').replace('pinterest.', '');
    return tld;
  };


  var getRelatedQueries = function(){
    $items = $('[data-root-margin="search-improvements-bar"] [data-test-id="search-guide"]');
    var list = [];
    $items.map(function(i, item){
      var text = item.getAttribute('title');
      if (text && text.indexOf('Search for') !== -1) {
        text = text.replace(/Search for "(.*)"$/, '$1');
        list.push(text);
      }
    });
    return list;
  };


  var checkRelatedQueries = function($node){
    clearInterval(relatedTimer);
    var count = 0;
    relatedTimer = setInterval(function(){
      if (count > 10) clearInterval(relatedTimer);
      count++;
      var hasRelated = !!getRelatedQueries().length;
      if (hasRelated) {
        clearInterval(relatedTimer);
        var html = $node.html();
        html = Common.appendListBtn(html, {
          title: 'Find Related Pin Ideas',
          service: 'pinterest',
          query: getQuery(),
          tld: getTLD()
        });
        $node.html(html);
        $node.find('.xt-listbtn-str').click(function(){
          var list = getRelatedQueries();
          chrome.runtime.sendMessage({
            cmd: 'setKeywordsPendingList',
            data: list
          });
        });
      }
    }, 1000);
  };


  var processQueryResponse = function( json ){
    var data;
    if (json.data) data = json.data[0];
    var $node = $('#xt-info');
    var hasRelated = !!getRelatedQueries().length;
    if (!$node.length) {
      $node = $('<div/>', {
          class: 'xt-pinterest-query'
        })
        .attr('id', 'xt-info');
      var $afterNode = $(rootSel);
      if (!$afterNode[0]) $afterNode = $('form[name=search]').parent().parent();
      $node
        .insertAfter( $afterNode );
    }
    if (!data) {
      if (json.error_code === 'NOCREDITS' || json.error_code === 'NO_API_KEY') {
        if (settings.showAutocompleteButton) {
          var html = Common.appendLTKBtn('', {
            query: getQuery(),
            title: 'Find topic ideas for ',
            service: 'pinterest',
            tld: getTLD()
          });
          // if (hasRelated) {
          //   html = Common.appendListBtn(html, {
          //     title: 'Find related pins',
          //     service: 'pinterest',
          //     tld: getTLD()
          //   });
          // }
          $node.html(html);
        }
      }
      else Common.processEmptyData(json, $node);
    }
    else {
      if (data.vol != '-') {
        Common.addKeywords(data.keyword);
        var html = Common.getResultStrType2(data);
        html = Common.appendStar(html, data);
        html = Common.appendKeg(html, json, data);
        if (settings.showAutocompleteButton) {
          html = Common.appendLTKBtn(html, {
            query: getQuery(),
            title: 'Find topic ideas for ',
            service: 'pinterest',
            tld: getTLD()
          });
          // if (hasRelated) {
          //   html = Common.appendListBtn(html, {
          //     query: getQuery(),
          //     title: 'Find related pins',
          //     service: 'pinterest',
          //     tld: getTLD()
          //   });
          // }
        }
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
    addPinStatsToggleBtn($node);
    checkRelatedQueries($node);
  };


  var addPinStatsToggleBtn = function($node){
    if (!configShowPinMetrics) return;
    var html = `<span id="xt-pinterest-pin-stats-btn" class="${!settings.showPinterestPinMetrics ? 'xt-pinterest-active' : ''}">${settings.showPinterestPinMetrics ? 'Hide Pin Metrics' : 'Show Pin Metrics'}</span>`
    $node.append(html);
    $('#xt-pinterest-pin-stats-btn').click(function(e){
      e.preventDefault();
      var turnOn = this.textContent === 'Show Pin Metrics';
      if (turnOn) this.textContent = 'Hide Pin Metrics';
      else this.textContent = 'Show Pin Metrics';
      this.classList.toggle('xt-pinterest-active', !turnOn);
      settings.showPinterestPinMetrics = turnOn;
      chrome.runtime.sendMessage({
        cmd: 'setting.set',
        data: {key: 'showPinterestPinMetrics', value: turnOn}
      });
      if (!turnOn) {
        $('.xt-pin').remove();
      }
      else {
        processPins();
      }
    });
  };


  var getContrastYIQ = function(hexcolor){
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
  };


  var initURLChangeListener = function( cbProcessPage ){
    var url = document.location.href;
    var timer = setInterval(function(){
      if ( url !== document.location.href ) {
        $('.xt-pinterest-query').remove();
        url = document.location.href;
        cbProcessPage( url );
      }
    }, 1000);
  };


  var initMutationObserver = function( target ){
    var settings = Starter.getSettings();
    if (!settings.showMetricsForSuggestions) return;
    if (!target) return;
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
      if ($node.find('[data-test-id="search-suggestion"]')[0] || $node.attr('data-test-id') === 'search-suggestion') {
        processSuggestion(node);
      }
    }
  };


  var processSuggestion = function(node){
    var $node = $(node);
    if (!suggestionsTimer) suggestionsList = {};
    $node.find('[data-test-id="search-suggestion"]').map(function(i, item){
      var keyword = Common.cleanKeyword( $.trim(item.textContent) );
      suggestionsList[keyword] = item;
    });
    if ($node.attr('data-test-id') === 'search-suggestion') {
      var keyword = Common.cleanKeyword( $.trim($node.text()) );
      suggestionsList[keyword] = node;
    }
    if (suggestionsTimer) clearTimeout(suggestionsTimer);
    suggestionsTimer = setTimeout(function(){
      processSuggestionsList();
      suggestionsTimer = null;
    }, 200);
  };


  var processSuggestionsList = function(list){
    if (!list) list = suggestionsList;
    var key = Object.keys(list).join('');
    if (cachedSuggestions[key]) {
      processSuggestionsListResponse(cachedSuggestions[key], list);
      return;
    }
    Common.processKeywords({
        keywords: Object.keys( list ),
        tableNode: {},
        src: source
      },
      function(json){
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
      var $appendToNode = $node.find('[data-test-id="regular-search-suggestion"] > div');
      if (!$appendToNode[0]) {
        console.log('not found node to append data', $node);
      }
      else $appendToNode.append( $span );
    }
    var $parent = $('[data-test-id="typeaheadResults"]');
    var filename = document.location.host.replace('www.', '') + '-' + getQuery() + '.csv';
    Common.addCopyExportButtons($parent, data, filename);
  };


  /**
   * Chart
   */

  var initTrendsChart = function(metricsResponse, retry){
    var hasCredits = Common.getCredits() > 0;
    if (settings.showGoogleTrendChart) {
      getChart({
        query: getQuery(),
        showVolume: hasCredits,
        metricsResponse: metricsResponse,
        endDate: trendsChartEndDate
      });
    }
    if (settings.sourceList.gprsea) {
      getRelatedTerms({
        query: getQuery()
      });
    }
  };


  var getRelatedTerms = function(params){
    chrome.runtime.sendMessage({cmd: 'pinterestTrendsAPI.relatedTerms', data: {
      query: params.query
    }}, async (res) => {
      // console.log(res);
      if (res.error && res.error !== 401) return;
      if (res.error === 401) {
        let $div = $('<section>', {class: 'xt-widget-table'}).appendTo('#xt-pinterest-widget-related-container');
        let html = [
          '<h3 class=""><img src="' + chrome.runtime.getURL('/img/icon24.png') + '" width="24" height="24" style="vertical-align:middle"> Related Trends</h3>',
          '<div>Login to Pinterest to view this data</div>'
        ].join('\n');
        $div.html(html);
        $div.append($('<div/>', {
          "class": 'xt-close'
        }).text('✖').click(function(e){
          $div.parent().remove();
        }));
        return;
      }
      var settings = Starter.getSettings();
      try {
        let items = res.json;
        let keywords = {};
        items.map(function(item){
          let trend = convertWeeklyCountsToTrend(item.counts);
          if (trend) keywords[item.term] = trend;
        });
        if (!settings.apiKey ) {
          let rows = [];
          for (let keyword in keywords) {
            rows.push({keyword: keyword});
          }
          Common.renderWidgetTable(rows, getRenderParams({json: null}));
          return;
        }
        processKeywords( keywords, {} );
      } catch (e) {
        console.log(e);
      }
    });
  };


  var convertWeeklyCountsToTrend = function(counts){
    var now = new Date();
    var sum = 0;
    var res = [];
    var currentMonth = now.getMonth();
    var notZero = false;
    for (var i = 0, len = counts.length; i < len; i++) {
      var count = counts[i];
      if (currentMonth === now.getMonth()) {
        sum += count;
      }
      else {
        res.unshift(sum);
        if (sum > 0) notZero = true;
        sum = 0;
        currentMonth = now.getMonth();
      }
      now.setDate(now.getDate() - 7);
    }
    res.shift();
    if (notZero) res = res.join('|');
    else res = '';
    return res;
  };


  var processKeywords = function( keywords, table ){
    let list = Object.keys(keywords);
    // console.log(list);
    Common.processKeywords({
        keywords: list,
        tableNode: table,
        src: source
      },
      function(json){
        processRelatedTermsResponse( json, keywords );
      }
    );
  };


  var processRelatedTermsResponse = function( json, keywords ){
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
      var trend = keywords[item.keyword];
      if (trend) {
        trend = trend.split('|');
        var avg = trend.reduce((partial_sum, a) => partial_sum + parseInt(a), 0) / trend.length;
        var volume = parseInt(item.vol.replace(/,/g, ''));
        var factor = volume / avg;
        var trendConverted = trend.map(function(val){
          return Math.round(parseInt(val) * factor);
        });
        item.trend = trendConverted.join('|');
      }
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
      settingEnabled: settings.sourceList[source],
      type: 'related',
      title: 'Related Trends',
      query: query,
      columnName: 'Keyword',
      rootSelector: 'xt-pinterest-related-search',
      addTo: '#xt-pinterest-widget-related-container',
      addMethod: 'appendTo',
      noPagination: true,
      excludeCols: ['cpc', 'comp'],
      rootTagName: '<section>',
      noIframe: true,
      // iframeSrcParam: 'pinterest',
      filename: 'pinterest-' + query.replace(/\s+/g, '_'),
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


  var initSearchInsights = async function(){
    let res = await fetch(document.location.href);
    let response = await res.text();
    let dom = (new DOMParser()).parseFromString(response, "text/html");
    let text = $('#__PWS_INITIAL_PROPS__', dom).text();
    // let text = $('#__PWS_DATA__', dom).text();
    let json = JSON.parse(text);
    if (!$(`template[data-resource="initial"]`)[0]) {
      let node = document.createElement("template");
      node.setAttribute("data-resource", "initial");
      node.textContent = JSON.stringify({resource_response:{
        data: {results: Object.values(json.initialReduxState.pins)}
      }});
      document.body.appendChild(node);
    }
    appVersion = json.app_version;
    let pins = json.initialReduxState.pins;
    if (!Object.keys(pins).length) {
      $(`template[data-resource][data-res="BaseSearchResource"]`).map(function(i,res){
        let json = JSON.parse(res.textContent);
        json.resource_response.data.results.map(function(item){
          pins[item.id] = item;
        })
      })
      if (!Object.keys(pins).length) return;
    }
    let stat = {
      count: 0,
      pinsCount: 0,
      productsCount: 0,
      verified: 0,
      pinners: {},
      pinnerDataById: {},
      pagesSum: 0,
      reaction_sum: {},
      reaction_total: 0,
      dominant_colors: []
    };
    for (let pinId in pins) {
      let pin = pins[pinId];
      if (stat.count >= 20) continue;
      if (!pinId.match(/^\d+$/)) continue; // promo
      if (!pin.pinner) continue;
      let isProduct = false;
      if (pin.shopping_flags && pin.shopping_flags.length > 0) {
        stat.productsCount++;
        isProduct = true;
      }
      else stat.pinsCount++;
      stat.count++;
      processPin(pin);
      if (pin.dominant_color) stat.dominant_colors.push(pin.dominant_color);
      // console.log('----------------', pinId, pin.grid_title, pin.reaction_counts, pin.story_pin_data, pin);
      if (pin.story_pin_data) {
        stat.pagesSum += pin.story_pin_data.page_count;
      }
      let pinnerId = pin.pinner.id;
      !stat.pinners[pinnerId] ? stat.pinners[pinnerId] = 1 : stat.pinners[pinnerId]++;
      stat.pinnerDataById[pinnerId] = {
        name: pin.pinner.full_name,
        username: pin.pinner.username
      };
      if (!isProduct) {
        // console.log(pin.reaction_counts, pin);
        for (let key in pin.reaction_counts) {
          if (stat.reaction_sum[key]) {
            stat.reaction_sum[key].sum += pin.reaction_counts[key];
            stat.reaction_sum[key].count++;
          }
          else stat.reaction_sum[key] = {sum: pin.reaction_counts[key], count: 1};
          stat.reaction_total += pin.reaction_counts[key];
        }
      }
      if (pin.pinner.verified_identity.verified) {
        stat.verified++;
      }
    }
    if (stat.pinsCount) {
      stat.reaction_avg = Math.round(stat.reaction_total / stat.pinsCount);
    }
    else stat.reaction_avg = '-';
    for (let key in stat.reaction_sum) {
      stat.reaction_sum[key].avg = Math.round(stat.reaction_sum[key].sum / stat.pinsCount);
    }
    let topPinnerId = getTopPinner(stat.pinners);
    if (topPinnerId) {
      stat.topPinner = stat.pinnerDataById[topPinnerId];
    }
    if (stat.pinsCount) {
      stat.pagesAvg = Math.round(stat.pagesSum / stat.pinsCount);
    }
    else stat.pagesAvg = '-';
    stat.dominant_colors.sort(function(a,b){
      return parseInt(b.replace('#', '0x')) - parseInt(a.replace('#', '0x'));
    });
    renderSearchInsights(stat);
  };


  var getTopPinner = function(pinners){
    let max = 1;
    let id = '';
    for (let key in pinners) {
      if (pinners[key] > max) {
        max = pinners[key];
        id = key;
      }
    }
    return id;
  };


  var renderSearchInsights = function(data){
    var selector = 'xt-pinterest-insights-widget';
    var $root = $('#' + selector);
    if (!$root[0]) {
      var settings = Starter.getSettings();
      var apiKey = settings.apiKey || '';
      var query = getQuery();
      var pur = Common.getCredits() > 0 ? 0 : 1;
      var version = chrome.runtime.getManifest().version;
      var settingEnabled = settings.sourceList.youtag;
      $root = $('<section>', { id: selector, class: "xt-widget-table" }).prependTo('#xt-pinterest-widget-insights-container');
      $root.html([
        '<div class="xt-close">✖</div>',
        `<h3><img src="${chrome.runtime.getURL('img/icon64.png')}" width="24" height="24"> Search Insights</h3>`,
        '<div class="xt-copy-export-row">',
          '<button class="xt-copy-csv xt-ke-btn">' + Common.getIcon('copy') + ' Copy</button>',
          '<button class="xt-export-csv xt-ke-btn">' + Common.getIcon('export') + ' Export</button>',
        '</div>',
        '<div class="xt-pinterest-widget-insights-body"></div>'
      ].join('\n'));
    }
    let res = JSON.stringify(data, '', '  ');
    let topPinnerHTML = '-';
    if (data.topPinner) {
      let topPinnerShort = data.topPinner.name;
      if (topPinnerShort.length > 25) topPinnerShort = topPinnerShort.substr(0,25) + '&hellip;';
      topPinnerHTML = `<a href="/${data.topPinner.username}" target="_blank">${topPinnerShort}</a>`;
    }
    let colorsHTML = '';
    data.dominant_colors.map(function(n){
      colorsHTML += `<span class="xt-pinterest-color-item" style="background: ${n}"></span>`;
    });
    let html = [
      '<table>',
      `<tr><td class="xt-widget-table-td-keyword"><span class="xt-ke-help" title="Top Pinner - this is the Pinterest account that has the most pins in this search result">Top Pinner</span></td><td class=""><span class="xt-ke-badge xt-ke-badge-light xt-ke-px-10px">${topPinnerHTML}</span></td></tr>`,
      `<tr><td class="xt-widget-table-td-keyword"><span class="xt-ke-help" title="Average Reactions - this is the average number of reactions that each pin has got in this search result">Average Reactions</span></td><td class=""><span class="xt-ke-badge xt-ke-badge-light xt-ke-px-10px">${data.reaction_avg}</span></td></tr>`,
      `<tr><td class="xt-widget-table-td-keyword" colspan="2">${renderReactionStat(data.reaction_sum)}</td></tr>`,
      `<tr><td class="xt-widget-table-td-keyword"><span class="xt-ke-help" title="Total Verified Pinners - this is the total number of pinners who have their profiles verified">Total Verified Pinners</span></td><td class=""><span class="xt-ke-badge xt-ke-badge-light xt-ke-px-10px">${data.verified}/${data.count}</span></td></tr>`,
      `<tr><td class="xt-widget-table-td-keyword"><span class="xt-ke-help" title="Average Slides Per Story - this is the average number of slides every pin has in this search result">Average Slides Per Story</span></td><td class=""><span class="xt-ke-badge xt-ke-badge-light xt-ke-px-10px">${data.pagesAvg}</span></td></tr>`,
      `<tr><td class="xt-widget-table-td-keyword"><span class="xt-ke-help" title="Dominant Colors - these are the dominant colors of each pin image in this search result">Dominant colors</span></td><td class=""><div class="xt-pinterest-colors">${colorsHTML}</div></td></tr>`,
      '</table>'
    ].join('\n');
    $root.find('.xt-pinterest-widget-insights-body').html(html);
    $root.find('.xt-ke-help').keTooltip();
    $root.find('.xt-close').click(function(){
      $root.hide();
    });
    $root.find('.xt-copy-csv').click(function(e){
      Common.exportTableToCSV({
        table: $root.find('table'),
        method: 'copy'
      });
    });
    $root.find('.xt-export-csv').click(function(e){
      Common.exportTableToCSV({
        table: $root.find('table'),
        method: 'export',
        filename: 'searchinsights-' + query.replace(/\s+/g, '_') + '.csv'
      });
    });

  };


  var renderReactionStat = function(reaction_sum) {
    let html = '';
    for (var key in reaction_sum) {
      html += `<img src="data:image/svg+xml;base64,${pinterestImgURLs[key]}"> ${reaction_sum[key].avg}`;
    }
    return html;
  };


  /**
   * Chart
   */


  var getLatestAvailableDate = async function(){
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        cmd: 'ajax.getPageHTML',
        data: {url: 'https://trends.pinterest.com/latest_available_date/'}
      }, function(response){
        if (!response) {
          resolve('');
          return '';
        }
        if (response.error) {
          resolve('');
          return '';
        }
        try {
          resolve(JSON.parse(response.data).date);
        } catch (e) {
          resolve('');
        }
      });
    });
  };


  var getChart = async function(params){
    let settings = Starter.getSettings();
    let endDate = await getLatestAvailableDate();
    if (!endDate) endDate = params.endDate;
    chrome.runtime.sendMessage({cmd: 'pinterestTrendsAPI.exactMatch', data: {
      query: params.query.toLowerCase(),
      country: settings.country,
      endDate: endDate
    }}, (res) => {
      if (res && res.error === 401) {
        renderTrendsChart(params, null);
        return;
      }
      let data = processTrendsResponse(res, params);
      if (!data) {
        // $('#xt-pinterest-widget-insights-container').addClass('hidden');
        $('#xt-pinterest-widget-chart-container').addClass('hidden');
        // $('#xt-pinterest-widget-related-container').addClass('hidden');
        return;
      }
      renderTrendsChart(params, data);
    });
  };


  var processTrendsResponse = function(res, params){
    // console.log(res, params);
    let metrics = params.metricsResponse;
    let result;
    let labels = [];
    let formattedTime = [];
    let values = [];
    let chartValues;
    let volumeChart = false;
    try {
      if (!res.json || !res.json[0]) return;
      let counts = res.json[0].counts;
      counts.map(function(item){
        labels.push(new Date(item.date).getTime());
        formattedTime.push(new Date(item.date).toLocaleDateString());
        values.push(item.normalizedCount);
      });
      chartValues = values;
      if (params.showVolume) {
        let convertedValues = convertInterestToVolume({
          labels,
          values,
          metrics: metrics,
          query: params.query
        });
        if (convertedValues) {
          chartValues = convertedValues;
          volumeChart = true;
        }
      }
    } catch (e) {
      console.log(e);
    }
    result = {
      volumeChart: volumeChart,
      labels: labels,
      values: chartValues,
      formattedTime: formattedTime
    };
    return result;
  };


  const convertInterestToVolume = (params) => {
    let {labels, values, metrics, query} = params;
    if (metrics.error) return;
    if (!metrics.data) return;
    let trendVals = metrics.data[0].trend.split('|');
    let lastVals = getLastNonZeroValues(trendVals, labels, values);
    let trendValue = lastVals.trendValue;
    if (typeof trendValue === 'undefined') return;
    if (trendVals.join('') === '') trendValue = parseInt(metrics.data[0].vol.replace(/,/g, ''));
    let interestValue = lastVals.interestValue;
    let divider = interestValue * 30;
    // if (timeRange.match(/(5yrs|12mo)/)) divider = interestValue * 4;
    // else if (timeRange.match(/(3mo|30d)/)) divider = interestValue * 30;
    // else if (timeRange === '7d') divider = interestValue * (30*24);
    let scaleFactor = trendValue / divider;
    let convertedValues = values.map(value => {
      let res = value * scaleFactor;
      let formattedRes;
      // if (res < 30 && timeRange.match(/(3mo|30d|7d)/)) formattedRes = res.toFixed(2);
      if (res <= 100) formattedRes = parseInt(res);
      else if (res > 100 && res <= 1000) formattedRes = (Math.round(res / 10) * 10);
      else if (res > 1000) formattedRes = Math.round(res / 100) * 100;
      return formattedRes;
    });
    // console.log(params, values, convertedValues, trendValue, interestValue, scaleFactor, lastVals);
    return convertedValues;
  };



  const getLastNonZeroValues = (arrTrend, arrTime, arrInterest) => {
    let sum = arrTrend.reduce((accumulator, currentValue) => {
      return accumulator + parseFloat(currentValue);
    });
    if (sum === 0) return {
      allZeroes: true,
      trendValue: 0
    };
    let today = new Date();
    let endOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    endOfPrevMonth.setHours(endOfPrevMonth.getHours()-endOfPrevMonth.getTimezoneOffset()/60);
    let endTs = endOfPrevMonth.getTime();
    let startIndex = arrTime.length - 1;
    let found = false;
    for (; startIndex >= 0; startIndex--) {
      if (arrTime[startIndex] < endTs) {
        found = true;
        break;
      }
    }
    // find non-zero
    let interestValue;
    let interestIndex;
    if (!found) {
      startIndex = 0; // for 7d & 30d
      for (let i = 0, len = arrTime.length; i < len; i++) {
        if (arrInterest[i] > 0) {
          interestIndex = i;
          interestValue = arrInterest[i];
          break;
        }
      }
    }
    else {
      for (let i = startIndex; i >= 0; i--) {
        if (arrInterest[i] > 0) {
          interestIndex = i;
          interestValue = arrInterest[i];
          break;
        }
      }
    }
    if (typeof interestIndex === 'undefined') {
      for (let i = 0, len = arrTime.length; i < len; i++) {
        if (arrInterest[i] > 0) {
          interestIndex = i;
          interestValue = arrInterest[i];
          break;
        }
      }
    }
    let nonZeroTS = arrTime[interestIndex];
    let d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    let trendValue;
    for (let i = 0, len = arrTrend.length; i < len; i++) {
      if (nonZeroTS >= d.getTime()) {
        trendValue = arrTrend[i];
        break;
      }
      d.setMonth(d.getMonth() - 1);
    }
    let res = {
      trendValue: trendValue,
      interestIndex: interestIndex,
      interestValue: interestValue,
      interestTS: nonZeroTS
    };
    return res;
  };


  var getIcon = function(icon) {
    switch (icon) {
      case 'copy':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      case 'export':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    }
  };


  var renderTrendsChart = function(params, data){
    let $widgetRoot = $('#xt-pinterest-widget-chart-container');
    let settings = Starter.getSettings();
    let geo = settings.country.toUpperCase();
    if (!geo) geo = 'US';
    if (geo !== 'UK' && geo !== 'CA') geo = 'US';
    let $div = $('<section>', {class: 'xt-widget-table'}).appendTo($widgetRoot);
    let html = [
      '<h3 class=""><img src="' + chrome.runtime.getURL('/img/icon24.png') + '" width="24" height="24" style="vertical-align:middle"> Trend Data For "' + params.query + ' (' + geo + ')"</h3>',
      '<div class="xt-copy-export-row">',
        '<button class="xt-copy-csv xt-ke-btn">' + getIcon('copy') + ' Copy</button>',
        '<button class="xt-export-csv xt-ke-btn">' + getIcon('export') + ' Export</button>',
      '</div>',
      `<canvas id="xt-trend-chart"></canvas>`,
    ].join('\n');
    if (!data) {
      html = [
        '<h3 class=""><img src="' + chrome.runtime.getURL('/img/icon24.png') + '" width="24" height="24" style="vertical-align:middle"> Trend Data For "' + params.query + ' (' + geo + ')"</h3>',
        '<div>Login to Pinterest to view this data</div>'
      ].join('\n');
    }
    // html += Common.renderIframeHTML({
    //   query: params.query,
    //   settingEnabled: true,
    //   iframeSrcParam: source
    // });
    $div.html(html);
    $div.append($('<div/>', {
      "class": 'xt-close'
    }).text('✖').click(function(e){
      $div.parent().remove();
    }));
    const getExportArray = (withHeaders) => {
      let arrRes = [];
      if (withHeaders) arrRes.push(['Date', `Search Volume ${params.countryTitle}`]);
      data.formattedTime.map((val, index) => {
        let date = val;
        arrRes.push([date, data.values[index]]);
      });
      return arrRes;
    };
    $widgetRoot.find('canvas').click(e => {
      chrome.runtime.sendMessage({
        cmd: 'new_tab',
        data: `https://trends.pinterest.com/?country=${geo}&terms=${params.query}`
      });
    });
    $widgetRoot.find('.xt-copy-csv').click(e => {
      e.preventDefault();
      Common.clipboardWrite( CSV.stringify(getExportArray(true), '\t') );
    });
    $widgetRoot.find('.xt-export-csv').click(e => {
      e.preventDefault();
      let query = params.query;
      let property = params.property;
      if (!property) property = 'google';
      let filename = ['trend', 'pinterest', query.replace(/\s+/g, '-'), Date.now()].join('-') + '.csv';
      filename = filename.toLowerCase();
      let csv = CSV.stringify( getExportArray(true), ',' );
      if (vendor === 'Firefox') {
        chrome.runtime.sendMessage({
          cmd: 'file.download',
          data: {
            content: csv,
            name: filename
          }
        });
        return;
      }
      var csvData = 'data:application/csv;charset=utf-8,' + '\ufeff' + encodeURIComponent(csv);
      Common.saveToFile(csvData, filename);
    });
    let $canvas = $div.find('#xt-trend-chart');
    if (!$canvas[0]) return;
    var ctx = $canvas[0].getContext('2d');

//     Chart.defaults.multicolorLine = Chart.defaults.line;
//     Chart.controllers.multicolorLine = Chart.controllers.line.extend({
//       draw: function(ease) {
//         let meta = this.getMeta();
//         let points = meta.data || [];
//         let regularColor = this.getDataset().borderColor;
//         let partialColor = this.getDataset().partialColor;
//         let area = this.chart.chartArea;
//         let originalDatasets = meta.dataset._children
//           .filter(function(data) {
//             return !isNaN(data._view.y);
//           });
//
//         function _setColor(newColor, meta) {
//           meta.dataset._view.borderColor = newColor;
//         }
//
//         if (!partialColor) {
//           Chart.controllers.line.prototype.draw.call(this, ease);
//           return;
//         }
//
//         for (let i = 0, len = meta.data.length; i < len; i++) {
//           var value = meta.data[i];
//           if (data.partial[i]) {
//             _setColor(partialColor, meta);
//             meta.dataset._children = originalDatasets.slice(i-1, i+1);
//             meta.dataset.draw();
//           }
//           else {
//             _setColor(regularColor, meta);
//             meta.dataset._children = originalDatasets.slice(i-1, i+1);
//             meta.dataset.draw();
//           }
//         }
//         meta.dataset._children = originalDatasets;
//         points.forEach(function(point) {
//           point.draw(area);
//         });
//       }
//     });

    var grayColor = params.darkMode ? '#aaa' : '#70757a';
    var gridColor = params.darkMode ? '#3e3e3e' : '#d9e2ef';
    var chartColor = '#c0504f';

    var chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: '',
          backgroundColor: chartColor,
          borderColor: chartColor,
          fill: true,
          // partialColor: '#00f000',
          data: data.values,
          colors: ['', 'red', 'green', 'blue']
        }],
        type: "line",
        pointRadius: 0,
        lineTension: 0,
        borderWidth: 1
      },
      options: {
        elements: {
          point:{
            radius: 0
          }
        },
        animation: {
          duration: 0
        },
        scales: {
          x: {
            type: "timeseries",
            distribution: "series",
            offset: true,
            ticks: {
              major: {
                enabled: true,
                fontStyle: "bold"
              },
              source: "data",
              autoSkip: true,
              autoSkipPadding: 75,
              maxRotation: 0,
              sampleSize: 100,
              fontColor: grayColor,
            },
            grid: {
              display: false
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              // display: data.volumeChart,
              display: true,
              padding: 10,
              color: grayColor,
              callback: function(value, index, values) {
                return Common.formatNumber(value);
              }
            },
            border: {
              display: false,
            },
            grid: {
              color: gridColor,
            },
            title: {
              display: true,
              color: grayColor,
              labelString: data.volumeChart ? 'Search Volume' : 'Search Interest'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            intersect: false,
            mode: "index",
            callbacks: {
              label: function(e, t) {
                if (!data.volumeChart) return e.raw;
                let res = parseFloat(e.raw).toLocaleString();
                return `${res}`;
              },
              title: function(e, t){
                let index = e[0].index;
                let res = data.formattedTime[index];
                return res;
              }
            }
          }
        }
      }
    });
    chart.update();
  };


  var getSource = function(){
    return source;
  };


  return {
    init: init,
    getSource: getSource
  };

})();


let pinterestPinStatTemplate = function(data){
  let html = `
  <ul class="nav align-items-center justify-content-between">
      <li href="#" class="xt-ke-pin-tooltip xt-ke-tooltip-fade-up d-flex align-items-center flex-nowrap" data-title="Repins: ${data.repins}">
          <svg width="15px" height="15px" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M17.1218 1.87023C15.7573 0.505682 13.4779 0.76575 12.4558 2.40261L9.61062 6.95916C9.61033 6.95965 9.60913 6.96167 9.6038 6.96549C9.59728 6.97016 9.58336 6.97822 9.56001 6.9848C9.50899 6.99916 9.44234 6.99805 9.38281 6.97599C8.41173 6.61599 6.74483 6.22052 5.01389 6.87251C4.08132 7.22378 3.61596 8.03222 3.56525 8.85243C3.51687 9.63502 3.83293 10.4395 4.41425 11.0208L7.94975 14.5563L1.26973 21.2363C0.879206 21.6269 0.879206 22.26 1.26973 22.6506C1.66025 23.0411 2.29342 23.0411 2.68394 22.6506L9.36397 15.9705L12.8995 19.5061C13.4808 20.0874 14.2853 20.4035 15.0679 20.3551C15.8881 20.3044 16.6966 19.839 17.0478 18.9065C17.6998 17.1755 17.3043 15.5086 16.9444 14.5375C16.9223 14.478 16.9212 14.4114 16.9355 14.3603C16.9421 14.337 16.9502 14.3231 16.9549 14.3165C16.9587 14.3112 16.9606 14.31 16.9611 14.3098L21.5177 11.4645C23.1546 10.4424 23.4147 8.16307 22.0501 6.79853L17.1218 1.87023ZM14.1523 3.46191C14.493 2.91629 15.2528 2.8296 15.7076 3.28445L20.6359 8.21274C21.0907 8.66759 21.0041 9.42737 20.4584 9.76806L15.9019 12.6133C14.9572 13.2032 14.7469 14.3637 15.0691 15.2327C15.3549 16.0037 15.5829 17.1217 15.1762 18.2015C15.1484 18.2752 15.1175 18.3018 15.0985 18.3149C15.0743 18.3316 15.0266 18.3538 14.9445 18.3589C14.767 18.3699 14.5135 18.2916 14.3137 18.0919L5.82846 9.6066C5.62872 9.40686 5.55046 9.15333 5.56144 8.97583C5.56651 8.8937 5.58877 8.84605 5.60548 8.82181C5.61855 8.80285 5.64516 8.7719 5.71886 8.74414C6.79869 8.33741 7.91661 8.56545 8.68762 8.85128C9.55668 9.17345 10.7171 8.96318 11.3071 8.01845L14.1523 3.46191Z" fill="#0F0F0F"/>
          </svg>
          <span class="xt-ke-value font-weight-semi-bold">${data.repins}</span>
      </li>
      <li href="#" class="xt-ke-pin-tooltip xt-ke-tooltip-fade-up d-flex align-items-center flex-nowrap" data-title="Saves: ${data.saves}">
          <svg width="15px" height="15px" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M4 4C4 2.34315 5.34315 1 7 1H17C18.6569 1 20 2.34315 20 4V20.9425C20 22.6114 18.0766 23.5462 16.7644 22.5152L12 18.7717L7.23564 22.5152C5.92338 23.5462 4 22.6114 4 20.9425V4ZM7 3C6.44772 3 6 3.44772 6 4V20.9425L12 16.2283L18 20.9425V4C18 3.44772 17.5523 3 17 3H7Z" fill="#0F0F0F"/>
          </svg>
          <span class="xt-ke-value font-weight-semi-bold">${data.saves}</span>
      </li>
      <li href="#" class="xt-ke-pin-tooltip xt-ke-tooltip-fade-up d-flex align-items-center flex-nowrap" data-title="Reactions: ${data.reactions}">
          <svg width="15px" height="15px" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M3.48877 6.00387C2.76311 7.24787 2.52428 8.97403 2.97014 10.7575C3.13059 11.3992 3.59703 12.2243 4.33627 13.174C5.06116 14.1052 5.9864 15.0787 6.96636 16.0127C8.90945 17.8648 11.0006 19.4985 12 20.254C12.9994 19.4985 15.0905 17.8648 17.0336 16.0127C18.0136 15.0787 18.9388 14.1052 19.6637 13.174C20.403 12.2243 20.8694 11.3992 21.0299 10.7575C21.4757 8.97403 21.2369 7.24788 20.5112 6.00387C19.8029 4.78965 18.6202 4 17 4C15.5904 4 14.5969 5.04228 13.8944 6.44721C13.5569 7.12228 13.3275 7.80745 13.1823 8.33015C13.1102 8.58959 13.0602 8.80435 13.0286 8.95172C12.9167 9.47392 12.3143 9.5 12 9.5C11.6857 9.5 11.0823 9.46905 10.9714 8.95172C10.9398 8.80436 10.8898 8.58959 10.8177 8.33015C10.6725 7.80745 10.4431 7.12229 10.1056 6.44722C9.40308 5.04228 8.40956 4 6.99998 4C5.37979 4 4.19706 4.78965 3.48877 6.00387ZM12 5.77011C12.0341 5.69784 12.0693 5.62535 12.1056 5.55279C12.9031 3.95772 14.4096 2 17 2C19.3798 2 21.1971 3.21035 22.2388 4.99613C23.2631 6.75212 23.5243 9.02597 22.9701 11.2425C22.7076 12.2927 22.0354 13.3832 21.2419 14.4025C20.4341 15.4402 19.4327 16.4891 18.4135 17.4605C16.3742 19.4042 14.1957 21.1022 13.181 21.8683C12.4803 22.3974 11.5197 22.3974 10.819 21.8683C9.80433 21.1022 7.62583 19.4042 5.58648 17.4605C4.56733 16.4891 3.56586 15.4402 2.75806 14.4025C1.96461 13.3832 1.2924 12.2927 1.02986 11.2425C0.475714 9.02597 0.736884 6.75213 1.76121 4.99613C2.80291 3.21035 4.62017 2 6.99998 2C9.59038 2 11.0969 3.95772 11.8944 5.55278C11.9307 5.62535 11.9659 5.69784 12 5.77011Z" fill="#0F0F0F"/>
          </svg>
          <span class="xt-ke-value font-weight-semi-bold">${data.reactions}</span>
      </li>
      <li href="#" class="xt-ke-pin-tooltip xt-ke-tooltip-fade-up d-flex align-items-center flex-nowrap" data-title="Comments: ${data.comments}">
          <svg width="15px" height="15px" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3C7.85113 3 4 5.73396 4 10C4 11.5704 4.38842 12.7289 5.08252 13.6554C5.79003 14.5998 6.87746 15.3863 8.41627 16.0908L9.2326 16.4645L8.94868 17.3162C8.54129 18.5384 7.84997 19.6611 7.15156 20.5844C9.56467 19.8263 12.7167 18.6537 14.9453 17.1679C17.1551 15.6948 18.3969 14.5353 19.0991 13.455C19.7758 12.4139 20 11.371 20 10C20 5.73396 16.1489 3 12 3ZM2 10C2 4.26604 7.14887 1 12 1C16.8511 1 22 4.26604 22 10C22 11.629 21.7242 13.0861 20.7759 14.545C19.8531 15.9647 18.3449 17.3052 16.0547 18.8321C13.0781 20.8164 8.76589 22.2232 6.29772 22.9281C5.48665 23.1597 4.84055 22.6838 4.56243 22.1881C4.28848 21.6998 4.22087 20.9454 4.74413 20.3614C5.44439 19.5798 6.21203 18.5732 6.72616 17.4871C5.40034 16.7841 4.29326 15.9376 3.48189 14.8545C2.48785 13.5277 2 11.9296 2 10Z" fill="#0F0F0F"/>
              <path d="M9 10C9 10.8284 8.32843 11.5 7.5 11.5C6.67157 11.5 6 10.8284 6 10C6 9.17157 6.67157 8.5 7.5 8.5C8.32843 8.5 9 9.17157 9 10Z" fill="#0F0F0F"/>
              <path d="M13.4976 10C13.4976 10.8284 12.826 11.5 11.9976 11.5C11.1692 11.5 10.4976 10.8284 10.4976 10C10.4976 9.17157 11.1692 8.5 11.9976 8.5C12.826 8.5 13.4976 9.17157 13.4976 10Z" fill="#0F0F0F"/>
              <path d="M16.5 11.5C17.3284 11.5 18 10.8284 18 10C18 9.17157 17.3284 8.5 16.5 8.5C15.6716 8.5 15 9.17157 15 10C15 10.8284 15.6716 11.5 16.5 11.5Z" fill="#0F0F0F"/>
          </svg>
          <span class="xt-ke-value font-weight-semi-bold">${data.comments}</span>
      </li>
      <li href="#" class="xt-ke-pin-tooltip xt-ke-tooltip-fade-up d-flex align-items-center flex-nowrap" data-title="Age: ${data.age}">
          <svg width="15px" height="15px" viewBox="0 0 24 24" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M23 12C23 18.0751 18.0751 23 12 23C5.92487 23 1 18.0751 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12ZM3.00683 12C3.00683 16.9668 7.03321 20.9932 12 20.9932C16.9668 20.9932 20.9932 16.9668 20.9932 12C20.9932 7.03321 16.9668 3.00683 12 3.00683C7.03321 3.00683 3.00683 7.03321 3.00683 12Z" fill="#0F0F0F"/>
              <path d="M12 5C11.4477 5 11 5.44771 11 6V12.4667C11 12.4667 11 12.7274 11.1267 12.9235C11.2115 13.0898 11.3437 13.2343 11.5174 13.3346L16.1372 16.0019C16.6155 16.278 17.2271 16.1141 17.5032 15.6358C17.7793 15.1575 17.6155 14.5459 17.1372 14.2698L13 11.8812V6C13 5.44772 12.5523 5 12 5Z" fill="#0F0F0F"/>
          </svg>
          <span class="xt-ke-value font-weight-semi-bold">${data.age}</span>
      </li>
      <li></li>
  </ul>
  `;
  return html;
};


let pinterestImgURLs = {
  1: "PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwKSI+CjxwYXRoIGQ9Ik0yMi4xOCAzLjM1QzI0LjYxIDUuODIgMjQuNjEgOS44NCAyMi4xOCAxMi4zMUwxMiAyMi41TDEuODIgMTIuMzFDMC42MSAxMS4wNyAwIDkuNDUgMCA3LjgzQzAgNi4yMSAwLjYxIDQuNTkgMS44MiAzLjM1QzQuMjYgMC44OSA4LjIyIDAuODkgMTAuNjUgMy4zNUwxMiA0LjcyTDEzLjM0IDMuMzVDMTQuNTYgMi4xMiAxNi4xNiAxLjUgMTcuNzYgMS41QzE5LjM2IDEuNSAyMC45NiAyLjEyIDIyLjE4IDMuMzVaIiBmaWxsPSIjRkY1MjQ2Ii8+CjxwYXRoIGQ9Ik0xNi4yNCAxMi44OEMxNi4yNCAxMi45IDE2LjI1IDEyLjkyIDE2LjI1IDEyLjk0QzE2LjI1IDE1LjI1IDE0LjM1IDE3LjEzIDEyIDE3LjEzQzkuNjUgMTcuMTMgNy43NSAxNS4yNiA3Ljc1IDEyLjk0QzcuNzUgMTIuOTIgNy43NiAxMi45IDcuNzYgMTIuODhDOS4wMiAxMy41NSAxMC40NyAxMy45MyAxMiAxMy45M0MxMy41MyAxMy45MyAxNC45OCAxMy41NCAxNi4yNCAxMi44OFpNNyA3LjEzQzUuOTYgNy4xMyA1LjEyIDcuOTcgNS4xMiA5LjAxQzUuMTIgMTAuMDUgNS45NiAxMC44OCA3IDEwLjg4QzguMDQgMTAuODggOC44NyAxMC4wNCA4Ljg3IDlDOC44NyA3Ljk2IDguMDQgNy4xMyA3IDcuMTNaTTE3IDcuMTNDMTUuOTYgNy4xMyAxNS4xMiA3Ljk3IDE1LjEyIDkuMDFDMTUuMTIgMTAuMDUgMTUuOTYgMTAuODggMTcgMTAuODhDMTguMDQgMTAuODggMTguODggMTAuMDQgMTguODggOUMxOC44OCA3Ljk2IDE4LjA0IDcuMTMgMTcgNy4xM1oiIGZpbGw9IiM3MjA5MDYiLz4KPC9nPgo8ZGVmcz4KPGNsaXBQYXRoIGlkPSJjbGlwMCI+CjxyZWN0IHdpZHRoPSIyNCIgaGVpZ2h0PSIyMSIgZmlsbD0id2hpdGUiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDAgMS41KSIvPgo8L2NsaXBQYXRoPgo8L2RlZnM+Cjwvc3ZnPiA=",
  5: "PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIzIDEyQzIzIDE4LjA4IDE4LjA4IDIzIDEyIDIzQzUuOTIgMjMgMSAxOC4wOCAxIDEyQzEgNS45MiA1LjkyIDEgMTIgMUMxOC4wOCAxIDIzIDUuOTIgMjMgMTJaIiBmaWxsPSIjOEY5RkY4Ii8+CjxwYXRoIGQ9Ik0xMiAxMkMxNC40OSAxMiAxNi45MSAxMi4yOCAxOS4yNSAxMi44QzE5LjI1IDEyLjgzIDE5LjI1IDEyLjg2IDE5LjI1IDEyLjg5QzE5LjI1IDE2LjgyIDE2IDIwIDEyIDIwQzggMjAgNC43NSAxNi44MiA0Ljc1IDEyLjg5QzQuNzUgMTIuODYgNC43NSAxMi44MyA0Ljc1IDEyLjhDNy4wOSAxMi4yOCA5LjUxIDEyIDEyIDEyWk02Ljc1IDkuMDlDNy4zOSA5LjA5IDcuOTYgOS40IDguMzIgOS44N0M4LjU4IDkuNTMgOC43NSA5LjEgOC43NSA4LjY0QzguNzUgNy41MyA3Ljg1IDYuNjIgNi43NSA2LjYyQzUuNjUgNi42MiA0Ljc1IDcuNTIgNC43NSA4LjY0QzQuNzUgOS4xMSA0LjkxIDkuNTMgNS4xOCA5Ljg3QzUuNTQgOS40IDYuMTEgOS4wOSA2Ljc1IDkuMDlaTTE3LjI1IDkuMDlDMTcuODkgOS4wOSAxOC40NiA5LjQgMTguODIgOS44N0MxOS4wOCA5LjUzIDE5LjI1IDkuMSAxOS4yNSA4LjY0QzE5LjI1IDcuNTMgMTguMzUgNi42MiAxNy4yNSA2LjYyQzE2LjE1IDYuNjIgMTUuMjUgNy41MiAxNS4yNSA4LjY0QzE1LjI1IDkuMTEgMTUuNDEgOS41MyAxNS42OCA5Ljg3QzE2LjA0IDkuNCAxNi42MSA5LjA5IDE3LjI1IDkuMDlaIiBmaWxsPSIjMDIxNTYzIi8+Cjwvc3ZnPiA=",
  7: "PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgY2xpcC1wYXRoPSJ1cmwoI2NsaXAwKSI+CjxwYXRoIGQ9Ik04IDIxLjVIMTZWMjEuNTlDMTYgMjIuOTIgMTQuOTIgMjQgMTMuNTkgMjRIMTAuNDFDOS4wOCAyNCA4IDIyLjkyIDggMjEuNTlWMjEuNVpNMTAuODkgMC4wNjAwMDA4QzYuNDIgMC41NTAwMDEgMi44IDQuMTggMi4zIDguNjVDMS44NyAxMi41NyA0LjA1IDE2LjMgNi44IDE4QzcuNjQgMTguNTIgOCAxOS4xNCA4IDIwVjIwLjVIMTZWMjBDMTYgMTkuMTQgMTYuNCAxOC41IDE3LjIgMThDMTkuOTUgMTYuMjkgMjEuNzUgMTMuMjIgMjEuNzUgOS43NUMyMS43NSA0IDE2Ljc3IC0wLjU4OTk5OSAxMC44OSAwLjA2MDAwMDhaIiBmaWxsPSIjRkZEMzQ4Ii8+CjxwYXRoIGQ9Ik0xMC4zOCA2LjI1QzEwLjM4IDcuMjkgOS41NCA4LjEyIDguNSA4LjEyQzcuNDYgOC4xMiA2LjYzIDcuMjkgNi42MyA2LjI1QzYuNjMgNS4yMSA3LjQ3MDAxIDQuMzcgOC41MSA0LjM3QzkuNTUgNC4zNyAxMC4zOCA1LjIxIDEwLjM4IDYuMjVaTTE1Ljc1IDQuMzdDMTQuNzEgNC4zNyAxMy44NyA1LjIxIDEzLjg3IDYuMjVDMTMuODcgNy4yOSAxNC43MSA4LjEyIDE1Ljc1IDguMTJDMTYuNzkgOC4xMiAxNy42MyA3LjI4IDE3LjYzIDYuMjVDMTcuNjMgNS4yMiAxNi43OSA0LjM3IDE1Ljc1IDQuMzdaTTcgMTIuMDVDNyAxNC43OCA5LjI0IDE3IDEyIDE3QzE0Ljc2IDE3IDE3IDE0Ljc4IDE3IDEyLjA1QzE3IDkuMzIgNyA5LjMyIDcgMTIuMDVaIiBmaWxsPSIjNkEzOTA5Ii8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDAiPgo8cmVjdCB3aWR0aD0iMTkuNSIgaGVpZ2h0PSIyNCIgZmlsbD0id2hpdGUiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDIuMjUpIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+IA==",
  11: "PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE1IDIzSDlDNC41OCAyMyAxIDE5LjQyIDEgMTVWOUMxIDQuNTggNC41OCAxIDkgMUgxNUMxOS40MiAxIDIzIDQuNTggMjMgOVYxNUMyMyAxOS40MiAxOS40MiAyMyAxNSAyM1oiIGZpbGw9IiNGRkFENjUiLz4KPHBhdGggZD0iTTkuODggOEM5Ljg4IDkuMDQgOS4wNCA5Ljg4IDggOS44OEM2Ljk2IDkuODggNi4xMiA5LjA0IDYuMTIgOEM2LjEyIDYuOTYgNi45NiA2LjEyIDggNi4xMkM5LjA0IDYuMTIgOS44OCA2Ljk2IDkuODggOFpNMTYgNi4xMkMxNC45NiA2LjEyIDE0LjEyIDYuOTYgMTQuMTIgOEMxNC4xMiA5LjA0IDE0Ljk2IDkuODggMTYgOS44OEMxNy4wNCA5Ljg4IDE3Ljg4IDkuMDQgMTcuODggOEMxNy44OCA2Ljk2IDE3LjA0IDYuMTIgMTYgNi4xMlpNMTIgMTEuNUM5LjkzIDExLjUgOC4yNSAxMy40IDguMjUgMTUuNzVDOC4yNSAxOC4xIDkuOTMgMjAgMTIgMjBDMTQuMDcgMjAgMTUuNzUgMTguMSAxNS43NSAxNS43NUMxNS43NSAxMy40IDE0LjA3IDExLjUgMTIgMTEuNVoiIGZpbGw9IiM2MDM2MUEiLz4KPC9zdmc+IA==",
  13: "PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuNTggMjNMMy45MyAxNS40NkwwIDkuNEw3LjAxIDYuNDhMMTIgMUwxNi45OSA2LjQ5TDI0IDkuNEwyMC4wNyAxNS40NUwxOS40MiAyM0wxMiAyMUw0LjU4IDIzWiIgZmlsbD0iIzQ0RTFCOSIvPgo8cGF0aCBkPSJNMTYuNDkgMTQuNUMxNi40OSAxNC41MyAxNi41IDE0LjU1IDE2LjUgMTQuNTdDMTYuNSAxNy4wMSAxNC40OSAxOSAxMiAxOUM5LjUwOTk5IDE5IDcuNDk5OTkgMTcuMDIgNy40OTk5OSAxNC41N0M3LjQ5OTk5IDE0LjU0IDcuNTA5OTkgMTQuNTIgNy41MDk5OSAxNC41QzguODU5OTkgMTUuMTcgMTAuMzggMTUuNTYgMTIgMTUuNTZDMTMuNjIgMTUuNTYgMTUuMTQgMTUuMTcgMTYuNDkgMTQuNVpNNy44Mzk5OSAxMS4zMUM4LjQ3OTk5IDExLjE0IDkuMTI5OTkgMTEuMyA5LjYwOTk5IDExLjY4QzkuNzU5OTkgMTEuMyA5Ljc5OTk5IDEwLjg4IDkuNjc5OTkgMTAuNDZDOS4zOTk5OSA5LjQxIDguMjk5OTkgOC43OSA3LjIyOTk5IDkuMDdDNi4xNTk5OSA5LjM1IDUuNTI5OTkgMTAuNDMgNS44MTk5OSAxMS40OEM1LjkyOTk5IDExLjkgNi4xNzk5OSAxMi4yNSA2LjQ5OTk5IDEyLjVDNi43MTk5OSAxMS45MyA3LjE5OTk5IDExLjQ4IDcuODM5OTkgMTEuMzFaTTE3LjUgMTIuNUMxNy44MiAxMi4yNSAxOC4wNyAxMS45IDE4LjE4IDExLjQ4QzE4LjQ3IDEwLjQzIDE3LjgzIDkuMzUgMTYuNzcgOS4wN0MxNS43IDguNzkgMTQuNjEgOS40MSAxNC4zMiAxMC40NkMxNC4yMSAxMC44OCAxNC4yNCAxMS4zIDE0LjM5IDExLjY4QzE0Ljg3IDExLjMgMTUuNTIgMTEuMTQgMTYuMTYgMTEuMzFDMTYuOCAxMS40OCAxNy4yOCAxMS45MyAxNy41IDEyLjVaIiBmaWxsPSIjMEM0MDNCIi8+Cjwvc3ZnPiA="
};

