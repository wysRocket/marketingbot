var ToolSec = (function(){

  var vendor = (navigator.userAgent.match(/(Chrome|Firefox)/) || [])[1];

  var source = 'ggmaps';
  var isMonitoring = false;
  var mapItems = new Set();
  var isGoogleMaps = document.location.href.indexOf('google.com/maps') !== -1;


  var init = function(){
    var settings = Starter.getSettings();
    if (!settings.sourceList[source]) return;

    if (isMonitoring) return;
    isMonitoring = true;
    scanForMapItems();
    initWindowMessaging();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              scanForMapItemsInNode(node);
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
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
        var selector = '#xt-gmaps-promo-root';
        if (source !== 'google_maps') return;
        if (height <= 0) return;
        if (data.isEmpty) height = 0;
        $(selector + ' iframe').height(height);
      }
    }, false);
  };

  var scanForMapItems = function() {
    const mapSelectors = [
      "div[jsdata] > div[data-ved] div[data-id][data-hveid]",
      "a[data-cid]:not([aria-hidden])",
      "div.fontBodyMedium > div > div.fontHeadlineSmall",
      "[data-result-index]",
      "[data-entity-id]"
    ];
    
    mapSelectors.forEach(selector => {
      const items = document.querySelectorAll(selector);
      items.forEach(item => {
        if (isValidMapItem(item) && !mapItems.has(item)) {
          injectWidgetIntoMapItem(item);
          mapItems.add(item);
        }
      });
    });

    injectSerpPromoIframe();
  };

  var scanForMapItemsInNode = function(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (isValidMapItem(node) && !mapItems.has(node)) {
      injectWidgetIntoMapItem(node);
      mapItems.add(node);
    }
    const mapSelectors = [
      "div[jsdata] > div[data-ved] div[data-id][data-hveid]",
      "a[data-cid]:not([aria-hidden])",
      "div.fontBodyMedium > div > div.fontHeadlineSmall",
      "[data-result-index]",
      "[data-entity-id]"
    ];
    
    mapSelectors.forEach(selector => {
      const items = node.querySelectorAll(selector);
      items.forEach(item => {
        if (isValidMapItem(item) && !mapItems.has(item)) {
          injectWidgetIntoMapItem(item);
          mapItems.add(item);
        }
      });
    });

    injectSerpPromoIframe();
  };

  var isValidMapItem = function(element) {
    if (!element || !element.closest) return false;
    // Check if it's a Google Search result with maps (primary selector)
    if (element.hasAttribute('data-id') && element.hasAttribute('data-hveid')) {
      const parentWithJsdata = element.closest('div[jsdata]');
      const parentWithDataVed = element.closest('div[data-ved]');
      if (parentWithJsdata && parentWithDataVed) {
        return true;
      }
    }
    if (element.hasAttribute('data-cid') && !element.hasAttribute('aria-hidden')) {
      return true;
    }
    if (element.classList.contains('fontHeadlineSmall')) {
      // Verify it's within the expected structure: div.fontBodyMedium > div > div.fontHeadlineSmall
      const parent = element.parentElement;
      const grandParent = parent && parent.parentElement;
      if (grandParent && grandParent.classList.contains('fontBodyMedium')) {
        return true;
      }
    }
    // Check if it's a Google Maps website item
    if (element.hasAttribute('data-result-index') || element.hasAttribute('data-entity-id')) {
      // Additional validation for Maps website
      const hasMapContent = element.querySelector('[role="button"], .section-result-content, .section-result-text');
      if (hasMapContent) {
        return true;
      }
    }
    
    return false;
  };


  var fetchMapData = function(url, callback) {
    var xhr = new XMLHttpRequest;
    xhr.onreadystatechange = function() {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        var status = xhr.status;
        if (!(status === 0 || status >= 200 && status < 400)) {
          return "";
        }
        try {
          var response = xhr.response;
          var appStateStart = response.indexOf("window.APP_INITIALIZATION_STATE=");
          var appFlagsStart = response.indexOf("window.APP_FLAGS", appStateStart);
          var appStateJson = response.substring(appStateStart + 32, appFlagsStart);
          var appState = JSON.parse(appStateJson.slice(0, -1));
          var previewUrl = "";
          try {
            var doc = new DOMParser().parseFromString(response, "text/html");
            var previewLink = doc.querySelector('link[href*="/maps/preview/place"]');
            if (previewLink) previewUrl = previewLink.getAttribute("href") || "";
          } catch (e) {
            previewUrl = "";
          }
          callback({ appState: appState, previewUrl: previewUrl });
        } catch (e) {
          callback({ appState: null, previewUrl: "" });
        }
      }
    };
    xhr.open("GET", url);
    xhr.send();
  };

  var fetchPreviewData = function(url, callback) {
    fetch(url)
      .then(function(res) { return res.text(); })
      .then(function(text) {
        try {
          if (text && text.length > 5) {
            var parsed = JSON.parse(text.substring(5));
            callback(parsed);
            return;
          }
        } catch (e) {}
        callback(null);
      })
      .catch(function() { callback(null); });
  };

  var applyBusinessDataFromParsed = function(parsed, data, linkElement) {
    if (!parsed) return false;
    var details =
      parsed[6] ||
      (parsed[0] && parsed[0][1] && parsed[0][1][0] && parsed[0][1][0][14]) ||
      (parsed[0] && parsed[0][1] && parsed[0][1][1] && parsed[0][1][1][14]);
    if (!details) return false;

    if (details[13] && Array.isArray(details[13])) {
      data.category = details[13].join(", ");
    } else {
      data.category = details[13] || "";
    }

    data.title = details[11] || data.title;
    data.address = Array.isArray(details[2]) ? details[2].join(" - ") : (details[2] || "");
    data.location = Array.isArray(details[2]) ? (details[2][0] || "") : "";
    data.rating = details[4] ? (details[4][7] || "") : "";
    data.reviews = details[4] ? (details[4][8] || "") : "";
    data.website = details[7] && details[7][0] ? details[7][0] : "";
    data.phone = details[178] && details[178][0] && details[178][0][3] ? details[178][0][3] : "";

    if (linkElement && linkElement.href) {
      var placeIdMatch = linkElement.href.match(/ChIJ(.*?)(?=\\?)/i);
      if (placeIdMatch) {
        data.placeId = "ChIJ" + placeIdMatch[1];
      }
    }
    if (!data.placeId) {
      data.placeId = details[78] || "";
    }

    if (details[89] && typeof details[89] === "string" && details[89].startsWith("/")) {
      data.kgId = details[89];
    }

    if (details[9] && details[9][2] && details[9][3]) {
      var lat = details[9][2];
      var lng = details[9][3];
      if (typeof lat === "number" && typeof lng === "number") {
        data.coordinates = lat + ", " + lng;
      }
    }

    if (details[181] && details[181][5]) {
      data.businessProfileId = details[181][5];
    } else if (details[227] && details[227][0] && details[227][0][5]) {
      data.businessProfileId = details[227][0][5];
    }

    try {
      if (details[126] && details[126][4]) {
        data.cid = new URL(details[126][4]).searchParams.get("ludocid") || data.cid;
      } else if (details[126] && details[126][5]) {
        data.cid = new URL(details[126][5]).searchParams.get("ludocid") || data.cid;
      }
    } catch (e) {}

    return true;
  };


  var extractMapData = function(mapItem, callback) {
    const data = {
      title: '',
      category: '',
      rating: '',
      reviews: '',
      location: '',
      placeId: '',
      cid: '',
      businessProfileId: '',
      coordinates: '',
      kgId: '',
      website: '',
      phone: ''
    };
    
    try {
      const parentContainer = mapItem.closest('[jsaction*="mouseover:pane"]') || mapItem;
      // console.log('Parent container:', parentContainer);
      
      if (parentContainer) {
        const linkElement = parentContainer.querySelector('a[href*="/maps/place/"]');
        // console.log('Link element:', linkElement);
        var businessUrl;
        if (linkElement && linkElement.href) {
          businessUrl = linkElement.href;
          // console.log('Business URL:', businessUrl);
        }
        else if (parentContainer.dataset.cid) {
          const cid = parentContainer.dataset.cid;
          businessUrl = 'https://www.google.com/maps/?cid=' + cid;
          data.cid = cid;
        }
        if (businessUrl) {
          let titleElement = parentContainer.querySelector('.fontHeadlineSmall');
          if (!titleElement) titleElement = parentContainer.querySelector('[role=heading]');
          if (titleElement) {
            data.title = titleElement.innerText.trim();
          }


          fetchMapData(businessUrl, function(result) {
            // console.log('App state:', result);
            var applied = false;
            try {
              if (result && result.appState && result.appState[3]) {
                var payload = result.appState[3][6] || result.appState[3][5];
                if (payload && payload.length > 5) {
                  var parsed = JSON.parse(payload.substring(5));
                  applied = applyBusinessDataFromParsed(parsed, data, linkElement);
                }
              }
            } catch (e) {
              console.error('Error parsing business data:', e);
            }

            if (!applied && result && result.previewUrl) {
              var previewUrl = result.previewUrl;
              var absolutePreviewUrl = previewUrl.indexOf("http") === 0 ? previewUrl : (window.location.origin + previewUrl);
              fetchPreviewData(absolutePreviewUrl, function(previewParsed) {
                if (previewParsed) {
                  applyBusinessDataFromParsed(previewParsed, data, linkElement);
                }
                if (callback) callback(data);
              });
              return;
            }

            if (callback) callback(data);
          });
        } else {
          console.log('No link found in parent container');
          if (callback) callback(data);
        }
      } else {
        console.log('No parent container with jsaction found');
        if (callback) callback(data);
      }
      
    } catch (error) {
      console.error('Error extracting map data:', error);
      if (callback) callback(data);
    }
  };


  function isDarkMode() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return false;
    const [r, g, b] = match.slice(1).map(Number);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128; // lower means darker
  }


  var getSearchQuery = function() {
    var query = '';
    try {
      var params = new URLSearchParams(window.location.search || '');
      query = params.get('q') || '';
    } catch (e) {}
    if (!query) {
      var input = document.querySelector('input[name="q"]');
      if (input) query = input.value || '';
    }
    return query;
  };


  var getSerpMorePlacesAnchor = function() {
    var anchors = document.querySelectorAll('a.jRKCUd');
    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i];
      var text = (anchor.textContent || '').trim().toLowerCase();
      if (text.indexOf('more places') !== -1) return anchor;
    }
    return null;
  };


  var injectSerpPromoIframe = function() {
    if (isGoogleMaps) return;
    if (document.getElementById('xt-gmaps-promo-root')) return;

    var anchor = getSerpMorePlacesAnchor();
    if (!anchor) return;
    var parent = anchor.closest('.iNTie') || anchor.closest('h3') || anchor.parentElement;
    if (!parent) return;

    var query = getSearchQuery();
    var html = Common.renderIframeHTML({
      query: query,
      settingEnabled: true,
      darkMode: isDarkMode(),
      iframeSrcParam: 'google_maps',
    });
    var promoRoot = document.createElement('div');
    promoRoot.id = 'xt-gmaps-promo-root';
    promoRoot.innerHTML = html;
    parent.insertBefore(promoRoot, parent.firstChild);
  };


  var injectWidgetIntoMapItem = function(mapItem) {
    let targetContainer = mapItem;
    if (mapItem.classList.contains('fontHeadlineSmall')) {
      const parentContainer = mapItem.closest('[jsaction*="mouseover:pane"]');
      if (parentContainer) {
        targetContainer = parentContainer;
      }
    }
    if (targetContainer.querySelector('.xt-maps-widget')) return;
    
    const widget = document.createElement('div');
    widget.className = `xt-maps-widget ${isDarkMode() ? 'xt-maps-widget-dark' : ''}`;
    widget.style.cssText = `
      position: relative;
      // background: ${isDarkMode() ? 'black' : 'white'};
      // color: ${isDarkMode() ? 'white' : '#bfbfbf'} !important;
      border-radius: 4px;
      padding: 0px;
      font-size: 12px;
      z-index: 1000;
    `;
    
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'xt-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
    
    const style = document.createElement('style');
    style.textContent = `
      .xt-copy-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        margin-left: 3px;
        padding: 1px 2px;
        border-radius: 2px;
        transition: background-color 0.2s;
        vertical-align: middle;
      }
      .xt-copy-btn:hover {
        background-color: #f0f0f0;
      }
      .xt-maps-widget-dark .xt-widget-content {
        color: #9e9e9e;
      }
      .xt-widget-content {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        gap: 0px 12px;
        align-items: center;
        font-size: 14px;
        line-height: 20px;
        color: #5e5e5e;
        padding-left: 0px;
        padding-right: 6px;
      }
      [data-gmaps=true].xt-widget-content {
        padding-left: 24px;
      }
      [data-gmaps=false].xt-widget-content {
        padding-right: 14px;
      }
      .xt-widget-content strong {
        margin-right: 4px;
      }
      .xt-data-item {
        display: inline-flex;
        align-items: center;
        white-space: normal;
      }
      .xt-data-item .xt-copy-btn {
        margin-left: 3px;
        cursor: pointer;
        transition: opacity 0.2s ease;
      }
      .xt-data-item .xt-copy-btn:hover {
        opacity: 0.8;
      }
      .xt-data-item .xt-copy-btn:active {
        opacity: 0.6;
      }
      .xt-tooltip {
        position: absolute;
        background: #333;
        color: white;
        padding: 5px 8px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .xt-tooltip.show {
        opacity: 1;
      }
      .xt-data-item .xt-ke-logo {
        display: inline-block;
        width: 14px;
        height: 14px;
        position: relative;
        top: -2px;
        left: 0px;
      }
      .xt-ke-logo img {
        height: 14px;
        width: 14px;
      }
      .xt-action-links {
        font-size: 12px;
      }
      .xt-copy-all-link, .xt-export-all-link {
        color: #5e5e5e;
        cursor: pointer;
        transition: color 0.2s;
      }
      .xt-copy-all-link:hover, .xt-export-all-link:hover {
        text-decoration: underline;
      }
      .xt-maps-widget-dark .xt-copy-all-link,
      .xt-maps-widget-dark .xt-export-all-link {
        color: #9e9e9e;
      }
    `;
    document.head.appendChild(style);
    
    widget.innerHTML = '<div class="xt-widget-content"><div class="xt-data-item">Loading...</div></div>';
    
    targetContainer.appendChild(widget);
    
    extractMapData(mapItem, function(mapData) {
      let content = `<div class="xt-widget-content" data-gmaps="${isGoogleMaps ? true : false}">`;
      
      // content += `<a href="https://keywordseverywhere.com/local-seo.html" target="_blank" class="xt-ke-logo"><img class="" src="${chrome.runtime.getURL('/img/icon24.png')}"></a>`;

      const allDataCSV = [];
      allDataCSV.push(['Title', mapData.title]);
      allDataCSV.push(['Address', mapData.address]);
      if (mapData.category) {
        let categoryDisplay = mapData.category;
        if (!isGoogleMaps) {
          // For Google SERP, show first category + count
          const categories = mapData.category.split(', ');
          const firstCategory = categories[0];
          const additionalCount = categories.length - 1;
          categoryDisplay = additionalCount > 0 ? `${firstCategory} + ${additionalCount}` : firstCategory;
        }
        
        content += `<div class="xt-data-item">
          <div>
            <a href="https://keywordseverywhere.com/local-seo.html" target="_blank" class="xt-ke-logo"><img class="" src="${chrome.runtime.getURL('/img/icon24.png')}">
            </a>
            <span>Categories:</span> ${categoryDisplay}
            <button class="xt-copy-btn" data-copy="${mapData.category}">${copySVG}</button>
          </div>
        </div>`;
        allDataCSV.push(['Categories', mapData.category]);
      }

      if (mapData.coordinates) {
        if (isGoogleMaps) {
          content += `<div class="xt-data-item"><span>Coordinates:</span> <button class="xt-copy-btn" data-copy="${mapData.coordinates}">${copySVG}</button></div>`;
        }
        allDataCSV.push(['Coordinates', mapData.coordinates]);
      }

      if (mapData.rating || mapData.reviews) {
        if (isGoogleMaps) {
          let ratingText = '';
          if (mapData.rating) ratingText += `Rating:</span> ${mapData.rating}`;
          if (mapData.rating && mapData.reviews) ratingText += ' | ';
          if (mapData.reviews) ratingText += `Reviews:</span> ${mapData.reviews}`;
          content += `<div class="xt-data-item"><span>${ratingText}</div>`;
        }
        if (mapData.rating) allDataCSV.push(['Rating', mapData.rating]);
        if (mapData.reviews) allDataCSV.push(['Reviews', mapData.reviews]);
      }
      
      if (mapData.kgId) {
        if (isGoogleMaps) {
          content += `<div class="xt-data-item"><span>KG ID:</span> <button class="xt-copy-btn" data-copy="${mapData.kgId}">${copySVG}</button></div>`;
        }
        allDataCSV.push(['KG ID', mapData.kgId]);
      }
      
      if (mapData.placeId) {
        if (isGoogleMaps) {
          content += `<div class="xt-data-item"><span>Place ID:</span> <button class="xt-copy-btn" data-copy="${mapData.placeId}">${copySVG}</button></div>`;
        }
        allDataCSV.push(['Place ID', mapData.placeId]);
      }
      
      if (mapData.cid) {
        if (isGoogleMaps) {
          content += `<div class="xt-data-item"><span>CID:</span> <button class="xt-copy-btn" data-copy="${mapData.cid}">${copySVG}</button></div>`;
        }
        allDataCSV.push(['CID', mapData.cid]);
      }
      
      if (mapData.businessProfileId) {
        if (isGoogleMaps) {
          content += `<div class="xt-data-item"><span>Business Profile ID:</span> <button class="xt-copy-btn" data-copy="${mapData.businessProfileId}">${copySVG}</button></div>`;
        }
        allDataCSV.push(['Business Profile ID', mapData.businessProfileId]);
      }
      
      if (!mapData.title && !mapData.category && !mapData.rating && !mapData.reviews && !mapData.location && !mapData.placeId && !mapData.cid && !mapData.coordinates && !mapData.kgId && !mapData.businessProfileId) {
        // content += '<div class="xt-data-item">No data extracted</div>';
        $(widget).remove();
        return;
      }
      
      content += `<div class="xt-action-links">`;
      content += `<a href="#" class="xt-copy-all-link">Copy All</a>`;
      content += `<span class="xt-separator"> | </span>`;
      content += `<a href="#" class="xt-export-all-link">Export All</a>`;
      content += `</div>`;
      
      content += '</div>';
      
      if (!widget.isConnected) {
        targetContainer.appendChild(widget);
      }
      widget.innerHTML = content;
      initItemUI(widget, tooltip, allDataCSV, mapData);
      setTimeout(function(){
        if (!widget.isConnected) {
          targetContainer.appendChild(widget);
          widget.innerHTML = content;
          initItemUI(widget, tooltip, allDataCSV, mapData);
        }
      }, 3000);
    });
  };


  var initItemUI = function(widget, tooltip, allDataCSV, mapData){

    const copyButtons = widget.querySelectorAll('.xt-copy-btn');
    copyButtons.forEach(button => {
      button.addEventListener('mouseenter', function(e) {
        const textToCopy = this.getAttribute('data-copy');
        if (textToCopy) {
          tooltip.textContent = textToCopy;
          tooltip.style.display = 'block';
          tooltip.classList.add('show');

          const rect = this.getBoundingClientRect();
          const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
          const scrollY = window.pageYOffset || document.documentElement.scrollTop;

          tooltip.style.left = (rect.left + scrollX + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
          tooltip.style.top = (rect.top + scrollY - tooltip.offsetHeight - 5) + 'px';
        }
      });

      button.addEventListener('mouseleave', function(e) {
        tooltip.classList.remove('show');
        tooltip.style.display = 'none';
      });

      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const textToCopy = this.getAttribute('data-copy');
        if (textToCopy) {
          tooltip.textContent = 'Copied!';
          tooltip.style.display = 'block';
          tooltip.classList.add('show');
          const rect = this.getBoundingClientRect();
          const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
          const scrollY = window.pageYOffset || document.documentElement.scrollTop;

          tooltip.style.left = (rect.left + scrollX + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
          tooltip.style.top = (rect.top + scrollY - tooltip.offsetHeight - 5) + 'px';
          Common.clipboardWrite(textToCopy);
          setTimeout(() => {
            tooltip.classList.remove('show');
            setTimeout(() => {
              tooltip.style.display = 'none';
            }, 200);
          }, 1000);
        }
      });
    });

    const logoLink = widget.querySelector('.xt-ke-logo');
    if (logoLink) {
      logoLink.addEventListener('click', function(e) {
        e.stopPropagation();
        window.open('https://keywordseverywhere.com/local-seo.html', '_blank');
      });
    }

    const copyAllLink = widget.querySelector('.xt-copy-all-link');
    const exportAllLink = widget.querySelector('.xt-export-all-link');

    if (copyAllLink) {
      copyAllLink.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var csv = allDataCSV.map(([key, value]) => `"${key}","${value}"`).join('\n');
        Common.clipboardWrite(csv);
        this.textContent = 'Copied!';
        setTimeout(() => {
          this.textContent = 'Copy All';
        }, 1500);
      });
    }

    if (exportAllLink) {
      exportAllLink.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var csv = allDataCSV.map(([key, value]) => `"${key}","${value}"`).join('\n');
        var csvData = 'data:application/csv;charset=utf-8,' + '\ufeff' + encodeURIComponent(csv);
        var title = (mapData.title || '').toLowerCase().replace(/\s+/g, '-');
        const filename = `google-maps-${title}.csv`;
        Common.saveToFile(csvData, filename, 'text/csv');
        this.textContent = 'Exported!';
        setTimeout(() => {
          this.textContent = 'Export All';
        }, 1500);
      });
    }
  };


  var copySVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;


  var getSource = function(){
    return source;
  };

  return {
    init: init,
    getSource: getSource
  };

})();
