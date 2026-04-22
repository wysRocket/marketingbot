(()=>{
  let xhr = XMLHttpRequest.prototype;
  let send = xhr.send;
  xhr.send = function() {
    this.addEventListener("load", function() {
      let url = this.responseURL;
      if (url.indexOf('/graphql/query') === -1 && url.indexOf('/api/graphql') === -1 && url.indexOf('/api/v1/feed/user') === -1 && url.indexOf('api/v1/tags/web_info') === -1 && url.indexOf('/api/v1/fbsearch/web/top_serp') === -1) return;
      if (this.responseType === '' || this.responseType === 'text') {
        try {
          let response = this.responseText;
          let json = JSON.parse(response);
          console.log(json);
          let node = document.createElement("template");
          node.setAttribute("data-url", url);
          node.setAttribute("data-path", document.location.pathname);
          node.textContent = response;
          document.body.appendChild(node);
        } catch (e) {
          console.log(e);
        }
      }
    });
    return send.apply(this, arguments);
  };
})();
