var Tool = (function(){

  var vendor = (navigator.userAgent.match(/(Chrome|Firefox)/) || [])[1];

  const OFFPAGE_PERCENT = 0.65;
  const ONPAGE_PERCENT = 0.35;
  const PAGINATION_OPTIONS = [10, 20, 50, 100, 200];
  const BACKLINKS_LINK_LEN = 50;
  const BACKLINKS_ANCHOR_LEN = 20;
  var currentBacklinksPerPage;

  var source = 'gsearc';
  var conf;
  var showLinkData = false;
  var showTopKeywords = false;
  var showSEOReports = false;

  var darkMode = false;

  var rootSel = '#sbtc';
  var addMethod = 'appendTo';
  var rightColSelector = '#cnt:not(.rfli) #rhs';

  var serpObserver;

  var suggestionsObserver;
  var suggestionsTimer;
  var suggestionsList = {};
  var cachedSuggestions = {};

  var $popover;
  var popoverTimeout;

  var hasCredits = false;
  var dataByKeyword = {};
  var topKeywordsByURL = {};
  var dataSEOReport = {};

  var init = function(){
    if (document.location.href.indexOf('sorry/index') !== -1) {
      return;
    }
    var itemtype = document.documentElement.getAttribute('itemtype');
    if (!itemtype) itemtype = '';
    if (document.location.href.match(/google\.[\w.]+\/?$/)) itemtype = 'SearchResultsPage';
    if (document.location.href.match(/google\.[\w.]+\/[\w=?&]+$/)) itemtype = 'SearchResultsPage';
    if (itemtype.indexOf('SearchResultsPage') === -1) {
      return;
    }

    darkMode = isDarkMode();
    if (darkMode) {
      document.documentElement.setAttribute('dark', true);
    }

    initWindowMessaging();
    setTimeout( function(){
      var node = $('#sbtc')[0];
      if (!node) node = $('#tsf')[0];
      if (!node) node = $('form[role=search]')[0];
      if (!node) {
        console.error("Target not found");
        return;
      }
      initSERPMutationObserver();
      initSuggestionsMutationObserver(node);
      processPage();
    }, 500 );

    initURLChangeListener(function(){
      setTimeout( function(){
        processPage();
      }, 500 );
    });

    initPopover();
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
        if (source === 'pasf') selector = '#xt-google-people-search';
        if (source === 'ltkwid') selector = '#xt-google-ltkwid';
        else if (source === 'related') selector = '#xt-related-search';
        else if (source === 'trend') selector = '#xt-trend-chart-root';
        else if (source === 'trenkw') selector = '#xt-google-trenkw';
        else if (source === 'seoreport') selector = '#xt-seoreport-root';
        else if (source === 'difficulty') selector = '#xt-difficulty-root';
        else if (source === 'topicg') selector = '#xt-google-topical';
        else if (source === 'topkw') selector = '#xt-google-topkw';
        else if (source === 'backlinks') selector = '.xt-backlinks-widget .xt-widget-iframe';
        else if (source === 'free_google_serp') selector = '.xt-google-top-keywords-line .xt-widget-iframe';
        else if (source === 'free_google_search_volume') selector = '.xt-google-query .xt-widget-iframe';
        else if (source.indexOf('freeuser') !== -1) selector = '#xt-freeuser-root';
        if (!selector) return;
        if (height <= 0) return;
        if (data.isEmpty) height = 0;
        $(selector + ' iframe').height(height);
      }
    }, false);
  };


  var initPopover = function(){
    $popover = $('<div/>')
      .attr('id', 'xt-popover')
      .appendTo( $('body') );
    var hideTimer;

    $('body').on('mouseenter', '.xt-google-url-metrics, .xt-google-domain-link-metrics',
      function(e){
        var html = this.dataset.popover;
        var trendStr = this.dataset.trend;
        var rect = e.target.getBoundingClientRect();
        $popover[0].dataset.type = '';
        $popover.html(html);
        var top = document.documentElement.scrollTop + rect.top + rect.height - 5;
        clearTimeout(hideTimer);
        showPopover($popover, top, e.pageX - 50);
        if (trendStr) {
          renderPopoverTrendChart($popover, trendStr, {darkMode: darkMode});
          var domain = this.dataset.domain;
          var arr = Common.parseTrendStr(trendStr, {moz: true});
          var $table = $popover.find('table');
            $table.append(`<tr class="xt-hidden"><td></td><td></td></tr>`);
            $table.append(`<tr class="xt-hidden"><td>Month</td><td>Domain Authority</td></tr>`);
          arr.map(function(item){
            $table.append(`<tr class="xt-hidden"><td>${item.date}</td><td>${item.val}</td></tr>`);
          });
          $popover.find('.xt-copy-csv').click(function(e){
            Common.exportTableToCSV({
              table: $popover.find('table'),
              method: 'copy'
            });
          });
          $popover.find('.xt-export-csv').click(function(e){
            Common.exportTableToCSV({
              table: $popover.find('table'),
              method: 'export',
              filename: domain.replace(/\s+/g, '_') + '-domain-link-metrics-' + Common.getDate('YYYY-MM-DD') + '.csv'
            });
          });
        }
      });
    $('body').on('mouseleave', '.xt-google-url-metrics, .xt-google-domain-link-metrics',
      function(e){
        clearTimeout(popoverTimeout);
        if ($(e.relatedTarget).closest('#xt-popover')[0] || e.relatedTarget === $popover[0]) return;
        hideTimer = setTimeout(function(){
          $popover.hide();
        }, 500);
      });
    $('body').on('mouseenter', '.xt-popover', function(e){
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = null;
    });

    $popover.mouseleave(function(e){
      $popover.hide();
    });

    $('body').on('click', '.xt-google-backlinks', function(e){
      var $self = $(this);
      var $next = $self.next();
      if ($next[0] && $next.hasClass('xt-backlinks-widget')) {
        if ($next.is(':visible')) {
          $next.hide();
          $self.text('Show backlinks');
        }
        else {
          $self.text('Hide backlinks');
          $next.show();
        }
        return;
      }
      else {
        $next = $('<div>', {class: 'xt-backlinks-widget xt-widget-table'}).insertAfter($self);
        $self.text('Hide backlinks');
      }
      var domain = this.dataset.domain;
      var page = this.dataset.page;
      runBacklinks({page: page, domain: domain, uniq: true, perDomain: false, $root: $next});
    });
  };


  var runBacklinks = function(params){
    html = `<div style="text-align:center"><img src="${chrome.runtime.getURL('img/spinner32.gif')}"></div>`;
    var settings = Starter.getSettings();
    var keywordsPerPage = settings.widgetBacklinksPerPage || 10;
    if (currentBacklinksPerPage) keywordsPerPage = currentBacklinksPerPage;
    params.$root.html(html);
    getBacklinks({
      domain: params.domain,
      page: params.page,
      uniq: params.uniq,
      perDomain: params.perDomain
    })
      .then(getBacklinksDomainsAuthority)
      .then(function(response){
        let html = processGetBacklinksResponse(response, params);
        params.$root.html(html);
        let $table = params.$root.find('table');
        Common.showWidgetTablePage($table, response.links, keywordsPerPage, 1);
        initBacklinksPopoverEvents(response, params);
      })
      .catch(function(response){
        console.log(response);
      });
  };


  var initBacklinksPopoverEvents = function(response, params){
    let $root = params.$root;
    $root.find('.xt-show-backlinks-retry').click(function(e){
      e.preventDefault();
      runBacklinks(params);
    });
    $root.find('.xt-show-backlinks-domain-page-toggle').click(function(e){
      e.preventDefault();
      let target = this.dataset.target;
      params.perDomain = target === 'domain';
      runBacklinks(params);
    });
    $root.find('.xt-show-backlinks-uniq-toggle').click(function(e){
      e.preventDefault();
      let uniq = this.dataset.uniq;
      params.uniq = uniq === 'uniq';
      runBacklinks(params);
    });
    $root.on('click', '[data-page]', function(e){
      e.preventDefault();
      var page = parseInt(this.dataset.page);
      var perPage = $root.find('.xt-widget-page-select').val();
      var html = Common.getPaginationHTML({perPage: perPage, rows: response.links, currentPage: page, options: PAGINATION_OPTIONS});
      $root.find('.xt-widget-pagination').html(html);
      var $table = $root.find('table');
      Common.showWidgetTablePage($table, response.links, perPage, page);
    });

    $root.on('change', '.xt-widget-page-select', function(e){
      var perPage = this.value;
      var html = Common.getPaginationHTML({perPage: perPage, rows: response.links, currentPage: 1, options: PAGINATION_OPTIONS});
      $root.find('.xt-widget-pagination').html(html);
      var $table = $root.find('table');
      Common.showWidgetTablePage($table, response.links, perPage, 1);
      currentBacklinksPerPage = perPage;
      chrome.runtime.sendMessage({
        cmd: 'setting.set',
        data: {
          key: 'widgetBacklinksPerPage',
          value: perPage
        }
      });
    });

    let filename = getBacklinksExportFilename(params);

    $root.find('.xt-copy-csv').click(function(e){
      e.preventDefault();
      var table = exportBacklinksTable( $($root.find('table')[0]), params );
      Common.exportTableToCSV({table: table, filename: filename, method: 'copy'});
    });

    $root.find('.xt-export-csv').click(function(e){
      e.preventDefault();
      var table = exportBacklinksTable( $($root.find('table')[0]), params );
      Common.exportTableToCSV({table: table, filename: filename});
    });
  };


  var getBacklinksExportFilename = function(params){
    var res = ['Backlinks'];
    res.push(params.uniq ? 'Unique' : 'All');
    if (!params.perDomain) {
      res.push('Page');
      res.push(params.page.replace(/https?:\/\//, '').substr(0, 40));
    }
    else {
      res.push('Domain');
      res.push(params.domain);
    }
    res = res.join('-') + '.csv';
    return res;
  };


  var exportBacklinksTable = function($table, params){
    var $result = $('<table>');
    $table.find('tr').each(function(i, tr){
      var $tr = $('<tr>').appendTo($result);
      $(tr).find('td,th').each(function(j, td){
        var text = td.textContent;
        if (td.querySelector('a[title]')) {
          text = td.querySelector('a').getAttribute('title');
        }
        $('<td>').text(text).appendTo($tr);
      });
    });
    return $result;
  };


  var getBacklinks = function(params){
    let cmd = '';
    if (params.uniq && params.perDomain) cmd = 'api.getUniqueDomainBacklinks';
    if (params.uniq && !params.perDomain) cmd = 'api.getUniquePageBacklinks';
    if (!params.uniq && params.perDomain) cmd = 'api.getDomainBacklinks';
    if (!params.uniq && !params.perDomain) cmd = 'api.getPageBacklinks';

    return new Promise(function(resolve, reject){
      chrome.runtime.sendMessage({
        cmd: cmd,
        data: params
      }, function(response){
        resolve(response);
      });
    });
  };


  var getBacklinksDomainsAuthority = function(response){
    if (response.error) {
      response.links = [];
      return response;
    }
    let links = response.backlinks || [];
    let authorityByDomain = {};
    let promises = [];
    let chunks = [];
    let chunkSize = 500;
    let settings = Starter.getSettings();
    let linksClone = links.slice();
    for (let i = 0, len = Math.ceil(linksClone.length/chunkSize); i < len; i++) {
      chunks.push( linksClone.splice(0, chunkSize));
    }
    chunks.map(function(chunk){
      let promise = new Promise(function(resolve){
        let domains = [];
        if (!chunk.length) {
          resolve({links: chunk});
          return;
        }
        chunk.map(function(item){
          domains.push(item.domain_source);
        });
        chrome.runtime.sendMessage({
          cmd: 'api.getDomainLinkMetrics',
          data: {
            domains: domains,
            country: settings.country
          }
        }, function(json){
          if (json.error) {
            console.log(json);
            resolve({links: chunk});
            return;
          }
          json.data.map(function(item){
            if (item.error) return;
            let da = item.data.moz_domain_authority;
            authorityByDomain[item.domain] = da;
          });
          resolve({
            links: chunk,
            authorityByDomain: authorityByDomain
          });
        });
      });
      promises.push(promise);
    });
    return Promise.all(promises).then(function(responses){
      // console.log(responses);
      return {
        links: links,
        authorityByDomain: authorityByDomain
      };
    });
  };


  var processGetBacklinksResponse = function(response, params){
    let links = response.links;
    let authorityByDomain = response.authorityByDomain;
    var settings = Starter.getSettings();
    var keywordsPerPage = settings.widgetBacklinksPerPage || 10;
    // console.log(response);
    if (currentBacklinksPerPage) keywordsPerPage = currentBacklinksPerPage;
    let html = `
      <div class="xt-backlinks-widget-controls">
        <button class="xt-ke-btn xt-show-backlinks-domain-page-toggle" data-target="${params.perDomain ? 'page' : 'domain'}">show backlinks for ${params.perDomain ? 'page' : 'entire domain'}</button>
        <button class="xt-ke-btn xt-show-backlinks-uniq-toggle" data-uniq="${params.uniq ? '' : 'uniq'}">show ${params.uniq ? 'all backlinks' : 'only one backlink'} per subdomain</button>
      </div>
    `;
    if (response.error) {
      html += '<div class="xt-ke-mt-md xt-text-center">Unable to get data <a href="#" class="xt-show-backlinks-retry" data-target="domain">Try again?</a></div>';
    }
    else if (!links.length) {
      html += '<div class="xt-ke-mt-md xt-text-center">No backlinks found for this page <a href="#" class="xt-show-backlinks-domain-page-toggle" data-target="domain">View backlinks for the entire domain</a></div>';
    }
    else {
      html += '<table><thead>';
      html += '<tr><th>URL</th><th>Anchor Text</th><th class="xt-ke-text-right">Moz DA</th><th class="xt-hidden">Target URL</th></tr></thead><tbody>';
      let domains = [];
      links.map(function(item){
        let da = authorityByDomain[item.domain_source];
        let daStr = da ? `${da}/100` : '-';
        let tr = `<tr data-domain="${Common.escapeHtml(item.domain_source)}">`;
        tr += `<td><a href="${Common.escapeHtml(item.url_source)}" target="_blank" title="${Common.escapeHtml(item.url_source)}">${Common.shortenStr(Common.escapeHtml(item.url_source), BACKLINKS_LINK_LEN)}</a></td>`;
        let anchorText = Common.escapeHtml(Common.decodeHTMLEntities(item.anchor_text));
        tr += `<td><a href="${Common.escapeHtml(item.url_target)}" target="_blank" title="${anchorText}">${Common.shortenStr(anchorText, BACKLINKS_ANCHOR_LEN)}</a></td>`;
        tr += `<td class="xt-ke-text-right"><span class="xt-ke-badge xt-ke-badge-light xt-ke-px-10px">${daStr}</span></td>`;
        tr += `<td class="xt-hidden">${item.url_target}</td>`;
        tr += '</tr>';
        html += tr;
      });
      html += '</tbody></table>';
      html += Common.renderIframeHTML({
        query: getQuery(),
        settingEnabled: true,
        darkMode: darkMode,
        iframeSrcParam: 'backlinks'
      });
      html += '<div class="xt-widget-pagination">' + Common.getPaginationHTML({perPage: keywordsPerPage, rows: links, currentPage: 1, options: PAGINATION_OPTIONS}) + '</div>';
      html += [
        '<div class="xt-copy-export-row">',
          '<button class="xt-copy-csv xt-ke-btn">' + Common.getIcon('copy') + ' Copy</button>',
          '<button class="xt-export-csv xt-ke-btn">' + Common.getIcon('export') + ' Export</button>',
        '</div>'].join('\n');
    }
    return html;
  };


  var showPopover = function($popover, top, left){
    if (popoverTimeout) clearTimeout(popoverTimeout);
    popoverTimeout = setTimeout(function(){
      $popover
        .show()
        .css('top', top)
        .css('left', left);
    }, 300);
  };


  var isDarkMode = function() {
    let bgColor = getComputedStyle(document.body).backgroundColor;
    if (bgColor === "rgb(255, 255, 255)") return false;
    if (bgColor === "rgba(0, 0, 0, 0)") return false;
    else return true;
  };


  var getQuery = function(corrected){
    var query = getURLParameter('q', true);
    if (!query) query = getURLParameter('q');
    if (!query) query = getURLParameter('as_q');
    if (!query) query = '';
    if (corrected) {
      var correctedText = $.trim( $('#taw .med').text() );
      if (correctedText && correctedText.match(/(did you mean|including results for|showing results for)/i)) {
        query = $.trim($($('#taw .med a')[0]).text());
      }
    }
    return query;
  };


  var revealResults = function(){
    var $stats = $('#result-stats');
    if (!$stats[0] || !$stats.text().trim()) return;
    if ($stats.is(':visible')) return;
    if ($stats.text().match(/ 0 results/)) return;
    $('#hdtb').prepend($stats);
    $stats[0].style.marginLeft = 'var(--center-abs-margin)';
  };


  var isSearchResultsView = function(){
    var tbm = getURLParameter('tbm');
    var udm = getURLParameter('udm');
    if (tbm || udm) return false;
    return true;
  };


  var isAutocompleteResultsView = function(){
    var tbm = getURLParameter('tbm');
    if (!tbm || tbm === 'vid' || tbm === 'isch' || tbm === 'nws') {
      return true;
    }
  };


  var isGoogleMap = function(){
    return !!$('#lu_pinned_rhs')[0];
  };

  var AIO_CONTAINER_SELECTOR = 'div[data-subtree="aimc"], div.FkX2oe, div[id*="aio"], div[data-attrid="wa:/complete"], div.XGPMgd';
  var AIO_CARD_SELECTOR = '.CyMdWb';
  var MAGI_FEATURE_KEY = 'MAGI_FEATURE';
  var MAGI_LDPB_KEY = 'lDPB';
  var SV6KPE_KEY = 'Sv6Kpe';

  var stripTranslateGoog = function(hostname) {
    if (!hostname || !hostname.endsWith('.translate.goog')) return hostname;
    return hostname.replace('.translate.goog', '').replace(/--/g, '.');
  };

  /** Extract hostname from URL (no www, translate.goog stripped). */
  var extractHostnameFromUrl = function(url) {
    try { return stripTranslateGoog(new URL(url).hostname.replace('www.', '')); } catch (e) { return ''; }
  };

  var normalizeUrlSimple = function(url) {
    if (!url) return '';
    try {
      var urlObj = new URL(url);
      var hostname = stripTranslateGoog(urlObj.hostname.replace('www.', ''));
      var norm = hostname + urlObj.pathname.replace(/\/$/, '');
      if (urlObj.search) norm += urlObj.search;
      return norm;
    } catch (e) {
      return url.replace(/^https?:\/\/(www\.)?/, '').replace(/#.*$/, '').replace(/\/$/, '');
    }
  };

  /** True if URL is an internal/Google URL we should exclude from MAGI/citation lists. */
  var isExcludedUrl = function(url) {
    return url.includes('gstatic.com') || url.includes('googleapis.com') || url.includes('w3.org/') || url.includes('google.com/search') || url.includes('googleusercontent.com');
  };

  /** Recursively extract MAGI grounding URLs from a tree (array/object). Pushes into results, counts in urlCounts. */
  var extractMagiUrlsFromTree = function(node, results, urlCounts) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      if (node[0] === MAGI_FEATURE_KEY && typeof node[7] === 'string' && node[7].startsWith('http')) {
        var magiUrl = node[7];
        if (!isExcludedUrl(magiUrl)) {
          urlCounts[magiUrl] = (urlCounts[magiUrl] || 0) + 1;
          if (urlCounts[magiUrl] === 1) {
            results.push({ url: magiUrl, domain: extractHostnameFromUrl(magiUrl), title: '', sourceLabel: MAGI_FEATURE_KEY, count: 1, hasAboutResult: false });
          } else {
            var existing = results.find(function(r){ return r.url === magiUrl; });
            if (existing) existing.count = urlCounts[magiUrl];
          }
        }
        return;
      }
      for (var i = 0; i < node.length; i++) {
        extractMagiUrlsFromTree(node[i], results, urlCounts);
      }
    } else {
      for (var key in node) {
        if (Object.prototype.hasOwnProperty.call(node, key)) {
          extractMagiUrlsFromTree(node[key], results, urlCounts);
        }
      }
    }
  };

  /** Extract MAGI grounding URLs from inline script tags by scanning for MAGI_FEATURE and URLs before it. */
  var extractMagiUrlsFromScriptTags = function() {
    var results = [];
    var urlCounts = {};
    try {
      var scripts = document.querySelectorAll('script:not([src])');
      for (var i = 0; i < scripts.length; i++) {
        var content = scripts[i].textContent || '';
        // Decode basic HTML entities that often wrap MAGI payloads (e.g. &quot;MAGI_FEATURE&quot;)
        var decoded = content
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'");
        if (!decoded.includes(MAGI_FEATURE_KEY)) continue;
        var searchPos = 0;
        while (true) {
          var idx = decoded.indexOf('"' + MAGI_FEATURE_KEY + '"', searchPos);
          if (idx === -1) break;
          searchPos = idx + 14;
          var windowStart = Math.max(0, idx - 5000);
          var beforeChunk = decoded.substring(windowStart, idx);
          var urlMatches = beforeChunk.match(/https?:\/\/[^\s"'<>\\,;)}{]+/g);
          var magiUrl = null;
          if (urlMatches) {
            for (var j = urlMatches.length - 1; j >= 0; j--) {
              var u = urlMatches[j];
              if (!isExcludedUrl(u) && u.length > 15) {
                magiUrl = u;
                break;
              }
            }
          }
          if (!magiUrl) continue;
          var domain = extractHostnameFromUrl(magiUrl);
          var title = '';
          var sourceMatches = beforeChunk.match(/"Source:\s*([^"]{2,80})"/g);
          var sourceMatch = sourceMatches && sourceMatches.length ? sourceMatches[sourceMatches.length - 1] : null;
          if (sourceMatch) title = sourceMatch.replace(/^"Source:\s*/i, '').replace(/"$/, '');
          var hasReq = content.substring(Math.max(0, idx - 3000), Math.min(content.length, idx + 2000)).includes('about-this-result');
          urlCounts[magiUrl] = (urlCounts[magiUrl] || 0) + 1;
          if (urlCounts[magiUrl] === 1) {
            results.push({ url: magiUrl, domain: domain, title: title, sourceLabel: sourceMatch || '', count: 1, hasAboutResult: hasReq });
          } else {
            var existing = results.find(function(r){ return r.url === magiUrl; });
            if (existing) existing.count = urlCounts[magiUrl];
          }
        }
      }
    } catch (e) {}
    return results;
  };

  /** Parse lDPB script payload: extract AI Overview citations and MAGI grounding URLs. */
  var extractLdpbCitationsAndMagiUrls = function() {
    var citations = [];
    var magiUrls = [];
    var magiUrlCounts = {};
    var seenCitUrls = new Set();
    var scriptsWithLdpb = 0;
    var parsedOk = false;
    try {
      var scripts = document.querySelectorAll('script:not([src])');
      for (var i = 0; i < scripts.length; i++) {
        var content = scripts[i].textContent || '';
        if (!content.includes(MAGI_LDPB_KEY)) continue;
        scriptsWithLdpb++;
        var dataMatch = content.match(/\)\s*\(\s*(\[[\s\S]*\])\s*\)\s*;?\s*$/) ||
          content.match(/\.call\s*\(\s*this\s*,\s*(\[[\s\S]*\])\s*\)\s*;?\s*$/);
        if (!dataMatch) continue;
        var dataStr = dataMatch[1];
        dataStr = dataStr.replace(/\\u003d/g, '=').replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'").replace(/\\u0022/g, '"');
        var dataArr = null;
        try { dataArr = JSON.parse(dataStr); } catch (e) { continue; }
        if (!Array.isArray(dataArr)) continue;
        parsedOk = true;
        extractMagiUrlsFromTree(dataArr, magiUrls, magiUrlCounts);
        for (var k = 0; k < dataArr.length - 1; k += 2) {
          var key = dataArr[k];
          var value = dataArr[k + 1];
          if (typeof key !== 'string' || !Array.isArray(value)) continue;
          if (!Array.isArray(value[0])) continue;
          for (var b = 0; b < value.length; b++) {
            var block = value[b];
            if (!Array.isArray(block)) continue;
            var entry = null;
            if (block.length >= 2 && Array.isArray(block[1]) && block[1].length >= 2) entry = block[1];
            else if (block.length >= 6) entry = block;
            if (!Array.isArray(entry) || entry.length < 2) continue;
            var url = null;
            if (typeof entry[5] === 'string' && entry[5].startsWith('http') && !entry[5].includes('googleusercontent.com')) {
              url = entry[5];
            } else {
              for (var j = 0; j < Math.min(entry.length, 20); j++) {
                if (typeof entry[j] === 'string' && entry[j].startsWith('https://') && !entry[j].includes('google.com/search') && !entry[j].includes('gstatic.com') && !entry[j].includes('googleusercontent.com')) {
                  url = entry[j];
                  break;
                }
              }
            }
            if (!url) continue;
            var normUrl = normalizeUrlSimple(url);
            if (seenCitUrls.has(normUrl)) continue;
            seenCitUrls.add(normUrl);
            var title = (typeof entry[0] === 'string') ? entry[0] : '';
            var snippet = (typeof entry[1] === 'string') ? entry[1] : '';
            var domain = (typeof entry[3] === 'string') ? entry[3] : '';
            if (domain && domain.startsWith('http')) domain = extractHostnameFromUrl(domain);
            var position = typeof entry[8] === 'string' ? entry[8] : (typeof entry[8] === 'number' ? String(entry[8]) : null);
            citations.push({
              title: title,
              snippet: snippet,
              sourceDomain: domain,
              url: url,
              position: position ? parseInt(position, 10) || 0 : 0
            });
          }
        }
      }
    } catch (e) {}
    console.log('[AIO] extractLdpbCitationsAndMagiUrls: scriptsWithLdpb=' + scriptsWithLdpb + ' parsedOk=' + parsedOk + ' citations=' + citations.length + ' magiUrls=' + magiUrls.length);
    if (magiUrls.length > 0) {
      console.log('[AIO] LDPB MAGI URLs (first 5):', magiUrls.slice(0, 5).map(function(m){ return m.url; }));
    }
    return { citations: citations, magiUrls: magiUrls };
  };

  var captureOrganicUrls = function() {
    var urls = [];
    var seen = new Set();
    var links = document.querySelectorAll('#search a[data-ved][href^="http"]');
    if (!links.length) links = document.querySelectorAll('#rso a[href^="http"]');
    links.forEach(function(link){
      var href = link.href || '';
      if (!href) return;
      if (href.includes('google.com/search') || href.includes('gstatic.com') || href.includes('googleapis.com')) return;
      if (href.includes('google.com/imgres') || href.includes('youtube.com/results')) return;
      var normUrl;
      try {
        var u = new URL(href);
        normUrl = u.hostname.replace('www.', '') + u.pathname.replace(/\/$/, '');
      } catch (e) { normUrl = href; }
      if (!seen.has(normUrl)) {
        seen.add(normUrl);
        urls.push({ url: href, domain: extractHostnameFromUrl(href), position: urls.length + 1 });
      }
    });
    return urls;
  };

  var getAioContainer = function() {
    return document.querySelector(AIO_CONTAINER_SELECTOR);
  };

  var extractAioSidebarCards = function(container) {
    var cards = [];
    if (!container) return cards;
    try {
      var cardElements = container.querySelectorAll(AIO_CARD_SELECTOR);
      cardElements.forEach(function(card){
        var linkEl = card.querySelector('a[href^="http"]') || card.querySelector('a[href]');
        if (!linkEl) return;
        var href = linkEl.href || '';
        if (!href || href.includes('google.com/search')) return;
        var domain = extractHostnameFromUrl(href);
        var title = (linkEl.textContent || '').trim() || (card.textContent || '').trim().substring(0, 100);
        cards.push({ url: href, domain: domain, title: title, position: cards.length + 1 });
      });
    } catch (e) {}
    return cards;
  };

  var extractAioLinks = function(container) {
    var entityLinks = [];
    var externalLinks = [];
    if (!container) return { entityLinks: entityLinks, externalLinks: externalLinks };
    var seenEntities = new Set();
    var seenExternals = new Set();
    try {
      container.querySelectorAll('a[href]').forEach(function(link){
        var href = link.href || '';
        var text = (link.textContent || '').trim();
        if (!href || !text) return;
        if (href.includes('google.com/search') && !href.includes('about-this-result')) {
          if (!seenEntities.has(href)) {
            seenEntities.add(href);
            entityLinks.push({ text: text, href: href });
          }
        } else if (href.startsWith('http') && !href.includes('google.com/') && !href.includes('gstatic.com') && !href.includes('googleapis.com')) {
          if (!seenExternals.has(href)) {
            seenExternals.add(href);
            externalLinks.push({ text: text, href: href, domain: extractHostnameFromUrl(href) });
          }
        }
      });
    } catch (e) {}
    return { entityLinks: entityLinks, externalLinks: externalLinks };
  };

  /** Extract citations from Sv6Kpe HTML comments (and optionally MAGI URLs, like aio-aim-inspector AIO path). */
  var extractSv6KpeCitations = function(root, magiResults, magiUrlCounts) {
    var citations = [];
    var sv6kpeCommentCount = 0;
    if (!root) {
      console.log('[AIO] extractSv6KpeCitations: no root container');
      return citations;
    }
    try {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
      while (walker.nextNode()) {
        var commentText = walker.currentNode.nodeValue || '';
        if (commentText.indexOf(SV6KPE_KEY + '[') === -1) continue;
        sv6kpeCommentCount++;
        var match = commentText.match(new RegExp(SV6KPE_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\[(.+)\\]', 's'));
        if (!match) continue;
        try {
          var decoded = match[1]
            .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'");
          var json = JSON.parse(decoded);
          if (magiResults && magiUrlCounts) {
            extractMagiUrlsFromTree(json, magiResults, magiUrlCounts);
          }
          if (!json || !Array.isArray(json[1]) || json[1].length < 5) continue;
          var entry = json[1];
          var url = (typeof entry[5] === 'string' && entry[5].startsWith('http')) ? entry[5] : '';
          if (!url) {
            for (var j = 0; j < Math.min(entry.length, 20); j++) {
              if (typeof entry[j] === 'string' && entry[j].startsWith('https://') && !entry[j].includes('google.com/search')) {
                url = entry[j];
                break;
              }
            }
          }
          if (!url) continue;
          var norm = normalizeUrlSimple(url);
          if (!norm) continue;
          var title = entry[0] || '';
          var snippet = entry[1] || '';
          var domain = (typeof entry[3] === 'string') ? entry[3] : '';
          if (domain && domain.indexOf('http') === 0) domain = extractHostnameFromUrl(domain);
          var position = 0;
          if (typeof entry[8] === 'string') position = parseInt(entry[8], 10) || 0;
          else if (typeof entry[8] === 'number') position = entry[8];
          citations.push({
            title: title,
            snippet: snippet,
            sourceDomain: domain,
            url: url,
            position: position
          });
        } catch (e) {}
      }
    } catch (e) {}
    console.log('[AIO] extractSv6KpeCitations: root=' + (root ? root.className || root.tagName : 'null') + ' Sv6Kpe comments=' + sv6kpeCommentCount + ' citations=' + citations.length + ' magiFromSv6Kpe=' + (magiResults ? magiResults.length : 0));
    if (magiResults && magiResults.length > 0) {
      console.log('[AIO] Sv6Kpe MAGI URLs (first 5):', magiResults.slice(0, 5).map(function(m){ return m.url; }));
    }
    return citations;
  };

  var collectAioOverviewData = function() {
    var container = getAioContainer();
    var query = getQuery().trim();
    console.log('[AIO] collectAioOverviewData: container=' + (container ? (container.className || container.tagName) : 'null') + ' query=' + (query ? query.substring(0, 40) + (query.length > 40 ? '...' : '') : ''));
    if (!container) return null;
    var ldpbResult = extractLdpbCitationsAndMagiUrls();
    console.log('[AIO] after LDPB: citations=' + ldpbResult.citations.length + ' magiUrls=' + ldpbResult.magiUrls.length);
    // Build MAGI set like aio-aim-inspector AIO path: script-tag MAGI + Sv6Kpe MAGI + lDPB MAGI.
    var magiInnerHTML = extractMagiUrlsFromScriptTags() || [];
    var sv6kpeMagiCounts = {};
    var sidebarCards = extractAioSidebarCards(container);
    var linkData = extractAioLinks(container);
    var organicUrls = captureOrganicUrls();
    var citations = [];
    var sv6kpeCitations = extractSv6KpeCitations(container, magiInnerHTML, sv6kpeMagiCounts);
    if (sv6kpeCitations.length > 0) {
      var seenNorm = new Set();
      sv6kpeCitations.forEach(function(c){
        var n = normalizeUrlSimple(c.url);
        if (n && !seenNorm.has(n)) {
          seenNorm.add(n);
          citations.push(c);
        }
      });
      ldpbResult.citations.forEach(function(c){
        var n = normalizeUrlSimple(c.url);
        if (n && !seenNorm.has(n)) {
          seenNorm.add(n);
          citations.push(c);
        }
      });
    } else {
      citations = ldpbResult.citations.slice();
    }
    // Merge in MAGI URLs from lDPB, avoiding duplicates, same as original.
    ldpbResult.magiUrls.forEach(function(m){
      if (!magiInnerHTML.find(function(e){ return e.url === m.url; })) magiInnerHTML.push(m);
    });
    console.log('[AIO] final: citations=' + citations.length + ' magiInnerHTML=' + magiInnerHTML.length + ' (Grounded=Yes when URL is in magiInnerHTML)');
    if (magiInnerHTML.length > 0) {
      console.log('[AIO] final MAGI URLs (first 8):', magiInnerHTML.slice(0, 8).map(function(m){ return m.url; }));
    }
    if (!citations.length) {
      var fallbackLinks = container.querySelectorAll('a[href^="http"]');
      var pos = 0;
      fallbackLinks.forEach(function(link){
        var url = link.href;
        if (!url || url.includes('google.com/search')) return;
        pos++;
        citations.push({
          title: (link.textContent || '').trim(),
          snippet: '',
          sourceDomain: extractHostnameFromUrl(url),
          url: url,
          position: pos
        });
      });
    }
    var seenNorm = new Set();
    citations.forEach(function(c){
      var n = normalizeUrlSimple(c.url);
      if (n) seenNorm.add(n);
    });
    var nextPos = citations.length + 1;
    (linkData.externalLinks || []).forEach(function(ext){
      var url = ext.href || '';
      if (!url) return;
      var norm = normalizeUrlSimple(url);
      if (!norm || seenNorm.has(norm)) return;
      seenNorm.add(norm);
      citations.push({
        title: (ext.text || '').trim(),
        snippet: '',
        sourceDomain: ext.domain || extractHostnameFromUrl(url),
        url: url,
        position: nextPos++
      });
    });
    return {
      query: query,
      citations: citations,
      magiUrls: magiInnerHTML,
      sidebarCards: sidebarCards,
      entities: linkData.entityLinks,
      externalLinks: linkData.externalLinks,
      organicUrls: organicUrls
    };
  };

  var addAioAnalyzeButton = function() {
    var container = getAioContainer();
    if (!container) return;
    var target = container.closest('[data-subtree="mfc"]');
    if (!target || target.querySelector('.xt-aio-analyze-button')) return;
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;justify-content:flex-end;margin:6px 0;';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xt-ke-btn xt-aio-analyze-button';
    btn.textContent = 'Analyze AI Overview';
    btn.addEventListener('click', function(e){
      e.preventDefault();
      var payload = collectAioOverviewData();
      if (!payload) return;
      chrome.runtime.sendMessage({ cmd: 'google.setAIOData', data: payload }, function(){
        chrome.runtime.sendMessage({
          cmd: 'new_tab',
          data: chrome.runtime.getURL('html/aio-overview.html')
        });
      });
    });
    bar.appendChild(btn);
    var headerEl = null;
    var divs = target.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      if ((divs[i].textContent || '').trim() === 'AI Overview') {
        headerEl = divs[i];
        break;
      }
    }
    if (headerEl && headerEl.parentElement) {
      headerEl.parentElement.insertBefore(bar, headerEl.nextSibling);
    } else {
      target.prepend(bar);
    }
  };


  var processPage = function(){
    var query = getQuery();
    revealResults();
    if (!query) {
      UIHelper.moveButtons(50);
      return;
    }
    else UIHelper.moveButtons(10);
    var hasCredits = Common.getCredits() > 0;
    addAioAnalyzeButton();
    query = Common.cleanKeyword(query);
    var metricsPromise = Promise.resolve({});
    var plan = Common.getPlan();
    var config = Common.getConfig();
    var showFreeFeatures = config.gFeaturesFree;
    showTopKeywords = config.showTopKeywords;
    showSEOReports = config.showSEOReports;
    hasCredits = Common.getCredits() > 0 || (config.areSubsEnabled && plan.credits > 0);
    conf = config.google;
    // console.log(config, conf, showLinkData, showTopKeywords);
    if (config.showLinkData) showLinkData = true;
    if (hasCredits) {
      metricsPromise = new Promise((resolve) => {
        chrome.runtime.sendMessage({
          cmd: 'api.getKeywordData',
          data: {
            keywords: [query],
            src: source
          }
        }, function( json ){
          UIHelper.checkErrors(json, $('#top_nav')[0]);
          processQueryResponse( json );
          resolve(json);
        });
      });
    }
    else {
      var $node = addSearchQueryLine();
      var html = Common.renderIframeHTML({
        query: query,
        settingEnabled: true,
        darkMode: darkMode,
        iframeSrcParam: 'free_google_search_volume'
      });
      $node.html(html);
    }
    if (isGoogleMap()) return;
    if (!isSearchResultsView()) return;

    var promoParam = Common.subscriptionPromoCondition();
    if (promoParam) {
      renderPromoIframe(promoParam);
      if (!showFreeFeatures) return;
    }

    var settings = Starter.getSettings();
    if (settings.showGoogleTrendChart) {
      initTrendsChart({
        showVolume: hasCredits,
        query: query,
        metrics: metricsPromise,
        timeRange: settings.googleTrendChartDefaultTime
      });
    }
    if (settings.showDifficultyMetrics) {
      getDifficulty();
    }
    if (showSEOReports) {
      processSEOReport();
    }
    getTrendingKeywords();
    getLTKQueries();
    setTimeout(function(){
      processTopicalKeywords();
      processRelatedSearch();
      processPeopleAlsoSearch();
    }, 1000);
    runURLMetricsChecking();
  };


  var getWidgetsParent = function(){
    var $rhs = $(rightColSelector);
    if ($rhs[0]) {
      return $rhs[0];
    }
    if ($('#xt-ke-widgets-root')[0]) {
      var node = $('#xt-ke-widgets-root')[0];
      // console.log('-----', node.getBoundingClientRect().left);
      // if (node.getBoundingClientRect().left < 200 ) node.style.marginLeft = '180px';
      return node;
    }
    var $widgetsRoot = $('<div>', {id: 'xt-ke-widgets-root'});
    var $rcnt = $('#rcnt');
    var $centerCol = $('#center_col');
    var $centerColParent = $centerCol.parent();
    var rect;
    if ($centerCol[0]) rect = $centerCol[0].getBoundingClientRect();
    var left;
    if (rect) left = rect.right;
    if ($rcnt[0] && $centerCol[0] && getComputedStyle($rcnt[0]).display === 'flex') {
      $widgetsRoot.insertAfter($centerCol)
        .css({'margin-left': 30});
      $rcnt.css({'max-width': 'fit-content'});
      if (document.documentElement.clientWidth < 1528) {
        // $rcnt.css({'flex-wrap': 'nowrap'});
        $rcnt.find('[jscontroller="wuEeed"]').css('width', '100%');
      }
      if (document.documentElement.clientWidth > 2232 && $centerCol[0].previousElementSibling) {
        $rcnt.css({'max-width': 'min-content'});
      }
    }
    else if ($rcnt[0] && $centerCol[0] && getComputedStyle($rcnt[0]).display !== 'grid') {
      $widgetsRoot.insertAfter($centerCol.parent())
        .addClass('xt-ke-google-widgets-float')
        .css({'margin-left': left + 50});
    }
    else if ($centerColParent[0].getBoundingClientRect().top > 400) {
      $widgetsRoot.appendTo($centerColParent);
    }
    else if (rect && rect.top > 400) {
      $widgetsRoot.appendTo($centerColParent);
    }
    else {
      $widgetsRoot.appendTo('body').addClass('xt-ke-google-widgets-absolute');
      if (left) $widgetsRoot.css({'left': left + 50});
    }
    return $widgetsRoot[0];
  };


  var runURLMetricsChecking = function(){
    var settings = Starter.getSettings();
    if (!settings.showGoogleTraffic && !settings.showGoogleMetrics) return;
    processURLs(settings.showGoogleTraffic, settings.showGoogleMetrics);
  };


  var processURLs = function(showGoogleTraffic, showGoogleMetrics, parentId){
    // if (!hasCredits) return;
    if (!parentId) parentId = '#rso';
    var $items = $(parentId + ' .g a[ping] h3:visible, #rso a[ping] h3:visible');
    var $itemsWithoutPing = $(parentId + ' .g a h3:visible, #rso a h3:visible');
    if ($items.length && $items.length < $itemsWithoutPing.length) {
      $itemsWithoutPing.map(function(i, node){
        if ($(node).closest('a').attr('href').match(/https.*google\.com/)) {
          $items = $items.add(node);
        }
      });
    }
    if (vendor === 'Firefox') {
      $items = $(parentId + ' .g a h3');
    }
    if (!$items.length && $itemsWithoutPing.length) {
      $items = $itemsWithoutPing;
    }
    if ($items.length) {
      $items = $items.map(function(i, item){
        return item.parentNode;
      });
    }
    else $items = $(parentId + ' .g .r > a');
    setPointerEventsForOverlay($items);
    var urls = {};
    var serpItems = [];
    $items.map(function(i, node){
      var $node = $(node);
      if ($node.closest('g-accordion-expander')[0]) {
        return;
      }
      if ($node.closest('.related-question-pair')[0]) {
        return;
      }
      var $parent = $($node.closest('.g'));
      if ($parent.find('.xt-google-domain-link-metrics, .xt-google-url-metrics')[0]) return;
      urls[node.href] = node;
      let domain = Common.getHost(node.href);
      serpItems.push({node: node, url: node.href, domain: domain});
    });
    var domains = Object.keys(urls);
    var list = Object.keys(urls);
    var settings = Starter.getSettings();
    if (showGoogleMetrics) {
      getGoogleMetrics(serpItems);
    }
    if (showGoogleTraffic) {
      var urlPromise = new Promise(function(resolve){
        chrome.runtime.sendMessage({
          cmd: 'api.getURLMetrics',
          data: {
            urls: list,
            country: settings.country
          }
        }, function(json){
          resolve(json);
        });
      });
      var domainPromise = new Promise(function(resolve){
        chrome.runtime.sendMessage({
          cmd: 'api.getDomainMetrics',
          data: {
            domains: domains,
            country: settings.country
          }
        }, function(json){
          resolve(json);
        });
      });
      Promise.all([urlPromise, domainPromise]).then(function(responses){
        // console.log(responses);
        processGetMetricsResponse(responses, {
          urls: urls,
          country: settings.country
        });
      });
    }
    if (showTopKeywords) {
      getURLsKeywords(urls);
    }
    
    // Process Discussions and forums section
    processDiscussionsAndForums(showGoogleTraffic, showGoogleMetrics);
  };


  var processDiscussionsAndForums = function(showGoogleTraffic, showGoogleMetrics){
    // Find the "Discussions and forums" section by looking for the heading text
    var $discussionsSection = null;
    $('div[aria-level="2"][role="heading"]').each(function(){
      if ($(this).text().trim().toLowerCase().includes('discussions and forums')) {
        $discussionsSection = $(this).closest('.A6K0A');
        return false; // break out of each loop
      }
    });
    
    if (!$discussionsSection || !$discussionsSection.length) {
      return; // Section not found
    }
    
    // Find main discussion links within this section (exclude comment links in lists)
    var $discussionLinks = $discussionsSection.find('a[href]').not('[role="list"] a[href]');
    if (!$discussionLinks.length) {
      return; // No discussion links found
    }
    
    var urls = {};
    var serpItems = [];
    var settings = Starter.getSettings();
    
    $discussionLinks.each(function(i, link){
      var $link = $(link);
      var href = link.href;
      
      // Skip if already processed
      if ($link.closest('.g').find('.xt-google-domain-link-metrics, .xt-google-url-metrics')[0]) {
        return;
      }
      
      urls[href] = link;
      let domain = Common.getHost(href);
      serpItems.push({node: link, url: href, domain: domain});
    });
    
    if (Object.keys(urls).length === 0) {
      return; // No URLs to process
    }
    
    var domains = Object.keys(urls);
    var list = Object.keys(urls);
    
    if (showGoogleMetrics) {
      getGoogleMetrics(serpItems);
    }
    
    if (showGoogleTraffic) {
      var urlPromise = new Promise(function(resolve){
        chrome.runtime.sendMessage({
          cmd: 'api.getURLMetrics',
          data: {
            urls: list,
            country: settings.country
          }
        }, function(json){
          resolve(json);
        });
      });
      var domainPromise = new Promise(function(resolve){
        chrome.runtime.sendMessage({
          cmd: 'api.getDomainMetrics',
          data: {
            domains: domains,
            country: settings.country
          }
        }, function(json){
          resolve(json);
        });
      });
      Promise.all([urlPromise, domainPromise]).then(function(responses){
        processGetMetricsResponse(responses, {
          urls: urls,
          country: settings.country
        });
      });
    }
  };


  var setPointerEventsForOverlay = function($items){
    // that's one of the google layouts where they have an overlay
    // over serp item
    $items.each(function(_, h3){
      var a = h3.parentNode && h3.parentNode.tagName === 'A'
        ? h3.parentNode
        : $(h3).closest('a')[0];
      if (!a) return;

      // scan only first-level children (siblings of h3)
      for (var i = 0; i < a.children.length; i++) {
        var el = a.children[i];
        if (el === h3) continue;
        if (el.tagName !== 'DIV') continue;

        var cs = window.getComputedStyle(el);
        if (cs.position !== 'absolute') continue;

        // "has a value for all 4 dimensions" (i.e., not 'auto')
        var hasAllEdges =
          cs.top    !== 'auto' &&
          cs.right  !== 'auto' &&
          cs.bottom !== 'auto' &&
          cs.left   !== 'auto';

        if (hasAllEdges) {
          el.style.pointerEvents = 'none';
          // optional: mark so we don't touch it again
          el.dataset.xtPassThrough = '1';
        }
      }
    });
  };


  var getURLsKeywords = function(urls){
    let settings = Starter.getSettings();
    let countryStr = `(${ settings.country ? settings.country : 'us'})`;
    let promises = [];
    let hasCredits = Common.getCredits() > 0;
    // if (!hasCredits) return;
    for (let url in urls) {
      let node = urls[url];
      if (!hasCredits) {
        setTimeout(function(){
          injectIframeToSerpResults(node, url);
        }, 1000);
        continue;
      }
      let urlPromise = new Promise(function(resolve){
        chrome.runtime.sendMessage({
          cmd: 'api.getURLKeywords',
          data: {
            url: url,
            num: 20,
            country: settings.country
          }
        }, function(json){
          resolve();
          var res = processGetURLKeywordsResponse(json);
          if (!res) return;
          topKeywordsByURL[url] = res;
          var line = `<span class="xt-ke-cl-dk">Top keywords</span> <span class="xt-ke-cl-gr">${countryStr}:</span> ` + res.join(', ');
          var $parent = getMetricsParent( $(node) );
          let id = btoa(url);
          let keywordsURL = chrome.runtime.getURL('html/page.html?page=keywords&target=url&id=' + id);
          if ($parent[0]) {
            if ($parent.find('.xt-google-top-keywords-root')[0]) return;
            $root = $('<div>', {class: 'xt-google-top-keywords-root'});
            $root.html(`
              <div class="xt-google-top-keywords-line">${line}</div>
              <a id="xt-google-top-keywords-viewall" href="${keywordsURL}" target="_blank">View All</a>
              `);
            if (!$parent.find('.xt-google-url-metrics')[0]) $root.appendTo($parent);
            else $root.insertAfter($parent.find('.xt-google-url-metrics'));
            const $line = $root.find('.xt-google-top-keywords-line');
            const $viewAll = $root.find('#xt-google-top-keywords-viewall');
            if ($line[0].scrollWidth > $parent.width() - 50) {
              $line.css({
                'width': '90%',
                'white-space': 'nowrap',
                'overflow': 'hidden',
                'text-overflow': 'ellipsis'
              });
              $viewAll.show();
            } else {
              $viewAll.hide();
            }
          }
        });
      });
      promises.push(urlPromise);
    }
    Promise.all(promises).then(function(){
      renderTopKeywordsWidget();
    });
  };


  var injectIframeToSerpResults = function(node, url){
    var $parent = getMetricsParent( $(node) );
    let id = btoa(url);
    let html = Common.renderIframeHTML({
      url: url,
      query: getQuery(),
      settingEnabled: true,
      darkMode: darkMode,
      iframeSrcParam: 'free_google_serp'
    });
    if ($parent[0]) {
      if ($parent.find('.xt-google-top-keywords-root')[0]) return;
      $root = $('<div>', {class: 'xt-google-top-keywords-root'});
      $root.addClass('xt-google-top-keywords-root-no-credits');
      $root.html(`<div class="xt-google-top-keywords-line">${html}</div>`);
      if (!$parent.find('.xt-google-url-metrics')[0]) $root.appendTo($parent);
      else $root.insertAfter($parent.find('.xt-google-url-metrics'));
    }
  };


  function countKeywordOccurrences(topKeywordsByURL) {
    const keywordCount = {};
    for (const url in topKeywordsByURL) {
      const keywords = topKeywordsByURL[url];
      keywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase(); // Normalize case sensitivity
        keywordCount[lowerKeyword] = (keywordCount[lowerKeyword] || 0) + 1;
      });
    }
    return keywordCount;
  }


  function getFrequentKeywords(keywordCount) {
    const frequentKeywords = Object.entries(keywordCount)
    .filter(([keyword, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);
    return frequentKeywords;
  }


  var processGetURLKeywordsResponse = function(json){
    if (json.error) return;
    var data = json.data || {};
    var arrKeywords = data.data;
    if (!arrKeywords || !arrKeywords.length) return;
    var list = arrKeywords.map(item => item.keyword);
    if (!list.length) return;
    var res = SimilarKeywords.getList(list);
    return res;
  };


  var renderTopKeywordsWidget = function(manual){
    const keywordCount = countKeywordOccurrences(topKeywordsByURL);
    const frequentKeywords = getFrequentKeywords(keywordCount);
    if (!frequentKeywords.length) return;
    var settings = Starter.getSettings();
    var hasCredits = Common.getCredits() > 0;
    var rows = [];
    if (!hasCredits || !settings.apiKey) return;
    if ( (!settings.sourceList.topkw && !manual) || !settings.apiKey || !hasCredits) {
      frequentKeywords.map(function(item){
        rows.push({keyword: item[0]});
      });
      renderWidgetTable('top-keywords', rows, null);
      dataSEOReport.topkw = rows;
      return;
    }
    Common.processKeywords({
      keywords: frequentKeywords.map(x => x[0]),
      tableNode: null,
      src: source,
      from: 'topkw',
      seed: getQuery('corrected'),
      noCheckCredits: true
    }, function(json){
      if (json.error_code === 'NOCREDITS' || json.error_code === 'INVALIDAPI') {
        frequentKeywords.map(function(item){
          rows.push({keyword: item[0]});
        });
        dataSEOReport.topkw = rows;
        renderWidgetTable('top-keywords', rows, null, 'nocredits');
      }
      else {
        processTopKeywordsResponse(json, keywordCount, rows);
      }
    });
  };


  var processTopKeywordsResponse = function(json, keywordCount, rows){
    // console.log(json, keywords, rows);
    if (typeof json.data !== 'object') return;
    for (var key in json.data) {
      var item = json.data[key];
      item.usage = keywordCount[item.keyword] || '';
      rows.push(item);
    }
    rows.sort(function(a,b){
      var aVol = parseInt(a.vol.replace(/[,.\s]/g, ''));
      var bVol = parseInt(b.vol.replace(/[,.\s]/g, ''));
      return bVol - aVol;
    });
    dataSEOReport.topkw = [];
    rows.map(function(row){
      dataSEOReport.topkw.push({keyword: row.keyword, vol: row.vol});
    });
    renderWidgetTable('top-keywords', rows, json);
  };


  var getGoogleMetrics = function(list){
    var domains = list.map(function(item){
      return item.domain;
    });
    var settings = Starter.getSettings();
    chrome.runtime.sendMessage({
      cmd: 'api.getDomainLinkMetrics',
      data: {
        domains: domains,
        country: settings.country
      }
    }, function(json){
      processGetDomainLinkMetricsResponse(json, list);
      // resolve(json);
    });
  };


  var domainLinkPopoverHTML = function(params) {
    let propensity = params.moz_link_propensity / 100;
    if (propensity) propensity = propensity.toFixed(2) + '%';
    else propensity = '-';
    const data = [
      { title: "Domain Authority", value: `${params.moz_domain_authority}/100` },
      { title: "DA Trend (12mo)", value: `${params.trendPercent}%` },
      { title: "Spam Score", value: `${params.moz_spam_score < 0 ? '-' : params.moz_spam_score + '%'}` },
      { title: "Link Propensity", value: propensity },
      { title: "Referring Domains", value: params.moz_root_domains_to_subdomain.toLocaleString() },
      { title: "Total Backlinks", value: params.moz_external_pages_to_subdomain.toLocaleString() }
    ];

    const dataLength = data.length;

    let tableHTML = '<table class="xt-hidden">' + data.map((row) => {
      return `<tr><td>${row.title}</td><td>${row.value}</td></tr>`;
    }).join('') + '</table>';

    const mozInfoHtml = data.map((row, i) => `
        <div class="${ i < dataLength - 3 ? "xt-ke-mb-md" : ""}">
          <div class="xt-ke-font-sm">
            <span class="xt-ke-cl-dk">${row.title}</span>
          </div>
          <div class="xt-ke-font-lg xt-ke-value xt-ke-popup-value">
            ${row.value}
          </div>
        </div>
    `);

    let html = `
      <div class="xt-popover-header">
        <div class="xt-ke-bold xt-ke-title xt-ke-mb-0 xt-ke-cl-dk">
            <img class="xt-ke-logo" src="${chrome.runtime.getURL('/img/icon24.png')}">Link Metrics For <a href="${params.url}" target="_blank">${params.domain}</a>
        </div>
      </div>

      <div class="xt-popover-content xt-links-popover xt-popover-content-col-3 b-b">
        ${mozInfoHtml.join('')}
      </div>

      <div class="xt-popover-content">
        <canvas class="xt-popover-trend-chart"></canvas>
      </div>

      <div class="xt-popover-footer xt-ke-d-flex xt-ke-align-items-center b-t">
          <button class="xt-copy-csv xt-ke-btn">${Common.getIcon('copy')} Copy</button>
          <button class="xt-export-csv xt-ke-btn xt-ke-ml-md">${Common.getIcon('export')} Export</button>

          <img src="${chrome.runtime.getURL('img/moz_blue.png')}" alt="" class="xt-popover-logo xt-ke-ms-auto" />
      </div>
      ${tableHTML}
    `;

    return html;
  };

  var metricsPopoverHTML = function(params){
    var html = `
      <div class="xt-popover-header b-b">
        <div class="xt-ke-bold xt-ke-title"><img class="xt-ke-logo" src="${chrome.runtime.getURL('/img/icon24.png')}"><a href="${params.url}" target="_blank">${params.url}</a></div>
        <div class="xt-ke-subtitle"><span class="xt-ke-bold" style="margin-right: 1rem">${params.domain}</span><span class="xt-ke-badge xt-ke-badge-gr xt-ke-font-sm">${aHrefHTML(params.toppagesURL, 'view top pages')}</span></div>
        <div>Country: ${params.countryStr}</div>
      </div>

      <div class="xt-popover-content xt-popover-content-col">
        <div class="xt-ke-mb-lg">
          <div class="xt-ke-font-sm">
            <span class="xt-ke-cl-dk">Organic Traffic</span><br>per month for URL
          </div>
          <div class="xt-ke-font-lg xt-ke-value xt-ke-popup-value">
            <a href="${params.keywordsURL}" target="_blank">${params.trafURLData}/mo</a>
          </div>
        </div>

        <div class="xt-ke-mb-lg">
            <div class="xt-ke-font-sm">
                <span class="xt-ke-cl-dk">Organic Traffic</span><br>per month for ${params.domain}
            </div>
            <div class="xt-ke-font-lg xt-ke-value xt-ke-popup-value">
                <a href="${params.keywordsDomainURL}" target="_blank">${params.trafDomData}/mo</a>
            </div>
        </div>

        <div>
            <div class="xt-ke-font-sm">
                <span class="xt-ke-cl-dk">Total Keywords</span><br>that URL ranks for
            </div>
            <div class="xt-ke-font-lg xt-ke-value xt-ke-popup-value">
              <a href="${params.keywordsURL}" target="_blank">${params.kwURLData}</a>
            </div>
        </div>

        <div>
          <div class="xt-ke-font-sm">
            <span class="xt-ke-cl-dk">Total Keywords</span><br>that ${params.domain} ranks for
          </div>
          <div class="xt-ke-font-lg xt-ke-value xt-ke-popup-value">
            <a href="${params.keywordsDomainURL}" target="_blank">${params.kwDomData}</a>
          </div>
        </div>
      </div>
    `;
    return html;
  };


  var aHrefHTML = function(href, anchor){
    return `<a href="${href}" target="_blank">${anchor}</a>`;
  };


  var processGetMetricsResponse = function(responses, params){
    var urls = params.urls;
    var country = params.country;
    var urlsJSON = responses[0];
    var domainsJSON = responses[1];
    if (urlsJSON.error) return;
    var payload = urlsJSON.data;
    var domainsPayload = !domainsJSON.error ? domainsJSON.data : {};
    var domainDataByDomain = {};
    domainsPayload.map(item => {
      domainDataByDomain[item.domain] = item.data;
    });
    var countryStr = `(${ country ? country : 'us'})`;
    for (let url in urls) {
      let item = (payload.filter(function(x){
        return x.url === url;
      }))[0];
      let domain = Common.getHost(url);
      let domainData = domainDataByDomain[domain];
      if (!domainData && !item) continue;
      let id = btoa(url);
      let keywordsURL = chrome.runtime.getURL('html/page.html?page=keywords&target=url&id=' + id);
      let keywordsDomainURL = chrome.runtime.getURL('html/page.html?page=keywords&target=domain&id=' + id);
      let toppagesURL = chrome.runtime.getURL('html/page.html?page=toppages&id=' + id);
      let etv_format = '-';
      let total_keywords_format = '-';
      let trafURLData = '-';
      let kwURLData = '-';
      if (item) {
        let data = item.data;
        trafURLData = data.etv.toLocaleString();
        kwURLData = data.total_keywords.toLocaleString();
        etv_format = data.etv_format;
        total_keywords_format = data.total_keywords_format;
      }
      let popoverParams = {
        country: country.toUpperCase(),
        countryStr: countryStr,
        url: url,
        domain: domain,
        keywordsURL: keywordsURL,
        keywordsDomainURL: keywordsDomainURL,
        toppagesURL: toppagesURL,
        trafURLData: trafURLData,
        kwURLData: kwURLData
      };
      if (!dataSEOReport.metrics) dataSEOReport.metrics = {};
      if (!dataSEOReport.metrics[url]) dataSEOReport.metrics[url] = {};
      dataSEOReport.metrics[url].country = countryStr;
      dataSEOReport.metrics[url].page = etv_format;
      dataSEOReport.metrics[url].domain = domainData.etv_format;
      let trafVals = aHrefHTML(keywordsURL, etv_format + '/mo');
      if (domainData) {
        trafVals += ' (website: ' + aHrefHTML(keywordsDomainURL, domainData.etv_format + '/mo') + ')';
        popoverParams.trafDomData = domainData.etv.toLocaleString();
      }
      let kwVals = aHrefHTML(keywordsURL, total_keywords_format);
      if (domainData) {
        kwVals += ' (website: ' + aHrefHTML(keywordsDomainURL, domainData.total_keywords_format) + ')';
        popoverParams.kwDomData = domainData.total_keywords_format;
      }
      let str = `
        <span class="xt-ke-cl-dk">Search traffic</span> ${countryStr}: <span class="xt-ke-value xt-ke-traf-vals">${trafVals}</span> -
        <span class="xt-ke-cl-dk">Keywords</span> ${countryStr}: <span class="xt-ke-value xt-ke-kw-vals">${kwVals}</span>`;
      let node = urls[url];
      if (!node) {
        console.log("Can't find item", url, urls);
        continue;
      }
      let $node = $(node);
      var popoverHTML = metricsPopoverHTML(popoverParams);
      var $root;
      var $parent = getMetricsParent($node);
      if ($parent.find('.xt-google-url-metrics')[0]) {
        continue;
      }
      $root = $(`<div class="xt-google-url-metrics">${str}</div>`);

      $root.appendTo($parent);
      $root[0].dataset.popover = popoverHTML;
      $parent.find('.xt-google-url-metrics a').click(function(e){
        e.preventDefault();
        chrome.runtime.sendMessage({
          cmd: 'new_tab',
          data: this.href
        });
      });
    }
  };


  var getMetricsParent = function($node){
    return $node.parent().parent().parent();
  };


  // after
  var getMetricsParent_ = function($node){
    var $parent;

    var $g = $node.closest('.g');
    // var $res = $g.find('div > div');
    var $res = $g.find('div[jscontroller] > div');
    if ($res[0]) $parent = $($res[$res.length - 1]);
    if (!$parent[0]) {
      var $em = $($g.find('em')[0]);
      if ($em[0]) {
        var parent = $em.closest('div[jscontroller] > div')[0];
        if (parent) $parent = $(parent);
      }
    }

    if (!$parent[0]) {
      $parent = $node.closest('video-voyager');
    }
    var style = {};
    if ($parent[0]) style = getComputedStyle($parent[0]);
    if (style.gridTemplateAreas || style.display === 'flex') {
      $parent = $parent.parent();
    }
    if (!$parent[0]) {
      return $([]);
    }
    return $parent;
  };


  var getDescriptionNode = function($node){
    var em = $node.find('em')[0];
    if (em) return $(em.parentNode);
    return $([]);
  };


  var processGetDomainLinkMetricsResponse = function(response, serpItems){
    if (response.error) {
      return;
    }
    var dataByDomain = {};
    response.data.map(function(item){
      var domain = item.domain;
      dataByDomain[domain] = item.data;
    });
    serpItems.map(function(item){
      var node = item.node;
      var $node = $(node);
      var data = dataByDomain[item.domain];
      if (!data) return;
      var $parent = getMetricsParent($node);
      var popoverParams = data;
      popoverParams.domain = item.domain;
      popoverParams.url = item.url;
      var $root;
      if (!data.moz_da_history_values) return;
      if (!dataSEOReport.metrics) dataSEOReport.metrics = {};
      if (!dataSEOReport.total) dataSEOReport.total = {
        min_moz_root_domains_to_subdomain: Infinity,
        max_moz_root_domains_to_subdomain: 0,
        min_moz_external_pages_to_subdomain: Infinity,
        max_moz_external_pages_to_subdomain: 0
      };
      if (!dataSEOReport.metrics[item.url]) dataSEOReport.metrics[item.url] = {};

      if (data.moz_root_domains_to_subdomain < dataSEOReport.total.min_moz_root_domains_to_subdomain) dataSEOReport.total.min_moz_root_domains_to_subdomain = data.moz_root_domains_to_subdomain;
      if (data.moz_root_domains_to_subdomain > dataSEOReport.total.max_moz_root_domains_to_subdomain) dataSEOReport.total.max_moz_root_domains_to_subdomain = data.moz_root_domains_to_subdomain;
      if (data.moz_external_pages_to_subdomain < dataSEOReport.total.min_moz_external_pages_to_subdomain) dataSEOReport.total.min_moz_external_pages_to_subdomain = data.moz_external_pages_to_subdomain;
      if (data.moz_external_pages_to_subdomain > dataSEOReport.total.max_moz_external_pages_to_subdomain) dataSEOReport.total.max_moz_external_pages_to_subdomain = data.moz_external_pages_to_subdomain;

      dataSEOReport.total.moz_root_domains_to_subdomain = (dataSEOReport.total.moz_root_domains_to_subdomain || 0) + data.moz_root_domains_to_subdomain;
      dataSEOReport.total.moz_external_pages_to_subdomain = (dataSEOReport.total.moz_external_pages_to_subdomain || 0) + data.moz_external_pages_to_subdomain;
      dataSEOReport.total.count = (dataSEOReport.total.count || 0) + 1;
      dataSEOReport.metrics[item.url] = {
        moz_domain_authority: data.moz_domain_authority,
        moz_root_domains_to_subdomain: data.moz_root_domains_to_subdomain,
        moz_external_pages_to_subdomain: data.moz_external_pages_to_subdomain
      };
      // console.log(dataSEOReport);
      popoverParams.trendPercent = Common.getTrendPercent(data.moz_da_history_values, {moz: true});
      // popoverParams.trendImg = Common.getTrendImgHTML(data.moz_da_history_values, false, {color: '#aaa', sizeFactor: 3, moz: true});
      var popoverHTML = domainLinkPopoverHTML(popoverParams);
      var str = `<span><span class="xt-ke-serp-metrics-label">MOZ DA:</span> ${data.moz_domain_authority}/100 (${popoverParams.trendPercent}%)</span><span><span class="xt-ke-serp-metrics-label">Ref Dom:</span> ${Common.formatNumber(data.moz_root_domains_to_subdomain)}</span> <span><span class="xt-ke-serp-metrics-label">Ref Links:</span> ${Common.formatNumber(data.moz_external_pages_to_subdomain)}</span> <span><span class="xt-ke-serp-metrics-label">Spam Score:</span> ${data.moz_spam_score >= 0 ? data.moz_spam_score + '%' : '-'}</span>`;
      if ($parent[0]) {
        if ($parent.find('.xt-google-domain-link-metrics-root')[0]) return;
        $root = $('<div>', {class: 'xt-google-domain-link-metrics-root'});
        if (!$parent.find('.xt-google-url-metrics')[0]) $root.appendTo($parent);
        else $root.insertBefore($parent.find('.xt-google-url-metrics'));
        var $metricsRoot = $(`<span class="xt-google-domain-link-metrics">${str}</span>`).appendTo($root);
        $metricsRoot[0].dataset.popover = popoverHTML;
        $metricsRoot[0].dataset.trend = data.moz_da_history_values;
        $metricsRoot[0].dataset.domain = item.domain;
        if (showLinkData) {
          var $a = $(`<a class="xt-google-backlinks" data-domain="${item.domain}" data-page="${item.url}" data-da="${data.moz_domain_authority}">Show backlinks</a>`).appendTo($root);
        }
      }
    });
  };


  var renderPopoverTrendChart = function($popover, trendStr, params, data){
    if (!params) params = {};
    if (!data) data = {};
    var arr = Common.parseTrendStr(trendStr, {moz: true});
    var labels = [];
    var values = [];
    arr.map(function(item){
      labels.push(item.date);
      values.push(item.val);
    });
    var $canvas = $($popover.find('canvas'));
    var grayColor = params.darkMode ? '#aaa' : '#70757a';
    var gridColor = params.darkMode ? '#3e3e3e' : '#d9e2ef';
    var chartColor = '#c0504f';


    // var ctx = $canvas[0].getContext('2d');
    const ctx = $canvas[0];

    var chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '',
          backgroundColor: chartColor,
          borderColor: chartColor,
          fill: true,
          // partialColor: '#00f000',
          data: values,
          colors: ['', 'red', 'green', 'blue']
        }],
        type: "line",
        pointRadius: 0,
        lineTension: 0,
        borderWidth: 1
      },
      options: {
        maintainAspectRatio: false,
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
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
              padding: 10,
              fontColor: grayColor,
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
              text: 'Domain Authority'
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
            // callbacks: {
            //   label: function(e, t) {
            //     let res = parseFloat(e.value).toLocaleString();
            //     return `${res}`;
            //   },
            //   title: function(e, t){
            //     let index = e[0].index;
            //     let res = data.formattedTime[index];
            //     return res;
            //   }
            // }
          }
        }
      }
    });
    chart.update();
  };


  var processTopicalKeywords = function(manual){
    let $as = $('[jscontroller="fcDBE"] [role=list] [role=listitem] a');
    if (!$as.length) {
      $as = $('[aria-label="Refinement"] [role="listitem"] a');
    }
    if (!$as.length) return;
    $('#xt-ke-widgets-root').addClass('xt-ke-has-topical');
    // const list = [];
    const keywords = {};
    $as.map(function(i, node){
      const href = node.href;
      const keyword = getURLParameter('q', false, href);
      // list.push(keyword);
      keywords[keyword.toLowerCase()] = true;
    });

    var settings = Starter.getSettings();
    var hasCredits = Common.getCredits() > 0;
    var rows = [];
    if ( (!settings.sourceList.topicg && !manual) || !settings.apiKey || !hasCredits) {
      for (var keyword in keywords) {
        rows.push({keyword: keyword});
      }
      renderWidgetTable('topical-keywords', rows, null);
      return;
    }
    Common.processKeywords({
      keywords: Object.keys(keywords),
      tableNode: null,
      src: source,
      from: 'topicg',
      seed: getQuery('corrected'),
      noCheckCredits: true
    }, function(json){
      if (json.error_code === 'NOCREDITS' || json.error_code === 'INVALIDAPI') {
        for (var keyword in keywords) {
          rows.push({keyword: keyword});
        }
        renderWidgetTable('topical-keywords', rows, null, 'nocredits');
      }
      else {
        processTopicalResponse(json, keywords, rows);
      }
    });
  };


  var processRelatedSearch = function(manual){
    // see Oct 18 issue with google maps
    if (document.location.pathname.indexOf('/search') !== 0) return;
    var list = [];
    if (conf && conf.relatedSearchSelectors) {
      for (var i = 0, len = conf.relatedSearchSelectors.length; i < len; i++) {
        var selItem = conf.relatedSearchSelectors[i];
        list = $(selItem.sel);
        if (selItem.ignoreClosest) {
          selItem.ignoreClosest.map(function(filterSelector){
            if (list.closest(filterSelector)[0]) list = $([]);
          });
        }
        // console.log(selItem, list);
        if (list.length) break;
      }
    }
    else {
      list = $('._e4b a:not([target="_blank"]');
      if (!list.length) {
        list = $('#extrares .brs_col a:not([target="_blank"])');
      }
      if (!list.length) {
        list = $('#botstuff .EIaa9b a:not([target=\"_blank\"]), [jsname=xQjRM] .EIaa9b a:not([target=\"_blank\"])');
      }
      if (!list.length) {
        list = $('#botstuff .brs_col a:not([target="_blank"])');
      }
      if (!list.length) {
        list = $('#botstuff #bzMwOe a span');
        if (list.closest('g-more-link')[0] || list.closest('g-popup')[0]) list = [];
      }
      if (!list.length) {
        list = $('#botstuff #bzMwOe a .s75CSd');
        if (list.closest('g-more-link')[0] || list.closest('g-popup')[0]) list = [];
      }
      if (!list.length) {
        list = $('#extrares #bres a.F3dFTe');
      }
    }
    var $mosaicItems = getRelatedSearchMosaicKeywords();
    $mosaicItems.map(function(i, item){
      list.push(item);
    });
    if (!list.length) return;
    var keywords = {};
    keywords[getQuery()] = null;
    for (var i = 0, len = list.length; i < len; i++) {
      var keyword = Common.cleanKeyword( list[i].textContent );
      keywords[ keyword.toLowerCase() ] = list[i];
    }
    var settings = Starter.getSettings();
    if ( (!settings.sourceList.gprsea && !manual) || !settings.apiKey ) {
      var rows = [];
      for (var keyword in keywords) {
        rows.push({keyword: keyword});
      }
      dataSEOReport.related = rows;
      renderWidgetTable('related-keywords', rows, null);
      return;
    }
    processKeywords( keywords, {} );
  };


  var getRelatedSearchMosaicKeywords = function(){
    var list = [];
    if (conf && conf.relatedMosaicSelectors) {
      for (var i = 0, len = conf.relatedMosaicSelectors.length; i < len; i++) {
        var selItem = conf.relatedMosaicSelectors[i];
        list = $(selItem.sel);
        if (list.length) break;
      }
    }
    else {
      list = $('#botstuff [jscontroller="V9u9Nb"] a, #botstuff [jscontroller="V9u9Nb"] a');
    }
    list = list.filter(function(i, node){
      if (node.querySelector('g-more-link')) return false;
      return true;
    });
    return list;
  };


  var getPASFData = function(){
    return new Promise(function(resolve, reject){
      chrome.runtime.sendMessage({
        cmd: 'api.getPASFData',
        data: {
          keyword: getQuery()
        }
      }, function(res){
        resolve(res);
      });
    });
  };


  var processPeopleAlsoSearch = async function(manual){
    var keywords = {};
    var rows = [];
    var $nodes = $( "div.g div .rc div div[id^='eobd'] div" );
    if (!$nodes.length) {
      $nodes = $("div.g div[jsname=d3PE6e] div[data-ved]");
    }
    $nodes.each(function( index ) {
      var keyword = this.textContent;
      keywords[keyword] = true;
    });
    var listLen = Object.keys(keywords).length;
    if (listLen === 0) {
      var res = await getPASFData();
      if (res && res.keywords && res.keywords.length) {
        res.keywords.map(function(keyword){
          keywords[keyword] = true;
        });
      }
      else return;
    }
    var settings = Starter.getSettings();
    var hasCredits = Common.getCredits() > 0;
    if ( (!settings.sourceList.gpasea && !manual) || !settings.apiKey || !hasCredits) {
      for (var keyword in keywords) {
        rows.push({keyword: keyword});
      }
      dataSEOReport.pasf = rows;
      renderWidgetTable('people-also-search', rows, null);
      return;
    }
    Common.processKeywords({
      keywords: Object.keys(keywords),
      tableNode: null,
      src: source,
      from: 'pasf',
      seed: getQuery('corrected'),
      noCheckCredits: true
    }, function(json){
      if (json.error_code === 'NOCREDITS' || json.error_code === 'INVALIDAPI') {
        for (var keyword in keywords) {
          rows.push({keyword: keyword});
        }
        renderWidgetTable('people-also-search', rows, null, 'nocredits');
        dataSEOReport.pasf = rows;
      }
      else {
        processPeopleAlsoSearchResponse(json, keywords, rows);
      }
    });
  };


  var hasAutocompleteSuggestions = function(aQuery, response){
    if (!response) return false;
    if (!response.length) return false;
    if (response.length === 1) {
      let keyword = response[0].keyword;
      if (keyword === aQuery) return false;
    }
    return true;
  };


  const processSEOReport = async function(){
    const res = await getSEOReportTemplates();
    if (typeof res !== 'object') return;
    renderSEOReport();
    const settings = Starter.getSettings();
    let html = [];
    for (let key in res) {
      let selected = '';
      if (key === settings.googleSelectedReport) selected = 'selected';
      html.push(`<option value="${key}" ${selected}>${res[key]}</option>`);
    }
    let $select = $('#xt-google-seoreport-select');
    $select.html( '<select>' + html.join('') + '</select>');
    $select.find('select').change(function(){
      const id = this.value;
      Starter.getSettings()['googleSelectedReport'] = id;
      chrome.runtime.sendMessage({
        cmd: 'setting.set',
        data: {
          key: 'googleSelectedReport',
          value: id
        }
      });
    });

  };


  const getSEOReportTemplates = function(){
    return new Promise(function(resolve){
      chrome.runtime.sendMessage({
        cmd: 'api.openAIFetchSEOReports',
        data: {source: source} // Pass source from cs-google.js ('gsearc')
      }, function(response){
        resolve(response);
      });
    })
  };


  // Helper function to extract LLM source from URL
  const getLLMSourceFromUrl = function(url){
    if (!url) return '';
    if (url.includes('chatgpt.com')) return 'openai';
    if (url.includes('claude.ai')) return 'claude';
    if (url.includes('gemini.google.com')) return 'gemini';
    if (url.includes('deepseek.com')) return 'deepsk';
    return '';
  };

  const getSEOReportTemplate = function(id, llmSource){
    return new Promise(function(resolve){
      chrome.runtime.sendMessage({
        cmd: 'api.openAIFetchSEOReport',
        data: {id: id, source: llmSource || source} // Pass LLM source if provided, otherwise use default ('gsearc')
      }, function(response){
        if (response && response.prompt) resolve(response);
        else {
          console.log('Investigate', response);
          resolve(response);
        }
      });
    })
  };


  var getTrendingKeywords = function(manual){
    var query = getQuery();
    query = Common.cleanKeyword(query);
    let params = {};
    let settings = Starter.getSettings();
    let geo = settings.country.toUpperCase();
    if (!geo) geo = 'US';
    if (geo === 'UK') geo = 'GB';
    params.geo = geo;
    let property = '';
    let timeRange = '30d';
    chrome.runtime.sendMessage({cmd: 'googleTrendsAPI.relatedsearches', data: {
      keyword: query,
      timeRange: timeRange,
      geo: geo,
      property: property || ''
    }}, (res) => {
      processTrendingKeywordsResponse(res, manual);
    });
  };


  var processTrendingKeywordsResponse = function(res, manual){
    try {
      let arr = (res.json.default.rankedList[1] || {}).rankedKeyword;
      var keywords = {};
      var rows = [];
      if (!arr) return;
      arr.map(function(item) {
        let keyword = item.query;
        keywords[keyword] = item.value;
      });
      var listLen = Object.keys(keywords).length;
      if (listLen === 0) return;
      var settings = Starter.getSettings();
      var hasCredits = Common.getCredits() > 0;
      if ( (!settings.sourceList.trenkw && !manual) || !settings.apiKey || !hasCredits) {
        for (var keyword in keywords) {
          rows.push({keyword: keyword, trendingValue: keywords[keyword]});
        }
        renderWidgetTable('trending-keywords', rows, null);
        return;
      }
      chrome.runtime.sendMessage({
        cmd: 'api.postTrendKeywords',
        data: {
          list: Object.keys(keywords)
        }
      }, function(){});
      Common.processKeywords({
        keywords: Object.keys(keywords),
        tableNode: null,
        src: source,
        from: 'trenkw',
        seed: getQuery('corrected'),
        noCheckCredits: true
      }, function(json){
        if (json.error_code === 'NOCREDITS' || json.error_code === 'INVALIDAPI') {
          for (var keyword in keywords) {
            rows.push({keyword: keyword, trendingValue: keywords[keyword]});
          }
          renderWidgetTable('trending-keywords', rows, null, 'nocredits');
        }
        else {
          // console.log(json, keywords, rows);
          if (typeof json.data !== 'object') return;
          for (var key in json.data) {
            var item = json.data[key];
            item.trendingValue = keywords[item.keyword];
            rows.push(item);
          }
          rows.sort(function(a,b){
            var aVal = parseInt(a.trendingValue);
            var bVal = parseInt(b.trendingValue);
            return bVal - aVal;
          });
          renderWidgetTable('trending-keywords', rows, json);
        }
      });
    } catch (e) {
      console.log(e);
    }
  };


  var getLTKQueries = async function(manual){
    var query = getQuery();
    query = Common.cleanKeyword(query);

    var aQuery = query + ' *';
    var response1 = await autocompleteQuery(aQuery, aQuery.length - 1);
    if (!hasAutocompleteSuggestions(aQuery, response1)) response1 = await autocompleteQuery(query + ' ?', aQuery.length - 1);

    aQuery = '* ' + query;
    var response2 = await autocompleteQuery(aQuery, 1);
    if (!hasAutocompleteSuggestions(aQuery, response2)) response2 = await autocompleteQuery('? ' + query, 1);

    var response3, response4, response5;
    var words = query.split(' ');
    if (words.length >= 2)  {
      var words2 = words.slice();
      words2.splice(1, 0, '*');
      var wordsStr = words2.join(' ');
      response3 = await autocompleteQuery(wordsStr, words[0].length);
      if (!response3.length) {
        words2[1] = '?';
        response3 = await autocompleteQuery(words2.join(' '), words[0].length);
      }
    }
    if (words.length >= 3) {
      var words3 = words.slice();
      words3.splice(2, 0, '*');
      var wordsStr = words3.join(' ');
      response4 = await autocompleteQuery(wordsStr, words[0].length);
    }
    if (words.length >= 4) {
      var words4 = words.slice();
      words4.splice(3, 0, '*');
      var wordsStr = words4.join(' ');
      response5 = await autocompleteQuery(wordsStr, words[0].length);
    }

    var keywords = {};
    var rows = [];
    response1.map(item => {
      let kw = Common.decodeHTMLEntities(item.keyword);
      keywords[kw] = true;
    });
    response2.map(item => {
      let kw = Common.decodeHTMLEntities(item.keyword);
      keywords[kw] = true;
    });
    if (response3) {
      response3.map(item => {
        let kw = Common.decodeHTMLEntities(item.keyword);
        keywords[kw] = true;
      });
    }
    if (response4) {
      response4.map(item => {
        let kw = Common.decodeHTMLEntities(item.keyword);
        keywords[kw] = true;
      });
    }
    if (response5) {
      response5.map(item => {
        let kw = Common.decodeHTMLEntities(item.keyword);
        keywords[kw] = true;
      });
    }
    delete keywords[query];
    // console.log(keywords);
    if (!Object.keys(keywords).length) return;
    var settings = Starter.getSettings();
    var hasCredits = Common.getCredits() > 0;
    if ( (!settings.sourceList.ltkwid && !manual) || !settings.apiKey || !hasCredits ) {
      for (var keyword in keywords) {
        rows.push({keyword: keyword});
      }
      dataSEOReport.ltkw = rows;
      renderWidgetTable('ltkwid', rows, null);
      return;
    }
    Common.processKeywords({
      keywords: Object.keys(keywords),
      tableNode: null,
      src: source,
      from: 'ltkwid',
      seed: getQuery('corrected'),
      noCheckCredits: true
    }, function(json){
      if (json.error_code === 'NOCREDITS' || json.error_code === 'INVALIDAPI') {
        for (var keyword in keywords) {
          rows.push({keyword: keyword});
        }
        dataSEOReport.ltkw = rows;
        renderWidgetTable('ltkwid', rows, null, 'nocredits');
      }
      else {
        ltkResponse(json, keywords, rows);
      }
    });
  };


  var autocompleteQuery = function(query, cp){
    return new Promise(function(resolve, reject){
      let tld = document.location.host.replace('www.', '').replace('google.', '');
      chrome.runtime.sendMessage({
        cmd: 'autocomplete',
        data: {
          service: 'google',
          query: query,
          tld: tld,
          cp: cp
        }
      }, function(response){
        if (!response.error) resolve(response.data);
        else resolve([]);
      });
    });
  };


  var processTopicalResponse = function(json, keywords, rows){
    // console.log(json, keywords, rows);
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
    renderWidgetTable('topical-keywords', rows, json);
  };


  var processPeopleAlsoSearchResponse = function(json, keywords, rows){
    // console.log(json, keywords, rows);
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
    dataSEOReport.pasf = [];
    rows.map(function(row){
      dataSEOReport.pasf.push({keyword: row.keyword, vol: row.vol});
    });
    renderWidgetTable('people-also-search', rows, json);
  };


  var ltkResponse = function(json, keywords, rows){
    // console.log(json, keywords, rows);
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
    dataSEOReport.ltkw = [];
    rows.map(function(row){
      dataSEOReport.ltkw.push({keyword: row.keyword, vol: row.vol});
    });
    renderWidgetTable('ltkwid', rows, json);
  };


  var checkWidgetsOrder = function(){
    const order = [
      '#xt-freeuser-root',
      '#xt-difficulty-root',
      '#xt-seoreport-root',
      '#xt-trend-chart-root',
      '#xt-google-trenkw',
      '#xt-google-topical',
      '#xt-google-topkw',
      '#xt-related-search',
      '#xt-google-ltkwid',
      '#xt-google-people-search',
      ];
    const $parent = $(getWidgetsParent());
    order.map(selector => {
      let $widget = $(selector);
      $parent.append($widget);
    });
  };


  var renderWidgetTable = function(type, rows, json, nocredits){
    var query = getQuery();
    var source = '';
    var title = '';
    var rootSelector;
    var iframeSrcParam = '';
    var excludeCols = [];
    if (type === 'related-keywords') {
      source = 'gprsea';
      title = 'Related Keywords';
      iframeSrcParam = 'related';
      rootSelector = 'xt-related-search';
    }
    if (type === 'people-also-search') {
      source = 'gpasea';
      title = 'People Also Search For';
      iframeSrcParam = 'pasf';
      rootSelector = 'xt-google-people-search';
    }
    if (type === 'ltkwid') {
      source = 'ltkwid';
      title = 'Long-Tail Keywords';
      iframeSrcParam = 'ltkwid';
      rootSelector = 'xt-google-ltkwid';
    }
    if (type === 'trending-keywords') {
      source = 'trenkw';
      title = 'Trending Keywords';
      iframeSrcParam = 'trenkw';
      rootSelector = 'xt-google-trenkw';
    }
    if (type === 'topical-keywords') {
      source = 'topicg';
      title = 'Topical Keywords';
      iframeSrcParam = 'topicg';
      rootSelector = 'xt-google-topical';
    }
    if (type === 'top-keywords') {
      source = 'topkw';
      title = 'SERP Keywords';
      iframeSrcParam = 'topkw';
      rootSelector = 'xt-google-topkw';
      excludeCols = ['cpc', 'comp'];
    }

    var settings = Starter.getSettings();
    var params = {
      settingEnabled: settings.sourceList[source],
      source: source,
      darkMode: darkMode,
      query: query,
      title: title,
      json: json,
      type: type,
      columnName: 'Keyword',
      excludeCols: excludeCols,
      rootSelector: rootSelector,
      addTo: getWidgetsParent(),
      addMethod: 'appendTo',
      iframeSrcParam: iframeSrcParam,
      filename: source + '-' + query.replace(/\s+/g, '_'),
      fnGenerateLink: function(keywordEnc){
        return document.location.origin + '/search?q=' + keywordEnc;
      },
      onAdded: function($root){
        if ($('#xt-google-ltkwid')[0]) {
          $root.insertBefore($('#xt-google-ltkwid'));
        }
        if ($('#xt-google-people-search')[0]){
          if (type === 'ltkwid' || type === 'trending-keywords') {
            $root.insertAfter($('#xt-google-people-search'));
          }
          else {
            $root.insertBefore($('#xt-google-people-search'));
          }
        }
        checkWidgetsOrder();
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
        if ($parent[0].id === 'xt-related-search') {
          processRelatedSearch('manual');
        }
        else if ($parent[0].id === 'xt-google-people-search') {
          processPeopleAlsoSearch('manual');
        }
        else if ($parent[0].id === 'xt-google-ltkwid') {
          getLTKQueries('manual');
        }
        else if ($parent[0].id === 'xt-google-trenkw') {
          getTrendingKeywords('manual');
        }
        else if ($parent[0].id === 'xt-google-topical') {
          processTopicalKeywords('manual');
        }
        else if ($parent[0].id === 'xt-google-topkw') {
          renderTopKeywordsWidget('manual');
        }
      }
    };
    if (type === 'trending-keywords') {
      params.trendColumnName = '30d inc';
    }
    if (type === 'top-keywords') {
      params.usageColumnName = 'Pages';
    }
    Common.renderWidgetTable(rows, params);
  };


  var processKeywords = function( keywords, table ){
    Common.processKeywords({
        keywords: Object.keys( keywords ),
        tableNode: table,
        src: source,
        from: 'related',
        seed: getQuery('corrected'),
        noCheckCredits: true
      },
      function(json){
        processRelatedSearchWidgetResponse( json, keywords );
      }
    );
  };


  var processQueryResponse = function( json ){
    var data;
    if (json.error) {
      console.error(json);
      return;
    }
    if (json.data) data = json.data[0];
    var $node = addSearchQueryLine();
    if (!data) {
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


  var addSearchQueryLine = function(){
    var $node = $('#xt-info');
    if (!$node.length) {
      $node = $('<div/>', {
          class: 'xt-google-query'
        })
        .attr('id', 'xt-info');
      var $parent = $(rootSel);
      if (!$parent[0]) {
        $parent = $('#tsf .A8SBwf');
        if ($parent[0] && getComputedStyle($parent[0]).display === 'flex') {
          $node.css({
            position: 'absolute',
            top: $parent[0].getBoundingClientRect().bottom,
            zIndex: 1000
          });
        }
      }
      if (document.location.href.indexOf('&tbm=isch') !== -1) {
        $parent = $('#tsf .A8SBwf');
      }
      $node[addMethod]( $parent );
    }
    return $node;
  };


  var processRelatedSearchWidgetResponse = function( json, keywords ){
    var rows = [];
    if (json.error_code === 'NOCREDITS' || json.error_code === 'INVALIDAPI') {
      for (var keyword in keywords) {
        rows.push({keyword: keyword});
      }
      renderWidgetTable('related-keywords', rows, null, 'nocredits');
      dataSEOReport.related = rows;
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
    dataSEOReport.related = [];
    rows.map(function(row){
      dataSEOReport.related.push({keyword: row.keyword, vol: row.vol});
    });
    renderWidgetTable('related-keywords', rows, json);
  };


  var processRelatedSearchResponse = function( json, keywords ){
    var data = json.data;
    for (var key in data) {
      var item = data[key];
      var node = keywords[ item.keyword ];
      var $node = $(node);
      var $span = $('<span/>').addClass('xt-related-search');
      if (item.vol != '-') {
        var html = Common.getResultStr(item);
        var color = Common.highlight(item);
        if (color) {
          $span.addClass('xt-highlight');
          $span.css({background: color});
        }
        html = Common.appendStar(html, item);
        html = Common.appendKeg(html, json, item);
        $span.html(html);
      }
      $node
        .after( $span );
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


  var initSERPMutationObserver = function(){
    if (serpObserver) serpObserver.disconnect();
    serpObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          if (!mutation.addedNodes.length) return;
          processSERPChildList(mutation.addedNodes);
        }
      });
    });

    var config = { subtree: true, childList: true, characterData: true };
    var target = document.querySelector('body');
    serpObserver.observe(target, config);
  };


  var processSERPChildList = function(children){
    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];
      if (node.dataset && node.dataset.asyncContext) {
        if (node.querySelector('.g')) {
          var settings = Starter.getSettings();
          processURLs(settings.showGoogleTraffic, settings.showGoogleMetrics, '#botstuff');
        }
      }
    }
    addAioAnalyzeButton();
  };


  var initSuggestionsMutationObserver = function( target ){
    var settings = Starter.getSettings();
    if (!settings.showMetricsForSuggestions) return;
    if (suggestionsObserver) suggestionsObserver.disconnect();
    suggestionsObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          if (!mutation.addedNodes.length) return;
          processSuggestionsChildList(mutation.addedNodes);
        }
      });
    });

    var config = { subtree: true, childList: true, characterData: true };
    suggestionsObserver.observe(target, config);
  };


  var processSuggestionsChildList = function(children){
    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];
      if (typeof node.className === 'string' && node.className.match(/xt-/)) continue;
      var $node = $(node);
      if ($node.attr('role') === 'presentation') {
        processSuggestion(node);
      }
      else if ($node.parent().hasClass('sbl1') || $node.closest('li[role=presentation]')[0]){
        processSuggestion($node.closest('li[role=presentation]')[0]);
      }
      else {
        var list = $node.find('ul[role=listbox]')[0];
        if (list) {
          $(list).find('li div[role=option]').map(function(i, node){
            processSuggestion(node);
          });
        }
      }
    }
  };


  var processSuggestion = function(node){
    var $node = $(node);
    var option = $node.find('div[role=option]')[0];
    if (!option && $node.attr('role') === 'option') option = $node[0];
    if (!option) return;
    // console.log(node.textContent);
    if (!suggestionsTimer) suggestionsList = {};
    var $option = $(option);
    var keyword = $option.find('.sbqs_c, .sbpqs_a').text();
    if ($option.find('.aypzV')[0]) {
      keyword = $option.find('.aypzV').text();
    }
    if ($option.find('.Hlfhoe')[0]) {
      keyword = $option.find('.Hlfhoe').text();
    }
    if (!keyword && !$option.find('.sbqs_c')[0]) {
      keyword = $option.find('.sbl1 span').text();
    }
    if (!keyword) {
      keyword = $option.find('.wM6W7d span').text();
    }
    suggestionsList[keyword.toLowerCase()] = option;
    if (suggestionsTimer) clearTimeout(suggestionsTimer);
    suggestionsTimer = setTimeout(function(){
      processSuggestionsList();
    }, 1000);
  };


  var processSuggestionsList = function(){
    var visible = {};
    for (var key in suggestionsList) {
      var $option = $(suggestionsList[key]);
      if ($option.find('.sbl1 span, .aypzV span, .wM6W7d span, .sbqs_c, span.Hlfhoe').text().toLowerCase() === key) {
        visible[key] = suggestionsList[key];
      }
    }
    var key = Object.keys(visible).join('');
    if (cachedSuggestions[key]) {
      processSuggestionsListResponse(cachedSuggestions[key], visible);
      return;
    }
    suggestionsTimer = null;
    Common.processKeywords({
        keywords: Object.keys( visible ),
        tableNode: {},
        src: source
      },
      function(json){
        // console.log(json, visible);
        processSuggestionsListResponse( json, visible );
        cachedSuggestions[key] = json;
      }
    );
  };


  var processSuggestionsListResponse = function(json, keywords){
    var data = json.data;
    for (var key in data) {
      var item = data[key];
      dataByKeyword[item.keyword] = data[key];
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
      $node.find('.sbqs_c, .sbpqs_a').append( $span );
      if (!$node.find('.sbqs_c')[0]) {
        $node.find('.sbl1 span').append( $span );
      }
      if (!$node.find('.sbl1 span')[0]) {
        $node.find('.aypzV span, .wM6W7d span, .Hlfhoe').append($span);
      }
    }
    var $parent = $('ul[role=listbox]');
    var res = {};
    $parent.find('li [role=option]:visible').map(function(i, node){
      var keyword = node.getAttribute('aria-label');
      if (!keyword) return;
      var keywordLC = keyword.toLowerCase();
      res[keywordLC] = dataByKeyword[keywordLC];
    });
    var query = getQuery();
    if (!query) query = $('textarea[name=q]').val().trim();
    var filename = document.location.host.replace('www.', '') + '-' + query + '.csv';
    Common.addCopyExportButtons($parent, res, filename);
  };


  var getURLParameter = function(sParam, useHash, url) {
    var loc = new URL(window.location);
    if (url) loc = new URL(url);
    var qs = loc.search.substring(1);
    if (useHash) qs = loc.hash.substring(1);
    qs = qs.split('+').join(' ');
    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;
    while (tokens = re.exec(qs)) {
      params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }
    return params[sParam];
  };


  var getSource = function(){
    return source;
  };


  const initTrendsChart = (params) => {
    // example of ".rfli" - serp with results on the map, e.g. pizza
    params.parentSelector = getWidgetsParent();
    params.parentClassName = 'xt-g-google-trends-root';
    params.addFn = function($node){
      let $difficultyRoot = $('#xt-difficulty-root');
      let $ltkbtn = $('#xt-ltkbtn-root');
      if ($difficultyRoot[0]) $node.insertAfter($difficultyRoot);
      else if ($ltkbtn[0]) $node.insertAfter($ltkbtn);
      else $node.prependTo(getWidgetsParent());
    };
    params.rootId = 'xt-trend-chart-root';
    params.title = 'Trend Data For';
    params.buttonCopy = 'Copy';
    params.buttonExport = 'Export';
    params.query = getQuery();
    params.source = 'trend';
    params.darkMode = darkMode;
    TrendsChart.init(params);
  };


  const addFindLongTailKeywordsBtn = () => {
    let tld = document.location.host.replace('www.', '').replace('google.', '');
    let params = {
      parentSelector: getWidgetsParent(),
      addMethod: 'prependTo',
      rootId:'xt-ltkbtn-root',
      query: getQuery(),
      service: 'google',
      tld: tld
    };
    Common.renderFindLongTailKeywordsBtn(params);
  };


  const addDifficultyWidget = () => {
    let page = getURLParameter('start');
    if (page && page !== '0') return;
    let rootId = 'xt-difficulty-root';
    let $node = $('<div>', { id: rootId });
    let $ltkbtn = $('#xt-ltkbtn-root');
    if ($ltkbtn[0]) {
      $node.insertAfter($ltkbtn);
    }
    else $node.prependTo(getWidgetsParent());
    getDifficulty();
  };


  const getDifficulty = async () => {
    let page = getURLParameter('start');
    if (page && page !== '0') return;
    let query = getQuery().trim();
    let domains = [];
    let serpData = [];
    let count = 0;
    let total = 0;
    let branded = false;
    let social = 'twitter.com facebook.com linkedin.com instagram.com tiktok.com'.split(' ');
    let socialCount = {sum: 0};
    // let selector = getSERPItemsSelector();
    let selector = '#ires div.g, #res div.g, #rso .MjjYud, [jscontroller="SC7lYd"]';
    $(selector).map(function(i, node){
      if (count > 10) return;
      let $node = $(node);
      if ($node.find('[jscontroller="SC7lYd"]').length > 0) {
        return; // prevent duplicatiion
      }
      if ($node.closest('.related-question-pair')[0]) return;
      // if ($node.closest('.ULSxyf')[0]) return;
      if ($node.find('#kp-wp-tab-cont-overview')[0]) return;
      if ($node.find('g-section-with-header')[0]) return;
      if ($node.find('.g')[0]) return;
      if ($node.find('#currency-v2-updatable_2')[0]) return;
      if (node.classList.contains('g-blk')) {}
      else {
        if ($node.closest('.g-blk')[0]) {
          return;
        }
        if (count === 0 && $node.parent().closest('.g').find('table')[0]) {
          branded = true;
        }
        count++;
        let data = getSERPItemData($node);
        if (!data) return;
        data.domain = Common.getHost(data.url);
        social.map(function(domain){
          if (data.domain.indexOf(domain) !== -1 && !socialCount[domain]) {
            socialCount.sum++;
            socialCount[domain] = true;
          }
        });
        domains.push(data.domain);
        if (count === 3 && domains[0] === domains[1] && domains[1] === domains[2]) branded = true;
        let res = calcOnPagePoints(query, data, {exactMatchesTitle: 15, exactMatchesURL: 5, exactMatchesDescr: 5, broadMatchesTitle: 25, broadMatchesURL: 10, broadMatchesDescr: 10, hasBolded: 30});
        total += res.sum;
        data.onpage = res;
        serpData.push(data);
      }
    });
    dataSEOReport.serp = serpData;
    if (socialCount.sum > 1) branded = true;
    let onpageAvg = Math.round(total / count);
    if (!domains.length) {
      console.log('no domains');
      return;
    }
    let offpage = await getOffpageDifficulty(domains);
    let difficulty = OFFPAGE_PERCENT * offpage.avg + ONPAGE_PERCENT * onpageAvg;
    if (branded) difficulty *= 1.2;
    if (difficulty > 100) difficulty = 100;
    else difficulty = Math.round(difficulty);
    let title = 'Find long-tail keywords for';
    let queryQuotes = '"' + query + '"';
    if (query.length > 38) queryQuotes = 'this search query';
    let country = (Starter.getSettings().country || '').toUpperCase();
    let countryTitle = country ? `(${country})` : '';
    let btnURL = chrome.runtime.getURL(`html/page.html?page=autocomplete&query=${encodeURIComponent(query)}&service=google`);
    let tld = document.location.host.replace('www.', '').replace('google.', '');
    btnURL += '&tld=' + tld;
    dataSEOReport.seo_metrics = `
      SEO Difficulty: ${difficulty}/100
      Off-Page Difficulty: ${offpage.avg}/100
      On-Page Difficulty: ${onpageAvg}/100
      Brand Query: ${branded}
    `;
    renderDifficulty({
      title: title,
      countryTitle: countryTitle,
      btnURL: btnURL,
      query: query,
      queryQuotes: queryQuotes,
      onpage: {
        avg: onpageAvg,
        data: serpData
      },
      offpage: offpage,
      difficulty: difficulty,
      branded: branded
    });
  };


  const getSERPItemsSelector = function(){
    let res = '#ires .g, #res .g';
    let $nodes = $(res);
    if (res.length < 3) return res;
    let classNameCounts = {};
    let maxCount = 0;
    let maxClassName = '';
    $nodes.map(function(i, node){
      Array.from(node.classList).map(function(c){
        if (c === 'g') return;
        if (!classNameCounts[c]) classNameCounts[c] = 0;
        classNameCounts[c]++;
        if (classNameCounts[c] > maxCount) {
          maxCount = classNameCounts[c];
          maxClassName = c;
        }
      });
    });
    if (maxClassName) {
      res = `#ires .g.${maxClassName}, #res .g.${maxClassName}`;
    }
    return res;
  };


  const getOffpageDifficulty = domains => {
    return new Promise((resolve, reject) => {
      let settings = Starter.getSettings();
      chrome.runtime.sendMessage({
        cmd: 'api.getDomainLinkMetrics',
        data: {
          domains: domains,
          country: settings.country
        }
      }, function(response){
        let dataByDomain = {};
        let total = 0;
        let count = 0;
        if (typeof response.data === 'object' && response.data.error) {
          console.error(response.data.error, response.data.message);
          return;
        }
        response.data.map(function(item){
          let domain = item.domain;
          dataByDomain[domain] = item.data;
          if (item.data.error) return;
          let moz_domain_authority = item.data.moz_domain_authority;
          let page_rank = item.data.page_rank * 10;
          if (typeof moz_domain_authority === 'undefined' || typeof page_rank === 'undefined') return;
          let sum = moz_domain_authority*0.75 + page_rank*0.25;
          total += sum;
          dataByDomain[domain].sum = sum;
          count++;
        });
        let avg = Math.round(total / count);
        resolve({
          avg: avg,
          data: dataByDomain
        });
      });
    });
  };


  const renderDifficulty = function(data){
    let html = '';
    let settings = Starter.getSettings();
    if (settings.showAutocompleteButton) {
      html = `
      <table><tr>
      <td><button class="xt-ke-btn">${data.title} <span style="margin-left: .25rem">${data.queryQuotes} ${data.countryTitle}</span></button>
      </td></tr></table>`;
    }
    html += `<div class="xt-ke-row xt-ke-mb-md">
        <div class="xt-ke-col">
            <div class="xt-ke-row xt-ke-align-items-center">
              <div class="xt-ke-col xt-ke-col-60">SEO Difficulty</div>
              <div class="xt-ke-col xt-ke-col-40">
                <span class="xt-ke-badge xt-ke-badge-light xt-ke-px-10px">${data.difficulty}/100</span>
              </div>
            </div>
        </div>

        <div class="xt-ke-col">
          <div class="xt-ke-row xt-ke-align-items-center">
            <div class="xt-ke-col xt-ke-col-60">Brand Query</div>
            <div class="xt-ke-col xt-ke-col-40 xt-difficulty-branded">
                <span class="xt-ke-badge xt-ke-badge-light">${data.branded ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="xt-ke-row xt-ke-mb-md">
        <div class="xt-ke-col">
          <div class="xt-ke-row xt-ke-align-items-center">
            <div class="xt-ke-col xt-ke-col-60">Off-Page Difficulty</div>
            <div class="xt-ke-col xt-ke-col-40"><span class="xt-ke-badge xt-ke-badge-light">${data.offpage.avg}/100</span></div>
          </div>
        </div>

        <div class="xt-ke-col">
          <div class="xt-ke-row xt-ke-align-items-center">
            <div class="xt-ke-col xt-ke-col-60">On-Page Difficulty</div>
            <div class="xt-ke-col xt-ke-col-40"><span class="xt-ke-badge xt-ke-badge-light">${data.onpage.avg}/100</span></div>
          </div>
        </div>
      </div>

      <div class="xt-ke-difficulty-links">
        <a href="https://keywordseverywhere.com/seo-metrics.html" target="_blank">How these metrics are calculated</a>
        <a href="${chrome.runtime.getURL('html/diffstats.html')}" class="xt-difficulty-breakdown-btn" target="_blank">Detailed breakdown</a>
      </div>
    `;
    html += Common.renderIframeHTML({
      query: data.query,
      settingEnabled: true,
      darkMode: darkMode,
      iframeSrcParam: 'difficulty'
    });
    let params = {
      parentSelector: getWidgetsParent(),
      addMethod: 'prependTo',
      rootId:'xt-difficulty-root',
      html: html,
      service: 'google',
      onAdded: function($root){
        let $ltkbtn = $('#xt-ltkbtn-root');
        if ($ltkbtn[0]) {
          $root.insertAfter($ltkbtn);
        }
        checkWidgetsOrder();
      },
      onReady: function($root){
        $root.find('.xt-difficulty-breakdown-btn').click(function(e){
          chrome.runtime.sendMessage({
            cmd: 'google.setDifficultyData',
            data: data
          });
        });
        if (data.branded) {
          $root.find('.xt-difficulty-branded').attr('title', 'Google considers "' + getQuery() + '" to be a branded query, the SEO Difficulty is increased by 20%.');
        }
      }
    };
    let $root = Common.renderGenericWidget(params);
    $root.find('button').click(() => {
      chrome.runtime.sendMessage({
        cmd: 'new_tab',
        data: data.btnURL
      });
    });
  };


  const renderSEOReport = function(data){
    let html = '';
    let settings = Starter.getSettings();
    var buttons =`
      <a class="xt-google-seoreport-run-btn xt-ke-btn" data-url="https://chatgpt.com">${SVGIcons.chatgpt} ChatGPT</a>
      <a class="xt-google-seoreport-run-btn xt-ke-btn" data-url="https://claude.ai/chats">${SVGIcons.claude} Claude</a>
      <a class="xt-google-seoreport-run-btn xt-ke-btn" data-url="https://gemini.google.com">${SVGIcons.gemini} Gemini</a>
      <a class="xt-google-seoreport-run-btn xt-ke-btn" data-url="https://chat.deepseek.com">${SVGIcons.deepseek} Deepseek</a>
      `;
    html += `
      <div class="xt-ke-row xt-ke-mb-md">
        <div class="xt-google-seoreport-template">
          <h3><img src="${chrome.runtime.getURL('/img/icon24.png')}" width="24" height="24"> Run SEO Report</h3>
          <div id="xt-google-seoreport-select"></div>
        </div>
        <div id="xt-google-seoreport-buttons">
          ${buttons}
        </div>
      </div>
    `;
    html += Common.renderIframeHTML({
      query: '', //data.query,
      settingEnabled: true,
      darkMode: darkMode,
      iframeSrcParam: 'seoreport'
    });
    let params = {
      parentSelector: getWidgetsParent(),
      addMethod: 'prependTo',
      rootId:'xt-seoreport-root',
      html: html,
      service: 'google',
      onAdded: function($root){
        let $ltkbtn = $('#xt-ltkbtn-root');
        if ($ltkbtn[0]) {
          $root.insertAfter($ltkbtn);
        }
        checkWidgetsOrder();
      },
      onReady: function($root){
      }
    };
    let $root = Common.renderGenericWidget(params);
    $root.find('.xt-ke-btn').click(function(e){
      e.preventDefault();
      runSEOReport(this.dataset.url);
    });
  };


  const runSEOReport = async function(url){
    const id = $('#xt-google-seoreport-select select').val();
    const llmSource = getLLMSourceFromUrl(url);
    const template = await getSEOReportTemplate(id, llmSource);
    const data = prepareSEOReportTemplateData();
    const prompt = generatePrompt(template.prompt, data);
    chrome.runtime.sendMessage({
      cmd: 'prompt_pending.set',
      data: {
        url: url,
        prompt: prompt
      }
    }, function(){});
  };


  const prepareSEOReportTemplateData = function(){
    const res = {
      search_query: getQuery().trim(),
      serp_data_basic: '',
      seo_metrics: dataSEOReport.seo_metrics
    };
    console.log(dataSEOReport);
    if (dataSEOReport.serp) {
      const  arr = [];
      const arrAdvanced = [];
      dataSEOReport.serp.map(function(item, index){
        let str = `
            Position: ${index + 1}
            Title: ${item.title}
            Description: ${item.description}
            URL: ${item.url}
          `;
        arr.push(str);
        const metrics = dataSEOReport.metrics[item.url] || {};
        const country = Starter.getSettings().country;
        const countryUC = country ? country.toUpperCase() : 'US';
        str += [
          metrics.page ? `Page Traffic from ${countryUC}: ${metrics.page}` : '',
          metrics.domain ? `Domain Traffic from ${countryUC}: ${metrics.domain}` : '',
          metrics.moz_domain_authority ? `Moz Domain Authority: ${metrics.moz_domain_authority}` : ''
        ].join('\n');
        arrAdvanced.push(str);
      });
      res.serp_data_basic = arr.join('\n');
      res.serp_data_advanced = arrAdvanced.join('\n');
    }
    if (dataSEOReport.total && dataSEOReport.total.count) {
      res.average_referring_domains = Math.round( dataSEOReport.total.moz_root_domains_to_subdomain / dataSEOReport.total.count );
      res.average_referring_links = Math.round( dataSEOReport.total.moz_external_pages_to_subdomain / dataSEOReport.total.count );
      res.minimum_referring_domains = dataSEOReport.total.min_moz_root_domains_to_subdomain;
      res.maximum_referring_domains = dataSEOReport.total.max_moz_root_domains_to_subdomain;
      res.minimum_referring_links = dataSEOReport.total.min_moz_external_pages_to_subdomain;
      res.maximum_referring_links = dataSEOReport.total.max_moz_external_pages_to_subdomain;
    }
    'related pasf ltkw topkw'.split(' ').map(key => {
      const kwList = [];
      const kwVolList = [];
      if (dataSEOReport[key]) {
        dataSEOReport[key].map(item => {
          kwList.push(item.keyword);
          if (item.vol) {
            let val = parseInt(item.vol.replace(/,/g, ''));
            if (val > 0) kwVolList.push(item.keyword + ',' + val);
          }
          else kwVolList.push(item.keyword + ',0');
        });
      }
      let id = key;
      if (key === 'ltkw') id = 'longtail';
      if (key === 'topkw') id = 'serp';
      res[id + '_keywords'] = kwList.join('\n');
      res[id + '_keywords_volume'] = kwVolList.join('\n');
    });
    return res;
  };


  const generatePrompt = function(template, data){
    let prompt = template;
    for (const key in data) {
      const re = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(re, data[key]);
    }
    return prompt;
  };


  const renderPromoIframe = function(promoParam){
    let query = getQuery().trim();
    var html = Common.renderIframeHTML({
      query: query,
      settingEnabled: true,
      darkMode: darkMode,
      iframeSrcParam: 'freeuser_google',
      iframeValidSubParam: promoParam === 'valid_sub'
    });
    let params = {
      parentSelector: getWidgetsParent(),
      addMethod: 'prependTo',
      rootId: 'xt-freeuser-root',
      html: html,
      service: 'google',
      onAdded: function($root){
        checkWidgetsOrder();
      },
      onReady: function($root){
      }
    };
    let $root = Common.renderGenericWidget(params);
  };


  const getSERPItemData = function($node){
    let res = {};
    try {
      if (!res.url) {
        res.url = $($node.find('.rc a[ping]')[0]).attr('href');
        if (vendor === 'Firefox') {
          res.url = $($node.find('.rc a')[0]).attr('href');
        }
      }
      if (!res.url) {
        let link = $node.find('g-link');
        if (link[0]) { // e.g. twitter results
          let $link = $(link);
          res.url = $link.find('a').get(0).getAttribute('href');
          res.title = $.trim($link.text());
        }
      }
      if (!res.url) {
        let $link = $node.find('a h3').closest('a');
        if ($link[0]) {
          res.url = $link.get(0).getAttribute('href');
        }
      }
      if (!res.url) {
        console.log('google serp item url not found', $node);
        return;
      }
      res.title = $.trim($node.find('a h3')[0].textContent);
      let $descriptionNode = getDescriptionNode($node);
      if ($descriptionNode[0]) {
        res.description = $descriptionNode.text();
        if ($descriptionNode[0].tagName === 'TABLE') {
          res.description = Array.from($descriptionNode.find('td').map(function(i, td){
            return td.textContent;
          })).join(' ');
        }
        let words = [];
        $descriptionNode.find('em').map(function(i, em){
          words = words.concat(em.textContent.toLowerCase().split(/\s+/));
          let uniq = {};
        });
        let uniqWords = {};
        words.map(function(word){
          uniqWords[word] = true;
        });
        res.descriptionBold = Object.keys(uniqWords);
      }
      else if ($node.find('.W8l4ac')[0]) {
        res.description = $node.find('.W8l4ac').text();
        res.descriptionBold = [];
      }
      else {
        res.descriptionBold = [];
        res.description = '';
      }
      let $when = $node.find('.st .f, .aCOpRe .f');
      if ($when[0]) {
        let text = $when[0].textContent.replace(/ -\s+$/, '');
        let date = new Date(text);
        let isValid = !isNaN(date.getTime()) || text.match(/ago/);
        if (isValid) {
          res.when = text;
        }
      }
    } catch (e) {
      console.log(e);
      console.log($node[0]);
    }
    return res;
  };


  var hasExactMatch = function(str, substr){
    var index = str.indexOf(substr);
    if (index === -1) return false;
    if (index > 0 && str[index - 1].match(/\w/)) return false;
    var nextChar = index + substr.length;
    if (str[nextChar] && str[nextChar].match(/\w/)) return false;
    return true;
  };


  var preprocessWords = function(text, params){
    text = text.toLowerCase();
    let stopwords = 'a am an and any are as at be by can did do does for from had has have how i if in is it its may me might mine must my mine must my nor not of oh ok when who whom why will with yes yet you your'.split(' ');
    stopwords.map(function(word){
      let re = new RegExp(`\\b${word}\\b`);
      text = text.replace(re, '');
    });
    let keywords = text.match(/[\w-']+/g);
    if (!keywords) {
      keywords = text.split(/\s+/);
    }
    if (!keywords) return '';
    keywords = keywords.map(function(kw){
      kw = kw.replace(/^'/, '');
      kw = kw.replace(/'$/, '');
      if (params.pluralize) kw = pluralize(kw);
      return kw;
    });
    if (params.split) return keywords;
    else return keywords.join(' ');
  };


  var calcOnPagePoints = (query, item, scale) => {
    let title = item.title;
    let description = item.description;
    let queryNoSpaces = query.replace(/\W/g, '');
    let url = item.url;
    url = url.replace(/https?:\/\//, '').replace(/[-_.]+/g, ' ');
    let exactMatchesTitle = 0, exactMatchesDescr = 0, broadMatchesTitle = 0, broadMatchesDescr = 0, exactMatchesURL = 0, broadMatchesURL = 0;
    if (!title) title = '';
    if (!description) description = '';
    let urlP = preprocessWords(url, {pluralize: true});
    query = preprocessWords(query, {});
    let queryP = preprocessWords(query, {pluralize: true});
    queryNoSpaces = preprocessWords(queryNoSpaces, {pluralize: true});
    let titleP = preprocessWords(title, {pluralize: true});
    let descriptionP = preprocessWords(description, {pluralize: true});
    if (hasExactMatch(titleP, queryP)) {
      exactMatchesTitle = scale.exactMatchesTitle;
    }
    if (hasExactMatch(urlP, queryP)) {
      exactMatchesURL = scale.exactMatchesURL;
    }
    if (hasExactMatch(urlP, queryNoSpaces)) {
      exactMatchesURL = scale.exactMatchesURL;
    }
    if (hasExactMatch(descriptionP, queryP)) {
      exactMatchesDescr = scale.exactMatchesDescr;
    }
    let keywords = query.split(/\s+/);
    let keywordsP = queryP.split(/\s+/);
    let arrTitle = titleP.split(/\s+/);
    let arrDescr = descriptionP.split(/\s+/);
    let arrURL = urlP.split(/\s+/);
    let titleMatchesCount = 0;
    let urlMatchesCount = 0;
    let descrMatchesCount = 0;
    let permArr = [];
    if (keywords.length <= 3) {
      permArr = permutator(keywords);
    }
    permArr.map(function(arr){
      let joined = arr.join('');
      if (url.indexOf(joined) !== -1) {
        broadMatchesURL = scale.broadMatchesURL;
      }
    });
    keywordsP.map((keyword, index) => {
      if (arrTitle.indexOf(keyword) !== -1) titleMatchesCount++;
      if (arrURL.indexOf(keyword) !== -1) urlMatchesCount++;
      else if (url.indexOf(keywords[index]) !== -1) urlMatchesCount++;
      if (arrDescr.indexOf(keyword) !== -1) descrMatchesCount++;
    });
    broadMatchesTitle = parseFloat(((titleMatchesCount / keywords.length) * scale.broadMatchesTitle).toFixed(2));
    if (!broadMatchesURL) {
      broadMatchesURL = parseFloat(((urlMatchesCount / keywords.length) * scale.broadMatchesURL).toFixed(2));
    }
    broadMatchesDescr = parseFloat(((descrMatchesCount / keywords.length) * scale.broadMatchesDescr).toFixed(2));

    var boldFactor = parseFloat((item.descriptionBold.length / keywords.length).toFixed(2));
    if (boldFactor > 1) boldFactor = 1;
    let boldPoints = parseFloat((boldFactor * scale.hasBolded).toFixed(2));

    if (item.descriptionOptimized) boldPoints = 30;
    let sum = exactMatchesTitle + exactMatchesDescr + exactMatchesURL + broadMatchesTitle + broadMatchesDescr + broadMatchesURL + boldPoints;

    return {
      sum: parseFloat(sum.toFixed(2)),
      exactMatchesTitle: exactMatchesTitle,
      exactMatchesDescr: exactMatchesDescr,
      exactMatchesURL: exactMatchesURL,
      broadMatchesTitle: broadMatchesTitle,
      broadMatchesDescr: broadMatchesDescr,
      broadMatchesURL: broadMatchesURL,
      boldPoints: boldPoints
    };
  };


  const permutator = (inputArr) => {
    let result = [];

    const permute = (arr, m = []) => {
      if (arr.length === 0) {
        result.push(m);
      } else {
        for (let i = 0; i < arr.length; i++) {
          let curr = arr.slice();
          let next = curr.splice(i, 1);
          permute(curr.slice(), m.concat(next));
       }
     }
   };
   permute(inputArr);
   return result;
  };


  const SimilarKeywords = (function(){
    // Normalize keyword: remove spaces and convert to lowercase
    function normalizeKeyword(keyword) {
      return keyword.replace(/\s+/g, '').toLowerCase();
    }

    // Levenshtein distance to calculate similarity between two strings
    function levenshtein(a, b) {
      const matrix = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
            );
          }
        }
      }
      return matrix[b.length][a.length];
    }

    // Function to filter out similar keywords and append the skipped ones at the end
    function filterSimilarKeywords(keywords, threshold = 3) {
      const uniqueKeywords = [];
      const skippedKeywords = [];
      const normalizedKeywords = new Set();

      keywords.forEach(keyword => {
        const normalized = normalizeKeyword(keyword);
        let isSimilar = false;

        // Check similarity against already added keywords
        for (let existingKeyword of normalizedKeywords) {
          if (levenshtein(existingKeyword, normalized) <= threshold) {
            isSimilar = true;
            break;
          }
        }
        if (!isSimilar) {
          uniqueKeywords.push(keyword);
          normalizedKeywords.add(normalized);
        } else {
          skippedKeywords.push(keyword);
        }
      });
      return [...uniqueKeywords, ...skippedKeywords];
    }


    function getList(list) {
      return filterSimilarKeywords(list);
    }

    return {
      getList: getList
    }

  })();



  return {
    init: init,
    getSource: getSource
  };

})();


