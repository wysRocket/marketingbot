var Tool = (function(){

  var source = 'quoraa';
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
      <div class="xt-quora-buttons-grid">
        <a class="xt-quora-summarize-run-btn xt-ke-btn" data-url="https://chatgpt.com">${SVGIcons.chatgpt} ChatGPT</a>
        <a class="xt-quora-summarize-run-btn xt-ke-btn" data-url="https://claude.ai/chats">${SVGIcons.claude} Claude</a>
        <a class="xt-quora-summarize-run-btn xt-ke-btn" data-url="https://gemini.google.com">${SVGIcons.gemini} Gemini</a>
        <a class="xt-quora-summarize-run-btn xt-ke-btn" data-url="https://chat.deepseek.com">${SVGIcons.deepseek} Deepseek</a>
      </div>
      `;
    html += `<div class="xt-ke-row">
      <div>
        <h3><img src="${chrome.runtime.getURL('/img/icon24.png')}" width="24" height="24"> Summarize Thread</h3>
      </div>
      <div id="xt-quora-summarize-buttons">
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
      parentSelector: '#mainContent + div',
      addMethod: 'prependTo',
      rootId:'xt-quora-root',
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
    // First, try to click the filter button if needed
    await handleFilterButtonClick();
    
    // Scroll to bottom and wait for content to load
    await scrollToBottomAndWait();
    
    // Then process the data
    const template = await getSummarizePromptTemplate();
    const data = prepareSummarizeTemplateData();
    console.log(data);
    const prompt = generatePrompt(template.prompt, data);
    chrome.runtime.sendMessage({
      cmd: 'prompt_pending.set',
      data: {
        url: url,
        prompt: prompt
      }
    }, function(){});
  };


  const handleFilterButtonClick = function() {
    return new Promise((resolve) => {
      // Find the button with text containing "All related" or "Answers"
      const buttons = document.querySelectorAll('button[role="button"][aria-haspopup="menu"]');
      let targetButton = null;
      
      for (let button of buttons) {
        const buttonText = button.textContent.trim();
        if (buttonText.includes('All related') || buttonText.includes('Answers')) {
          targetButton = button;
          break;
        }
      }
      
      if (!targetButton) {
        console.log('Filter button not found');
        resolve();
        return;
      }
      
      const buttonText = targetButton.textContent.trim();
      console.log('Found button:', buttonText);
      
      // If it's already "Answers", skip clicking
      if (buttonText.includes('Answers')) {
        console.log('Already on Answers view, skipping click');
        resolve();
        return;
      }
      
      // If it's "All related", click it
      if (buttonText.includes('All related')) {
        console.log('Clicking All related button');
        targetButton.click();
        
        // Wait for popover to appear and click on "Answers"
        setTimeout(() => {
          const popoverItems = document.querySelectorAll('.puppeteer_test_popover_item');
          if (popoverItems.length >= 2) {
            // Click the second button (Answers)
            const answersButton = popoverItems[1];
            console.log('Clicking Answers button');
            answersButton.click();
            
            // Wait for page to update
            setTimeout(() => {
              console.log('Page should be updated to Answers view');
              resolve();
            }, 1500);
          } else {
            console.log('Popover items not found');
            resolve();
          }
        }, 500); // Wait for popover to appear
      } else {
        resolve();
      }
    });
  };


  const getSummarizePromptTemplate = function(id){
    return new Promise(function(resolve){
      chrome.runtime.sendMessage({
        cmd: 'api.openAIFetchKEPrompt',
        data: {id: 'quorasummarizethread'}
      }, function(response){
        if (response && response.prompt) resolve(response);
        else {
          console.log('Investigate', response);
          resolve(response);
        }
      });
    })
  };


  const scrollToBottomAndWait = function() {
    return new Promise((resolve) => {
      console.log('Scrolling to bottom of page...');
      
      // Scroll to the bottom of the page
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
      
      // Wait 2 seconds for content to load
      setTimeout(() => {
        console.log('Finished waiting for content to load');
        resolve();
      }, 3000);
    });
  };


  const prepareSummarizeTemplateData = function(){
    // Get question title and truncate to 80 characters
    var title = $('.puppeteer_test_question_title').text().trim();
    if (title.length > 80) {
      title = title.substring(0, 80) + '...';
    }

    var comments = [];
    var currentLength = 0;

    // Process answers in their natural order
      $('[class*="dom_annotate_question_answer_item_"]').each(function(i, answer){
        var $answer = $(answer);
        
        // Find first .q-box in the answer (answer parent node)
        var $answerParent = $answer.find('.q-box').first();
        
        // Get answer author and text from the answer parent
        var answerAuthor = $answerParent.find('.qu-color--gray_dark.puppeteer_test_link').text().trim();
        var answerText = $answerParent.find('.puppeteer_test_answer_content').text().replace(/\s+/g, ' ').trim();

        // Only process if we have a valid author (not Anonymous) and text
        if (answerAuthor && answerAuthor !== 'Anonymous' && answerText) {
          var answerLine = `${answerAuthor}: ${answerText}`;
          
          // Check if adding this answer would exceed the limit
          if (currentLength + answerLine.length + 1 <= COMMENTS_TEXT_LIMIT) {
            comments.push(answerLine);
            currentLength += answerLine.length + 1;
          }
        }
        
        // Check if there's a second .q-box after the answer parent (comments root node)
        var $commentsRoot = $answerParent.parent().children('.q-box').eq(1);
        
        // if ($commentsRoot.length > 0) {
        //   // Get all authors and comment texts from the comments root
        //   var commentAuthors = $commentsRoot.find('.puppeteer_test_link').map(function() {
        //     return $(this).text().trim() || 'Anonymous';
        //   }).get();
          
        //   var commentTexts = $commentsRoot.find('.q-text.qu-truncateLines--3.qu-wordBreak--break-word span').map(function() {
        //     return $(this).text().replace(/\s+/g, ' ').trim();
        //   }).get();
          
        //   // Only process if arrays have the same length (authors and texts match)
        //   if (commentAuthors.length === commentTexts.length) {
        //     // Match authors with comment texts by index
        //     for (var j = 0; j < commentAuthors.length; j++) {
        //       var commentAuthor = commentAuthors[j];
        //       var commentText = commentTexts[j];
              
        //       if (commentAuthor && commentText) {
        //         var commentLine = `> ${commentAuthor}: ${commentText}`;
                
        //         // Check if adding this comment would exceed the limit
        //         if (currentLength + commentLine.length + 1 <= COMMENTS_TEXT_LIMIT) {
        //           comments.push(commentLine);
        //           currentLength += commentLine.length + 1;
        //         }
        //       }
        //     }
        //   }
        // }
      });

    var commentsText = comments.join('\n');

    return {
      quora_thread_title: title,
      quora_thread_comments: commentsText
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


