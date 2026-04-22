var SourceList = {
  'gsearc': {name: 'Google Search', type: 'site'},
  'gwmtoo': {name: 'Google Search Console', type: 'site'},
  'gkplan': {name: 'Google Keyword Planner', type: 'site'},
  'analyt': {name: 'Google Analytics', type: 'site'},
  'gtrend': {name: 'Google Trends', type: 'site'},
  'ggmaps': {name: 'Google Maps', type: 'site'},
  'youtub': {name: 'YouTube', type: 'site'},
  'bingco': {name: 'Bing Search', type: 'site'},
  'yahsea': {name: 'Yahoo Search', type: 'site'},
  'amazon': {name: 'Amazon', type: 'site'},
  'xtwttr': {name: 'X (Formerly Twitter)', type: 'site'},
  'ebayco': {name: 'Ebay', type: 'site'},
  'etsyco': {name: 'Etsy', type: 'site'},
  'duckgo': {name: 'DuckDuckGo ', type: 'site'},
  'soovle': {name: 'Soovle', type: 'site'},
  'instgr': {name: 'Instagram', type: 'site'},
  'pntrst': {name: 'Pinterest', type: 'site'},
  'reddit': {name: 'Reddit', type: 'site'},
  'ycmbnt': {name: 'Hacker News', type: 'site'},
  'quoraa': {name: 'Quora', type: 'site'},
  'stacko': {name: 'Stackoverflow', type: 'site'},
  'openai': {name: 'ChatGPT', type: 'site'},
  'gemini': {name: 'Gemini', type: 'site'},
  'claude': {name: 'Claude', type: 'site'},
  'deepsk': {name: 'Deepseek', type: 'site'},
  'gptfan': {name: 'Fan-out Queries', type: 'site'},
  'gprsea': {name: 'Related Widget (Google, Bing, YouTube, Pinterest & DDG)', type: 'widget'},
  'gpasea': {name: 'PASF Widget (Google)', type: 'widget'},
  'trenkw': {name: 'Trending Widget (Google & YouTube)', type: 'widget'},
  'topicg': {name: 'Topical Keywords (Google)', type: 'widget'},
  'topkw': {name: 'SERP Keywords (Google)', type: 'widget'},
  'ltkwid': {name: 'Long-Tail Widget (Google)', type: 'widget'},
  'youtag': {name: 'Tags Widget (YouTube)', type: 'widget'},
  'gptfow': {name: 'ChatGPT Fan-out Queries', type: 'widget'}
};


if (typeof exports !== 'undefined') {
  exports.get = function(){
    return SourceList;
  };
}
