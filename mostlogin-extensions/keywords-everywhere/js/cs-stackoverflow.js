var Tool = (function(){

  var source = 'stacko';
  var COMMENTS_TEXT_LIMIT = 30000;


  var init = function(){
    initWindowMessaging();
    initPage();
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
        var selector = '.xt-widget-iframe';
        if (!selector) return;
        if (height <= 0) return;
        $(selector + ' iframe').height(height);
      }
    }, false);
  };


  var initPage = function(){
    injectSummarizeButtons();
  };


  var injectSummarizeButtons = function(){
    renderSummarizeWidget();
  };


  const renderSummarizeWidget = function(data){
    let html = '';
    let settings = Starter.getSettings();
    var buttons =`
      <div class="xt-stackoverflow-buttons-grid">
        <a class="xt-stackoverflow-summarize-run-btn xt-ke-btn" data-url="https://chatgpt.com">${SVGIcons.chatgpt} ChatGPT</a>
        <a class="xt-stackoverflow-summarize-run-btn xt-ke-btn" data-url="https://claude.ai/chats">${SVGIcons.claude} Claude</a>
        <a class="xt-stackoverflow-summarize-run-btn xt-ke-btn" data-url="https://gemini.google.com">${SVGIcons.gemini} Gemini</a>
        <a class="xt-stackoverflow-summarize-run-btn xt-ke-btn" data-url="https://chat.deepseek.com">${SVGIcons.deepseek} Deepseek</a>
      </div>
      `;
    html += `<div class="xt-ke-row">
      <div>
        <h3><img src="${chrome.runtime.getURL('/img/icon24.png')}" width="24" height="24"> Summarize Thread</h3>
      </div>
      <div id="xt-stackoverflow-summarize-buttons">
      ${buttons}
      </div>
    `;
    html += Common.renderIframeHTML({
      query: '',
      settingEnabled: true,
      darkMode: false,
      iframeSrcParam: source
    });
    let params = {
      parentSelector: '#sidebar',
      addMethod: 'prependTo',
      rootId:'xt-stackoverflow-root',
      rootClassName: 's-sidebarwidget s-sidebarwidget__yellow',
      html: html,
      service: source,
      onAdded: function($root){
      },
      onReady: function($root){
      }
    };
    let $root = Common.renderGenericWidget(params);
    $root.find('.xt-ke-btn').click(function(e){
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
        data: {id: 'stackoverflowsummarizethread'}
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
    // Get question title and truncate to 80 characters
    var title = $('#question-header .question-hyperlink').text().trim();
    if (title.length > 80) {
      title = title.substring(0, 80) + '...';
    }

    var comments = [];
    var currentLength = 0;

    // Process question comments
    $('.comments-list .comment').each(function(i, comment){
      var $comment = $(comment);
      var commentId = $comment.attr('data-comment-id');
      var commentUrl = `https://stackoverflow.com/questions/comment/${commentId}`;
      var username = $comment.find('.comment-user').text().trim();
      var commentText = $comment.find('.comment-copy').text().replace(/\s+/g, ' ').trim();

      if (username && commentText) {
        var commentLine = `> [${commentUrl}] ${username}: ${commentText}`;
        
        // Check if adding this comment would exceed the limit
        if (currentLength + commentLine.length + 1 <= COMMENTS_TEXT_LIMIT) {
          comments.push(commentLine);
          currentLength += commentLine.length + 1;
        }
      }
    });

    // Process answers and their comments together in natural order
    var answers = [];
    $('.answer').each(function(i, answer){
      var $answer = $(answer);
      var score = parseInt($answer.attr('data-score')) || 0;
      if (score >= 0) {
        answers.push({
          element: $answer,
          score: score
        });
      }
    });

    // If we have at least 3 answers with positive votes, filter out 0-vote answers
    var positiveVoteAnswers = answers.filter(function(answer) {
      return answer.score > 0;
    });

    if (positiveVoteAnswers.length >= 3) {
      answers = positiveVoteAnswers;
    }

    // Process answers and their comments in their original order
    answers.forEach(function(answerData){
      var $answer = answerData.element;
      var answerId = $answer.attr('data-answerid');
      var answerUrl = `https://stackoverflow.com/a/${answerId}`;
      var answerText = $answer.find('.js-post-body').text().replace(/\s+/g, ' ').trim();
      var author = $answer.find('.user-details a').first().text().trim() || 'Anonymous';
      
      // Add the answer first
      if (answerText) {
        var answerLine = `[${answerUrl}] ${author}: ${answerText}`;
        
        // Check if adding this answer would exceed the limit
        if (currentLength + answerLine.length + 1 <= COMMENTS_TEXT_LIMIT) {
          comments.push(answerLine);
          currentLength += answerLine.length + 1;
        }
      }
      
      // Then add comments for this answer (second-level with >> prefix)
      $answer.find('[itemprop="comment"]').each(function(j, comment){
        var $comment = $(comment);
        var commentId = $comment.attr('data-comment-id') || $comment.attr('id');
        var commentUrl = `https://stackoverflow.com/questions/comment/${commentId}`;
        
        // Try different selectors for username
        var username = $comment.find('.comment-user, .s-user-card--link').text().trim();
        
        // Try different selectors for comment text
        var commentText = $comment.find('.comment-copy, [itemprop="text"]').text().replace(/\s+/g, ' ').trim();

        if (username && commentText) {
          var commentLine = `> [${commentUrl}] ${username}: ${commentText}`;
          
          // Check if adding this comment would exceed the limit
          if (currentLength + commentLine.length + 1 <= COMMENTS_TEXT_LIMIT) {
            comments.push(commentLine);
            currentLength += commentLine.length + 1;
          }
        }
      });
    });

    var commentsText = comments.join('\n');

    return {
      stackoverflow_thread_title: title,
      stackoverflow_thread_comments: commentsText
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


