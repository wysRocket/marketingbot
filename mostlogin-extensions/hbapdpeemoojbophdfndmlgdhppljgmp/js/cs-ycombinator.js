var Tool = (function(){

  var source = 'ycmbnt';
  var COMMENTS_TEXT_LIMIT = 30000;


  var init = function(){
    initPage();
  };


  var initPage = function(){
    injectSummarizeButtons();
  };


  var injectSummarizeButtons = function(){
    var $a = $('<a href="#" class="xt-summarize-trigger">summarize thread</a>');
    $('.subline').append(' | ').append($a);
    var buttons =`
      <div class="xt-yc-summarize-buttons" style="display: none;">
        <a class="xt-summarize-btn xt-ke-btn" data-url="https://chatgpt.com">${SVGIcons.chatgpt} ChatGPT</a>
        <a class="xt-summarize-btn xt-ke-btn" data-url="https://claude.ai/chats">${SVGIcons.claude} Claude</a>
        <a class="xt-summarize-btn xt-ke-btn" data-url="https://gemini.google.com">${SVGIcons.gemini} Gemini</a>
        <a class="xt-summarize-btn xt-ke-btn" data-url="https://chat.deepseek.com">${SVGIcons.deepseek} Deepseek</a>
      </div>
      `;
    $('.subtext').append(buttons);
    
    // Add click handler to show/hide buttons
    $a.click(function(e){
      e.preventDefault();
      var $buttons = $('.xt-yc-summarize-buttons');
      if ($buttons.is(':visible')) {
        $buttons.hide();
      } else {
        $buttons.show();
      }
    });
    
    // Add click handlers to AI buttons
    $('.xt-summarize-btn').click(function(e){
      e.preventDefault();
      runSummarize(this.dataset.url);
    });
  };


  const runSummarize = async function(url){
    const template = await getSummarizePromptTemplate();
    const data = prepareSummarizeTemplateData();
    const prompt = generatePrompt(template.prompt, data);
    chrome.runtime.sendMessage({
      cmd: 'prompt_pending.set',
      data: {
        url: url,
        prompt: prompt
      }
    }, function(){});
  };


  const getSummarizePromptTemplate = function(id){
    return new Promise(function(resolve){
      chrome.runtime.sendMessage({
        cmd: 'api.openAIFetchKEPrompt',
        data: {id: 'hnsummarizethread'}
      }, function(response){
        if (response && response.prompt) resolve(response);
        else {
          console.log('Investigate', response);
          resolve(response);
        }
      });
    })
  };


  const prepareSummarizeTemplateData = function(){
    var title = $('.titleline').text().trim();
    var $commentRows = $('.comtr');

    var comments = [];
    var currentLength = 0;

    $commentRows.each(function(i, row){
      var $row = $(row);
      var $indentTd = $row.find('td.ind');
      var indent = parseInt($indentTd.attr('indent')) || 0;
      var depthStr = ">".repeat(indent + 1);
      
      // Get comment URL
      var commentId = $row.attr('id');
      var commentUrl = `https://news.ycombinator.com/item?id=${commentId}`;
      
      // Get username
      var username = $row.find('.hnuser').text().trim();
      
      // Get comment text
      var commentText = $row.find('.commtext').text().replace(/\s+/g, ' ').trim();
      
      if (username && commentText) {
        var commentLine = `${depthStr} [${commentUrl}] ${username}: ${commentText}`;

        // Check if adding this comment would exceed the limit
        if (currentLength + commentLine.length + 1 <= COMMENTS_TEXT_LIMIT) { // +1 for newline
          comments.push(commentLine);
          currentLength += commentLine.length + 1;
        }
      }
    });
    var commentsText = comments.join('\n');

    return {
      hackernews_thread_title: title,
      hackernews_thread_comments: commentsText
    };
  };


  const generatePrompt = function(template, data){
    let prompt = template;
    for (const key in data) {
      const re = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(re, data[key]);
    }
    return prompt;
  };


  var getSource = function(){
    return source;
  };


  return {
    init: init,
    getSource: getSource
  };


})();


