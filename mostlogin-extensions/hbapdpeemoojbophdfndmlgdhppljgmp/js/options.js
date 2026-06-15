(function(){

  var settings = {};
  var status;


  var init = function(){
    initUI();
    // bug in FF49: no reply on first tab load
    var timer = setTimeout(function(){
      document.location.reload();
    }, 500);
    chrome.storage.local.get(null, function( data ){
      clearTimeout(timer);
      if (data.settings) settings = data.settings;
      getPlan();
      updateSettingsBreakdown();
      processSettings();
      populateCountries();
      populateCurrencies();
      calculateScrollingPositions();
    });
  };


  Object.defineProperty(String.prototype, 'capitalize', {
    value: function() {
      return this.charAt(0).toUpperCase() + this.slice(1);
    },
    enumerable: false
  });


  var getPlan = function(){
    return new Promise(function(resolve, reject){
      chrome.runtime.sendMessage({cmd: 'api.getPlan'}, function(json){
        console.log(json);
        var hideGetKey = false;
        if (json.error || json.ext_error) {
          resolve(null);
          if (json.data === 'subscription not found') {
            $('#purchase-plan-btn')
              .removeClass('hidden')
              .attr('href', `https://keywordseverywhere.com/ctl/subscriptions?apiKey=${settings.apiKey}`);
            hideGetKey = true;
          }
          else {
            $('#get-api-key-btn').removeClass('hidden');
            $('#purchase-plan-btn').addClass('hidden')
            $('#plan-info').addClass('hidden');
            return;
          }
        }
        var plan = json.data.plan || '';
        var planImg = plan;
        if (!plan) planImg = 'legacy';
        var planText = (plan).capitalize();
        var emailText = json.data.email || '';
        if (plan === 'legacy') {
          planText = `<a href="https://keywordseverywhere.com/how-to-purchase.html" target="_blank">No Plan Purchased</a>`;
        }
        else if (!plan) {
          planText = `<a href="https://keywordseverywhere.com/ctl/subscriptions?apiKey=${settings.apiKey}" target="_blank">No Plan Purchased</a>`;
        }
        else {
          planText = `<a href="https://keywordseverywhere.com/ctl/subscriptions/plan-info?apiKey=${settings.apiKey}" target="_blank">${planText}</a>`;
          emailText = `<a href="https://keywordseverywhere.com/ctl/subscriptions/plan-info?apiKey=${settings.apiKey}" target="_blank">${emailText}</a>`;
          $('#purchase-plan-btn').addClass('hidden');
        }
        var creditsText = json.data.credits;
        if (!creditsText) creditsText = 'No credits';
        else creditsText = creditsText.toLocaleString() + ' credits remaining';
        $('#plan-info').removeClass('hidden');
        $('#email').html( emailText );
        $('#credits').text( creditsText );
        $('#plan-info img').attr('src', `https://keywordseverywhere.com/img/plans/${planImg}.png`)
        $('#plan').html(planText);
        $('#get-api-key-btn').toggleClass('hidden', !!plan || hideGetKey);
        resolve(json.data);
      });
    });
  };


  var updateSettingsBreakdown = function(){
    $('[data-breakdown]').map(function(i, node){
      var name = this.dataset.breakdown;
      var setting = settings[name];
      var html = '';
      if (name === 'metricsList') {
        for (var key in setting) {
          if (setting[key]) {
            var text = key;
            if (text === 'vol') text = 'Volume';
            if (text === 'cpc') text = 'CPC';
            if (text === 'comp') text = 'Competition';
            if (text === 'trend') text = 'Trend';
            html += renderBreakdownItem(text);
          }
        }
      }
      else if (name === 'highlight') {
        var isOn = false;
        'highlightVolume highlightCPC highlightComp'.split(' ').map(function(key){
          if (settings[key]) {
            isOn = true;
            html += renderBreakdownItem(key);
          }
        });
        if (isOn) html += renderBreakdownItem(settings.highlightColor, {bg: settings.highlightColor});
      }
      else if (name.startsWith('sourceList')) {
        var type = name.replace('sourceList-', '');
        for (var src in settings.sourceList) {
          if (settings.sourceList[src] && SourceList[src].type === type) {
            html += renderBreakdownItem(SourceList[src].name);
          }
        }
      }
      else if (name === 'misc') {
        'showAutocompleteButton showChartsForGoogleTrends showChatGPTactions showDifficultyMetrics showExportButton showGoogleMetrics showGoogleTraffic showGoogleTrendChart showMetricsForSuggestions showYoutubeAdvancedMetrics showAddAllButton'.split(' ').map(function(s){
          if (settings[s]) {
            html += renderBreakdownItem(s);
          }
        });
      }
      else {
        html = renderBreakdownItem(setting);
      }
      node.innerHTML = html;
    });
  };


  var renderBreakdownItem = function(value, params){
    var style = '';
    var names = {
      showAutocompleteButton: 'Find Keywords',
      showChartsForGoogleTrends: 'Trends Chart',
      showChatGPTactions: 'ChatGPT Continue',
      showDifficultyMetrics: 'Difficulty Metrics',
      showExportButton: 'Show Export Button',
      showGoogleMetrics: 'Link Metrics',
      showGoogleTraffic: 'Traffic Metrics',
      showGoogleTrendChart: 'Google Trends Chart',
      showMetricsForSuggestions: 'Autocomplete Metrics',
      showYoutubeAdvancedMetrics: 'YouTube Metrics',
      showAddAllButton: 'Show Add All Button'
    };
    var name = value;
    if (names[value]) name = names[value];
    if (params && params.bg) style = `background-color: ${params.bg}`;
    var html = `
      <span
        class="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-800" style="${style}"
        >${name}</span>`;
    return html;
  };


  var checkMaintenance = function(){
    chrome.runtime.sendMessage({
      cmd: 'api.isOnline'
    }, function(response){
      if (!response.data) {
        $('.maintenance-msg')
          .removeClass('hidden')
          .text(response.message);
      }
    });
  };


  var injectIframe = function(params){
    var version = chrome.runtime.getManifest().version;
    var src = 'https://keywordseverywhere.com/ke/kesettings.php?apiKey=' + params.apiKey + '&version=' + version + '&t=' + Date.now() ;
    $('#iframe-root').html('');
    $('<iframe/>').attr('src', src).appendTo($('#iframe-root'));
  };


  var initUI = function(){
    // checkMaintenance();

    const keToggle = document.querySelector("[data-ke-toggle]");
    if (!(keToggle && keToggle.dataset.keToggle === "tabs")) {
      return;
    }
    const targets = keToggle.querySelectorAll("[data-ke-target]");
    for (const trigger of targets) {
      trigger.addEventListener("click", function(e) {
        const button = e.currentTarget.closest("[data-ke-target]");
        const target = document.getElementById(button.dataset.keTarget.slice(1));
        if (button) {
          const bSiblings = siblings(button, ".text-primary");
          bSiblings.forEach((s) => removeClass(s, "bg-gray-100 text-primary"));
          addClass(button, "bg-gray-100 text-primary");
        }
        if (target) {
          const tSiblings = siblings(target, ":not(.hidden)");
          tSiblings.forEach((s) => addClass(s, "hidden translate-x-full"));
          removeClass(target, "hidden translate-x-full");
          
          // Show/hide current settings section based on API settings
          const currentSettings = document.getElementById("current-settings");
          if (currentSettings) {
            if (target.id === "api-settings") {
              removeClass(currentSettings, "hidden");
            } else {
              addClass(currentSettings, "hidden");
            }
          }
        }
      });
    }

    status = new Helpers.Status( $('#status'), {
      show: {method: 'slideDown', params: []},
      hide: {method: 'slideUp', params: []}
    } );

    $('input, select').change(function(e){
      // custom handler for sources list
      if (this.dataset.source) return;
      if (this.dataset.metric) return;
      if (this.dataset.selector) return;
      var id = this.id;
      if (!id) return;
      if (this.type === 'checkbox') settings[id] = this.checked;
      else if (this.type === 'number') {
        settings[id] = parseFloat(this.value) || '';
      }
      else if (this.type === 'radio') {
        var key = this.name.replace('input-', '');
        settings[key] = this.value;
      }
      else settings[id] = $.trim(this.value);
      saveSettings();
      updateSettingsBreakdown();
    });

    $('.section-toggle').change(function(e){
      var selector = this.dataset.selector;
      var $inputs = $(selector + ' input[type=checkbox]');
      var checked = this.checked;
      $inputs.map(function(i, node){
        node.checked = checked;
        if (selector === '#miscList') {
          settings[node.id] = checked;
        }
        else settings.sourceList[node.dataset.source] = checked;
      });
      saveSettings();
    });

    $('#apiKey').keyup(function(e){
      if (e.keyCode === 13) {
        $(this).trigger('change');
        $('#validate').trigger('click');
      }
    });

    $('#validate').click(function(e){
      if (!settings.apiKey) {
        status.error('API key is empty', 3000);
        return;
      }
      chrome.runtime.sendMessage({
        cmd: 'api.checkApiKey',
        data: {key: settings.apiKey}
      }, function(json){
        if (json.error) status.error(json.data, 5000);
        else {
          getPlan();
          if (json.data) {
            status.success('Your API key has been successfully validated', 3000);
            $('.error-msg').addClass('hidden');
          }
          else if (json.data === false) {
            status.error('The API Key is not valid. If you have generated it within the last 10 minutes, please wait till 10 minutes are up and check again. If not, then please email me at help@keywordseverywhere.com');
          }
          else {
            status.error('Please refresh the page or check your internet connection. If you continue having issues please email help@keywordseverywhere.com');
          }
        }
      });
    });

    $('#reset-btn').click(function() {
      $('#reset-modal').fadeIn();
    });

    $('#reset-no').click(function() {
      $('#reset-modal').fadeOut();
    });

    $('#reset-confirm').click(function() {
      chrome.runtime.sendMessage({
          cmd: 'settings.reset',
          data: {
            apiKey: settings.apiKey
          }
        }, function(){
        document.location.reload();
      });
    });

    $('#export-btn').click(function() {
      $('#export-modal').fadeIn();
    });

    $('#export-with-api').click(function() {
      downloadSettings(true);
      $('#export-modal').fadeOut();
    });

    $('#export-without-api').click(function() {
      downloadSettings(false);
      $('#export-modal').fadeOut();
    });

    $('#import-btn').click(function() {
      $('#import-file').click();
    });

    $('#import-file').change(function(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          try {
            const importedSettings = JSON.parse(e.target.result);
            const apiKey = settings.apiKey;
            settings = importedSettings;
            if (apiKey && !settings.apiKey) settings.apiKey = apiKey;
            saveSettings(function(){
              document.location.reload();
            });
          } catch (err) {
            alert('Failed to import settings: Invalid JSON format.');
          }
        };
        reader.readAsText(file);
      }
    });

    $('#export-modal').click(function(event) {
      if (event.target === this) {
        $(this).fadeOut();
      }
    });
  };


  function downloadSettings(includeApiKey) {
    const today = new Date().toISOString().slice(0, 10); // Format as YYYY-MM-DD
    let filename;
    let exportData = { ...settings };

    if (!includeApiKey) {
      delete exportData.apiKey;
      filename = `ke-settings-${today}-no-api-key.json`;
    } else {
      filename = `ke-settings-${today}-contains-api-key.json`;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  /**
   * Calculate the scrolling position of all sections, should be done after the settings have been loaded
   * because the DOM is updated with multiple supported websites and other elements.
   **/
  var calculateScrollingPositions = function() {
    $('.scrollto').each(function(i, el) {
      var target = el.hash;
      $(el).data('scrolling-position', $(target).offset().top);
    });
  }


  var processSettings = function(){
    if (!settings.apiKey) {
      status.error('You only need to enter an API key if you want access to our <a href=" https://keywordseverywhere.com/start.html" target="_blank">paid features</a>');
    }
    processHighlightSettings();
    if (settings.apiKey) $('#apiKey').val(settings.apiKey);
    $('[name=input-dataSource][value=' + settings.dataSource + ']').prop('checked', true);
    $('#showAddAllButton').prop('checked', !!settings.showAddAllButton);
    $('#showExportButton').prop('checked', !!settings.showExportButton);
    $('#showChatGPTactions').prop('checked', !!settings.showChatGPTactions);
    $('#showMetricsForSuggestions').prop('checked', !!settings.showMetricsForSuggestions);
    $('#showChartsForGoogleTrends').prop('checked', !!settings.showChartsForGoogleTrends);
    $('#showAutocompleteButton').prop('checked', !!settings.showAutocompleteButton);
    $('#showDifficultyMetrics').prop('checked', !!settings.showDifficultyMetrics);
    $('#showGoogleTraffic').prop('checked', !!settings.showGoogleTraffic);
    $('#showGoogleMetrics').prop('checked', !!settings.showGoogleMetrics);
    $('#showGoogleTrendChart').prop('checked', !!settings.showGoogleTrendChart);
    $('#showYoutubeAdvancedMetrics').prop('checked', !!settings.showYoutubeAdvancedMetrics);
    $('#defaultPopupAction').val(settings.defaultPopupAction);
    $('#googlePos').val(settings.googlePos);

    $('#sourceList').append(getSourceListTable('site', true));
    $('#widgetsList').append(getSourceListTable('widget', false));
    for (var key in settings.metricsList) {
      var checked = settings.metricsList[key];
      $('input[data-metric="' + key + '"').prop('checked', checked);
    }
    initSourceListClickHandlers();
    initMeticsListClickHandlers();

    $('.section-toggle').map(function(i, node){
      var selector = node.dataset.selector;
      var off = true;
      $(selector + ' input[type=checkbox]').map(function(j, input){
        if (input.checked) off = false;
      });
      node.checked = !off;
    });
  };

  var getSourceListTable = function(type, useThreeColumns) {
    const items = [];

    for (var key in SourceList) {
      var item = SourceList[key];
      if (item.type !== type) continue;

      var name = item.name;
      var html = $('<div />', {
        class: "border-b border-b-gray-300 py-4",
        html: getSourceInputHTML(key, name)
      });

      items.push(html);
    }

    // If not using 3 columns, return items as-is
    if (!useThreeColumns) {
      return items;
    }

    // 3-column layout for sourceList
    const columns = [[], [], []]; // 3 columns

    // Distribute items across 3 columns
    items.forEach((item, index) => {
      const columnIndex = index % 3;
      columns[columnIndex].push(item);
    });

    // Create the 3-column layout
    const container = $('<div />', {
      style: "display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; align-items: start;"
    });

    columns.forEach(columnItems => {
      const column = $('<div />', {
        style: "display: flex; flex-direction: column; gap: 16px;"
      });
      columnItems.forEach(item => {
        // Make each item have consistent height
        item.css({
          'min-height': '60px',
          'display': 'flex',
          'align-items': 'center'
        });
        column.append(item);
      });
      container.append(column);
    });

    return container;
  };


  var processHighlightSettings = function(){
    'highlightVolume highlightCPC highlightComp'.split(' ').map(function(key){
      var isChecked = !!settings[key];

      ['', 'Sec'].map(function(suffix){
        var condId = key + 'Cond' + suffix;
        var valId = key + 'Value' + suffix;
        $('#' + key).prop('checked', isChecked);
        if (typeof settings[condId] !== 'undefined') {
          $('#' + condId).val( settings[condId] );
        }
        if (typeof settings[valId] !== 'undefined' && settings[valId] !== '') {
          $('#' + valId).val( settings[valId] );
        }
      });

      /**
       * Open the highlighting conditions for the particular setting
       **/
      if (isChecked) {
        $('#' + key).parent('.group-row').next().addClass('open');
      }

      /**
       * Enable collapse on toggle change
       **/
      $('#' + key).on('change', function(e) {
        var target = e.target;
        var row = $(target).parent('.group-row').next();

        if (target.checked) {
          row.addClass('open');
        } else {
          row.removeClass('open');
        }
      });
    });
    if (settings.highlightColor) $('#highlightColor').val(settings.highlightColor);
  };


  var getSourceInputHTML = function( key, name ) {
    var checked = '';
    if (settings.sourceList && settings.sourceList[key]) {
      checked = 'checked';
    }
    var html = `
      <label
        for="${key}"
        class="flex w-full cursor-pointer items-center justify-between"
      >
        <input
          type="checkbox"
          class="peer sr-only"
          id="${key}"
          data-source="${key}"
          ${checked}
        />
        <span class="flex-1 text-sm font-medium"
          >${name}</span
        >
        <div
          class="relative h-6 w-11 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full"
        ></div>
      </label>
    `;
    return html;


    var $input = $('<input/>', {
      type: "checkbox",
      class: "toggler",
      id: key
    });

    $input.attr('data-source', key);

    if (settings.sourceList && settings.sourceList[key]) {
      $input.attr('checked', true);
    }

    var html = ['<label for="' + key + '" class="label">' + name + '</label>', $input];
    return html;
  };


  var initSourceListClickHandlers = function(){
    $('#sourceList input[type=checkbox], #widgetsList input[type=checkbox]').change(function(e){
      var checked = this.checked;
      var src = this.dataset.source;
      settings.sourceList[src] = checked;
      saveSettings();
      updateSettingsBreakdown();
    });
  };


  var initMeticsListClickHandlers = function(){
    $('#metricsList input[type=checkbox]').change(function(e){
      var checked = this.checked;
      var metric = this.dataset.metric;
      settings.metricsList[metric] = checked;
      saveSettings();
      updateSettingsBreakdown();
    });
  };


  var populateCountries = function(){
    chrome.runtime.sendMessage({cmd: 'api.getCountries'}, function(json){
      if (!json || !Object.keys(json).length) {
        status.error('An error has occured');
        return;
      }
      for (var key in json) {
        var $option = $('<option/>')
          .attr('value', key)
          .text(json[key]);
        if (settings.country === key) $option.attr('selected', 'true');
        $option.appendTo($('#country'));
      }
    });
  };


  var populateCurrencies = function(){
    chrome.runtime.sendMessage({cmd: 'api.getCurrencies'}, function(json){
      if (!json || !Object.keys(json).length) {
        status.error('An error has occured');
        return;
      }
      for (var key in json) {
        var $option = $('<option/>')
          .attr('value', key)
          .text(json[key]);
        if (settings.currency === key) $option.attr('selected', 'true');
        $option.appendTo($('#currency'));
      }
    });
  };


  var saveSettings = function(cbContinue){
    chrome.storage.local.set({settings: settings}, function(){
      if (cbContinue) cbContinue();
    });
    chrome.runtime.sendMessage({cmd: 'settings.update'});
  };


  const removeClass = (element, className) => {
    const classes = className.split(" ");
    classes.forEach((c) => element.classList.remove(c));
  };


  const addClass = (element, className) => {
    const classes = className.split(" ");
    classes.forEach((c) => element.classList.add(c));
  };


  const siblings = (element, matchTest) => {
    let siblings2 = [];
    let sibling = element.parentNode.firstChild;
    while (sibling) {
      if (sibling.nodeType === 1 && matchTest && sibling.matches(matchTest) && sibling !== element) {
        siblings2.push(sibling);
      }
      sibling = sibling.nextSibling;
    }
    return siblings2;
  };

  return {
    init: init
  };

})().init();
