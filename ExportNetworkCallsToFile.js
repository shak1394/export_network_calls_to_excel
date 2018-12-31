// ==UserScript==
// @name         URL interceptor
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Collect network data.
// @author       Shaket Kumar
// @match        https://*/***
// @require      https://unpkg.com/xhook@latest/dist/xhook.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

var COMMA = ",";
var NEW_LINE = "\n";
var QUOTE = "\"";
var FILENAME = "NetworkData.csv";
var HEADERS = "Request Method, Request URL, Request Body, Request Header Names, Request Headers, Response Status, Response Data \n";

var networkData = HEADERS;

var input = document.createElement("input");
input.type = "button";
input.value = "Download network data";
input.onclick = downloadNetworkData;
document.body.appendChild(input);

function downloadNetworkData() {
  var a = document.createElement("a");
  a.href = "data:application/csv;charset=utf-8," + encodeURIComponent(networkData);
  a.download = FILENAME;
  document.getElementsByTagName("body")[0].appendChild(a);
  a.click();
  networkData = HEADERS;
}

(function() {
  xhook.after(function(request, response) {
    var requestBody = escapeCommaAndDoubleQuotesInJSON(request.body);
    var requestHeaderNames = escapeCommaAndDoubleQuotesInJSON(JSON.stringify(request.headerNames));
    var requestHeaders = escapeCommaAndDoubleQuotesInJSON(JSON.stringify(request.headers));
    var responseData = escapeCommaAndDoubleQuotesInJSON(response.data);

    var eachNetworkData = request.method + COMMA +
                            request.url + COMMA + 
                            QUOTE + requestBody + QUOTE + COMMA + 
                            QUOTE + requestHeaderNames + QUOTE + COMMA + 
                            QUOTE + requestHeaders + QUOTE + COMMA + 
                            response.status + COMMA + 
                            QUOTE + responseData + QUOTE + NEW_LINE;

    networkData = networkData + eachNetworkData;
  });
})();

function escapeCommaAndDoubleQuotesInJSON(callJSON) {
    if (!!callJSON) {
        if (callJSON.indexOf("\"") != -1) {
            callJSON = callJSON.replace(/"/g, '""');
        }

        if (callJSON.indexOf(",") != -1) {
            callJSON = callJSON.replace(/,/g, '\,');
        }
    }

    return callJSON;
}
