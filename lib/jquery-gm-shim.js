"use strict";

// https://gist.github.com/monperrus/999065
// This is a shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest.
// This allows us to use $.getJSON instead of using GM_xmlhttpRequest directly.
//
// This is necessary because some sites (e.g. Twitter, DeviantArt) have a
// Content Security Policy that blocks us from making cross-origin requests to
// Danbooru. Tampermonkey allows us to bypass the CSP, but only if we use GM_xmlhttpRequest.
function GM_XHR(xmlhttpRequest) {
    this.type = null;
    this.url = null;
    this.async = null;
    this.username = null;
    this.password = null;
    this.status = null;
    this.readyState = null;
    this.headers = {};
    this.xmlhttpRequest = xmlhttpRequest;

    this.abort = function() {
        this.readyState = 0;
    };

    this.getAllResponseHeaders = function(name) {
        if (this.readyState != 4) return "";
        return this.responseHeaders;
    };

    this.getResponseHeader = function(name) {
        var regexp = new RegExp('^'+name+': (.*)$','im');
        var match = regexp.exec(this.responseHeaders);
        if (match) { return match[1]; }
        return '';
    };

    this.open = function(type, url, async, username, password) {
        this.type = type ? type : null;
        this.url = url ? url : null;
        this.async = async ? async : null;
        this.username = username ? username : null;
        this.password = password ? password : null;
        this.readyState = 1;
    };

    this.setRequestHeader = function(name, value) {
        this.headers[name] = value;
    };

    this.onresponse = function (handler) {
        let xhr = this;

        return function (resp) {
            xhr.readyState = resp.readyState;
            xhr.responseHeaders = resp.responseHeaders;
            xhr.responseText = resp.responseText;
            xhr.status = resp.status;
            xhr.statusText = resp.statusText;

            if (xhr[handler]) {           // if (xhr.onload) {
                xhr[handler].call(xhr);   //     xhr.onload();
            } else {
                xhr.onreadystatechange();
            }
        };
    };

    this.send = function(data) {
        this.data = data;

        this.xmlhttpRequest({
            fetch: true, // TM only - better `onerror` work
            timeout: 15_000, // to prevent hanging requests
            method: this.type,
            url: this.url,
            headers: this.headers,
            data: this.data,
            responseType: this.responseType,
            onload: this.onresponse("onload"),
            onerror: this.onresponse("onerror"),
            ontimeout: this.onresponse("onerror"),
            cookiePartition: {
                topLevelSite: `https://${new URL(this.url).hostname.split(".").slice(-2).join(".")}`,
            },
        });
    };
}

function GM_jQuery_setup() {
    // https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html
    // In Greasemonkey 4+ / Tampermonkey 4.5+, use GM.xmlHttpRequest. In earlier
    // versions, use GM_xmlhttpRequest.
    if (typeof GM !== "undefined" && GM.xmlHttpRequest !== undefined) {
        $.ajaxSetup({ xhr: () => new GM_XHR(GM.xmlHttpRequest) });
    } else {
        $.ajaxSetup({ xhr: () => new GM_XHR(GM_xmlhttpRequest) });
    }
}
