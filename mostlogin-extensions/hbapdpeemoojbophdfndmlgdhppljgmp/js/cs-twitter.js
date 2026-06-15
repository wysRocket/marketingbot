var Tool = (function(){

  var vendor = (navigator.userAgent.match(/(Chrome|Firefox)/) || [])[1];

  var source = 'xtwttr';

  var settings;
  var observer = null;

  var suggestionsTimer;
  var suggestionsList = {};
  var cachedSuggestions = {};

  var processTweetsTimer = null;
  var relatedTimer = null;

  var $widgetsRoot;
  var metricsResponse;

  var twitterData = [];
  var restoreScrollTop = 0;
  var loadMoreClicked = false;


  var init = function(){
    settings = Starter.getSettings();
    initWindowMessaging();
    $('body').addClass('xt-' + source);
    initMutationObserver( $('main[role=main]')[0] );
    setTimeout( function(){
      processPage();
      injectSidebarIframe();
      initSuggestions();
    }, 500 );
    initURLChangeListener(function(url){
      setTimeout( function(){
        processPage();
        injectSidebarIframe();
      }, 1000 );
    });
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
        var selector = '#xt-twitter-widgets-root';
        if (source === 'twitter_sidebar') selector = '#xt-twitter-sidebar-iframe';
        if (!selector) return;
        if (height <= 0) return;
        $(selector + ' iframe').height(height + 10);
      }
    }, false);
  };


  var initSuggestions = function(){
    var timer = setInterval(function(){
      if (!observer) {
        var node = $('#searchBoxContainer')[0];
        if (node) {
          clearInterval(timer);
          initMutationObserver(node);
        }
      }
    }, 500);
  };


  var processPage = function(){
    scrollCount = 0;
    twitterData = [];
    loadMoreClicked = false;
    processTweets();
  };


  var initWidgetsRoot = function(){
    if ($widgetsRoot) $widgetsRoot.remove();
    $widgetsRoot = $('<div>', {id: 'xt-twitter-widgets-root'});
    var $parent = $('[data-testid="sidebarColumn"] form').parent().parent().parent().parent().next();
    $widgetsRoot.insertAfter($parent);
    $widgetsRoot.html(`
      <div id="xt-twitter-stats-container"></div>
    `);
  };


  var isDarkMode = function(){
    var dark = document.body.style.backgroundColor === 'rgb(0, 0, 0)';
    var dim = document.body.style.backgroundColor === 'rgb(21, 32, 43)';
    return dark ? 'dark' : (dim ? 'dim' : false);
  };


  var injectSidebarIframe = function(){
    if ($('#xt-twitter-sidebar-iframe')[0]) return;
    var nav = document.querySelector('nav[aria-label="Primary"][role="navigation"]');
    if (!nav || !nav.parentNode) return;
    var html = Common.renderIframeHTML({
      query: '',
      settingEnabled: true,
      darkMode: isDarkMode(),
      iframeSrcParam: 'twitter_sidebar'
    });
    var root = document.createElement('div');
    root.id = 'xt-twitter-sidebar-iframe';
    root.innerHTML = html;
    nav.parentNode.insertBefore(root, nav);
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


  var processTweets = function(){
    var $tweets = $('[data-testid="tweet"]');
    // console.log($tweets);
    $tweets.map(function(i, tweet){
      var $tweet = $(tweet);
      var $spans = $tweet.find('span');
      var ignored = false;
      var pinned = !!$tweet.find('[data-testid="socialContext"]').text().match(/Pinned/);
      if (pinned) ignored = true;
      for (var i = 0, len = $spans.length; i < len; i++) {
        var span = $spans[i];
        var text = span.textContent.trim();
        if (text === 'Ad') ignored = 'ad';
        else if (text.indexOf('reposted') !== -1) ignored = 'resposted';
        else if (text === 'Pinned') ignored = 'pinned';
        if (ignored) break;
      }
      var url = getTweetURL($tweet);
      for (var i = 0, len = twitterData.length; i < len; i++) {
        var item = twitterData[i];
        if (url === item.url) return;
      }
      var str = $tweet.find('[aria-label][role=group]').attr('aria-label');
      var replies = parseInt((str.match(/(\d+) repl.*/) || [])[1] || 0);
      var reposts = parseInt((str.match(/(\d+) reposts?/) || [])[1] || 0);
      var likes = parseInt((str.match(/(\d+) likes?/) || [])[1] || 0);
      var views = parseInt((str.match(/(\d+) views?/) || [])[1] || 0);
      if (!views) ignored = 'noviews';
      twitterData.push({url: url, replies: replies, reposts: reposts, likes: likes, views: views, ignored: ignored});
    });
    calcStats();
  };


  var getTweetURL = function($tweet){
    var url = '';
    $tweet.find('a').map(function(i, a){
      var id = (a.href.match(/\/status\/(\d+)/) || [])[1];
      if (!url && id) url = a.href;
    });
    return url;
  };


  var getProfileInfo = function(){
    var $user = $('[data-testid="UserName"]');
    var links = $user.parent().find('[role=link]');
    var nameAndTwitterId = $user.text().split('@');
    var name = '';
    var twitterId = '';
    if (nameAndTwitterId.length === 3) {
      name = '@' + nameAndTwitterId[1];
      twitterId = nameAndTwitterId[2];
    }
    else if (nameAndTwitterId.length === 2) {
      name = nameAndTwitterId[0];
      twitterId = nameAndTwitterId[1];
    }
    twitterId = twitterId.replace('Follows you', '');
    var verifiedSVG = $user.find('svg')[0];
    var followers;
    var img = $(links[0]).find('img').attr('src');
    links.map(function(i, link){
      var followersText = link.textContent;
      if (followersText.indexOf('Followers') === -1) return;
      followersText = followersText.replace(/ Followers?/, '');
      followersText = followersText.replace(/,/g, '');
      followers = parseInt(followersText);
      if (followersText.indexOf('M') > 0) followers *= 1000000;
      if (followersText.indexOf('K') > 0) followers *= 1000;
    });
    return {
      name,
      twitterId,
      img,
      followers,
      verifiedSVG
    }
  };


  var calcStats = function(){
    var profileInfo = getProfileInfo();
    if (!profileInfo.twitterId) return;
    var maxIndex = 0;
    var maxViews = 0;
    twitterData.map(function(tweet, index){
      if (tweet.views > maxViews) {
        maxViews = tweet.views;
        maxIndex = index;
      }
    });
    var stats = {replies: 0, reposts: 0, likes: 0, views: 0, tweets: 0, maxViewsIndex: maxIndex};
    twitterData.map(function(tweet, index){
      if (index === maxIndex) return;
      if (tweet.ignored) return;
      stats.replies += tweet.replies;
      stats.reposts += tweet.reposts;
      stats.likes += tweet.likes;
      stats.views += tweet.views;
      stats.tweets++;
    });
    // console.log(stats);
    renderStats(stats, profileInfo, twitterData);
  };


  var renderStats = function(stats, profileInfo, twitterData){
    initWidgetsRoot();
    var avgViews = (stats.views / stats.tweets);
    var avgLikes = (stats.likes / stats.tweets);
    var avgReplies = (stats.replies / stats.tweets);
    var avgReposts = (stats.reposts / stats.tweets);
    var followerEngagementRate = (((avgLikes + avgReplies + avgReposts) / profileInfo.followers) * 100).toFixed(2);
    var imprEngagementRate = ( ( (avgLikes + avgReplies + avgReposts) / avgViews ) * 100 ).toFixed(2);
    var $widget = $('#xt-twitter-stats-container');
    var verifiedHTML = '';
    if (profileInfo.verifiedSVG) {
      verifiedHTML = profileInfo.verifiedSVG.outerHTML;
    }
    var len = twitterData.filter(function(item){
      return !item.ignored;
    }).length;
    if (len < 5) $widget.addClass('xt-twitter-not-enough');
    var dark = document.body.style.backgroundColor === 'rgb(0, 0, 0)';
    var dim = document.body.style.backgroundColor === 'rgb(21, 32, 43)';
    var darkValue = dark ? 'dark' : (dim? 'dim' : false);
    document.documentElement.setAttribute('dark', darkValue );
    var html = `
      <div class="xt-twitter-stats-header">
        <img src="${profileInfo.img}" class="${profileInfo.img ? '' : 'xt-hidden'}"/>
        <strong>${profileInfo.name} ${verifiedHTML}</strong><br>
        <span>@${profileInfo.twitterId}</span>
      </div>
      <a class="xt-twitter-stats-logo" href="https://keywordseverywhere.com/x-twitter-metrics.html" target="_blank"><img class="xt-ke-logo" src="${chrome.runtime.getURL('/img/icon24.png')}"></a>
      <div class="xt-twitter-stats-spinner xt-hidden">
        <img src="${chrome.runtime.getURL('img/spinner32.gif')}">
      </div>
      <div class="xt-twitter-stats-table">
        <div><span>Avg Impressions:</span> ${Common.formatNumber(avgViews)}</div>
        <div><span>Avg Likes:</span> ${Common.formatNumber(avgLikes)}</div>
        <div><span>Avg Replies:</span> ${Common.formatNumber(avgReplies)}</div>
        <div><span>Avg Retweets:</span> ${Common.formatNumber(avgReposts)}</div>
        <div><span>Follower Engagement Rate:</span> ${followerEngagementRate.toLocaleString()}%</div>
        <div><span>Impr Engagement Rate:</span> ${imprEngagementRate.toLocaleString()}%</div>
      </div>
      <div class="xt-center xt-twitter-stats-load-container">
        <span class="xt-hidden">Not enough Tweets loaded</span>
        <button class="xt-twitter-stats-center-more-btn xt-twitter-stats-more-btn" href="#">Analyze Metrics</button>
      </div>
      `;
    html += `<div class="xt-twitter-stats-more-container">
        <button class="xt-twitter-stats-more-btn" href="#"><small>Analyze More Tweets</small></button>
      </div>`;
    html += `<div><small><a href="https://keywordseverywhere.com/x-twitter-metrics.html" target="_blank">How these metrics are calculated</a></small></div><div class="xt-twitter-stats-line"><small><a class="xt-twitter-stats-btn" href="${chrome.runtime.getURL('html/twitterstats.html')}" target="_blank">Based on last ${stats.tweets} tweets</a></small></div>`;
    var iframeHTML = Common.renderIframeHTML({
      settingEnabled: true,
      darkMode: darkValue,
      iframeSrcParam: source
    });
    html += iframeHTML;
    html += `<div class="xt-twitter-stats-footer"></div>`;

    $widget.html(html);
    $widget.find('.xt-twitter-stats-btn').click(function(){
      chrome.runtime.sendMessage({cmd: 'twitter.setData', data: {
        tweets: twitterData, maxIndex: stats.maxViewsIndex, url: document.location.href}
      });
    });
    $widget.find('.xt-twitter-stats-more-btn').click(function(e){
      e.preventDefault();
      loadMoreClicked = true;
      restoreScrollTop = document.documentElement.scrollTop;
      if (!restoreScrollTop) restoreScrollTop = 1;
      window.scrollTo({left: 0, top: document.documentElement.scrollHeight, behavior: 'auto'});
    });
    $widget.find('.xt-twitter-stats-spinner').addClass('xt-hidden');
    if (loadMoreClicked) {
      $widget.find('.xt-twitter-stats-load-container .xt-hidden').removeClass('xt-hidden');
      $widget.find('.xt-twitter-stats-load-container .xt-twitter-stats-more-btn').text('Analyze More Tweets');
    }
  };


  var initMutationObserver = function( target ){
    var settings = Starter.getSettings();
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
      if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('data-testid') === "cellInnerDiv") {
        clearTimeout(processTweetsTimer);
        $('.xt-twitter-stats-spinner').removeClass('xt-hidden');
        $('.xt-twitter-stats-more-btn').addClass('xt-hidden');
        processTweetsTimer = setTimeout(function(){
          processTweets();
          if (restoreScrollTop) {
            setTimeout(function(){
              window.scrollTo({left: 0, top: restoreScrollTop, behavior: 'smooth'});
              restoreScrollTop = 0;
            }, 1000);
          }
        }, 500);
      }
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
