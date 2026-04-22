var Tool = (function(){

  var source = 'gwmtoo';

  var observerTarget = '#query,[jsrenderer=Mtipq]';
  var tableSelector = '#query table,[jsrenderer=Mtipq] table:visible';
  var observer = null;

  var xtTableData = [];
  var wordSummary = {};


  var processTableTimer = null;


  // === Treemap config constants ===
  // Maximum number of blocks to show in the treemap
  const TREEMAP_MAX_BLOCKS = 80;
  // Exponent for block size ratio (lower = less aggressive, e.g. 0.5-1)
  const TREEMAP_SIZE_EXPONENT = 0.4;
  // Font sizes for treemap labels
  const TREEMAP_LABEL_FONT_SIZE = 14;
  const TREEMAP_VALUE_FONT_SIZE = 10;
  const STOPWORDS = ["i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const STOPWORDS_SET = new Set(STOPWORDS);


  var init = function(){
    initPage();
  };


  var initPage = function(){
    checkTarget();
    var timer = setInterval(function(){
      var found = checkTarget();
      if (found) clearInterval(timer);
    }, 500);
    initMutationObserver(document.body);
  };


  var checkTarget = function(){
    var $target = $( observerTarget );
    if (!$target.length) return;
    processTable( $(tableSelector).last()[0] );
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


  var processChildList = function(children){
    for (var i = 0, len = children.length; i < len; i++) {
      var node = children[i];
      if (node.nodeName === 'C-WIZ') {
        processTable($(tableSelector).last()[0]);
      }
      else if (node.children && node.children[0] && node.children[0].nodeName === 'C-WIZ') {
        processTable($(tableSelector).last()[0]);
      }
    }
  };


  var processTable = function(table) {
    if (!table) return;
    const rootBlocks = Array.from(document.querySelectorAll('c-wiz[jsrenderer="Mtipq"]'));
    const visibleBlock = rootBlocks.find(el => el.offsetParent !== null);
    const queryTabSelected = isQueryTabSelected();
    if (!queryTabSelected) {
      injectSummaryButton(visibleBlock);
      return;
    }
    // const queryTabSelected = Array.from(visibleBlock.querySelectorAll('[jscontroller="ragstd"][role="tab"][aria-selected="true"]')).find(tab =>
    //   tab.innerText.trim().toLowerCase() === 'queries'
    // );
    // if (!queryTabSelected) {
    //   injectSummaryButton(visibleBlock);
    //   return;
    // }
    $('body').addClass('xt-' + source);
    if (processTableTimer) clearTimeout(processTableTimer);

    const $rows = $(table).find('tbody tr');
    if (!$rows.length) return;

    const keywords = {};
    const wordStats = {};
    xtTableData = [];

    $rows.each(function() {
      const $row = $(this);
      const $firstTd = $row.find('td').eq(0);
      let text = ($firstTd.find('content span[title], .zRhise span[title]').attr('title')
               || $firstTd.data('string-value')
               || $firstTd.find('.PkjLuf').text()
               || '').toString();

      text = text.trim();
      if (!text) return;

      // Get metrics
      const impressions = parseInt($row.find('td[data-label="IMPRESSIONS"]').data('numeric-value')) || 0;
      const clicks = parseInt($row.find('td[data-label="CLICKS"]').data('numeric-value')) || 0;
      const ctr = parseFloat($row.find('td[data-label="CTR"]').data('numeric-value')) || 0;
      const position = parseFloat($row.find('td[data-label="POSITION"]').data('numeric-value')) || 0;

      // Add to xtTableData
      const words = text
        .toLowerCase()
        .replace(/[^ -\w\s]/g, '') // remove punctuation (optional)
        .split(/\s+/)
        .filter(word => word.length > 1 && !STOPWORDS_SET.has(word));
      const uniqueWords = new Set(words);
      xtTableData.push({
        q: text,
        clicks,
        impressions,
        ctr,
        position,
        _filteredUniqueWords: uniqueWords
      });

      uniqueWords.forEach(word => {
        if (!wordStats[word]) {
          wordStats[word] = {
            impressions: 0,
            clicks: 0,
            ctrSum: 0,
            positionSum: 0,
            count: 0 // add count property
          };
        }
        wordStats[word].impressions += impressions;
        wordStats[word].clicks += clicks;
        wordStats[word].ctrSum += impressions * ctr;
        wordStats[word].positionSum += impressions * position;
        wordStats[word].count += 1; // increment count for each unique word occurrence per query
      });

      if (!$firstTd.data('fetch') && !$firstTd.is(':hidden')) {
        $firstTd.data('fetch', true);
        const keyword = Common.cleanKeyword(text);
        if (!keywords[keyword]) keywords[keyword] = [];
        keywords[keyword].push($firstTd[0]);
      }
    });

    wordSummary = {};
    for (const [word, stats] of Object.entries(wordStats)) {
      const { impressions, clicks, ctrSum, positionSum } = stats;
      wordSummary[word] = {
        impressions,
        clicks,
        ctr: impressions ? +(ctrSum / impressions).toFixed(2) : 0,
        position: impressions ? +(positionSum / impressions).toFixed(2) : 0,
        count: stats.count || 0
      };
    }

    // console.log('Word stats (impressions, clicks, avg CTR %, avg position):', wordSummary);

    injectSummaryButton(visibleBlock);

    var plan = Common.getPlan();
    var config = Common.getConfig();
    var hasCredits = Common.getCredits() > 0 || (config.areSubsEnabled && plan.credits > 0);
    if (!hasCredits) return;

    addColumns(table);
    if (Object.keys(keywords).length !== 0) {
      processKeywords(keywords, table);
    }

    processTableTimer = setTimeout(() => processTable(table), 5000);
  };


  function injectChartContainersInPage(container) {
    if (container.querySelector('#xt-chart-wrapper')) return;

    const main = Array.from(container.querySelectorAll('div[role="main"]')).find(
      el => el.offsetParent !== null
    );
    if (!main) {
      console.warn('No main container found');
      return;
    }

    const firstSection = Array.from(main.children).find(el => el.tagName === 'DIV');
    if (!firstSection) {
      console.warn('No child DIV found inside [role=main]');
      return;
    }


    const newSection = document.createElement('div');
    newSection.className = firstSection.className;
    newSection.id = 'xt-chart-wrapper';

    if (firstSection.nextSibling) {
      main.insertBefore(newSection, firstSection.nextSibling);
    } else {
      main.appendChild(newSection);
    }

    newSection.innerHTML = `
      <div style="padding:16px; background:#fff; border:1px solid #ccc;">
        <h3 style="margin-top:0;display:flex;align-items:center;font-size:18px;font-weight:600;gap:8px;">
          <img src="${chrome.runtime.getURL('/img/icon24.png')}" style="height:22px;width:22px;vertical-align:middle;"> Keyword Analytics
        </h3>
        <div id="xt-treemap-wrapper">
          <canvas id="chart-treemap" width="600" height="200" style="margin-bottom:20px;"></canvas>
        </div>
        <div id="xt-bar-charts" style="display:flex;gap:20px;flex-wrap:nowrap;justify-content:space-between;">
          <div style="width: 300px;"><canvas id="chart-position" width="300" height="200"></canvas></div>
          <div style="width: 300px;"><canvas id="chart-ctr" width="300" height="200"></canvas></div>
          <div style="width: 300px;"><canvas id="chart-impressions" width="300" height="200"></canvas></div>
        </div>
        <div id="xt-hierarchical-table" style="margin-top:32px;"></div>
      </div>
    `;
  }


  var isQueryTabSelected = function(){
    const rootBlocks = Array.from(document.querySelectorAll('c-wiz[jsrenderer="Mtipq"]'));
    const visibleBlock = rootBlocks.find(el => el.offsetParent !== null);
    const firstTab = Array.from(visibleBlock.querySelectorAll('[jscontroller="ragstd"][role="tab"]'))[0];
    const firstSelectedTab = Array.from(visibleBlock.querySelectorAll('[jscontroller="ragstd"][role="tab"][aria-selected="true"]'))[0];
    return firstSelectedTab === firstTab;
  };


  function injectSummaryButton(container) {
    const existing = container.querySelector('#xt-show-charts-btn');
    if (existing) return;

    // Step 1: find element with "Last update:"
    const candidates = Array.from(container.querySelectorAll('div'));
    let target = candidates.find(el =>
      el.textContent.trim().toLowerCase().startsWith('last update')
    );

    if (!target) {
      target = container.querySelector('.oAMBf');
    }
    if (!target) {
      console.warn('injectSummaryButton: Could not find "Last update" element');
      return;
    }

    // Step 2: create the button
    const btn = document.createElement('button');
    btn.id = 'xt-show-charts-btn';
    btn.className = 'xt-show-summary-btn';
    btn.innerHTML = `<img src="${chrome.runtime.getURL('/img/icon16.png')}"> Visualize`;

    // Step 3: inject it before the target
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';

    target.parentNode.insertBefore(wrapper, target);
    wrapper.appendChild(btn);
    wrapper.appendChild(target);

    // Step 4: handle click
    btn.addEventListener('click', () => {
      // Check if Queries tab is selected
      // const queryTabSelected = Array.from(container.querySelectorAll('[jscontroller="ragstd"][role="tab"][aria-selected="true"]')).find(tab =>
      //   tab.innerText.trim().toLowerCase() === 'queries'
      // );
      const queryTabSelected = isQueryTabSelected();
      if (!queryTabSelected) {
        // Show error message (simple alert, or you can replace with a styled div if you prefer)
        alert('Please select the Queries tab to use the Visualize feature.');
        return;
      }
      injectChartContainersInPage(container);
      const chartWrapper = container.querySelector('#xt-chart-wrapper');
      renderKeywordCharts(wordSummary, chartWrapper);
      const hierDiv = chartWrapper.querySelector('#xt-hierarchical-table');
      if (hierDiv && xtTableData && xtTableData.length) {
        hierDiv.innerHTML = '';
        injectHierarchicalSmartTables(hierDiv, xtTableData);
      }
    });
  }



  let xtCharts = {};

  function renderKeywordCharts(wordSummary, container) {
    // --- Treemap metric state ---
    if (!container._xtTreemapMetric) container._xtTreemapMetric = 'clicks';
    let treemapMetric = container._xtTreemapMetric;

    // --- Treemap toggle UI ---
    const treemapWrapper = container.querySelector('#xt-treemap-wrapper');
    let treemapToggle = treemapWrapper.querySelector('#xt-treemap-toggle');
    if (!treemapToggle) {
      treemapToggle = document.createElement('div');
      treemapToggle.id = 'xt-treemap-toggle';
      treemapToggle.style.display = 'flex';
      treemapToggle.style.gap = '8px';
      treemapToggle.style.marginBottom = '8px';
      treemapToggle.style.alignItems = 'center';
      treemapToggle.style.marginTop = '8px';
      const btnClicks = document.createElement('button');
      btnClicks.textContent = 'Clicks';
      btnClicks.className = 'xt-ke-btn';
      const btnImpr = document.createElement('button');
      btnImpr.textContent = 'Impressions';
      btnImpr.className = 'xt-ke-btn';
      const btnCount = document.createElement('button');
      btnCount.textContent = 'Count';
      btnCount.className = 'xt-ke-btn';
      treemapToggle.appendChild(btnClicks);
      treemapToggle.appendChild(btnImpr);
      treemapToggle.appendChild(btnCount);
      // Insert treemap toggle before the treemap chart, or append if not found
      const chartTreemap = treemapWrapper.querySelector('#chart-treemap');
      if (chartTreemap && chartTreemap.parentNode === treemapWrapper) {
        treemapWrapper.insertBefore(treemapToggle, chartTreemap);
      } else {
        treemapWrapper.appendChild(treemapToggle);
      }
      // Handlers
      function setTreemapMetric(metric) {
        container._xtTreemapMetric = metric;
        btnClicks.classList.toggle('selected', metric === 'clicks');
        btnImpr.classList.toggle('selected', metric === 'impressions');
        btnCount.classList.toggle('selected', metric === 'count');
        renderKeywordCharts(wordSummary, container);
      }
      btnClicks.onclick = () => { setTreemapMetric('clicks'); };
      btnImpr.onclick = () => { setTreemapMetric('impressions'); };
      btnCount.onclick = () => { setTreemapMetric('count'); };
      // Default
      setTreemapMetric('clicks');
      return;
    } else {
      // Set selected state
      const [btnClicks, btnImpr, btnCount] = treemapToggle.querySelectorAll('button');
      btnClicks.classList.toggle('selected', treemapMetric === 'clicks');
      btnImpr.classList.toggle('selected', treemapMetric === 'impressions');
      btnCount.classList.toggle('selected', treemapMetric === 'count');
    }

    // Clear previous Chart.js instances for each chart before creating new ones
    xtCharts = xtCharts || {};
    const getValues = (prop) => Object.values(wordSummary).map(w => w[prop]);

    const binData = (values, bins) => {
      const counts = new Array(bins.length - 1).fill(0);
      values.forEach(v => {
        for (let i = 0; i < bins.length - 1; i++) {
          if (v >= bins[i] && v < bins[i + 1]) {
            counts[i]++;
            break;
          }
        }
      });
      return counts;
    };

    const drawBarChartOnce = (id, labels, data, title) => {
      if (xtCharts[id]) {
        xtCharts[id].destroy();
      }
      xtCharts[id] = new Chart(container.querySelector(`#${id}`), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: title,
            data,
            backgroundColor: '#C0504F', // brand color
            barThickness: 20
          }]
        },
        options: {
          scales: {
            y: { type: 'logarithmic', beginAtZero: true },
            x: { ticks: { font: { size: 10 } } }
          },
          plugins: {
            title: { display: true, text: title },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Queries: ${ctx.parsed.y.toLocaleString()}`
              },
              backgroundColor: '#000',
              titleColor: '#fff',
              bodyColor: '#fff',
            }
          }
        }
      });
    };

    // Treemap
    if (xtCharts['chart-treemap']) {
      xtCharts['chart-treemap'].destroy();
    }
    // Sort and limit blocks
    let metricKey = treemapMetric;
    let treemapTitle = 'Keyword Treemap';
    if (metricKey === 'clicks') treemapTitle = 'Keyword Clicks Treemap';
    else if (metricKey === 'impressions') treemapTitle = 'Keyword Impressions Treemap';
    else if (metricKey === 'count') treemapTitle = 'Keyword Count Treemap';
    let sortedEntries;
    if (metricKey === 'count') {
      sortedEntries = Object.entries(wordSummary)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, TREEMAP_MAX_BLOCKS);
    } else {
      sortedEntries = Object.entries(wordSummary)
        .sort((a, b) => b[1][metricKey] - a[1][metricKey])
        .slice(0, TREEMAP_MAX_BLOCKS);
    }
    const treeData = sortedEntries.map(([word, val]) => ({
      label: word,
      value: Math.pow((metricKey === 'count' ? (val.count || 0) : val[metricKey]), TREEMAP_SIZE_EXPONENT),
      clicks: val.clicks,
      impressions: val.impressions,
      count: val.count || 0
    }));
    xtCharts['chart-treemap'] = new Chart(container.querySelector('#chart-treemap'), {
      type: 'treemap',
      data: {
        datasets: [{
          tree: treeData,
          labels: {
            display: true,
            formatter: (ctx) => {
              const { raw } = ctx;
              let originalValue = 0;
              if (raw._data && raw._data.children && raw._data.children[0]) {
                if (metricKey === 'clicks') originalValue = raw._data.children[0].clicks || 0;
                else if (metricKey === 'impressions') originalValue = raw._data.children[0].impressions || 0;
                else if (metricKey === 'count') originalValue = raw._data.children[0].count || 0;
              }
              const formatted = (typeof originalValue === 'number' && !isNaN(originalValue))
                ? originalValue.toLocaleString()
                : '';
              return [raw.g, formatted];
            },
            color: ['#fff', '#fff'],
            font: [
              { size: TREEMAP_LABEL_FONT_SIZE, weight: 'normal' }, // word
              { size: TREEMAP_VALUE_FONT_SIZE, weight: 'normal' } // number
            ]
          },
          key: 'value',
          groups: ['label'],
          backgroundColor: (ctx) => {
            return '#C0504F';
          },
          borderColor: '#fff',
          borderWidth: 1,
          hoverBackgroundColor: '#a03e3d',
        }]
      },
      options: {
        plugins: {
          title: { display: true, text: treemapTitle },
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (ctx) => '',
              label: (ctx) => {
                const raw = ctx.raw;
                let originalValue = 0;
                if (raw._data && raw._data.children && raw._data.children[0]) {
                  if (metricKey === 'clicks') originalValue = raw._data.children[0].clicks || 0;
                  else if (metricKey === 'impressions') originalValue = raw._data.children[0].impressions || 0;
                  else if (metricKey === 'count') originalValue = raw._data.children[0].count || 0;
                }
                return `${raw.g}: ${originalValue.toLocaleString()}`;
              }
            },
            backgroundColor: '#222',
            titleColor: '#fff',
            bodyColor: '#fff',
          }
        }
      }
    });

    // Bar charts (unchanged)
    drawBarChartOnce(
      'chart-position',
      ['1–3', '4–10', '11–20', '21–50', '51+'],
      binData(getValues('position'), [0, 3, 10, 20, 50, 100]),
      'Position'
    );
    drawBarChartOnce(
      'chart-ctr',
      ['0–1%', '1–3%', '3–5%', '5–10%', '10%+'],
      binData(getValues('ctr'), [0, 1, 3, 5, 10, 100]),
      'CTR (%)'
    );
    drawBarChartOnce(
      'chart-impressions',
      ['0–10', '10–100', '100–1K', '1K–10K', '10K–100K', '100K+'],
      binData(getValues('impressions'), [0, 10, 100, 1000, 10000, 100000, 1000000]),
      'Impressions'
    );
  }


  var addColumns = function( table ){
    if ($(table).find('.xt-col')[0]) return;
    var country = Common.getCountry();
    if (country) country = ' (' + country + ')';
    var $table = $(table);
    var metricsList = Starter.getSettings().metricsList;
    var metricsNumber = Common.getMetricsNumber();
    var $target = $table.find('thead th:nth-child(1)');
    if (metricsList.trend) {
      $target.after('<th class="xt-col XgRaPc sbEvHd">Trend' + country + '</td>');
    }
    if (metricsList.comp) {
      $target.after('<th class="xt-col XgRaPc sbEvHd">Comp' + country + '</td>');
    }
    if (metricsList.cpc) {
      $target.after('<th class="xt-col XgRaPc sbEvHd">CPC' + country + '</td>');
    }
    if (metricsList.vol) {
      $target.after('<th class="xt-col XgRaPc sbEvHd">Vol' + country + '</td>');
    }
    for (var i = 0; i < metricsNumber; i++) {
      $table.find('tbody td:nth-child(1)')
        .after('<td class="xt-gwmtoo-cell sbEvHd"></td>');
    }
  };


  var processKeywords = function( keywords, table ){
    Common.processKeywords({
        keywords: Object.keys( keywords ),
        tableNode: table,
        src: source
      },
      function(json){
        processJSON( json, keywords );
      }
    );
  };


  var processJSON = function( json, keywords ){
    var data = json.data;
    var metricsList = Starter.getSettings().metricsList;
    for (var key in data) {
      var item = data[key];
      var tds = keywords[ item.keyword ];
      for (var i = 0, len = tds.length; i < len; i++) {
        var td = tds[i];
        var $td = $(td);
        if ($td.find('.xt-star')[0]) continue;
        Common.appendStar($td, item);
        Common.appendKeg($td, json, item);
        var color = Common.highlight(item);
        var $target = $td.next();
        if (metricsList.vol) {
          $target.text(item.vol).toggleClass('xt-highlight', color).css('background', color);
          $target = $target.next();
        }
        if (metricsList.cpc) {
          $target.text(item.cpc).toggleClass('xt-highlight', color).css('background', color);
          $target = $target.next();
        }
        if (metricsList.comp) {
          $target.text(item.competition).toggleClass('xt-highlight', color).css('background', color);
          $target = $target.next();
        }
        if (metricsList.trend) {
          $target.html(Common.getTrendImgHTML(item.trend, false)).toggleClass('xt-highlight', color).css('background', color);
        }
      }
    }
  };


  var getSource = function(){
    return source;
  };


  function injectHierarchicalSmartTables(container, tableData) {
    // --- Helper functions ---
    function formatNumberWithCommas(number) {
      return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function getTopWords(queries, count) {
      const wordCounts = {};
      queries.forEach((query) => {
        const words = query.toLowerCase().split(/\s+/);
        words.forEach((word) => {
          if (!STOPWORDS_SET.has(word)) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
          }
        });
      });
      return Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map((entry) => entry[0]);
    }
    function filterQueriesByWord(queries, word) {
      return queries.filter((query) => query.toLowerCase().includes(word.toLowerCase()));
    }

    // --- UI containers ---
    container.innerHTML = '';
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'xt-hierarchical-tabs';

    // Create breakdown buttons
    const breakdownByClicksBtn = document.createElement('button');
    breakdownByClicksBtn.textContent = 'Breakdown by Clicks';
    breakdownByClicksBtn.className = 'xt-ke-btn';

    const breakdownByImpressionsBtn = document.createElement('button');
    breakdownByImpressionsBtn.textContent = 'Breakdown by Impressions';
    breakdownByImpressionsBtn.className = 'xt-ke-btn';

    const breakdownByCountBtn = document.createElement('button');
    breakdownByCountBtn.textContent = 'Breakdown by Count';
    breakdownByCountBtn.className = 'xt-ke-btn';

    tabsContainer.appendChild(breakdownByClicksBtn);
    tabsContainer.appendChild(breakdownByImpressionsBtn);
    tabsContainer.appendChild(breakdownByCountBtn);
    container.appendChild(tabsContainer);

    const mainFlex = document.createElement('div');
    mainFlex.className = 'xt-hierarchical-panel';
    container.appendChild(mainFlex);

    const leftPanel = document.createElement('div');
    leftPanel.className = 'xt-hierarchical-left';
    const rightPanel = document.createElement('div');
    rightPanel.className = 'xt-hierarchical-right';
    mainFlex.appendChild(leftPanel);
    mainFlex.appendChild(rightPanel);

    // --- State ---
    let currentTab = 'clicks'; // Default to Clicks
    let currentPath = [];

    // --- Data helpers ---
    function getAllQueries() {
      return tableData.map(row => row.q || "").filter(Boolean);
    }
    function getFilteredData(path) {
      let filtered = tableData;
      for (let i = 0; i < path.length; i++) {
        const word = path[i];
        filtered = filtered.filter(row => {
          const q = row.q || "";
          return q.toLowerCase().includes(word);
        });
      }
      return filtered;
    }
    function getTopWordsForPath(path, count) {
      const filtered = getFilteredData(path);
      const queries = filtered.map(row => row.q || "").filter(Boolean);
      return getTopWords(queries, count);
    }
    function getWordStatsForPath(path, word) {
      const filtered = getFilteredData(path);
      const queries = filtered.map(row => row.q || "").filter(Boolean);
      let value = 0;
      if (currentTab === 'impressions') {
        value = filtered.reduce((sum, row) => {
          if (row._filteredUniqueWords && row._filteredUniqueWords.has(word)) {
            return sum + (row.impressions || 0);
          }
          return sum;
        }, 0);
      } else if (currentTab === 'clicks') {
        value = filtered.reduce((sum, row) => {
          if (row._filteredUniqueWords && row._filteredUniqueWords.has(word)) {
            return sum + (row.clicks || 0);
          }
          return sum;
        }, 0);
      } else {
        value = queries.reduce((sum, q) => sum + (q.toLowerCase().split(/\s+/).filter(w => w === word).length), 0);
      }
      return value;
    }

    // --- Metrics cache ---
    const metricsCache = {};

    // --- Renderers ---
    function renderLeft(level, path, container) {
      if (!container) {
        leftPanel.innerHTML = '';
        container = leftPanel;
      }
      if (level >= 3) return;
      let words = getTopWordsForPath(path, TREEMAP_MAX_BLOCKS);
      // Only show words with value > 0 for the current metric
      words = words.filter(word => getWordStatsForPath(path, word) > 0);
      // Sort left table by currentTab
      words = words.sort((a, b) => getWordStatsForPath(path, b) - getWordStatsForPath(path, a));
      if (level > 0 && words.length > 0 && words[0] === path[level - 1]) {
        words = words.slice(1);
      }
      words.forEach(word => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'xt-hierarchical-row' + (currentPath[level] === word ? ' xt-hierarchical-selected' : '');
        rowDiv.innerHTML = `<span>${word}</span><span>${formatNumberWithCommas(getWordStatsForPath(path, word))}</span>`;
        rowDiv.onclick = (e) => {
          e.stopPropagation();
          if (currentPath[level] === word) {
            currentPath = currentPath.slice(0, level);
          } else {
            currentPath = currentPath.slice(0, level);
            currentPath[level] = word;
          }
          renderLeft(0, [], null);
          renderRight();
          renderCharts();
        };
        container.appendChild(rowDiv);
        if (currentPath[level] === word) {
          const childDiv = document.createElement('div');
          childDiv.className = 'xt-hierarchical-nested';
          renderLeft(level + 1, [...path, word], childDiv);
          container.appendChild(childDiv);
        }
      });
    }
    function renderRight() {
      rightPanel.innerHTML = '';
      const filtered = getFilteredData(currentPath);
      const metricsList = Starter.getSettings().metricsList;
      const metricsOrder = ['vol', 'cpc', 'comp', 'trend'];
      const metricsLabels = { vol: 'Vol', cpc: 'CPC', comp: 'Comp', trend: 'Trend' };
      const table = document.createElement('table');
      table.id = 'xt-hierarchical-right-table';
      table.style.width = '100%';
      table.style.fontSize = '13px';
      table.style.borderCollapse = 'collapse';
      const settings = Starter.getSettings();;
      const apiKey = settings.apiKey || '';
      const plan = Common.getPlan();
      const config = Common.getConfig();
      const hasCredits = Common.getCredits() > 0 || (config.areSubsEnabled && plan.credits > 0);
      if (filtered.length) {
        let headers = Object.keys(filtered[0]).filter(h => h !== '_filteredUniqueWords');
        // Header renaming and capitalization
        headers = headers.map(h => {
          if (h === 'q') return 'Queries';
          return h.charAt(0).toUpperCase() + h.slice(1);
        });
        // Insert metrics columns after the keyword column (first column)
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        headers.forEach((h, i) => {
          const th = document.createElement('th');
          th.textContent = h;
          th.style.padding = '6px';
          th.style.border = '1px solid #ccc';
          // Mark metrics columns as not sortable
          if (i === 1) {
            metricsOrder.forEach(metric => {
              if (metricsList[metric]) {
                const thMetric = document.createElement('th');
                thMetric.textContent = metricsLabels[metric];
                thMetric.style.padding = '6px';
                thMetric.style.border = '1px solid #ccc';
                thMetric.setAttribute('data-orderable', 'false');
                tr.appendChild(thMetric);
              }
            });
          }
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        filtered.forEach(row => {
          const tr = document.createElement('tr');
          let rowKeys = Object.keys(row).filter(h => h !== '_filteredUniqueWords');
          rowKeys = rowKeys.map(h => (h === 'q' ? 'Queries' : h.charAt(0).toUpperCase() + h.slice(1)));
          headers.forEach((h, i) => {
            // Map header back to original key for data
            let origKey = h === 'Queries' ? 'q' : h.toLowerCase();
            const td = document.createElement('td');
            let val = row[origKey];
            // Format Clicks and Impressions columns
            if ((h === 'Clicks' || h === 'Impressions') && typeof val === 'number') {
              td.textContent = val.toLocaleString();
            } else {
              td.textContent = val;
            }
            td.style.padding = '6px';
            td.style.border = '1px solid #ccc';
            if (i === 0) td.setAttribute('data-keyword', row[origKey]);
            tr.appendChild(td);
            if (i === 0) {
              metricsOrder.forEach(metric => {
                if (metricsList[metric]) {
                  const tdMetric = document.createElement('td');
                  tdMetric.className = 'xt-metric-cell xt-metric-' + metric;
                  tdMetric.style.padding = '6px';
                  tdMetric.style.border = '1px solid #ccc';
                  if (!hasCredits) {
                    // Shopping cart icon with link (inline SVG)
                    const a = document.createElement('a');
                    a.href = 'https://keywordseverywhere.com/ctl/subscriptions?apiKey=' + encodeURIComponent(apiKey);
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.title = 'Purchase a Keywords Everywhere subscription';
                    a.style.display = 'inline-block';
                    a.style.lineHeight = '0';
                    a.innerHTML = `
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                        <path d="M7 18c-1.104 0-2 .896-2 2s.896 2 2 2 2-.896 2-2-.896-2-2-2zm10 0c-1.104 0-2 .896-2 2s.896 2 2 2 2-.896 2-2-.896-2-2-2zM7.16 16l.94-2h7.45c.75 0 1.41-.41 1.75-1.03l3.24-5.88A1 1 0 0 0 20.5 6H5.21l-.94-2H1v2h2l3.6 7.59-1.35 2.44C4.52 16.37 5.48 18 7 18h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.09zM6.16 8h12.31l-2.76 5H8.53l-2.37-5z" fill="#C0504F"/>
                      </svg>
                    `;
                    tdMetric.appendChild(a);
                  } else {
                    tdMetric.textContent = '';
                  }
                  tr.appendChild(tdMetric);
                }
              });
            }
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
      }
      rightPanel.appendChild(table);
      // DataTables integration
      const $container = $(container);
      var $datatable = $container.find('#xt-hierarchical-right-table');
      if ($datatable.length) {
        if ($.fn.DataTable.isDataTable($datatable)) {
          $datatable.DataTable().destroy();
        }
        // Always sort by Clicks (descending)
        let defaultSortCol = 0;
        let defaultSortDir = 'desc';
        const headerCells = $(table).find('thead th');
        headerCells.each(function(idx) {
          if ($(this).text().toLowerCase() === 'clicks') defaultSortCol = idx;
        });
        let order = [[defaultSortCol, defaultSortDir]];
        // Make Vol, CPC, Comp, Trend columns not sortable, others default to desc first
        const columnDefs = [];
        headerCells.each(function(idx) {
          const txt = $(this).text().toLowerCase();
          if (["vol", "cpc", "comp", "trend"].includes(txt)) {
            columnDefs.push({ targets: idx, orderable: false });
          } else {
            columnDefs.push({ targets: idx, orderSequence: ["desc", "asc"] });
          }
        });
        const dt = $datatable.DataTable({
          pageLength: 20,
          lengthMenu: [[10, 20, 50, 100, 500], [10, 20, 50, 100, 500]],
          searching: true,
          ordering: true,
          info: true,
          autoWidth: false,
          order: order,
          columnDefs: columnDefs
        });
        function fetchAndUpdateMetrics() {
          const plan = Common.getPlan();
          const config = Common.getConfig();
          const hasCredits = Common.getCredits() > 0 || (config.areSubsEnabled && plan.credits > 0);
          if (!hasCredits) return;
          const visibleKeywords = [];
          $('#xt-hierarchical-right-table tbody tr').each(function() {
            const keyword = $(this).find('td[data-keyword]').text();
            if (keyword) visibleKeywords.push(keyword);
          });
          const toFetch = visibleKeywords.filter(k => !metricsCache[k]);
          if (toFetch.length === 0) {
            updateMetricsCells();
            return;
          }
          Common.processKeywords({
            keywords: toFetch,
            src: 'gwmtoo',
            tableNode: null
          }, function(json) {
            if (json && json.data) {
              for (const key in json.data) {
                const item = json.data[key];
                if (item && item.keyword) {
                  metricsCache[item.keyword] = item;
                }
              }
              updateMetricsCells();
            }
          });
        }
        function updateMetricsCells() {
          $('#xt-hierarchical-right-table tbody tr').each(function() {
            const $row = $(this);
            const keyword = $row.find('td[data-keyword]').text();
            const metrics = metricsCache[keyword];
            if (!metrics) return;
            let metricCellIdx = 1; // after keyword
            metricsOrder.forEach(metric => {
              if (metricsList[metric]) {
                const $cell = $row.find('td.xt-metric-' + metric);
                if (metric === 'trend') {
                  $cell.html(Common.getTrendImgHTML(metrics.trend, false));
                } else {
                  var metricKey = metric;
                  if (metric === 'comp') metricKey = 'competition';
                  $cell.text(metrics[metricKey] !== undefined ? metrics[metricKey] : '');
                }
                metricCellIdx++;
              }
            });
          });
        }
        // Initial fetch
        fetchAndUpdateMetrics();
        // On page/search change
        dt.on('draw', function() {
          fetchAndUpdateMetrics();
        });
      }
    }
    function renderCharts() {
      const filtered = getFilteredData(currentPath);
      const wordStats = {};
      filtered.forEach(row => {
        const text = (row.q || "").toLowerCase();
        const words = text.split(/\s+/).filter(w => w.length > 1);
        const filteredWords = words.filter(w => !STOPWORDS_SET.has(w));
        const uniqueWords = new Set(filteredWords);
        uniqueWords.forEach(word => {
          if (!wordStats[word]) {
            wordStats[word] = {
              impressions: 0,
              clicks: 0,
              ctrSum: 0,
              positionSum: 0,
              count: 0 // add count property
            };
          }
          wordStats[word].impressions += row.impressions || 0;
          wordStats[word].clicks += row.clicks || 0;
          wordStats[word].ctrSum += (row.impressions || 0) * (row.ctr || 0);
          wordStats[word].positionSum += (row.impressions || 0) * (row.position || 0);
          wordStats[word].count += 1; // increment count for each unique word occurrence per query
        });
      });
      const wordSummary = {};
      for (const [word, stats] of Object.entries(wordStats)) {
        const { impressions, clicks, ctrSum, positionSum } = stats;
        wordSummary[word] = {
          impressions,
          clicks,
          ctr: impressions ? +(ctrSum / impressions).toFixed(2) : 0,
          position: impressions ? +(positionSum / impressions).toFixed(2) : 0,
          count: stats.count || 0 // add count property
        };
      }
      const topChartDiv = container.querySelector('#xt-chart-wrapper');
      if (topChartDiv) {
        renderKeywordCharts(wordSummary, topChartDiv);
      }
    }

    // --- Tab switching ---
    function setBreakdownTab(tab) {
      currentTab = tab;
      currentPath = [];
      breakdownByClicksBtn.classList.remove('selected');
      breakdownByImpressionsBtn.classList.remove('selected');
      breakdownByCountBtn.classList.remove('selected');
      if (tab === 'clicks') breakdownByClicksBtn.classList.add('selected');
      if (tab === 'impressions') breakdownByImpressionsBtn.classList.add('selected');
      if (tab === 'numbers') breakdownByCountBtn.classList.add('selected');
      renderLeft(0, [], null);
      renderRight();
      renderCharts();
    }
    breakdownByClicksBtn.onclick = () => setBreakdownTab('clicks');
    breakdownByImpressionsBtn.onclick = () => setBreakdownTab('impressions');
    breakdownByCountBtn.onclick = () => setBreakdownTab('numbers');
    setBreakdownTab('clicks');
  }


  return {
    init: init,
    getSource: getSource
  };


})();
