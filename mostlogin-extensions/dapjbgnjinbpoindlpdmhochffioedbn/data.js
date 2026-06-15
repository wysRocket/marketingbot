

chrome.tabs.query({"active": true, "lastFocusedWindow": true}, function (tabs) {
    
    if ( tabs==null || tabs.length ==0 ){
        document.getElementById("data").innerHTML = tab.url + '<div style="margin:20px;font-size:0.8rem">No tab available.</small>';
    } else {
    
        var tab=tabs[0];
        
      if (tab.url.substring(0, 4) != 'http') {
        document.getElementById("data").innerHTML = tab.url + '<div style="margin:20px;font-size:0.8rem">We only support lookups on websites that start with HTTP or HTTPS sorry.</small>';
    } else {
        loadContent(tab.url);
    }
    
    }
    
});






var BW = {};


submitAnswer = function (answer, url)
{
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://builtwith.com/auth.asmx?T=CAPAN&V=" + answer, true);

      document.getElementById("data").innerHTML='<div style="text-align:center;margin-top:20px"><svg class="spinner" width="32px" height="32px" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg"><circle class="path" fill="none" stroke-width="6" stroke-linecap="round" cx="33" cy="33" r="30"></circle></svg></div>';
    xhr.send();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            if ( xhr.responseText.indexOf('$OK')!=-1 ) loadContent(url);
        }
        
    };
}

loadContent = function(url) {

    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://builtwith.com/mobile.aspx?" + url, true);

    xhr.send();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
            var element = document.getElementById("logo");
            if(element)element.parentNode.removeChild(element);
            document.getElementById("data").innerHTML = xhr.responseText;
            
            
            for (x = 0; x < document.getElementsByClassName('capA').length; x++) {
                document.getElementsByClassName('capA')[x].onclick = function() {
                    return submitAnswer(document.getElementById('capA').value,url);
                }                
            }
            

            
            
            
            if ( document.getElementById("capA")!=null){
            document.getElementById("capA")
            .addEventListener("keyup", function(event) {
            event.preventDefault();
            if (event.keyCode === 13) {
                return submitAnswer(document.getElementById('capA').value,url);
            }
            });
        }
            
            
            for (x = 0; x < document.getElementsByClassName('nav-link').length; x++) {
                document.getElementsByClassName('nav-link')[x].onclick = function() {
                    return changeTab(this);
                }
            }

            if (xhr.responseText.indexOf('$DETAILED!') != -1) {
                changeTab(document.getElementsByClassName('nav-link')[1]);
            }


            var imgEl = document.getElementsByTagName('img');
            for (var i = 0; i < imgEl.length; i++) {
                if (imgEl[i].getAttribute('data-src')) {
                    imgEl[i].setAttribute('src', imgEl[i].getAttribute('data-src'));
                    imgEl[i].removeAttribute('data-src'); //use only if you need to remove data-src attribute after setting src
                }
            }




        }

        if (xhr.readyState == 3) {
            document.getElementById("loading").innerHTML = "Loading";
        }


        if (xhr.readyState == 1) {
            document.getElementById("loading").innerHTML = "Open";
        }
    }
}



changeTab = function(t) {

    for (x = 0; x < document.getElementsByClassName('tab').length; x++) {
        document.getElementsByClassName('tab')[x].classList.add('d-none');
    }

    for (x = 0; x < document.getElementsByClassName('nav-link').length; x++) {
        document.getElementsByClassName('nav-link')[x].classList.remove('active');
    }

    t.classList.add('active');
    document.getElementById(t.innerHTML.toLowerCase()).classList.remove('d-none');

    return false;


}