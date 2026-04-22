(() => {
  let head = document.head || document.documentElement;
  let script = document.createElement("script");
  script.src = chrome.runtime.getURL("js/cs-instagram-ajax.js");
  head.append(script);
})();
