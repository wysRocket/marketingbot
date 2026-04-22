(() => {
  let head = document.head || document.documentElement;
  let script = document.createElement("script");
  script.src = chrome.runtime.getURL("js/cs-youtube-ajax.js");
  head.append(script);
})();

