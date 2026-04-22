(()=>{
  let xhr = XMLHttpRequest.prototype;
  let send = xhr.send;
  xhr.send = function() {
    this.addEventListener("load", function() {
      let url = this.responseURL;
      let ignore = true;
      if (url.indexOf('resource/BaseSearchResource/get/') !== -1) ignore = false;
      if (url.indexOf('resource/BoardContentRecommendationResource/') !== -1) ignore = false;
      if (url.indexOf('resource/PinResource/get/') !== -1) ignore = false;
      if (url.indexOf('UserActivityPinsResource/get/') !== -1) ignore = false;
      if (ignore) return;
      if (this.responseType === '' || this.responseType === 'text') {
        try {
          let response = this.responseText;
          var json = JSON.parse(response);
          let node = document.createElement("template");
          node.setAttribute("data-url", url);
          node.setAttribute("data-resource", json.request_identifier);
          if (url.indexOf('resource/BoardContentRecommendationResource/') !== -1) {
            node.setAttribute("data-res", "BoardContentRecommendationResource");
          }
          else if (url.indexOf('BaseSearchResource') !== -1) {
            node.setAttribute("data-res", "BaseSearchResource");
          }
          else if (url.indexOf('UserActivityPinsResource') !== -1) {
            node.setAttribute("data-res", "UserActivityPinsResource");
          }
          else if (json.resource.options.id) {
            node.setAttribute("data-pinid", json.resource.options.id);
          }
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
