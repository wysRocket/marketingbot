/* global chrome */
(function(){
  var dataCache = null;
  var domainMetrics = {};

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stripTranslateGoog(hostname) {
    if (!hostname || !hostname.endsWith('.translate.goog')) return hostname;
    return hostname.replace('.translate.goog', '').replace(/--/g, '.');
  }

  function extractDomain(url) {
    try {
      var urlObj = new URL(url);
      return stripTranslateGoog(urlObj.hostname.replace('www.', ''));
    } catch (e) {
      return '';
    }
  }

  function normalizeUrlSimple(url) {
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
  }

  function hasExactMatch(str, substr){
    var index = str.indexOf(substr);
    if (index === -1) return false;
    if (index > 0 && str[index - 1].match(/\w/)) return false;
    var nextChar = index + substr.length;
    if (str[nextChar] && str[nextChar].match(/\w/)) return false;
    return true;
  }

  function preprocessWords(text, params){
    text = (text || '').toLowerCase();
    var stopwords = 'a am an and any are as at be by can did do does for from had has have how i if in is it its may me might mine must my mine must my nor not of oh ok when who whom why will with yes yet you your'.split(' ');
    stopwords.map(function(word){
      var re = new RegExp('\\b' + word + '\\b');
      text = text.replace(re, '');
    });
    var keywords = text.match(/[\w-']+/g);
    if (!keywords) keywords = text.split(/\s+/);
    if (!keywords) return '';
    keywords = keywords.map(function(kw){
      kw = kw.replace(/^'/, '');
      kw = kw.replace(/'$/, '');
      return kw;
    });
    if (params && params.split) return keywords;
    return keywords.join(' ');
  }

  function permutator(inputArr) {
    var result = [];
    var permute = function(arr, m){
      if (arr.length === 0) {
        result.push(m);
      } else {
        for (var i = 0; i < arr.length; i++) {
          var curr = arr.slice();
          var next = curr.splice(i, 1);
          permute(curr.slice(), (m || []).concat(next));
        }
      }
    };
    permute(inputArr);
    return result;
  }

  function calcOnPagePoints(query, item, scale) {
    var title = item.title || '';
    var description = item.description || '';
    var queryNoSpaces = (query || '').replace(/\W/g, '');
    var url = (item.url || '').replace(/https?:\/\//, '').replace(/[-_.]+/g, ' ');
    var exactMatchesTitle = 0, exactMatchesDescr = 0, broadMatchesTitle = 0, broadMatchesDescr = 0, exactMatchesURL = 0, broadMatchesURL = 0;
    var urlP = preprocessWords(url, {pluralize: true});
    query = preprocessWords(query, {});
    var queryP = preprocessWords(query, {pluralize: true});
    queryNoSpaces = preprocessWords(queryNoSpaces, {pluralize: true});
    var titleP = preprocessWords(title, {pluralize: true});
    var descriptionP = preprocessWords(description, {pluralize: true});
    if (hasExactMatch(titleP, queryP)) exactMatchesTitle = scale.exactMatchesTitle;
    if (hasExactMatch(urlP, queryP)) exactMatchesURL = scale.exactMatchesURL;
    if (hasExactMatch(urlP, queryNoSpaces)) exactMatchesURL = scale.exactMatchesURL;
    if (hasExactMatch(descriptionP, queryP)) exactMatchesDescr = scale.exactMatchesDescr;
    var keywords = query.split(/\s+/);
    var keywordsP = queryP.split(/\s+/);
    var arrTitle = titleP.split(/\s+/);
    var arrDescr = descriptionP.split(/\s+/);
    var arrURL = urlP.split(/\s+/);
    var titleMatchesCount = 0;
    var urlMatchesCount = 0;
    var descrMatchesCount = 0;
    var permArr = [];
    if (keywords.length <= 3) {
      permArr = permutator(keywords);
    }
    permArr.map(function(arr){
      var joined = arr.join('');
      if (url.indexOf(joined) !== -1) broadMatchesURL = scale.broadMatchesURL;
    });
    keywordsP.map(function(keyword){
      if (arrTitle.indexOf(keyword) !== -1) titleMatchesCount++;
      if (arrURL.indexOf(keyword) !== -1) urlMatchesCount++;
      if (arrDescr.indexOf(keyword) !== -1) descrMatchesCount++;
    });
    if (titleMatchesCount >= keywordsP.length / 2) broadMatchesTitle = scale.broadMatchesTitle;
    if (urlMatchesCount >= keywordsP.length / 2) broadMatchesURL = scale.broadMatchesURL;
    if (descrMatchesCount >= keywordsP.length / 2) broadMatchesDescr = scale.broadMatchesDescr;
    var sum = exactMatchesTitle + exactMatchesDescr + exactMatchesURL + broadMatchesTitle + broadMatchesDescr + broadMatchesURL;
    if (sum > 100) sum = 100;
    return { sum: sum };
  }

  function renderContext(query) {
    var container = document.getElementById('xt-aio-context');
    if (!container) return;
    container.innerHTML = '<div class="xt-ke-title-sm">Query</div><div class="xt-aio-query-display" style="margin-top:6px;">' + escapeHtml(query || '-') + '</div>';
  }

  function truncateUrl(url, maxLen) {
    if (!url || url.length <= maxLen) return url;
    return url.substring(0, maxLen) + '\u2026';
  }

  function renderEntities(entities) {
    var container = document.getElementById('xt-aio-entities');
    if (!container) return;
    if (!entities || !entities.length) {
      container.innerHTML = '<div class="xt-ke-card"><div class="xt-ke-title-sm">Entities</div><div class="xt-aio-muted" style="margin-top:6px;">No entities detected.</div></div>';
      return;
    }
    var unique = {};
    var html = '<div class="xt-ke-card"><div class="xt-ke-title-sm">Entities</div><div class="xt-aio-entities">';
    entities.forEach(function(ent){
      var text = (ent.text || '').trim();
      if (!text || unique[text.toLowerCase()]) return;
      unique[text.toLowerCase()] = true;
      var href = ent.href || '';
      if (href) {
        html += '<a class="xt-aio-entity" href="' + escapeHtml(href) + '" target="_blank">' + escapeHtml(text) + '</a>';
      } else {
        html += '<span class="xt-aio-entity">' + escapeHtml(text) + '</span>';
      }
    });
    html += '</div></div>';
    container.innerHTML = html;
  }

  function buildTableRows(data, metricsMap) {
    var magiMap = new Map();
    (data.magiUrls || []).forEach(function(item){
      if (!item || !item.url) return;
      var norm = normalizeUrlSimple(item.url);
      if (!norm) return;
      if (!magiMap.has(norm)) magiMap.set(norm, item);
    });
    var poolMap = new Map();
    var citationOrderMap = new Map();
    (data.citations || []).forEach(function(item, idx){
      if (!item || !item.url) return;
      var norm = normalizeUrlSimple(item.url);
      if (!norm) return;
      if (!poolMap.has(norm)) {
        poolMap.set(norm, item);
        citationOrderMap.set(norm, idx + 1);
      }
    });
    var sidebarRankMap = new Map();
    (data.sidebarCards || []).forEach(function(card, idx){
      if (!card || !card.url) return;
      var norm = normalizeUrlSimple(card.url);
      if (!norm) return;
      if (!sidebarRankMap.has(norm)) sidebarRankMap.set(norm, idx + 1);
    });
    var organicRankMap = new Map();
    (data.organicUrls || []).forEach(function(entry){
      var url = (typeof entry === 'string') ? entry : (entry && entry.url ? entry.url : '');
      if (!url) return;
      var norm = normalizeUrlSimple(url);
      if (!norm) return;
      var rank = (entry && entry.position) ? parseInt(entry.position, 10) || 0 : 0;
      if (!organicRankMap.has(norm)) organicRankMap.set(norm, rank);
    });
    var inTextSet = new Set();
    (data.externalLinks || []).forEach(function(entry){
      var url = entry && entry.href ? entry.href : '';
      if (!url) return;
      var norm = normalizeUrlSimple(url);
      if (norm) inTextSet.add(norm);
    });

    var allNorms = new Set();
    magiMap.forEach(function(_, k){ allNorms.add(k); });
    poolMap.forEach(function(_, k){ allNorms.add(k); });

    var rows = [];
    allNorms.forEach(function(norm){
      var magi = magiMap.get(norm) || null;
      var pool = poolMap.get(norm) || null;
      var url = (pool && pool.url) ? pool.url : (magi ? magi.url : norm);
      var domain = (pool && pool.sourceDomain) ? pool.sourceDomain : extractDomain(url);
      var metrics = metricsMap[domain] || {};
      var pageRank = (typeof metrics.page_rank === 'number') ? metrics.page_rank : null;
      var mozDA = (typeof metrics.moz_domain_authority === 'number') ? metrics.moz_domain_authority : null;
      var offpage = (mozDA !== null && pageRank !== null)
        ? Math.round(mozDA * 0.75 + (pageRank * 10) * 0.25)
        : null;
      var onpage = calcOnPagePoints(data.query || '', {
        title: (pool && pool.title) ? pool.title : (magi ? (magi.title || '') : ''),
        description: (pool && pool.snippet) ? pool.snippet : '',
        url: url
      }, {
        exactMatchesTitle: 15,
        exactMatchesURL: 5,
        exactMatchesDescr: 5,
        broadMatchesTitle: 25,
        broadMatchesURL: 10,
        broadMatchesDescr: 10,
        hasBolded: 30
      });
      rows.push({
        url: url,
        domain: domain,
        sourceLabel: (magi && magi.sourceLabel) ? magi.sourceLabel : '',
        // Grounded = in MAGI grounding set (matches original viewer)
        inMagi: !!magi,
        poolRank: pool ? (parseInt(pool.position, 10) || citationOrderMap.get(norm) || 0) : 0,
        displayedRank: sidebarRankMap.get(norm) || 0,
        organicRank: organicRankMap.get(norm) || 0,
        inText: inTextSet.has(norm),
        mozDA: mozDA,
        opr: pageRank,
        offpage: offpage,
        onpage: onpage.sum
      });
    });

    rows.sort(function(a, b){
      var da = a.displayedRank || 9999;
      var db = b.displayedRank || 9999;
      if (da !== db) return da - db;
      return (a.poolRank || 9999) - (b.poolRank || 9999);
    });
    return rows;
  }

  function renderTable(data) {
    var container = document.getElementById('xt-aio-result');
    if (!container) return;
    var rows = buildTableRows(data, domainMetrics);
    if (!rows.length) {
      container.innerHTML = '<div class="xt-aio-muted" style="margin-top:6px;">No AI Overview data found.</div>';
      return;
    }
    var urlMaxLen = 80;
    var html = '';
    html += '<table class="xt-aio-table table diff-table"><thead><tr>' +
      '<th class="xt-aio-th">#</th>' +
      '<th class="xt-aio-th xt-aio-left">Website</th>' +
      '<th class="xt-aio-th xt-aio-left">URL</th>' +
      '<th class="xt-aio-th">Grounded</th>' +
      '<th class="xt-aio-th">Pool Rank</th>' +
      '<th class="xt-aio-th">Displayed Rank</th>' +
      '<th class="xt-aio-th">Organic Rank</th>' +
      '<th class="xt-aio-th">Shown In Text</th>' +
      '<th class="xt-aio-th right first">Moz Domain Authority</th>' +
      '<th class="xt-aio-th right">Open Page Rank</th>' +
      '<th class="xt-aio-th right">Backlink Score</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(row, idx){
      var urlDisplay = truncateUrl(row.url, urlMaxLen);
      html += '<tr>' +
        '<td class="xt-aio-td">' + (idx + 1) + '</td>' +
        '<td class="xt-aio-td xt-aio-left">' + escapeHtml(row.domain || '-') + '</td>' +
        '<td class="xt-aio-td xt-aio-left"><a href="' + escapeHtml(row.url) + '" target="_blank" class="td-url">' + escapeHtml(urlDisplay) + '</a></td>' +
        '<td class="xt-aio-td">' + (row.inMagi ? 'Yes' : '-') + '</td>' +
        '<td class="xt-aio-td">' + (row.poolRank > 0 ? row.poolRank : '-') + '</td>' +
        '<td class="xt-aio-td">' + (row.displayedRank > 0 ? row.displayedRank : '-') + '</td>' +
        '<td class="xt-aio-td">' + (row.organicRank > 0 ? row.organicRank : '-') + '</td>' +
        '<td class="xt-aio-td">' + (row.inText ? 'Yes' : '-') + '</td>' +
        '<td class="xt-aio-td right first">' + (row.mozDA !== null ? row.mozDA + '/100' : '-') + '</td>' +
        '<td class="xt-aio-td right">' + (row.opr !== null ? row.opr.toFixed(2) + '/10' : '-') + '</td>' +
        '<td class="xt-aio-td right">' + (row.offpage !== null ? Math.round(row.offpage) + '/100' : '-') + '</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  function copyTableToClipboard() {
    var table = document.querySelector('.xt-aio-table');
    if (!table) return;
    var rows = table.querySelectorAll('tr');
    var lines = [];
    rows.forEach(function(row){
      var cells = row.querySelectorAll('th, td');
      var line = [];
      cells.forEach(function(cell){
        line.push(cell.textContent.trim());
      });
      lines.push(line.join('\t'));
    });
    navigator.clipboard.writeText(lines.join('\n'));
  }

  function exportTableToCSV() {
    var table = document.querySelector('.xt-aio-table');
    if (!table) return;
    var rows = table.querySelectorAll('tr');
    var lines = [];
    rows.forEach(function(row){
      var cells = row.querySelectorAll('th, td');
      var line = [];
      cells.forEach(function(cell){
        var text = cell.textContent.trim().replace(/"/g, '""');
        line.push('"' + text + '"');
      });
      lines.push(line.join(','));
    });
    var csv = lines.join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'aio-overview.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadDomainMetrics(domains, cb) {
    chrome.storage.local.get(['settings'], function(obj){
      var country = obj && obj.settings && obj.settings.country ? obj.settings.country : 'us';
      chrome.runtime.sendMessage({
        cmd: 'api.getDomainLinkMetrics',
        data: { domains: domains, country: country }
      }, function(resp){
        var map = {};
        if (resp && !resp.error && Array.isArray(resp.data)) {
          resp.data.forEach(function(entry){
            if (entry && entry.domain && entry.data) {
              map[entry.domain] = entry.data;
            }
          });
        }
        cb(map);
      });
    });
  }

  function init() {
    document.getElementById('xt-aio-copy').addEventListener('click', copyTableToClipboard);
    document.getElementById('xt-aio-export').addEventListener('click', exportTableToCSV);
    chrome.runtime.sendMessage({ cmd: 'google.getAIOData' }, function(data){
      if (!data || !data.query) {
        document.getElementById('xt-aio-context').innerHTML = '<div class="xt-ke-title-sm">Query</div><div class="xt-aio-muted" style="margin-top:6px;">No data captured. Open a Google result with AI Overview and click "Analyze AI Overview".</div>';
        return;
      }
      dataCache = data;
      renderContext(data.query);
      renderEntities(data.entities || []);
      var domains = [];
      var domainSet = {};
      function addDomain(domain) {
        if (domain && !domainSet[domain]) {
          domainSet[domain] = true;
          domains.push(domain);
        }
      }
      (data.citations || []).forEach(function(item){
        addDomain(item.sourceDomain || extractDomain(item.url || ''));
      });
      (data.magiUrls || []).forEach(function(item){
        if (item && item.url) addDomain(item.sourceDomain || extractDomain(item.url));
      });
      if (!domains.length) {
        renderTable(data);
        return;
      }
      loadDomainMetrics(domains, function(metrics){
        domainMetrics = metrics || {};
        renderTable(data);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
