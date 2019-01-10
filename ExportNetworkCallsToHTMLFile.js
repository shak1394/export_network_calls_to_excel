// ==UserScript==
// @name         URL interceptor
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Collect network data and screenshots.
// @author       Shaket Kumar
// @match        https://submitter-atp-gamma-iad.iad.proxy.amazon.com/***
// @require      https://unpkg.com/xhook@latest/dist/xhook.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/0.4.1/html2canvas.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

var NEW_LINE = "<br>";
var FILENAME = "NetworkData.html";
var REQUEST_METHOD = "Request Method: ";
var REQUEST_URL = "Request URL: ";
var REQUEST_BODY = "Request Body: ";
var RESPONSE_STATUS = "Response Status: ";
var RESPONSE_DATA = "Response Data: ";
var TAB_URL = "Tab URL: ";
var BODY_CLOSING_TAG = "</body>";
var HTML_CLOSING_TAG = "</html>";
var H2_OPENING_TAG = "<h2>";
var H2_CLOSING_TAG = "</h2>";
var CLOSING_DIV = "</div>"
var DOWNLOAD_BUTTON_TEXT = "Download Network Data";
var DOWNLOAD_BUTTON_ID = "input_id";
var DOWNLOAD_BUTTON_STYLE = "position:absolute; top:0px; left:0px; z-index:10; border-radius:100%; height:70px; background-color:coral; color:mediumblue; font-weight:bold";
var PIXEL = "px";
var HTML_HEADER_AND_IMPORTS = '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">' +
        '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>' +
        '<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js">' +
        '</script>' +
        '</head>' +
        '<body style="background-color: burlywood;">' +
        '<div class="container">' +
        '<h2>Network Data</h2>';

var networkData = HTML_HEADER_AND_IMPORTS;
var tabURL = "";
var id_iterator = 1;
var screenshot_iterator = 0;
var downloadButtonDragged = false;
var beforeCallScreenshotMap = new Object();
var beforeCallScreenshotMapTracker = new Object();
var screenshotDocument;

var input = document.createElement("input");
input.id = DOWNLOAD_BUTTON_ID;
input.type = "button";
input.value = DOWNLOAD_BUTTON_TEXT;
input.onclick = downloadNetworkData;
input.style = DOWNLOAD_BUTTON_STYLE;
input.disabled = false;
document.body.appendChild(input);

dragElement(document.getElementById(DOWNLOAD_BUTTON_ID));

function dragElement(element) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown;

    function dragMouseDown(event) {
        event = event || window.event;
        event.preventDefault();
        pos3 = event.clientX;
        pos4 = event.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(event) {
        downloadButtonDragged = true;
        event = event || window.event;
        event.preventDefault();
        pos1 = pos3 - event.clientX;
        pos2 = pos4 - event.clientY;
        pos3 = event.clientX;
        pos4 = event.clientY;
        element.style.top = (element.offsetTop - pos2) + PIXEL;
        element.style.left = (element.offsetLeft - pos1) + PIXEL;
    }

    function closeDragElement() {
        downloadButtonDragged = downloadButtonDragged === true ? true : false
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function downloadNetworkData() {
    if (!downloadButtonDragged) {
        captureScreenshot();

        var tabUrlButtonText = "Screenshot after " + window.location.href;
        networkData = networkData + CLOSING_DIV + NEW_LINE + NEW_LINE + createCollapsableImage(beforeCallScreenshotMap[window.location.href.toString()], tabUrlButtonText) +
            BODY_CLOSING_TAG + HTML_CLOSING_TAG;

        setTimeout(function() {
            var a = document.createElement("a");
            a.href = "data:application/html;charset=utf-8," + encodeURIComponent(networkData);
            a.download = FILENAME;
            document.getElementsByTagName("body")[0].appendChild(a);
            a.click();
            networkData = HTML_HEADER_AND_IMPORTS;
            tabURL = "";
        }, 0);
    } else {
        downloadButtonDragged = false;
    }
}

(function() {
    xhook.before(function(request) {
        appendWindowLocationToNetworkData();
        setTimeout(function() {captureBeforeScreenshot(window.location.href.toString())}, 1000);
    });
})();

(function() {
    xhook.after(function(request, response) {
        var eachNetworkData = createCollapsableButtonWithText(request.url, getEachNetworkData(request, response));
        networkData = networkData + eachNetworkData + NEW_LINE;
    });
})();

function captureBeforeScreenshot(tabURL) {
    captureScreenshot();
}

function captureScreenshot() {
    html2canvas(document.getElementById("root"), {
        onrendered: function (canvas) {
            screenshotDocument = '<img src="' + canvas.toDataURL("image/png") + '"/>';
            beforeCallScreenshotMap[tabURL.toString()] = screenshotDocument;
            beforeCallScreenshotMapTracker[tabURL.toString()] = 1;
        },
        letterRendering:true
    });
}

function appendWindowLocationToNetworkData() {
    var currentTabURL = window.location.href;
    if (currentTabURL !== tabURL) {
        if (networkData !== HTML_HEADER_AND_IMPORTS) {
            networkData = networkData + CLOSING_DIV + NEW_LINE;
        }

        if (beforeCallScreenshotMapTracker[tabURL.toString()] === 1) {
            var tabUrlButtonText = "Screenshot between " + tabURL + " and " + currentTabURL;
            networkData = networkData + NEW_LINE +
                createCollapsableImage(beforeCallScreenshotMap[tabURL.toString()], tabUrlButtonText) + NEW_LINE + NEW_LINE;
            beforeCallScreenshotMapTracker[tabURL.toString()] = 0;
        }

        networkData = networkData + createCollapsableTabUrlButtonWithText(currentTabURL) + NEW_LINE;
        tabURL = currentTabURL;
    }
}

function getEachNetworkData(request, response) {
    return colorText(request.method, REQUEST_METHOD) + NEW_LINE +
            colorText(request.body, REQUEST_BODY) + NEW_LINE +
            colorText(response.status, RESPONSE_STATUS) + NEW_LINE +
            colorText(JSON.stringify(JSON.parse(response.data), null, 2), RESPONSE_DATA);
}

function colorText(text, type) {
    switch (type) {
        case REQUEST_METHOD:
            return "<font color=orange><strong>" + type + "</strong> "+ text + "</font>";
        case REQUEST_BODY:
            return "<font color=midnightBlue><strong>" + type + "</strong> " + text + "</font>";
        case RESPONSE_STATUS:
            if (text === "200") {
                return "<font color=green><strong>" + type + "</strong> " + text + "</font>";
            } else {
                return "<font color=red><strong>" + type + "</strong> " + text + "</font>";
            }
        case RESPONSE_DATA:
            return "<font color=brown><strong>" + type + "</strong> " + text + "</font>";
    }
}

function createCollapsableTabUrlButtonWithText(tabUrlButtonText) {
    var data_target = "#demo" + id_iterator;
    var div_id = data_target.substr(1);
    id_iterator++;
    return '<button type="button" class="btn btn-info" data-toggle="collapse" data-target=' + data_target + '>' +
            tabUrlButtonText + '</button>' + '<div id=' + div_id + ' class="collapse" style="background-color: antiquewhite;">';
}

function createCollapsableButtonWithText(buttonText, internalText) {
    var data_target = "#demo" + id_iterator;
    var div_id = data_target.substr(1);
    id_iterator++;
    return '<button type="button" class="btn btn-info" data-toggle="collapse" data-target=' + data_target + '>' + buttonText + '</button>' +
            '<div id=' + div_id + ' class="collapse" style="background-color: lightgoldenrodyellow;" >' + internalText + '</div><br><br>';
}

function createCollapsableImage(imageDocument, tabUrlButtonText) {
    screenshot_iterator++;
    return '<button type="button" class="btn btn-info" data-toggle="collapse" data-target=#' + screenshot_iterator + '>' +
            tabUrlButtonText + '</button>' + '<div id=' + screenshot_iterator + ' class="collapse" style="background-color: antiquewhite;">' +
            imageDocument + '</div>';
}
