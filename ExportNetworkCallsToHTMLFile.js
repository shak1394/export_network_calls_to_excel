// ==UserScript==
// @name         URL interceptor
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Collect network data and screenshots.
// @author       Shaket Kumar
// @match        https://*/*
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
var DOWNLOAD_BUTTON_STYLE = "position:absolute; top:0px; left:0px; z-index:10000; border-radius:100%; height:70px; background-color:coral; color:mediumblue; font-weight:bold";
var PIXEL = "px";
var SCREENSHOT_BUTTON_TEXT = "Screenshot";
var HTML_HEADER_AND_IMPORTS = '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">' +
        '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js"></script>' +
        '<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js">' +
        '</script>' +
        '</head>' +
        '<body style="background-color:#001f3f;">' +
        '<div class="container">' +
        '<h2 style="color:#FFFFFF;">Network Data</h2>';

var networkData = HTML_HEADER_AND_IMPORTS;
var tabURL = "";
var id_iterator = 1;
var screenshot_iterator = 0;
var downloadButtonDragged = false;
var eachPageCallDiv = new Map();
var eachNetworkCallDiv = new Map();
var eachNetworkCallScreenshot = new Map();
var eachPageNumberOfNetworkCalls = new Map();
var eachPageCallIterator = 0;
var eachNetworkCallIterator = 0;
var eachNetworkCallScreenshotIterator = 0;

/**
 * Capture Xhr request states.
 * Logic START.
 */
var open = window.XMLHttpRequest.prototype.open;
var send = window.XMLHttpRequest.prototype.send;

function openReplacement(method, url, async, user, password) {
    this._url = url;
    this._method = method;
    return open.apply(this, arguments);
}

function sendReplacement(data) {
    this._requestData = data;
    if(this.onreadystatechange) {
        this._onreadystatechange = this.onreadystatechange;
    }

    this.onreadystatechange = onReadyStateChangeReplacement;
    return send.apply(this, arguments);
}

function onReadyStateChangeReplacement() {
    if (this.readyState === 4) {
        captureEachAjaxRequestResponse(this._method, this._requestData, this._url, this.status, this.response);
    }

    if(this._onreadystatechange) {
        return this._onreadystatechange.apply(this, arguments);
    }
}

window.XMLHttpRequest.prototype.open = openReplacement;
window.XMLHttpRequest.prototype.send = sendReplacement;
/**
 * Capture Xhr request states.
 * Logic END.
 */

/**
 * Create draggable "Download network data" button.
 * Logic START.
 */
var input = document.createElement("input");
input.id = DOWNLOAD_BUTTON_ID;
input.type = "button";
input.value = DOWNLOAD_BUTTON_TEXT;
input.onclick = downloadNetworkData;
input.style = DOWNLOAD_BUTTON_STYLE;
input.disabled = false;

window.onload = function() {
    document.body.appendChild(input);
}

setTimeout(function() {dragElement(document.getElementById(DOWNLOAD_BUTTON_ID))}, 5000);

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
        buildNetworkData();

        var a = document.createElement("a");
        a.href = "data:application/html;charset=utf-8," + encodeURIComponent(networkData);
        a.download = FILENAME;
        document.getElementsByTagName("body")[0].appendChild(a);
        a.click();
        networkData = HTML_HEADER_AND_IMPORTS;
        tabURL = "";
    } else {
        downloadButtonDragged = false;
    }
}
/**
 * Create draggable "Download network data" button.
 * Logic END.
 */

 /**
 * Capture webpage screenshot.
 * Logic START
 */
function captureScreenshot(ajaxCall) {
    html2canvas(document.getElementsByTagName("body")[0], {
        onrendered: function (canvas) {
            eachNetworkCallScreenshotIterator++;
            var screenshotDocument = '<img src="' + canvas.toDataURL("image/png") + '"/>';
            var eachNetworkDataScreenshot = createCollapsableImage(screenshotDocument);
            var eachNetworkCallScreenshotMapKey = tabURL.toString() + ajaxCall.toString() + eachNetworkCallScreenshotIterator.toString();
            eachNetworkCallScreenshot.set(eachNetworkCallScreenshotMapKey, eachNetworkDataScreenshot);
        },
        letterRendering:true
    });
}
/**
 * Capture webpage screenshot.
 * Logic END
 */

/**
 * Create HTML divs for each AJAX request.
 * Also capture screenshot after each AJAX request completes.
 * Logic START
 */
function captureEachAjaxRequestResponse(requestMethod, requestData, requestURL, responseStatus, responseData) {
    appendWindowLocationToNetworkData();

    var eachNetworkData = createCollapsableButtonWithText(requestURL,
        getEachNetworkData(requestMethod, requestData, responseStatus, responseData));

    eachNetworkCallIterator++;
    var eachNetworkCallDivMapKey = tabURL.toString() + requestURL.toString() + eachNetworkCallIterator.toString();
    eachNetworkCallDiv.set(eachNetworkCallDivMapKey, eachNetworkData);

    var eachPageCallDivMapKey = tabURL.toString() + eachPageCallIterator.toString();
    if (!eachPageNumberOfNetworkCalls.has(eachPageCallDivMapKey)) {
        eachPageNumberOfNetworkCalls.set(eachPageCallDivMapKey, 1);
    } else {
        eachPageNumberOfNetworkCalls.set(eachPageCallDivMapKey, eachPageNumberOfNetworkCalls.get(eachPageCallDivMapKey) + 1);
    }

    setTimeout(function() {captureScreenshot(requestURL.toString())}, 1000);
}

function appendWindowLocationToNetworkData() {
    var currentTabURL = window.location.href;
    if (currentTabURL !== tabURL) {
        eachPageCallIterator++;
        tabURL = currentTabURL;
        var eachPageCallData =  createCollapsableTabUrlButtonWithText(tabURL);
        var eachPageCallDivMapKey = tabURL.toString() + eachPageCallIterator.toString();
        eachPageCallDiv.set(eachPageCallDivMapKey, eachPageCallData);
    }
}

function getEachNetworkData(requestMethod, requestData, responseStatus, responseData) {
    return colorText(requestMethod, REQUEST_METHOD) + NEW_LINE +
            colorText(requestData, REQUEST_BODY) + NEW_LINE +
            colorText(responseStatus, RESPONSE_STATUS) + NEW_LINE +
            colorText(responseData, RESPONSE_DATA);
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
    return '<button style="background-color:#FF4136;border-color:#FF4136;" type="button" class="btn btn-info" data-toggle="collapse" data-target=' + data_target + '>' +
            tabUrlButtonText + '</button>' + '<div id=' + div_id + ' style="background-color:rgb(133, 20, 75);" class="collapse" style="background-color: antiquewhite;">';
}

function createCollapsableButtonWithText(buttonText, internalText) {
    var data_target = "#demo" + id_iterator;
    var div_id = data_target.substr(1);
    id_iterator++;
    return '<button style="background-color:#0074D9;border-color:#0074D9;" type="button" class="btn btn-info" data-toggle="collapse" data-target=' + data_target + '>' + buttonText + '</button>' +
            '<div id=' + div_id + ' class="collapse" style="background-color: lightgoldenrodyellow;" ><div class="row">' + internalText + '</div></div><br><br>';
}

function createCollapsableImage(imageDocument) {
    screenshot_iterator++;
    if (imageDocument === undefined) {
        imageDocument = "Page not loaded yet...";    
    }
    return '<button style="margin-left:20px;background-color:#0074D9;border-color:#0074D9;" type="button" class="btn btn-info" data-toggle="collapse" data-target=#' + screenshot_iterator + '>' +
            SCREENSHOT_BUTTON_TEXT + '</button>' + '<div id=' + screenshot_iterator + ' class="collapse" style="background-color: antiquewhite;">' +
            imageDocument + '</div>';
}
/**
 * Create HTML divs for each AJAX request.
 * Also capture screenshot after each AJAX request completes.
 * Logic END
 */

/**
 * Build HTML page which will get downloaded.
 * Logic START
 */
function buildNetworkData() {
    for (var [pageCallKey, pageCallValue] of eachPageCallDiv) {
        networkData = networkData + pageCallValue;
        var numberOfCalls = eachPageNumberOfNetworkCalls.get(pageCallKey);
        for (var [networkCallKey, networkCallValue] of eachNetworkCallDiv) {
            if (numberOfCalls > 0) {
                networkData = networkData + NEW_LINE + networkCallValue + eachNetworkCallScreenshot.get(networkCallKey) + NEW_LINE + NEW_LINE;
                eachNetworkCallDiv.delete(networkCallKey);
                eachNetworkCallScreenshot.delete(networkCallKey);
                numberOfCalls--;
            } else {
                break;
            }
        }
        networkData = networkData + CLOSING_DIV + NEW_LINE + NEW_LINE;
    }
}
/**
 * Build HTML page which will get downloaded.
 * Logic END
 */
