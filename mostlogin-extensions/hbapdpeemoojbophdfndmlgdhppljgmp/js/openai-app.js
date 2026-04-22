(() => {

  const vendor = (navigator.userAgent.match(/(Chrome|Firefox)/) || [])[1];

  const categorySelect = document.getElementById('select-category');
  const subCategorySelect = document.getElementById('select-subcategory');
  const templateSelect = document.getElementById('select-template');
  const languageSelect = document.getElementById('select-language');
  const countrySelect = document.getElementById('select-country');
  const voiceToneSelect = document.getElementById('select-tone-of-voice');
  const writingStyleSelect = document.getElementById('select-writing-style');

  const $sectionGlobal = $('#section-global');
  const $sectionInputs = $('#section-inputs');

  const promptTextarea = document.getElementById('promptTextarea');
  const executeTemplateButton = document.getElementById('executeTemplate');

  const globalVars = {};
  let source;
  let selectedTemplateData;
  let settings;
  let plan;
  let _credits;
  let templateVars = {};

  const ICON_HELP_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-help-circle"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';


  const init = () => {
    Prefix.init('xt-openai');
    initWindowMessaging();
    reset();
    post('widget.ready');
    post('get-settings');
    initSource();
    initTheme();
    initUI();
    getGlobalInputs();
    populateCategories();
  };


  const initSource = function(){
    source = getURLParameter('source') || '';
    document.documentElement.setAttribute('source', source);
  };


  const initTheme = function(){
    const dark = getURLParameter('darkmode');
    if (dark && dark === "true") $('html').attr('dark', true);
  };


  const initIframe = () => {
    // Get configuration values
    const darkmode = $('html').attr('dark') === 'true';
    const apiKey = settings.apiKey || '';
    const settingEnabled = settings.sourceList.instgr;
    const version = chrome.runtime.getManifest().version;
    const planParam = plan?.plan ? `&plan=${plan.plan}` : '';
    const pur = _credits > 0 ? 1 : 0;
    
    // Build iframe URL with parameters
    const baseUrl = 'https://keywordseverywhere.com/ke/widget.php';
    const urlParams = new URLSearchParams({
      apiKey: apiKey,
      source: source,
      enabled: settingEnabled,
      country: settings.country,
      darkmode: darkmode,
      version: version,
      pur: pur
    });
    if (plan && plan.plan) {
      urlParams.set('plan', plan.plan);
    }
    
    const iframeSrc = baseUrl + '?' + urlParams.toString();
    const iframeHTML = `
      <div class="xt-widget-iframe">
        <iframe 
          class="xt-ke-instgrm-iframe" 
          src="${iframeSrc}" 
          scrolling="no">
        </iframe>
      </div>
    `;
    $('#section-footer').html(iframeHTML);

    // Resize iframe after a short delay
    setTimeout(() => {
      WidgetHelpers.resize({heightOnly: true});
    }, 1000);
  };

  const reset = () => {
    $('#section-description').text('Please browse through our categories and sub-categories above and select a prompt template that you\'d like to execute');
    $('#section-global > div[data-id]').addClass('hidden');
    $('#section-inputs').text('');
    $('#section-prompt').addClass('hidden');
    $('#section-execute').addClass('hidden');
    $('#section-upgrade').addClass('hidden');
    promptTextarea.value = '';
    templateVars = {};
    WidgetHelpers.resize({heightOnly: true});
  };


  const initWindowMessaging = () => {
    window.addEventListener("message", function(event){
      const payload = event.data;
      if (typeof payload !== 'object') return;
      let cmd = payload.cmd;
      const data = payload.data;
      const prefix = Prefix.get('');
      if (cmd === 'xt.resize') {
        var height = data.height;
        var source = data.source;
        var selector = '#section-footer';
        if (!selector) return;
        if (height <= 0) return;
        $(selector + ' iframe').height(height + 10);
      }
      if (cmd.indexOf( prefix ) !== 0) {
        // console.log('Command without prefix. Aborting to avoid collision', cmd, data);
        return;
      }
      cmd = cmd.replace( prefix, '');
      // console.log(cmd, data);
      if (cmd === 'darkmode') {
        $('html').attr('dark', data);
        initIframe();
      }
      else if (cmd === 'settings') {
        settings = data.settings;
        plan = data.plan;
        _credits = data.credits;
        console.log(plan, settings);
        initIframe();
      }
    }, false);
  };


  const processTemplate = (data) => {
    data.global_variables.map(item => {
      const key = 'select-' + item.name.replace(/_/g, '-');
      $(`#section-global > div[data-id=${key}]`).removeClass('hidden');
    });
    // data.input_grid = '"input_1 input_1 input_1 input_1 input_1 input_1 input_2 input_2 input_3 input_3 input_3 input_3" "input_4 input_4 input_4 input_4 input_4 input_4 input_4 input_4 input_4 input_4 input_4 input_4"';
    renderInputs(data.input_variables, data.input_grid);
    $('#section-description').text('Description: ' + data.description);
    $('#section-prompt').removeClass('hidden');
    $('#section-execute').removeClass('hidden');
    WidgetHelpers.resize({heightOnly: true});
    prepareTemplateString();
  };


  const getGlobalInputs = async () => {
    try {
      const storage = await readStorage();
      const [languages, countries, voiceTones, writingStyles] = await Promise.all([
        API.openAIFetchLanguages(),
        API.openAIFetchCountries(),
        API.openAIFetchVoiceTones(),
        API.openAIFetchWritingStyles()
      ]);
      globalVars.voiceTones = voiceTones;
      globalVars.writingStyles = writingStyles;
      renderSelectOptions(languageSelect, languages, storage.language);
      renderSelectOptions(countrySelect, countries, storage.country);
      renderSelectOptions(voiceToneSelect, voiceTones, storage.tone_of_voice);
      renderSelectOptions(writingStyleSelect, writingStyles, storage.writing_style);
    } catch (err) {
      console.log(err);
    }
  };


  const readStorage = () => {
    return new Promise((resolve) => {
      chrome.storage.local.get('openai', (data) => {
        if (!data.openai) resolve({});
        else resolve(data.openai);
      });
    });
  };


  const setStorage = async (key, value) => {
    let data = await readStorage();
    data[key] = value;
    chrome.storage.local.set({openai: data});
  };


  const renderInputs = (inputs, grid) => {
    if (grid) {
      $sectionInputs.removeClass('row').addClass('grid');
      $sectionInputs[0].style.gridTemplateAreas = grid;
    }
    else {
      $sectionInputs.removeClass('grid').addClass('row');
    }
    inputs.map(input => {
      if (input.type === 'text') {
        const html = `
          <div class="flex-full-width" style='grid-area: ${input.name}'>
            <label>${input.label} <span class="help" title="${input.help_text}">${ICON_HELP_SVG}</span></label>
            <input type="text" placeholder="${input.label}" data-name="${input.name}" value="${input.default_text || ''}">
          </div>`;
        $sectionInputs.append(html);
      }
      if (input.type === 'URL' || input.type === 'SERP' || input.type === 'YouTube_Video_URL') {
        var type = input.type.toLowerCase();
        const html = `
          <div class="flex-full-width" style='grid-area: ${input.name}' data-type="${type}">
            <label>${input.label} <span class="help" title="${input.help_text}">${ICON_HELP_SVG}</span></label>
            <input type="text" placeholder="${input.label}" data-name="${input.name}" value="${input.default_text || ''}">
          </div>
          <div style="grid-area: ${input.name}_button" class="button-item">
            <button data-type="${type}" data-target="${input.name}">Get Data</button>
            <img class="spinner hidden" src="/img/spinner32.gif" />
            <span class="input-clear hidden" data-target="${input.name}">clear</span>
          </div>`;
        $sectionInputs.append(html);
        executeTemplateButton.disabled = true;
      }
      else if (input.type === 'number') {
        const html = `
          <div class="flex-item" style='grid-area: ${input.name}'>
            <label>${input.label} <span class="help" title="${input.help_text}">${ICON_HELP_SVG}</span></label>
            <input type="number" data-name="${input.name}" value="${input.default_text || ''}">
          </div>`;
        $sectionInputs.append(html);
      }
      else if (input.type === 'dropdown') {
        let optionsHTML = '';
        let options = input.options.split(/\s*,\s*/).map(option => {
          optionsHTML += `<option value="${option}">${option}</option>`;
        });
        const html = `
          <div class="flex-item" style='grid-area: ${input.name}'>
          <label>${input.label} <span class="help" title="${input.help_text}">${ICON_HELP_SVG}</span></label>
          <select data-name="${input.name}">${optionsHTML}</select>
          `;
        $sectionInputs.append(html);
      }
      else if (input.type === 'textarea') {
        const html = `
          <div class="flex-full-width" style='grid-area: ${input.name}'>
            <label>${input.label} <span class="help" title="${input.help_text}">${ICON_HELP_SVG}</span></label>
            <textarea data-name="${input.name}" rows="4">${input.default_text || ''}</textarea>
          </div>`;
        $sectionInputs.append(html);
      }
    });
    $sectionInputs.find('.help').keTooltip();
    $sectionInputs.find('.input-clear').click(function(e){
      const target = this.dataset.target;
      $(`[data-name="${target}"]`).val('')[0].disabled = false;
      for (var key in templateVars) {
        if (key.indexOf(target) === 0) delete templateVars[key];
      }
      prepareTemplateString({
        urlData: templateVars
      });
      this.classList.add('hidden');
    });

    $sectionInputs.find('button').click(function(e){
      e.preventDefault();
      const self = this;
      const type = this.dataset.type;
      const target = this.dataset.target;
      const $input = $(`[data-name="${target}"]`);
      let val = $input.val();
      if (!val) return;
      if (type === 'url') {
        if (!val.match(/https?:\/\/.*/)) {
          val = 'https://' + val;
        }
      }
      if (type === 'serp') {
        val = 'https://www.google.com/search?q=' + encodeURIComponent(val);
      }
      $input[0].disabled = true;
      self.disabled = true;
      const $spinner = $(this).parent().find('.spinner');
      $spinner.removeClass('hidden');
      chrome.runtime.sendMessage({
        cmd: 'ajax.getPageHTML',
        data: {
          url: val
        }
      }, async function(response){
        $spinner.addClass('hidden');
        self.disabled = false;
        if (response.error) {
          console.log(response);
          return;
        }
        $(self).parent().find('.input-clear').removeClass('hidden');
        executeTemplateButton.disabled = false;
        const pageData = await processPageHTML(type, response.data);
        prepareAdvancedVars(type, target, pageData);
        prepareTemplateString({
          urlData: templateVars
        });
      });
    });
  };


  const prepareAdvancedVars = (type, target, pageData) => {
    const vars = templateVars;
    if (type === 'url') {
      vars[target + '.title'] = pageData.title;
      vars[target + '.description'] = pageData.description;
      vars[target + '.content'] = pageData.cleanFullText;
      vars[target + '.total_words'] = pageData.wordsTotal;
      vars[target + '.headings'] = pageData.allHeaders;
      vars[target + '.headings_h1'] = pageData.headers[0].join('\n');
      vars[target + '.headings_h2'] = pageData.headers[1].join('\n');
      vars[target + '.headings_h3'] = pageData.headers[2].join('\n');
      vars[target + '.headings_h4'] = pageData.headers[3].join('\n');
      vars[target + '.headings_h5'] = pageData.headers[4].join('\n');
      vars[target + '.headings_h6'] = pageData.headers[5].join('\n');
    }
    else if (type === 'youtube_video_url') {
      vars[target + '.title'] = pageData.title;
      vars[target + '.description'] = pageData.description;
      vars[target + '.tags'] = pageData.tags;
      vars[target + '.transcript'] = pageData.transcript;
    }
    else if (type === 'serp') {
      let titles = [];
      let descriptions = [];
      pageData.results.map(function(item){
        titles.push(item.title);
        descriptions.push(item.description);
      });
      vars[target + '.titles'] = titles.join('\n');
      vars[target + '.descriptions'] = descriptions.join('\n');
      vars[target + '.related_keywords'] = pageData.relatedKeywords.join('\n');
      vars[target + '.pasf_keywords'] = pageData.pasfKeywords.join('\n');
    }
    return vars;
  };


  const processPageHTML = async (type, origHTML) => {
    let extraHTML = '';
    if (type === 'serp') {
      extraHTML = googlePreprocessing(origHTML);
    }
    html = cleanHTML(origHTML, {form: true});
    let dom = (new DOMParser()).parseFromString(html, "text/html");
    let title = $('head title', dom).text();
    let description = $('meta[name=description]', dom).attr('content');

    let headers = [];
    let cleanHeaders = [];
    for (let i = 0; i < 6; i++) {
      headers[i] = [];
      cleanHeaders[i] = [];
      $('h' + (i+1), dom).map(function(index, node){
        let text = node.textContent;
        headers[i].push(text.replace(/\s+/g, ' '));
        cleanHeaders[i].push(clearText(text));
      });
    }
    let allHeaders = [];
    headers.map(function(arr){
      allHeaders.push(arr.join('\n'));
    });
    let text = $('body', dom).html()
    text = text.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/ig, '');
    text = text.replace(/<nav\W[\s\S]*?<\/nav>/, '');
    text = text.replace(/<header[\s\S]*?<\/header>/, '');
    text = text.replace(/<footer[\s\S]*?<\/footer>/, '');
    text = text.replace(/<[^>]*>/g, " ");
    let fullText = $('<div>').html(text).text();
    let cleanTitleText = clearText([title, fullText].join(' '));

    let pageData = {
      title: title,
      cleanTitle: clearText(title),
      description: description,
      cleanDescription: clearText(description),
      allHeaders: allHeaders.join('\n'),
      headers: headers,
      cleanHeaders: cleanHeaders,
      fullText: fullText,
      cleanFullText: clearText(fullText),
      cleanTitleText: cleanTitleText,
      wordsTotal: cleanTitleText.split(/\s+/).length
    };
    if (type === 'serp') {
      const config = await getConfig();
      let results = processGoogleSERP(dom);
      pageData.results = results;
      pageData.relatedKeywords = getGoogleRelatedSearch(dom, config.google);
      pageData.pasfKeywords = getPeopleAlsoSearch(dom, config.google, extraHTML);
    }
    if (type === 'youtube_video_url') {
      let ytData = await processYoutubePage(origHTML);
      pageData.title = ytData.title;
      pageData.description = ytData.description;
      pageData.tags = ytData.tags.join(', ');
    }
    return pageData;
  };


  const processYoutubePage = async (html) => {
    let dom = (new DOMParser()).parseFromString(html, "text/html");
    let info = await getVideoInfo(dom, html, {});
    var ytplayerConfig;
    var ytInitialData;
    var scripts = $('#player-wrap script, #player script', dom);
    for (var i = 0, len = scripts.length; i < len; i++) {
      var script = scripts[i];
      var text = script.textContent;
      if (!text.match(/ytplayer.config =/)) continue;
      var matches = text.match(/ytplayer\.config = (.*?});/);
      if (matches) {
        ytplayerConfig = JSON.parse(matches[1]);
      }
    }
    var scripts = $('body > script', dom);
    for (var i = 0, len = scripts.length; i < len; i++) {
      var script = scripts[i];
      var text = $.trim(script.textContent);
      var pattern = 'window["ytInitialData"] = ';
      if (text.indexOf(pattern) === 0) {
        var jsonStr = text.replace(pattern, '');
        jsonStr = jsonStr.replace(/};[\s\S]*/, '}');
        ytInitialData = JSON.parse(jsonStr);
      }
      else if (text.indexOf('var ytInitialData =') !== -1) {
        var jsonStr = text.replace(/var ytInitialData\s*=\s*{/, '{');
        jsonStr = jsonStr.replace(/};[\s\S]*/, '}');
        ytInitialData = JSON.parse(jsonStr);
      }
      if (!ytplayerConfig) {
        if (text.indexOf('var ytInitialPlayerResponse =') !== -1) {
          var jsonStr = text.replace(/var ytInitialPlayerResponse = {/, '{');
          jsonStr = jsonStr.replace(/};[\s\S]*/, '}');
          ytplayerConfig = {args: {player_response: jsonStr}};
        }
      }
    }
    // console.log(ytplayerConfig, ytInitialData);
    try {
      var response = JSON.parse(ytplayerConfig.args.player_response);
      let title = response.videoDetails.title || '';
      let description = response.videoDetails.shortDescription || '';
      // let videoSecondaryInfoRenderer = getObjValue(ytInitialData, '.contents.twoColumnWatchNextResults.results.results.contents[1].videoSecondaryInfoRenderer');
      // var descriptionLines = getObjValue(videoSecondaryInfoRenderer, '.description');
      // if (descriptionLines) {
      //   descriptionLines = descriptionLines.runs.map(function(item){
      //     return item.text;
      //   });
      // }
      // else descriptionLines = [];
      var tags = getObjValue(response, '.videoDetails.keywords');
      var res = {
        title,
        description,
        tags
      };
      console.log(res);
      return res;
    } catch (e) {
      console.log(e);
    }
  };


  var getVideoInfo = async function(dom, html, params){
    let res = {};
    let matches = html.match(/"XSRF_TOKEN":"(.*?)",/);
    if (matches) {
      res.xsrf = decodeURIComponent(matches[1]);
      res.xsrf = res.xsrf.replace(/\\u003d/g, '=');
    }
    matches = html.match(/"ID_TOKEN":"(.*?)",/);
    if (matches) {
      res.idToken = decodeURIComponent(matches[1]);
      res.idToken = res.idToken.replace(/\\u003d/g, '=');
    }
    matches = html.match(/"INNERTUBE_CLIENT_VERSION":"(.*?)",/);
    if (matches) {
      res.clientVersion = matches[1];
    }
    matches = html.match(/"INNERTUBE_API_KEY":"(.*?)"/);
    if (matches) {
      res.innertubeApiKey = matches[1];
    }
    let promises = $('script', dom).map(async function(i, script){
      let text = script.textContent;
      if (text.indexOf('var ytInitialPlayerResponse = ') !== -1) {
        let jsonText = text.replace('var ytInitialPlayerResponse = ', '');
        jsonText = jsonText.replace(/\};.*$/, '}');
        try {
          let json = JSON.parse(jsonText);
          res.ytInitialPlayerResponse = json;
        } catch (e) {
          console.log(e);
        }
      }
      if (text.indexOf('var ytInitialData = ') !== -1) {
        let jsonText = text.replace('var ytInitialData = ', '');
        jsonText = jsonText.replace(/\};$/, '}');
        try {
          let json = JSON.parse(jsonText);
          // console.log(json);
          res.ytInitialData = json;
          res.visitorData = getObjValue(json, '.responseContext.webResponseContextExtensionData.ytConfigData.visitorData');
          // res.clientVersion = getObjValue(json, '.responseContext.serviceTrackingParams[3].params[0]');
          let continuation = getObjValue(json, '.contents.twoColumnWatchNextResults.results.results.contents[2].itemSectionRenderer.contents[0].continuationItemRenderer.continuationEndpoint.continuationCommand.token');
          if (!continuation) {
            continuation = getObjValue(json, '.contents.twoColumnWatchNextResults.results.results.contents[3].itemSectionRenderer.contents[0].continuationItemRenderer.continuationEndpoint.continuationCommand.token');
          }
          if (!continuation) {
            // console.log('No continuation. Abort');
            return;
          }
          res.continuation = continuation;
          // res.commentsCount = await getComments(res);
        } catch (e) {
          console.log(e);
        }
      }
    });
    await Promise.all(promises);
    processYtInitial(res);
    // const transcript = await getTranscript(html, res);
    return res;
  };


  var processYtInitial = function(res){
    // console.log(res);
    let ytInitialData = res.ytInitialData;
    let ytInitialPlayerResponse = res.ytInitialPlayerResponse;
    try {
      let videoPrimaryInfoRenderer = getObjValue(ytInitialData, '.contents.twoColumnWatchNextResults.results.results.contents[0].videoPrimaryInfoRenderer');
      if (!videoPrimaryInfoRenderer) videoPrimaryInfoRenderer = getObjValue(ytInitialData, '.contents.twoColumnWatchNextResults.results.results.contents[1].videoPrimaryInfoRenderer');
      let videoSecondaryInfoRenderer = getObjValue(ytInitialData, '.contents.twoColumnWatchNextResults.results.results.contents[1].videoSecondaryInfoRenderer');
      if (!videoSecondaryInfoRenderer) videoSecondaryInfoRenderer = getObjValue(ytInitialData, '.contents.twoColumnWatchNextResults.results.results.contents[2].videoSecondaryInfoRenderer');
      // let likes = getObjValue(videoPrimaryInfoRenderer, '.videoActions.menuRenderer.topLevelButtons[0].segmentedLikeDislikeButtonRenderer.likeButton.toggleButtonRenderer.defaultText.simpleText');
      // res.likes = convertToInt(likes);
      // res.dislikes = 0; //convertToInt(dislikes);
      // let viewsText = ytInitialData.contents.twoColumnWatchNextResults.results.results.contents[0].videoPrimaryInfoRenderer.viewCount.videoViewCountRenderer.viewCount.simpleText;
      // res.views = convertToInt(viewsText);
      res.channelId = getObjValue(ytInitialPlayerResponse, '.videoDetails.channelId');
      res.channelName = getObjValue(ytInitialPlayerResponse, 'microformat.playerMicroformatRenderer.ownerChannelName');
      res.viewCount = parseInt(getObjValue(ytInitialPlayerResponse, '.videoDetails.viewCount'));
      // res.subscribersText = getObjValue(videoSecondaryInfoRenderer, '.owner.videoOwnerRenderer.subscriberCountText.simpleText');
      // res.subscribers = convertAbbreviatedNumber(res.subscribersText);
      res.verified = getObjValue(videoSecondaryInfoRenderer, '.owner.videoOwnerRenderer.badges[0].metadataBadgeRenderer.tooltip') === 'Verified';
      res.title = getObjValue(videoPrimaryInfoRenderer, '.title.runs[0].text');
      res.description = getObjValue(videoSecondaryInfoRenderer, 'attributedDescription.content');
      // let arrDescription = getObjValue(videoSecondaryInfoRenderer, '.description.runs') || [];
      // res.description = arrDescription.map(item => item.text).join('');
      res.keywords = getObjValue(ytInitialPlayerResponse, '.videoDetails.keywords');
      res.lengthSeconds = getObjValue(ytInitialPlayerResponse, '.videoDetails.lengthSeconds');
      res.publishDate = getObjValue(ytInitialPlayerResponse, '.microformat.playerMicroformatRenderer.publishDate');
      let arrFormats = getObjValue(ytInitialPlayerResponse, '.streamingData.adaptiveFormats');
      arrFormats.map(item => {
        if (res.quality) return;
        if (item.qualityLabel) {
          var q = item.qualityLabel;
          q = q.replace(/p.*/, '');
          if (!q.match(/^\d+$/)) return;
          res.quality = parseInt(q);
        }
      });
      // let queryLC = getSearchQuery().toLowerCase();
      // if (res.description.toLowerCase().indexOf(queryLC) !== -1) res.descriptionHasQuery = true;
      console.log(res);
    } catch (e) {
      console.log(e);
    }
  };


  var getObjValue = function(o, s) {
    if (!o) {
      console.log(`Empty object, can't get path ${s}`);
      return '';
    }
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
      var k = a[i];
      if (k in o) {
        o = o[k];
      } else {
        console.log(`Unable to find ${s} in `, o, 'failed on ', k);
        return '';
      }
    }
    return o;
  };


  var getTranscript = async function(html, res){
    let url = "https://www.youtube.com/youtubei/v1/get_transcript?key=" + res.innertubeApiKey;
    let data = generateRequest(html, {});
    $.post(url, {
      dataType: 'json',
      data: data
    });
    const response = await fetch(url, {
      "method": 'POST',
      "body": JSON.stringify(data, '', ''),
      "mode": "cors",
      "credentials": "omit",
      "headers": {
        "origin": "https://www.youtube.com"
      }
    });
    let text = await response.text();
    try {
      const json = JSON.parse(text);
      const segments = getObjValue(json, '.actions[0].updateEngagementPanelAction.content.transcriptRenderer.content.transcriptSearchPanelRenderer.body.transcriptSegmentListRenderer.initialSegments');
      console.log(segments);
    } catch (e) {
      console.log(e);
    }
  };


  const generateRequest = function (page, config) {
    var _a, _b, _c, _d;
    var params = (_a = page.split('"serializedShareEntity":"')[1]) === null || _a === void 0 ? void 0 : _a.split('"')[0];
    var visitorData = (_b = page.split('"VISITOR_DATA":"')[1]) === null || _b === void 0 ? void 0 : _b.split('"')[0];
    var sessionId = (_c = page.split('"sessionId":"')[1]) === null || _c === void 0 ? void 0 : _c.split('"')[0];
    var clickTrackingParams = (_d = page === null || page === void 0 ? void 0 : page.split('"clickTrackingParams":"')[1]) === null || _d === void 0 ? void 0 : _d.split('"')[0];
    return {
      context: {
        client: {
          hl: (config === null || config === void 0 ? void 0 : config.lang) || 'fr',
          gl: (config === null || config === void 0 ? void 0 : config.country) || 'FR',
          visitorData: visitorData,
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)',
          clientName: 'WEB',
          clientVersion: '2.20200925.01.00',
          osName: 'Macintosh',
          osVersion: '10_15_4',
          browserName: 'Chrome',
          browserVersion: '85.0f.4183.83',
          screenWidthPoints: 1440,
          screenHeightPoints: 770,
          screenPixelDensity: 2,
          utcOffsetMinutes: 120,
          userInterfaceTheme: 'USER_INTERFACE_THEME_LIGHT',
          connectionType: 'CONN_CELLULAR_3G',
        },
        request: {
          sessionId: sessionId,
          internalExperimentFlags: [],
          consistencyTokenJars: [],
        },
        user: {},
        clientScreenNonce: generateNonce(),
        clickTracking: {
          clickTrackingParams: clickTrackingParams,
        },
      },
      params: params,
    };
  };


  const generateNonce = function () {
    var rnd = Math.random().toString();
    var alphabet = 'ABCDEFGHIJKLMOPQRSTUVWXYZabcdefghjijklmnopqrstuvwxyz0123456789';
    var jda = [
    alphabet + '+/=',
    alphabet + '+/',
    alphabet + '-_=',
    alphabet + '-_.',
    alphabet + '-_',
    ];
    var b = jda[3];
    var a = [];
    for (var i = 0; i < rnd.length - 1; i++) {
      a.push(rnd[i].charCodeAt(i));
    }
    var c = '';
    var d = 0;
    var m, n, q, r, f, g;
    while (d < a.length) {
      f = a[d];
      g = d + 1 < a.length;
      if (g) {
        m = a[d + 1];
      }
      else {
        m = 0;
      }
      n = d + 2 < a.length;
      if (n) {
        q = a[d + 2];
      }
      else {
        q = 0;
      }
      r = f >> 2;
      f = ((f & 3) << 4) | (m >> 4);
      m = ((m & 15) << 2) | (q >> 6);
      q &= 63;
      if (!n) {
        q = 64;
        if (!q) {
          m = 64;
        }
      }
      c += b[r] + b[f] + b[m] + b[q];
      d += 3;
    }
    return c;
  };


  const googlePreprocessing = (html) => {
    let matches = html.match(/window\.jsl\.dh\('eob_\d','([^']+)/g);
    if (matches) {
      let text = matches[1];
      text = text.replace(/\\x3d/g, '=');
      text = text.replace(/\\x3c/g, '<');
      text = text.replace(/\\x3e/g, '>');
      text = text.replace(/\\x22/g, '"');
      text = text.replace(/window\.jsl\.dh\('eob_.','/, '');
      return text;
    }
    return '';
  };


  const getConfig = function(){
    return new Promise(function(resolve, reject){
      chrome.runtime.sendMessage({cmd: 'api.getConfig'}, function(json){
        if (json.error) {
          resolve(null);
          return;
        }
        resolve(json.data);
      });
    });
  };


  const processGoogleSERP = function(dom){
    let serpData = [];
    let selector = '#ires div.g, #res div.g';
    let count = 0;
    $(selector, dom).map(function(i, node){
      let $node = $(node);
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
        count++;
        let data = getSERPItemData($node);
        serpData.push(data);
      }
    });
    return serpData;
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
      else {
        res.descriptionBold = [];
        res.description = '';
      }
      // console.log($node[0], res);
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


  var getDescriptionNode = function($node){
    var em = $node.find('em')[0];
    if (em) return $(em.parentNode);
    return $([]);
  };


  var getGoogleRelatedSearch = function(dom, conf){
    var list = [];
    if (conf && conf.relatedSearchSelectors) {
      for (var i = 0, len = conf.relatedSearchSelectors.length; i < len; i++) {
        var selItem = conf.relatedSearchSelectors[i];
        list = $(selItem.sel, dom);
        if (selItem.ignoreClosest) {
          selItem.ignoreClosest.map(function(filterSelector){
            if (list.closest(filterSelector)[0]) list = $([]);
          });
        }
        // console.log(selItem, list);
        if (list.length) break;
      }
    }
    var $mosaicItems = getRelatedSearchMosaicKeywords(dom, conf);
    $mosaicItems.map(function(i, item){
      list.push(item);
    });
    console.log(list);
    var keywords = [];
    for (var i = 0, len = list.length; i < len; i++) {
      var keyword = Common.cleanKeyword( list[i].textContent );
      keywords.push(keyword.toLowerCase());
    }
    console.log(keywords);
    return keywords;
  };


  var getRelatedSearchMosaicKeywords = function(dom, conf){
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


  var getPeopleAlsoSearch = function(dom, conf, extraHTML){
    var keywords = [];
    let domExtra = (new DOMParser()).parseFromString(extraHTML, "text/html");

    var $nodes = $("div[jsname=d3PE6e] div[data-ved]", domExtra);
    $nodes.each(function( index ) {
      var keyword = this.textContent;
      keywords.push(keyword);
    });
    return keywords;
  };


  var cleanHTML = function( html, filter ){
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/<style[\s\S]*?\/style>/ig, '');
    html = html.replace(/<noscript[\s\S]*?\/noscript>/ig, '');
    html = html.replace(/onload=".*?"/ig, '');
    if (filter && filter.image) {/*...*/}
    else html = html.replace(/<img[^>]*>/ig, '');
    if (filter && filter.form) {}
    else html = html.replace(/<form [\s\S]+?<\/form>/ig, '');
    return html;
  };


  var clearText = function(text){
    if (!text) return '';
    var punctRE = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\/:;<=>?@\[\]^_`{|}~]/g;
    text = text
            .replace(punctRE, '')
            .replace(/\.(\s|$)/g, ' ')
            .replace(/ - /g, ' ')
            .replace(/\s+/g, ' ');
    text = $.trim(text);
    return text;
  };


  const renderSelectOptions = (selectNode, list, selected) => {
    for (const key in list) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = list[key];
      if (selected && selected === key) option.selected = true;
      selectNode.appendChild(option);
    }
  };


  const prepareTemplateString = (params) => {
    if (!params) params = {};
    let subst = {};
    let hasEmptyFields = false;
    $sectionInputs.find('input').map((index, input) => {
      const val = input.value.trim().replace(/"/g, '');
      const name = input.dataset.name;
      subst[name] = val;
      if (val === '') hasEmptyFields = true;
    });
    $sectionInputs.find('textarea').map((index, input) => {
      const val = input.value.trim().replace(/"/g, '');
      const name = input.dataset.name;
      subst[name] = val;
      if (val === '') hasEmptyFields = true;
    });
    $sectionInputs.find('select').map((index, input) => {
      const val = input.value.trim().replace(/"/g, '');
      const name = input.dataset.name;
      subst[name] = val;
      console.log(name, val);
      if (val === '') hasEmptyFields = true;
    });
    $sectionGlobal.find('select').map((index, select) => {
      let val = select.value;
      const name = select.dataset.name;
      if (name === 'tone_of_voice') {
        if (val === 'default') val = '';
        else val = `You have a ${globalVars.voiceTones[val]} tone of voice.`;
      }
      if (name === 'writing_style') {
        if (val === 'default') val = '';
        else val = `You have a ${globalVars.writingStyles[val]} writing style.`;
      }
      subst[name] = val;
    });
    if (Object.keys(templateVars).length) {
      for (let key in templateVars) {
        subst[key] = templateVars[key];
      }
    }
    if (!selectedTemplateData) return;
    let prompt = selectedTemplateData.prompt;
    for (const key in subst) {
      const re = new RegExp(`{${key}}`, 'g');
      prompt = prompt.replace(re, subst[key]);
    }
    if (!params.leavePrompt) promptTextarea.value = prompt;
    return {
      hasEmptyFields,
      prompt
    };
  };


  const initUI = () => {
    $('.btn-close').click(function(e){
      post('widget.close');
    });

    $sectionGlobal.on('change', 'select', function(e){
      prepareTemplateString();
      this.removeAttribute('pristine');
      const name = this.dataset.name;
      setStorage(name, this.value);
    });

    $sectionInputs.on('keyup', 'input, textarea', function(e){
      prepareTemplateString();
      this.removeAttribute('pristine');
    });

    $sectionInputs.on('change', 'input, select', function(e){
      prepareTemplateString();
      this.removeAttribute('pristine');
    });

    categorySelect.addEventListener('change', () => {
      reset();
      subCategorySelect.innerHTML = '<option value="">Select a sub-category</option>';
      templateSelect.innerHTML = '<option value="">Select a template</option>';
      subCategorySelect.disabled = true;
      templateSelect.disabled = true;
      executeTemplateButton.disabled = true;

      const selectedCategory = categorySelect.value;
      if (selectedCategory !== 'Choose a category') {
        API.openAIFetchCategories(source).then(categories => {
          const subcategories = categories[selectedCategory].subcategories;
          for (const subcategory in subcategories) {
            const option = document.createElement('option');
            option.value = subcategory;
            option.textContent = subcategories[subcategory];
            subCategorySelect.appendChild(option);
          }
          subCategorySelect.disabled = false;
        });
      }
    });

    subCategorySelect.addEventListener('change', () => {
      reset();
      templateSelect.innerHTML = '<option value="">Select a template</option>';
      templateSelect.disabled = true;
      executeTemplateButton.disabled = true;

      const selectedSubCategory = subCategorySelect.value;
      if (selectedSubCategory) {
        API.openAIFetchTemplates(selectedSubCategory, source).then(templates => {
          for (const template in templates) {
            const item = templates[template];
            const option = document.createElement('option');
            option.value = (item.paid ? 'premium_' : '') + template;
            let html = templates[template].name;
            if (item.paid) html += ' (&#128142;)';
            option.innerHTML = html;
            templateSelect.appendChild(option);
          }
          templateSelect.disabled = false;
        });
      }
    });

    templateSelect.addEventListener('change', function(){
      executeTemplateButton.disabled = !templateSelect.value;
      chooseTemplate();
    });

    executeTemplateButton.addEventListener('click', () => {
      const res = prepareTemplateString({leavePrompt: true});
      if (res.hasEmptyFields) {
        alert('Please fill out all required fields.');
        return;
      }
      const prompt = promptTextarea.value;
      post('choose-template', {prompt: prompt});
      post('widget.close');
    });
  };


  async function chooseTemplate() {
    reset();
    const selectedTemplate = templateSelect.value;
    $('#section-upgrade').addClass('hidden');
    if (selectedTemplate) {
      let premium = selectedTemplate.indexOf('premium_') === 0;
      let id = selectedTemplate.replace('premium_', '');
      if (!premium || (plan && 'silver gold platinum'.indexOf(plan.plan) !== -1)) {
        const response = await API.openAIFetchTemplate(id, source);
        selectedTemplateData = response;
        processTemplate(response);
      }
      else {
        $('#section-upgrade').removeClass('hidden');
        const actions = {
          nokey: {
            text: 'Sign up for an API key',
            url: 'https://keywordseverywhere.com/first-install-addon.html',
          },
          noplan: {
            text: 'Purchase a Subscription',
            url: 'https://keywordseverywhere.com/ctl/subscriptions?apiKey=' + settings.apiKey,
          },
          bronze: {
            text: 'Upgrade Your Subscription',
            url: 'https://keywordseverywhere.com/ctl/subscriptions/plan-info?apiKey=' + settings.apiKey
          },
        }
        let action = 'noplan';
        if (!settings.apiKey) action = 'nokey';
        else if (plan === 'bronze') action = 'bronze';
        const $btn = $('#upgrade-action-btn');
        $btn.text(actions[action].text);
        $btn[0].onclick = function(){
          chrome.tabs.create({
            url: actions[action].url
          });
        }
        WidgetHelpers.resize({heightOnly: true});
      }
    } else {
      promptTextarea.value = '';
      selectedTemplateData = null;
    }
  }


  function populateCategories() {
    API.openAIFetchCategories(source).then(categories => {
      for (const category in categories) {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = categories[category].name;
        categorySelect.appendChild(option);
      }
      categorySelect.dispatchEvent(new Event('change'));
    });
  }


  const getURLParameter = (sParam, useHash) => {
    let qs = window.location.search.substring(1);
    if (useHash) qs = window.location.hash.substring(1);
    qs = qs.split('+').join(' ');
    let params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;
    while (tokens = re.exec(qs)) {
      params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }
    return params[sParam];
  };


  const post = (cmd, data) => {
    window.parent.postMessage({cmd: `xt-openai-${cmd}`, data: data}, '*');
  };


  return {
    init: init
  };

})().init();
