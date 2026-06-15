var TrendsChart = (function(){

  var vendor = (navigator.userAgent.match(/(Chrome|Firefox)/) || [])[1];


  var init = function(params){
    if (params.queries) {
      if (params.chartData) initMultiTrendsChartWithData(params);
      else initMultiTrendsChart(params);
    }
    else initTrendsChart(params);
  };


  const initTrendsChart = (params) => {
    let query = params.query;
    let metricsPromise = params.metrics;
    let settings = Starter.getSettings();
    let geo = settings.country.toUpperCase();
    if (typeof params.geo !== 'undefined') geo = params.geo;
    if (!geo) geo = '';
    if (geo === 'UK') geo = 'GB';
    params.geo = geo;
    let property = params.property;
    let timeRange = params.timeRange || 'All Time';
    chrome.runtime.sendMessage({cmd: 'googleTrendsAPI.multiline', data: {
      keyword: query,
      timeRange: timeRange,
      geo: geo,
      property: property || '',
      category: params.category || 0
    }}, async (res) => {
      let data = await processTrendsResponse(res, params, metricsPromise);
      if (!data || data.nodata || data.noDataPartial) {
        renderTrendsChart(params, {noDataPartial: true});
        return;
      }
      renderTrendsChart(params, data);
    });
  };


  const googleTrendsAPImultilineAsync = (params) => {
    let metricsPromise = params.metricsPromise;
    return new Promise((resolve, reject) => {
      let retry = (function(){
        let attempts = 0;
        return function(){
          var timeout = [0, 30, 60, 90, 120, 300][attempts];
          attempts++;
          if (attempts <= 5) {
            setTimeout(async function(){
              let res = await GoogleTrendsAPI.multiline({
                keyword: params.keyword,
                timeRange: params.timeRange,
                geo: params.geo,
                property: params.property || '',
                category: params.category || '',
                captcha: params.captcha
              });
              let data = await processTrendsResponse(res, params, metricsPromise);
              if (!data) retry();
              else resolve(data);
            }, timeout*1000);
          }
          else {
            resolve();
            console.log('googleTrendsAPI.multiline failed after 5 retries');
          }
        };
      })();
      retry();
    });
  };


  var getChartItem = async function(params, index){
    var m = {
      error: false,
      data: [params.metrics[index]]
    };
    var metricsPromise = Promise.resolve(m);
    let res = await processTrendsResponse(params.chartData, params, metricsPromise, index);
    res.query = params.queries[index];
    res.keyword = params.queries[index];
    return res;
  };


  const initMultiTrendsChartWithData = async (params) => {
    let queries = params.queries;
    let results = new Array(queries.length);
    for (let i = 0; i < queries.length; i++) {
      results[i] = await getChartItem(params, i);
    }
    renderTrendsChart(params, results);
    $('.xt-trend-loading-spinner').addClass('xt-hidden');
  };


  const initMultiTrendsChart = async (params) => {
    let queries = params.queries;
    let metricsPromises = params.metricsPromises;
    let settings = Starter.getSettings();
    let geo = settings.country.toUpperCase();
    if (typeof params.geo !== 'undefined') geo = params.geo;
    if (!geo) geo = '';
    if (geo === 'UK') geo = 'GB';
    params.geo = geo;
    let property = params.property;
    let timeRange = params.timeRange || 'All Time';
    let results = new Array(queries.length);
    let promises = [];
    for (let [index, query] of queries.entries()) {
      let promise = googleTrendsAPImultilineAsync({
        showVolume: params.showVolume,
        keyword: query,
        metricsPromise: metricsPromises[index],
        timeRange: params.timeRange,
        geo: params.geo,
        property: params.property || '',
        category: params.category,
        captcha: params.captcha
      }).then(function(data){
        results[index] = data;
        if (data && !data.nodata) renderTrendsChart(params, results);
        if (typeof data === 'undefined') {
          $('.xt-trend-loading-status').removeClass('xt-hidden');
        }
      });
      promises.push(promise);
      if (index < queries.length - 1) {
        await timeoutAsync(1000);
      }
    }
    Promise.all(promises).then(function(){
      $('.xt-trend-loading-spinner').addClass('xt-hidden');
    });
    // renderTrendsChart(params, results);
  };


  const timeoutAsync = function(timeout){
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, timeout);
    });
  };


  const processTrendsResponse = async (res, params, metricsPromise, chartIndex) => {
    try {
      if (res.error) return;
      if (!chartIndex) chartIndex = 0;
      let resolution = res.req.request.resolution;
      let arrTimeline = res.json.default.timelineData;
      if (!arrTimeline.length) return {nodata: true};
      let labels = [];
      let formattedTime = [];
      let values = [];
      let partial = {};
      let noDataCount = 0;
      arrTimeline.map((item, index) => {
        labels.push(item.time*1000);
        formattedTime.push(item.formattedTime);
        values.push(item.value[chartIndex]);
        if (item.isPartial) partial[index] = true;
        if (!item.hasData[0]) noDataCount++;
      });
      let noDataRatio = noDataCount / arrTimeline.length;
      // if (noDataRatio > 0.25) return {noDataPartial: true};
      let extra = null;
      let chartValues = values;
      try {
        extra = calcValuesChange({chartValues, formattedTime, resolution});
      } catch (e) {
        console.log(e);
      }
      let volumeChart = false;
      if (params.showVolume) {
        let convertedValues = await convertInterestToVolume({labels,
          values,
          metricsPromise: metricsPromise,
          timeRange: params.timeRange,
          property: params.property,
          query: params.query
        });
        if (convertedValues) {
          chartValues = convertedValues;
          volumeChart = true;
        }
      }
      let result = {
        query: params.keyword,
        volumeChart: volumeChart,
        labels: labels,
        values: chartValues,
        formattedTime: formattedTime,
        resolution: resolution,
        extra: extra,
        partial: partial
      };
      // $('#xt-trend-chart-root').append('<pre>' + JSON.stringify({
      //   interestValue: interestValue,
      //   interestIndex: lastVals.interestIndex,
      //   interestDate: (new Date(lastVals.interestTS)).toLocaleString(),
      //   interestTS: lastVals.interestTS,
      //   scaleFactor: scaleFactor,
      //   trendValue: trendValue,
      //   trendVals: trendVals
      // }, '', '  ') + '</pre>');
      return result;
    } catch (e) {
      console.log(e);
      return;
    }
  };


  const calcValuesChange = function({chartValues, formattedTime, resolution}) {
    const daysInWeek = 7;
    const weeksInYear = 52;
    const weeksInQuarter = 13;
    const monthsInYear = 12;
    const monthsInQuarter = 3;

    let intervalLengthYear, intervalLengthQuarter;

    if (resolution === 'WEEK') {
        intervalLengthYear = weeksInYear;
        intervalLengthQuarter = weeksInQuarter;
    } else if (resolution === 'MONTH') {
        intervalLengthYear = monthsInYear;
        intervalLengthQuarter = monthsInQuarter;
    } else {
        throw new Error("Invalid resolution. Use 'WEEK' or 'MONTH'.");
    }

    function calculateIntervalTrend(intervalLength) {
        if (chartValues.length < 2 * intervalLength) {
            console.log("Not enough data to calculate the trend.");
            return;
        }

        const lastIntervalValues = chartValues.slice(-intervalLength);
        const previousIntervalValues = chartValues.slice(-2 * intervalLength, -intervalLength);

        // const lastIntervalDates = formattedTime.slice(-intervalLength);
        // const previousIntervalDates = formattedTime.slice(-2 * intervalLength, -intervalLength);

        const sumLastInterval = lastIntervalValues.reduce((sum, value) => sum + value, 0);
        const sumPreviousInterval = previousIntervalValues.reduce((sum, value) => sum + value, 0);

        if (intervalLength === intervalLengthYear && lastIntervalValues.filter(value => value === 0).length > lastIntervalValues.length / 2) {
            return null; // Do not show Past Year Trend
        }
        if (intervalLength === intervalLengthQuarter && lastIntervalValues.filter(value => value === 0).length > lastIntervalValues.length / 2) {
            return null; // Do not show Past Quarter Trend
        }

        let trend = 100 * (sumLastInterval - sumPreviousInterval) / sumPreviousInterval;
        const trendColor = trend >= 0 ? 'green' : 'red';
        if (trend > 0) trend = '+' + trend.toFixed(2);
        else trend = trend.toFixed(2);
        return { trend: trend + '%', color: trendColor };
    }

    const pastYearTrend = calculateIntervalTrend(intervalLengthYear);
    const pastQuarterTrend = calculateIntervalTrend(intervalLengthQuarter);

    return {
        pastYearTrend,
        pastQuarterTrend
    };
  };


  const convertInterestToVolume = async (params) => {
    let {labels, values, metricsPromise, timeRange, property, query} = params;
    let metrics = await metricsPromise;
    if (metrics.error) return;
    if (!metrics.data) return;
    let trendVals = metrics.data[0].trend.split('|');
    let lastVals = getLastNonZeroValues(trendVals, labels, values);
    let trendValue = lastVals.trendValue;
    if (typeof trendValue === 'undefined') return;
    if (trendVals.join('') === '') trendValue = parseInt(metrics.data[0].vol.replace(/,/g, ''));
    if (trendValue === 0) {
      if (property === 'youtube') return;
      if (lastVals.allZeroes) return;
      chrome.runtime.sendMessage({
        cmd: 'api.trend',
        data: {
          query: query
        }
      });
      return;
    }
    let interestValue = lastVals.interestValue;
    let divider = interestValue;
    if (timeRange.match(/(5yrs|12mo)/)) divider = interestValue * 4;
    else if (timeRange.match(/(3mo|30d)/)) divider = interestValue * 30;
    else if (timeRange === '7d') divider = interestValue * (30*24);
    else if (timeRange === '1d') divider = interestValue * (30*24*7.5); // every 8 minutes
    else if (timeRange === '4h') divider = interestValue * (30*24*60);
    else if (timeRange === '1h') divider = interestValue * (30*24*60);
    let scaleFactor = trendValue / divider;
    let convertedValues = values.map(value => {
      let res = value * scaleFactor;
      let formattedRes;
      if (res < 30 && timeRange.match(/(3mo|30d|7d)/)) formattedRes = res.toFixed(2);
      else if (res <= 100) formattedRes = parseInt(res);
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


  var generateExtraLine = function(keyword, trend, volume){
    var res = `<strong>${keyword}</strong> | ${volume.vol}`;
    if (trend) {
      if (trend.pastYearTrend) res += ` | past year: <span style="color: ${trend.pastYearTrend.color}">${trend.pastYearTrend.trend}</span>`;
      if (trend.pastQuarterTrend) res += ` | past quarter: <span style="color: ${trend.pastQuarterTrend.color}">${trend.pastQuarterTrend.trend}</span>`;
    }
    return res;
  };


  var generateExtraLineText = function(keyword, trend, volume){
    var res = `${keyword} | ${volume.vol}`;
    if (trend) {
      if (trend.pastYearTrend) res += ` | past year: ${trend.pastYearTrend.trend}`;
      if (trend.pastQuarterTrend) res += ` | past quarter: ${trend.pastQuarterTrend.trend}`;
    }
    return res;
  };


  function calculateEMA(data, windowSize) {
    let ema = [];
    let multiplier = 2 / (windowSize + 1);
    ema[0] = data[0]; // Start with the first data point

    for (let i = 1; i < data.length; i++) {
      ema[i] = ((data[i] - ema[i - 1]) * multiplier) + ema[i - 1];
    }

    return ema;
  }


  const renderTrendsChart = async (params, data) => {
    console.log(params, data);
    var multiCharts = false;
    if (data && data.length) multiCharts = true;

    let $root = $(params.parentSelector);
    $root.addClass(params.parentClassName);
    let rootId = params.rootId;
    let $widgetRoot = $root.find('#' + rootId);
    let rootTagName = params.rootTagName || '<div>';
    if (!$widgetRoot[0]) {
      $widgetRoot = $(rootTagName, {
        id: rootId,
        class: 'xt-ke-card'
      });
      if (params.addFn) {
        params.addFn($widgetRoot, $root);
      }
      else $widgetRoot[params.addMethod]($root);
    }
    else $widgetRoot.text('');

    let timeRangeSelectorHTML;
    if (!multiCharts) timeRangeSelectorHTML = renderTrendTimeRangeSelector(params.timeRange);
    let spinner = '';
    if (multiCharts) {
      spinner = '<span class="xt-trend-loading-spinner">Loading Keywords Everywhere Trend Chart</span><span class="xt-trend-loading-status xt-hidden">The Google Trends API is not responding. Please refresh this page after 10 minutes</span>';
    }
    var queries = params.queries;
    var iframeQuery = params.query ? params.query : queries.join(',');
    var settings = Starter.getSettings();
    let country = settings.country.toUpperCase();
    if (typeof params.geo !== 'undefined') country = params.geo;
    if (!country) country = 'Global';
    let countryTitle = '(' + country + ')';
    params.country = country;
    params.countryTitle = countryTitle;
    var volumeChart = data.volumeChart;
    var extraLines = [];
    if (multiCharts) {
      var index = data.findIndex(el => el !== undefined);
      if (index < 0) {
        console.log('No datasets for chart');
        return;
      }
      volumeChart = false;
      data.map((item, index) => {
        if (item && item.volumeChart) volumeChart = true;
        var line = generateExtraLine(data[index].query, data[index].extra, params.extra[data[index].query]);
        extraLines.push(line);
      });
    }
    let buttonsHiddenClass = volumeChart ? '' : 'xt-hidden';
    let version = chrome.runtime.getManifest().version;
    let heading = `${params.title} ${Common.escapeHtml(params.query)} ${countryTitle}`;
    if (multiCharts) heading = params.title + ' ' + countryTitle;
    var extraLinesHTML = extraLines.join('<br>');

    var pur = Common.getCredits() > 0 ? 0 : 1;
    var plan = Common.getPlan();
    if (plan) plan = plan.plan;

    let html = [
      '<div class="xt-close">✖</div>',
      '<table class="xt-ke-google-trend-title"><tr>',
      '<td><img src="' + chrome.runtime.getURL('/img/icon24.png') + '" width="24" height="24" style="vertical-align:middle">',
      '</td><td>',
      `<h3>${heading}</h3>`,
      spinner,
      '</td></tr></table>',
    ].join('\n');
    if (data && data.noDataPartial) {
      let url = `https://trends.google.com/trends/explore?geo=${params.geo}&date=all&q=` + encodeURIComponent(params.query);
      html += [
        '<div class="xt-chart-no-data">',
        `<div class="xt-text-center"><a class="xt-visit-gtrends-btn xt-ke-btn" href="${url}" target="_blank">View Trends Chart</a></div>`,
        '</div>',
        `<div class="xt-widget-iframe"><iframe src="https://keywordseverywhere.com/ke/widget.php?apiKey=${settings.apiKey}&source=${params.source}&pur=${params.showVolume ? 0 : 1}&country=${settings.country}&version=${version}&darkmode=${params.darkMode}&pur=${pur}&plan=${plan}&query=${encodeURIComponent(Common.escapeHtml(iframeQuery))}" scrolling="no"></iframe></div>`

      ].join('\n');
    }
    else {
      html += [
        '<table class="xt-google-trend-controls">',
        '<tr><td>',
        '<div class="xt-google-trend-extra-info">' + extraLinesHTML + '</div>',
        timeRangeSelectorHTML,
        '</td><td style="text-align:right">',
        '<div class="xt-ke-google-trend-copy-export-row">',
        (params.buttonScreenshot || true) && `<button class="xt-ke-btn xt-google-trend-screenshot ${buttonsHiddenClass}" title="Download a PNG image of the chart">${Common.getIcon('screenshot')}</button>`,
        `<button class="xt-ke-btn xt-google-trend-copy ${buttonsHiddenClass}" title="Copy the chart data to paste into Google sheets">${Common.getIcon('copy')}</button>`,
        `<button class="xt-ke-btn xt-google-trend-export ${buttonsHiddenClass}" title="Export a CSV file to be opened in Excel">${Common.getIcon('export')}</button>`,
        '</div>',
        '</td></tr>',
        '</table>',
        '<div class="xt-google-trend-canvas"></div>',
        `<div class="xt-widget-iframe"><iframe src="https://keywordseverywhere.com/ke/widget.php?apiKey=${settings.apiKey}&source=${params.source}&pur=${pur}&plan=${plan}&country=${settings.country}&version=${version}&darkmode=${params.darkMode}&query=${encodeURIComponent(Common.escapeHtml(iframeQuery))}" scrolling="no"></iframe></div>`
      ].join('\n');
    }
    $widgetRoot.html(html);
    initTrendsChartEventHandlers(params, $widgetRoot, data);
    if (data && data.noDataPartial) return;

    let $canvas = $('<canvas>', {id: 'xt-trend-chart'}).appendTo($widgetRoot.find('.xt-google-trend-canvas'));
    var ctx = $canvas[0].getContext('2d');

    var grayColor = params.darkMode ? '#aaa' : '#70757a';
    var gridColor = params.darkMode ? '#3e3e3e' : '#d9e2ef';
    var chartColor = '#c0504f';

    var volumeChart;
    var resolution;
    var formattedTime;
    var datasets = [];
    var labels = [];
    var colors = ['#4285f4', '#db4437', '#f4b400', '#0f9d58', '#ab47bc'];
    var darkerColors = ['#25499e', '#a52714', '#b38600', '#07592f', '#72199e'];
    if (multiCharts) {
      var index = data.findIndex(el => el !== undefined);
      if (index < 0) {
        console.log('No datasets for chart');
        return;
      }
      volumeChart = data[index].volumeChart;
      resolution = data[index].resolution;
      formattedTime = data[index].formattedTime;
      labels = data[index].labels;
      data.map((item, index) => {
        if (!item) return;
        // if (item.volumeChart) {
        //   datasets.push({});
        //   return;
        // }
        datasets.push({
          label: 'ema',
          fill: false,
          borderColor: darkerColors[index],
          // partialColor: '#00f000',
          data: calculateEMA(item.values, 15),
          colors: ['red', 'green', 'blue']
        });
        datasets.push({
          label: '',
          fill: false,
          borderColor: colors[index],
          // partialColor: '#00f000',
          data: item.values,
          // colors: ['red', 'green', 'blue']
        });
      });
    }
    else {
      volumeChart = data.volumeChart;
      resolution = data.resolution;
      formattedTime = data.formattedTime;
      labels = data.labels;
      datasets.push({
        label: '',
        backgroundColor: chartColor,
        borderColor: chartColor,
        // partialColor: '#00f000',
        fill: true,
        data: data.values,
        // colors: ['', 'red', 'green', 'blue']
      });
    }
    var chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets,
        type: "line",
        pointRadius: 0,
        lineTension: 0,
        borderWidth: 1
      },
      options: {
        maintainAspectRatio: params.maintainAspectRatio ?? false,
        aspectRatio: params.aspectRatio || 2,
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
            // offset: true,
            ticks: {
              major: {
                enabled: true
              },
              font: {
                weight: 'bold'
              },
              source: "data",
              autoSkip: true,
              autoSkipPadding: 40,
              maxRotation: 0,
              sampleSize: 100,
              color: grayColor,
            },
            grid: {
              display: false
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              display: volumeChart,
              padding: 10,
              color: grayColor,
              callback: function(value, index, values) {
                return value.toLocaleString();
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
              text: volumeChart ? 'Search Volume' : 'Search Interest'
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
                var dataPointer = data;
                var query = '';
                var index = Math.floor(e.datasetIndex / 2); // because we have avg now
                if (e.dataset.label === 'ema') return null;
                if (data.length) {
                  dataPointer = data[index];
                  query = ' - ' + queries[index];
                }
                // if (!dataPointer.volumeChart) return '';
                let res = parseFloat(e.raw).toLocaleString();
                if (res > 10) res = Math.round(res);
                return `${res} (${dataPointer.resolution.toLowerCase()})${query}`;
              },
              labelColor: function(context) {
                var index = Math.floor(context.datasetIndex / 2); // because we have avg now
                return {
                  borderColor: colors[index],
                  backgroundColor: colors[index],
                  borderWidth: 0,
                };
              },
              title: function(e, t){
                let index = e[0].dataIndex;
                let formattedTime = data.formattedTime;
                if (!formattedTime && data.length) {
                  formattedTime = data[0].formattedTime;
                }
                let res = formattedTime[index];
                return res;
              }
            }
          }
        }
      }
    });
    chart.update();
  };


  const formatDateString = (resolution, ts) => {
    let res;
    let d = new Date(ts);
    if (resolution === 'HOUR') res = d.toLocaleString();
    if (resolution === 'WEEK' || resolution === 'DAY') {
      res = d.toLocaleDateString();
    }
    else if (resolution === 'MONTH') {
      res = Common.getDate('MON YYYY', d);
    }
    return res;
  };


  const initTrendsChartEventHandlers = (params, $widgetRoot, data) => {
    const getExportArray = (withHeaders) => {
      let arrRes = [];
      if (data.length) {
        data.map(function(item, i){
          item.formattedTime.map((val, index) => {
            let date = val;
            if (i === 0) arrRes.push([date, item.values[index]]);
            else arrRes[index][i + 1] = item.values[index];
          });
        });
        if (withHeaders) {
          var headers = ['Date'];
          data.map(function(item){
            headers.push(`${item.query} - Search Volume ${params.countryTitle}`);
          });
          arrRes.unshift(headers);
        }
      }
      else {
        if (withHeaders) arrRes.push(['Date', `Search Volume ${params.countryTitle}`]);
        data.formattedTime.map((val, index) => {
          // let date = formatDateString(data.resolution, val);
          let date = val;
          arrRes.push([date, data.values[index]]);
        });
      }
      return arrRes;
    };
    $widgetRoot.find('.xt-close').click(e => {
      e.preventDefault();
      $widgetRoot.remove();
    });
    $widgetRoot.find('.xt-google-trend-canvas').click(e => {
      if (document.location.host === 'trends.google.com') return;
      e.preventDefault();
      let date = '';
      let mapping = {
        'All Time': 'all',
        '5yrs': 'today 5-y',
        '12mo': '',
        '3mo': 'today 3-m',
        '30d': 'today 1-m',
        '7d': 'now 7-d'
      };
      if (mapping[params.timeRange]) date = '&date=' + encodeURIComponent(mapping[params.timeRange]);
      let url = `https://trends.google.com/trends/explore?geo=${params.geo}&q=` + encodeURIComponent(params.query) + date;
      if (params.property === 'youtube') url += '&gprop=youtube';
      chrome.runtime.sendMessage({
        cmd: 'new_tab',
        data: url
      });
    });
    $widgetRoot.find('.xt-trend-time').click(function(e){
      e.preventDefault();
      $widgetRoot.find('.xt-trend-spinner').removeClass('xt-hidden');
      let val = this.dataset.val;
      params.timeRange = val;
      initTrendsChart(params);
      chrome.runtime.sendMessage({
        cmd: 'setting.set',
        data: {key: 'googleTrendChartDefaultTime', value: val}
      });
    });
    $widgetRoot.find('.xt-google-trend-screenshot').click(async (e) => {
      e.preventDefault();
      console.log(params);
      let query = params.query;
      if (params.queries) query = params.queries[0];
      let property = params.property;
      if (!property) property = 'google';
      var extra = '';
      if (params.timeRange) extra = params.timeRange;

      const extraLines = [];
      if (data && data.length) {
        data.map((item, index) => {
          var line = generateExtraLineText(data[index].query, data[index].extra, params.extra[data[index].query]);
          extraLines.push(line);
        });
        if (extraLines.length) extra = extraLines;
      }

      var chart = Chart.getChart($('#xt-trend-chart'));
      var base64 = chart.toBase64Image();
      var resImg = await generateChartImage({
        title: (typeof params.query === 'string') ? params.query : '',
        extra: extra,
        base64: base64
      });

      let filename = ['trend', property, query.replace(/\s+/g, '-'), params.country.toLowerCase(), params.timeRange.replace(/\s+/g, '-'), Date.now()].join('-') + '.png';
      filename = filename.toLowerCase();
      if (vendor === 'Firefox') {
        chrome.runtime.sendMessage({
          cmd: 'file.download',
          data: {
            content: resImg,
            name: filename
          }
        });
        return;
      }
      Common.saveToFile(resImg, filename);
    });
    $widgetRoot.find('.xt-google-trend-copy').click(e => {
      e.preventDefault();
      Common.clipboardWrite( CSV.stringify(getExportArray(true), '\t') );
    });
    $widgetRoot.find('.xt-google-trend-export').click(e => {
      e.preventDefault();
      let query = params.query;
      if (params.queries) query = params.queries[0];
      let property = params.property;
      if (!property) property = 'google';
      let filename = ['trend', property, query.replace(/\s+/g, '-'), params.country.toLowerCase(), params.timeRange.replace(/\s+/g, '-'), Date.now()].join('-') + '.csv';
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
  };


  const renderTrendTimeRangeSelector = (active) => {
    if (!active) active = 'All Time';
    let items = ['7d', '30d', '3mo', '12mo', '5yrs', 'All Time'];
    let html = '';
    items.map(item => {
      let activeClass = active === item ? 'xt-trend-time-active' : '';
      html += `<a href="#" class="xt-trend-time ${activeClass}" data-val="${item}">${item}</a>`;
    });
    html += '<span class="xt-trend-spinner xt-hidden"></span>';
    return '<div class="xt-trend-time-row">' + html + '</div>';
  };


  const generateChartImage = async (params) => {
      const chart = await getImage(params.base64);
      const logo = await getImage(chrome.runtime.getURL('img/logo.png'));

      if (params.extra && params.extra.length) {

      }

      const canvasWidth = 800;
      const padding = 20;
      const extraHeight = 120;

      // Calculate the scaling factor to fit the chart width to canvas width minus padding
      const scaleFactor = (canvasWidth - 2 * padding) / chart.width;
      const scaledHeight = Math.round(chart.height * scaleFactor);

      // Calculate canvas height based on scaled chart height plus extra space
      const canvasHeight = scaledHeight + 2 * padding + extraHeight;

      const canvas = document.createElement('canvas');
      canvas.setAttribute('width', canvasWidth);
      canvas.setAttribute('height', canvasHeight);
      const ctx = canvas.getContext('2d');

      // Fill the background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Draw the chart image, scaled to fit width with padding and positioned at the bottom with padding
      ctx.drawImage(
          chart.img,
          padding,
          canvasHeight - scaledHeight - padding,
          canvasWidth - 2 * padding,
          scaledHeight
      );

      if (params.title) {
        ctx.font = '36px Arial';
        ctx.fillStyle = 'black';
        ctx.fillText(params.title, 20, 56);
      }
      if (typeof params.extra === 'object' && params.extra.length) {
        params.extra.map(function(line, index){
          ctx.font = '16px Arial';
          ctx.fillStyle = 'gray';
          ctx.fillText(line, 20, 90 + 24*index);
        });
      }
      else if (params.extra) {
        ctx.font = '20px Arial';
        ctx.fillStyle = 'gray';
        ctx.fillText(params.extra, 20, 90);
      }

      // Draw the logo
      ctx.drawImage(logo.img, canvasWidth - logo.width - 20, 20, logo.width, logo.height);

      const result = canvas.toDataURL('image/png');
      return result;
  }


  async function getImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = function() {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const base64String = canvas.toDataURL('image/png');
        resolve({
          img: img,
          base64: base64String,
          width: img.width,
          height: img.height
        });
      };
      img.onerror = function() {
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }


  function convertStringsToSVG(stringsArray) {
    // Define the initial SVG structure
    const svgStart = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${stringsArray.length * 30}">`;
    const svgEnd = `</svg>`;
    let svgContent = svgStart;
    // Iterate over the strings array and convert each string to SVG text element
    stringsArray.forEach((string, index) => {
        const yPosition = (index + 1) * 30; // Calculate y position for each line
        svgContent += `<foreignObject x="0" y="${yPosition - 20}" width="500" height="30">
            <body xmlns="http://www.w3.org/1999/xhtml">
                ${string}
            </body>
          </foreignObject>`;
    });
    svgContent += svgEnd;
    return svgContent;
  }


  return {
    init: init,
    processTrendsResponse: processTrendsResponse
  };

})();
