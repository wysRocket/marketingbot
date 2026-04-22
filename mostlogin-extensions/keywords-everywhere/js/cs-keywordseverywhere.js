var Tool = (function(){

  var source = 'keywordseverywhere';

  var init = function(){
    console.log(source);
    setBodyAttributes();
    initUI();
  };


  var setBodyAttributes = function(){
    var settings = Starter.getSettings();
    var plan = Common.getPlan();
    var config = Common.getConfig();
    var isValidAPIKey = Common.getIsValidAPIKey();
    var hasCredits = Common.getCredits() > 0 || (config.areSubsEnabled && plan.credits > 0);
    var promoParam = Common.subscriptionPromoCondition() === 'freeuser';
    console.log(plan, isValidAPIKey);
    document.body.setAttribute('data-plan', plan && plan.plan ? plan.plan : '');
    document.body.setAttribute('data-valid-key', isValidAPIKey);
    document.body.setAttribute('data-api-key', settings.apiKey);
    if (promoParam) document.body.setAttribute('data-freeuser', promoParam);
  };


  var initUI = function(){
    var node = document.querySelector('#xt-settings');
    if (!node) return;
    node.style.display = '';
    node.addEventListener("click", function(e){
      chrome.runtime.sendMessage({
        cmd: 'new_tab',
        data: chrome.runtime.getURL('/html/options.html')
      });
    });
  };



  var getSource = function(){
    return source;
  };


  return {
    init: init,
    getSource: getSource
  };

})();
