// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20190820003146
// @description  Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, and BCY to Danbooru tags.
// @homepageURL  https://github.com/evazion/translate-pixiv-tags
// @supportURL   https://github.com/evazion/translate-pixiv-tags/issues
// @updateURL    https://github.com/evazion/translate-pixiv-tags/raw/stable/translate-pixiv-tags.user.js
// @downloadURL  https://github.com/evazion/translate-pixiv-tags/raw/stable/translate-pixiv-tags.user.js
// @match        *://www.pixiv.net/*
// @match        *://dic.pixiv.net/*
// @match        *://nijie.info/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://www.tinami.com/*
// @match        *://bcy.net/*
// @match        *://*.deviantart.com/*
// @match        *://*.hentai-foundry.com/*
// @match        *://twitter.com/*
// @match        *://*.artstation.com/*
// @match        *://saucenao.com/*
// @match        *://pawoo.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore.js
// @connect      donmai.us
// @noframes
// ==/UserScript==

const SETTINGS = {
    list: [
        {
            name: "booru",
            defValue: "https://danbooru.donmai.us",
            descr: "Danbooru subdomain for sending requests",
            type: "list",
            values: {
                "https://danbooru.donmai.us":   "Danbooru",
                "https://kagamihara.donmai.us": "Kagamihara",
                "https://saitou.donmai.us":     "Saitou",
                "https://shima.donmai.us":      "Shima",
            },
        }, {
            name: "cache_lifetime",
            defValue: 60*5,
            descr: "The amount of time in seconds to cache data from Danbooru before querying again",
            type: "number",
        }, {
            name: "preview_limit",
            defValue: 3,
            descr: "The number of recent posts to show in artist tooltips",
            type: "number",
        }, {
            name: "show_preview_rating",
            defValue: "s",
            descr: "The upper level of rating for preview (higher ratings will be blurred)",
            type: "list",
            values: {
                "s": "Safe",
                "q": "Questionable",
                "e": "Explicit",
            }
        }
    ],
    isValid: function(name, value) {
        const setting = this.list.find(s => s.name===name);
        if (!setting) {
            console.error("No setting "+name);
            return false;
        }
        switch (setting.type) {
            case "number": return Number.isInteger(value) && value>0;
            case "list": return setting.values.hasOwnProperty(value);
            default:
                console.error("Unsupported type "+setting.type);
                return false;
        }
    },
    get: function(name) {
        const setting = this.list.find(s => s.name===name);
        if (!setting) {
            console.error("no setting "+name);
            return null;
        }
        const value = GM_getValue(name);
        if (typeof value === "undefined" || !this.isValid(name, value)) {
            GM_setValue(name, setting.defValue);
            return setting.defValue;
        }
        return value;
    },
    set: function(name, value) {
        const setting = this.list.find(s => s.name===name);
        if (!setting) {
            console.error("no setting "+name);
            return null;
        }
        if (this.isValid(name, value)) {
            GM_setValue(name, value);
            return true;
        } else {
            console.warn(`Invalid value ${value} for ${name}`);
            return false;
        }
    }
};

// Which domain to send requests to
const BOORU = SETTINGS.get("booru");
// How long (in seconds) to cache translated tag lookups.
const CACHE_LIFETIME = SETTINGS.get("cache_lifetime");
// Number of recent posts to show in artist tooltips.
const ARTIST_POST_PREVIEW_LIMIT = SETTINGS.get("preview_limit");
// The upper level of rating to show preview. Higher ratings will be blurred.
const SHOW_PREVIEW_RATING = SETTINGS.get("show_preview_rating");

//Values needed from Danbooru API calls using the "only" parameter
const POST_FIELDS = "id,is_pending,is_flagged,is_deleted,parent_id,has_visible_children,tag_string,image_width,image_height,preview_file_url,source,file_size,rating,created_at";
const POST_COUNT_FIELDS = "post_count";
const TAG_FIELDS = "name,category";
const WIKI_FIELDS = "title,category_name";
const ARTIST_FIELDS = "id,name,is_banned,other_names,urls";

// Inline qtip2 css to avoid CSP issues on twitter.
// https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.min.css
const QTIP_CSS = `#qtip-overlay.blurs,.qtip-close{cursor:pointer}.qtip{position:absolute;left:-28000px;top:-28000px;display:none;max-width:280px;min-width:50px;font-size:10.5px;line-height:12px;direction:ltr;box-shadow:none;padding:0}.qtip-content,.qtip-titlebar{position:relative;overflow:hidden}.qtip-content{padding:5px 9px;text-align:left;word-wrap:break-word}.qtip-titlebar{padding:5px 35px 5px 10px;border-width:0 0 1px;font-weight:700}.qtip-titlebar+.qtip-content{border-top-width:0!important}.qtip-close{position:absolute;right:-9px;top:-9px;z-index:11;outline:0;border:1px solid transparent}.qtip-titlebar .qtip-close{right:4px;top:50%;margin-top:-9px}* html .qtip-titlebar .qtip-close{top:16px}.qtip-icon .ui-icon,.qtip-titlebar .ui-icon{display:block;text-indent:-1000em;direction:ltr}.qtip-icon,.qtip-icon .ui-icon{-moz-border-radius:3px;-webkit-border-radius:3px;border-radius:3px;text-decoration:none}.qtip-icon .ui-icon{width:18px;height:14px;line-height:14px;text-align:center;text-indent:0;font:normal 700 10px/13px Tahoma,sans-serif;color:inherit;background:-100em -100em no-repeat}.qtip-default{border:1px solid #F1D031;background-color:#FFFFA3;color:#555}.qtip-default .qtip-titlebar{background-color:#FFEF93}.qtip-default .qtip-icon{border-color:#CCC;background:#F1F1F1;color:#777}.qtip-default .qtip-titlebar .qtip-close{border-color:#AAA;color:#111}.qtip-light{background-color:#fff;border-color:#E2E2E2;color:#454545}.qtip-light .qtip-titlebar{background-color:#f1f1f1}.qtip-dark{background-color:#505050;border-color:#303030;color:#f3f3f3}.qtip-dark .qtip-titlebar{background-color:#404040}.qtip-dark .qtip-icon{border-color:#444}.qtip-dark .qtip-titlebar .ui-state-hover{border-color:#303030}.qtip-cream{background-color:#FBF7AA;border-color:#F9E98E;color:#A27D35}.qtip-red,.qtip-red .qtip-icon,.qtip-red .qtip-titlebar .ui-state-hover{border-color:#D95252}.qtip-cream .qtip-titlebar{background-color:#F0DE7D}.qtip-cream .qtip-close .qtip-icon{background-position:-82px 0}.qtip-red{background-color:#F78B83;color:#912323}.qtip-red .qtip-titlebar{background-color:#F06D65}.qtip-red .qtip-close .qtip-icon{background-position:-102px 0}.qtip-green{background-color:#CAED9E;border-color:#90D93F;color:#3F6219}.qtip-green .qtip-titlebar{background-color:#B0DE78}.qtip-green .qtip-close .qtip-icon{background-position:-42px 0}.qtip-blue{background-color:#E5F6FE;border-color:#ADD9ED;color:#5E99BD}.qtip-blue .qtip-titlebar{background-color:#D0E9F5}.qtip-blue .qtip-close .qtip-icon{background-position:-2px 0}.qtip-shadow{-webkit-box-shadow:1px 1px 3px 1px rgba(0,0,0,.15);-moz-box-shadow:1px 1px 3px 1px rgba(0,0,0,.15);box-shadow:1px 1px 3px 1px rgba(0,0,0,.15)}.qtip-bootstrap,.qtip-rounded,.qtip-tipsy{-moz-border-radius:5px;-webkit-border-radius:5px;border-radius:5px}.qtip-rounded .qtip-titlebar{-moz-border-radius:4px 4px 0 0;-webkit-border-radius:4px 4px 0 0;border-radius:4px 4px 0 0}.qtip-youtube{-moz-border-radius:2px;-webkit-border-radius:2px;border-radius:2px;-webkit-box-shadow:0 0 3px #333;-moz-box-shadow:0 0 3px #333;box-shadow:0 0 3px #333;color:#fff;border:0 solid transparent;background:#4A4A4A;background-image:-webkit-gradient(linear,left top,left bottom,color-stop(0,#4A4A4A),color-stop(100%,#000));background-image:-webkit-linear-gradient(top,#4A4A4A 0,#000 100%);background-image:-moz-linear-gradient(top,#4A4A4A 0,#000 100%);background-image:-ms-linear-gradient(top,#4A4A4A 0,#000 100%);background-image:-o-linear-gradient(top,#4A4A4A 0,#000 100%)}.qtip-youtube .qtip-titlebar{background-color:#4A4A4A;background-color:rgba(0,0,0,0)}.qtip-youtube .qtip-content{padding:.75em;font:12px arial,sans-serif;filter:progid:DXImageTransform.Microsoft.Gradient(GradientType=0, StartColorStr=#4a4a4a, EndColorStr=#000000);-ms-filter:"progid:DXImageTransform.Microsoft.Gradient(GradientType=0,StartColorStr=#4a4a4a,EndColorStr=#000000);"}.qtip-youtube .qtip-icon{border-color:#222}.qtip-youtube .qtip-titlebar .ui-state-hover{border-color:#303030}.qtip-jtools{background:#232323;background:rgba(0,0,0,.7);background-image:-webkit-gradient(linear,left top,left bottom,from(#717171),to(#232323));background-image:-moz-linear-gradient(top,#717171,#232323);background-image:-webkit-linear-gradient(top,#717171,#232323);background-image:-ms-linear-gradient(top,#717171,#232323);background-image:-o-linear-gradient(top,#717171,#232323);border:2px solid #ddd;border:2px solid rgba(241,241,241,1);-moz-border-radius:2px;-webkit-border-radius:2px;border-radius:2px;-webkit-box-shadow:0 0 12px #333;-moz-box-shadow:0 0 12px #333;box-shadow:0 0 12px #333}.qtip-jtools .qtip-titlebar{background-color:transparent;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=#717171, endColorstr=#4A4A4A);-ms-filter:"progid:DXImageTransform.Microsoft.gradient(startColorstr=#717171,endColorstr=#4A4A4A)"}.qtip-jtools .qtip-content{filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=#4A4A4A, endColorstr=#232323);-ms-filter:"progid:DXImageTransform.Microsoft.gradient(startColorstr=#4A4A4A,endColorstr=#232323)"}.qtip-jtools .qtip-content,.qtip-jtools .qtip-titlebar{background:0 0;color:#fff;border:0 dashed transparent}.qtip-jtools .qtip-icon{border-color:#555}.qtip-jtools .qtip-titlebar .ui-state-hover{border-color:#333}.qtip-cluetip{-webkit-box-shadow:4px 4px 5px rgba(0,0,0,.4);-moz-box-shadow:4px 4px 5px rgba(0,0,0,.4);box-shadow:4px 4px 5px rgba(0,0,0,.4);background-color:#D9D9C2;color:#111;border:0 dashed transparent}.qtip-cluetip .qtip-titlebar{background-color:#87876A;color:#fff;border:0 dashed transparent}.qtip-cluetip .qtip-icon{border-color:#808064}.qtip-cluetip .qtip-titlebar .ui-state-hover{border-color:#696952;color:#696952}.qtip-tipsy{background:#000;background:rgba(0,0,0,.87);color:#fff;border:0 solid transparent;font-size:11px;font-family:'Lucida Grande',sans-serif;font-weight:700;line-height:16px;text-shadow:0 1px #000}.qtip-tipsy .qtip-titlebar{padding:6px 35px 0 10px;background-color:transparent}.qtip-tipsy .qtip-content{padding:6px 10px}.qtip-tipsy .qtip-icon{border-color:#222;text-shadow:none}.qtip-tipsy .qtip-titlebar .ui-state-hover{border-color:#303030}.qtip-tipped{border:3px solid #959FA9;-moz-border-radius:3px;-webkit-border-radius:3px;border-radius:3px;background-color:#F9F9F9;color:#454545;font-weight:400;font-family:serif}.qtip-tipped .qtip-titlebar{border-bottom-width:0;color:#fff;background:#3A79B8;background-image:-webkit-gradient(linear,left top,left bottom,from(#3A79B8),to(#2E629D));background-image:-webkit-linear-gradient(top,#3A79B8,#2E629D);background-image:-moz-linear-gradient(top,#3A79B8,#2E629D);background-image:-ms-linear-gradient(top,#3A79B8,#2E629D);background-image:-o-linear-gradient(top,#3A79B8,#2E629D);filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=#3A79B8, endColorstr=#2E629D);-ms-filter:"progid:DXImageTransform.Microsoft.gradient(startColorstr=#3A79B8,endColorstr=#2E629D)"}.qtip-tipped .qtip-icon{border:2px solid #285589;background:#285589}.qtip-tipped .qtip-icon .ui-icon{background-color:#FBFBFB;color:#555}.qtip-bootstrap{font-size:14px;line-height:20px;color:#333;padding:1px;background-color:#fff;border:1px solid #ccc;border:1px solid rgba(0,0,0,.2);-webkit-border-radius:6px;-moz-border-radius:6px;border-radius:6px;-webkit-box-shadow:0 5px 10px rgba(0,0,0,.2);-moz-box-shadow:0 5px 10px rgba(0,0,0,.2);box-shadow:0 5px 10px rgba(0,0,0,.2);-webkit-background-clip:padding-box;-moz-background-clip:padding;background-clip:padding-box}.qtip-bootstrap .qtip-titlebar{padding:8px 14px;margin:0;font-size:14px;font-weight:400;line-height:18px;background-color:#f7f7f7;border-bottom:1px solid #ebebeb;-webkit-border-radius:5px 5px 0 0;-moz-border-radius:5px 5px 0 0;border-radius:5px 5px 0 0}.qtip-bootstrap .qtip-titlebar .qtip-close{right:11px;top:45%;border-style:none}.qtip-bootstrap .qtip-content{padding:9px 14px}.qtip-bootstrap .qtip-icon{background:0 0}.qtip-bootstrap .qtip-icon .ui-icon{width:auto;height:auto;float:right;font-size:20px;font-weight:700;line-height:18px;color:#000;text-shadow:0 1px 0 #fff;opacity:.2;filter:alpha(opacity=20)}#qtip-overlay,#qtip-overlay div{left:0;top:0;width:100%;height:100%}.qtip-bootstrap .qtip-icon .ui-icon:hover{color:#000;text-decoration:none;cursor:pointer;opacity:.4;filter:alpha(opacity=40)}.qtip:not(.ie9haxors) div.qtip-content,.qtip:not(.ie9haxors) div.qtip-titlebar{filter:none;-ms-filter:none}.qtip .qtip-tip{margin:0 auto;overflow:hidden;z-index:10}.qtip .qtip-tip,x:-o-prefocus{visibility:hidden}.qtip .qtip-tip,.qtip .qtip-tip .qtip-vml,.qtip .qtip-tip canvas{position:absolute;color:#123456;background:0 0;border:0 dashed transparent}.qtip .qtip-tip canvas{top:0;left:0}.qtip .qtip-tip .qtip-vml{behavior:url(#default#VML);display:inline-block;visibility:visible}#qtip-overlay{position:fixed}#qtip-overlay div{position:absolute;background-color:#000;opacity:.7;filter:alpha(opacity=70);-ms-filter:"progid:DXImageTransform.Microsoft.Alpha(Opacity=70)"}.qtipmodal-ie6fix{position:absolute!important}`;

// Container and viewport for qTips
$(`<div id="ex-qtips"></div>`).appendTo("body");
// Settings for artist tooltips.
const ARTIST_QTIP_SETTINGS = {
    style: {
        classes: "ex-artist-tooltip",
    },
    position: {
        my: "top center",
        at: "bottom center",
        viewport: $("#ex-qtips"),
        container: $("#ex-qtips"),
    },
    show: {
        delay: 500,
        solo: true,
    },
    hide: {
        delay: 250,
        fixed: true,
    },
};

//Domains where images outside of whitelist are blocked
const CORS_IMAGE_DOMAINS = [
    'twitter.com'
];

//Memory storage for already rendered artist tooltips
const rendered_qtips = {};

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
            method: this.type,
            url: this.url,
            headers: this.headers,
            data: this.data,
            responseType: this.responseType,
            onload: this.onresponse("onload"),
            onerror: this.onresponse("onerror"),
        });
    };
}

// https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html
// In Greasemonkey 4+ / Tampermonkey 4.5+, use GM.xmlHttpRequest. In earlier
// versions, use GM_xmlhttpRequest.
if (typeof GM !== "undefined" && GM.xmlHttpRequest !== undefined) {
    $.ajaxSetup({ xhr: () => new GM_XHR(GM.xmlHttpRequest) });
} else {
    $.ajaxSetup({ xhr: () => new GM_XHR(GM_xmlhttpRequest) });
}

$("head").append(`
<style>
    .ex-translated-tags {
        margin: 0 0.5em;
    }
    .ex-translated-tags * {
        display: inline !important;
        float: none !important;
        background: none !important;
        margin: 0 !important;
        padding: 0 !important;
        text-decoration: none !important;
        white-space: nowrap;
    }
    .ex-translated-tags::before {
        content: "(";
        white-space: nowrap;
    }
    .ex-translated-tags::after {
        content: ")";
        white-space: nowrap;
    }
    span.ex-translated-tags a.ex-translated-tag-category-5 {
        color: #F80 !important;
    }
    span.ex-translated-tags a.ex-translated-tag-category-4 {
        color: #0A0 !important;
    }
    span.ex-translated-tags a.ex-translated-tag-category-3 {
        color: #A0A !important;
    }
    span.ex-translated-tags a.ex-translated-tag-category-1 {
        color: #A00 !important;
    }
    span.ex-translated-tags a.ex-translated-tag-category-0 {
        color: #0073ff !important;
    }

    .ex-artist-tag {
        white-space: nowrap;
    }
    .ex-artist-tag.inline {
        display: inline-block;
        margin-left: 0.5em;
    }
    .ex-artist-tag a {
        color: #A00 !important;
        margin-left: 0.3ch;
        text-decoration: none;
    }
    .ex-artist-tag::before {
        content: "";
        display: inline-block;
        background-image: url('data:image/x-icon;base64,AAABAAEAEBAAAAEACABoBQAAFgAAACgAAAAQAAAAIAAAAAEACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXoCkAF+ApABegaQAX4GkAF+BpQBfgqYAYIKmAGGEpwBihagAY4apAGOHqgBliKwAZYmsAGaJrQBmiq0AZ4quAGiLrwBojLEAao6yAGuPswBsj7UAbJC1AG2QtQBskbUAbZK3AG+TuABwk7kAb5S4AHCUuQBwlLoAcZS6AHCVugBxlboAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQDAwMDAgIEBAAAAAAAAAAEAwMEAQQDAwQABAAAAAAABAQEAwMCBAQEAAQDAAAAAAMDAwQDAwQDAwAEAQAAAAALCwoJCAYEAgQABwUAAAAAFBUUExIREA4MAA8NAAAAACAgHiAgHRoZFwAYFgAAAAAgICAgIR8fHiAAISEAAAAAIB4gISEgISAeAB4eAAAAAAAAAAAAAAAAAAAeIAAAAAAAICAcICAgICAgACAAAAAAAAAgIB4gIR8bICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AACADwAAgAcAAIADAACAAQAAgAEAAIABAACAAQAAgAEAAIABAACAAQAAgAEAAMABAADgAQAA8AEAAP//AAA=');
        background-repeat: no-repeat;
        background-size: 12px;
        width: 12px;
        height: 12px;
        vertical-align: middle;
    }
    .ex-banned-artist-tag a::after {
        content: " (banned)";
    }

    #ex-qtips {
        position: fixed;
        width: 100vw;
        height: 100vh;
        top: 0;
        pointer-events: none;
        z-index: 15000;
    }
    #ex-qtips > * {
        pointer-events: all;
    }

    .ex-artist-tooltip.qtip {
        max-width: 538px !important;
        background-color: white;
    }
    .ex-artist-tooltip.qtip-dark {
        background-color: black;
    }
    .ex-artist-tooltip .qtip-content {
        width: 520px !important;
    }

    /* Fix https://www.pixiv.net/tags.php to display tags as vertical list. */
    #ex-pixiv .tag-list li {
        display: block;
    }
    #ex-pixiv .tag-list li::before {
        content: none;
    }
    /* Hide Pixiv's translated tags  */
    #ex-pixiv .ex-translated-tags + span .gtm-new-work-romaji-tag-event-click,
    #ex-pixiv .ex-translated-tags + span .gtm-new-work-translate-tag-event-click {
        display: none;
    }
    /* Remove hashtags from translated tags */
    #ex-pixiv .GpJOYWW a:before {
        content: "";
    }
    /* On the artist profile page, render the danbooru artist tag between the artist's name and follower count. */
    #ex-pixiv ._3_qyP5m {
        display: grid;
        grid-auto-rows: 16px;
        grid-template-columns: auto 1fr;
        justify-items: start;
    }
    #ex-pixiv ._3_qyP5m a[href^="/premium"] {
        grid-area: 1 / 2;
    }
    #ex-pixiv ._3_qyP5m .ex-artist-tag {
        grid-area: span 1 / span 2;
    }
    /* Illust page: fix locate artist tag to not trigger native tooltip */
    #ex-pixiv .jkOmvO {
        position: relative;
    }
    #ex-pixiv .hrdJSq {
        margin-bottom: 16px;
    }
    #ex-pixiv .jkOmvO .ex-artist-tag {
        position: absolute;
        bottom: 0;
        left: 47px;
    }
    /* Illust page: fix artist tag overflowing in related works */
    #ex-pixiv .bAzGIw {
        flex-direction: column;
        align-items: flex-start;
    }
    #ex-pixiv .bAzGIw .ex-artist-tag {
        margin-left: 2px;
        margin-top: -6px;
    }

    #ex-nijie .ex-translated-tags {
       font-family: Verdana, Helvetica, sans-serif;
    }
    /* Fix tag lists in http://nijie.info/view.php?id=203787 pages. */
    #ex-nijie #dojin_left #view-tag .tag {
      white-space: nowrap;
      border: 0;
    }

    /* Fix tags in http://seiga.nicovideo.jp/seiga/im7626097 */
    #ex-seiga .illust_tag .tag {
        background: #ebebeb;
        height: auto;
        margin: 0 10px 5px 0;
    }
    /* Fix artist tag in http://seiga.nicovideo.jp/seiga/im6950870 */
    #ex-seiga .im_head_bar .ex-artist-tag a {
        display: inline-block;
        border: none;
        background: none;
        padding: 0;
    }

    #ex-tinami .ex-translated-tags {
        font-family: Verdana, Helvetica, sans-serif;
        float: none !important;
        display: inline !important;
    }

    #ex-deviantart .ex-artist-tag a {
        color: #A00 !important;
    }

    #ex-twitter .ex-artist-tag {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif;
    }
    /* Old design: on post page locate the artist tag below author's @name. */
    #ex-twitter .permalink-header {
        display: grid;
        grid-template-columns: 1fr auto auto;
        height: auto;
    }
    #ex-twitter .permalink-header .ex-artist-tag {
        grid-row: 2;
        margin-left: 0;
    }
    /* Fix position of artist tag in an expanded tweet */
    #ex-twitter .r-18u37iz.r-thb0q2.r-wgs6xk .r-zl2h9q {
        display: grid;
        grid-template-columns: auto 32px;
    }
    #ex-twitter .r-18u37iz.r-thb0q2.r-wgs6xk .r-zl2h9q .ex-artist-tag {
        grid-area: 2/1;
        margin: 0;
    }

    #ex-artstation .qtip-content {
        box-sizing: initial;
    }
    #ex-artstation .artist-name-and-headline .ex-artist-tag {
        font-size: 12pt;
        line-height: 150%;
    }
    #ex-artstation .hover-card .ex-artist-tag {
        font-size: 12pt;
        margin-top: -10px;
    }
    #ex-artstation a.user .ex-artist-tag {
        line-height: 100%;
    }
    #ex-artstation .site-title .ex-artist-tag {
        font-size: 12pt;
        line-height: 100%;
        margin-top: -10px;
    }
    #ex-artstation .site-title .ex-artist-tag a {
        font-size: 12pt;
    }

    #ex-saucenao .ex-translated-tags {
        margin: 0;
    }
    #ex-saucenao .ex-translated-tags::before, #ex-saucenao .ex-translated-tags::after {
        content: none;
    }
    #ex-saucenao .ex-translated-tags + .target, #ex-saucenao .ex-artist-tag + .target {
        display: none;
    }

    /* Active Users sidebar */
    #ex-pawoo .account__avatar-wrapper {
        display: flex;
        height: 100%;
        align-items: center;
    }
    /* fix newline in arist tag in cards of following users and followers */
    #ex-pawoo .ex-artist-tag a {
        display: inline;
    }
`);

// tag function for template literals to remove newlines and leading spaces
function noIndents(strings, ...values) {
    // remove all spaces before/after a tag and leave one in other cases
    strings = strings.map(s => s.replace(/(>)?\n *(<)?/g, (s, lt, gt) => lt&&gt ? lt+gt : lt||gt ? (lt||gt) : " "));
    let res = new Array(values.length*2+1);
    for (let i = 0; i < values.length; i++) {
        res[i*2] = strings[i];
        res[i*2+1] = values[i];
    }
    res[res.length-1] = strings[strings.length-1];
    return res.join("");
}

function getImage(image_url) {
    return new Promise((resolve,reject)=>{
        GM.xmlHttpRequest({
            method: "GET",
            url: image_url,
            responseType: 'blob',
            onload: function(resp) {resolve(resp.response);},
            onerror: function(resp) {reject(resp);}
        });
    });
}

const getJSONMemoized = _.memoize(
    (url, params) => $.getJSON(url, params),
    (url, params) => url + $.param(params)
);

function get(url, params, cache = CACHE_LIFETIME, base_url = BOORU) {
    if (cache > 0) {
        const timestamp = Math.round((Date.now() / 1000 / cache));
        params = { ...params, expiry: 365, timestamp: timestamp };
    }
    return getJSONMemoized(`${base_url}${url}.json`, params)
        .catch(xhr => {
            console.error(xhr.status, xhr);
            return [];
        });
}

async function translateTag(target, tagName, options) {
    const normalizedTag = tagName.trim().normalize("NFKC").replace(/\d+users入り$/, "").replace(/^#/, "");

    /* tags like "5000users入り$" become empty after normalization; don't search for empty tags. */
    if (normalizedTag.length === 0) {
        return [];
    }

    let tags = [];

    const wikiPages = await get("/wiki_pages", {search: {other_names_match: normalizedTag, is_deleted: false}, only: WIKI_FIELDS});
    if (wikiPages.length) {
        tags = wikiPages.map(wikiPage => new Object({
            name: wikiPage.title,
            prettyName: wikiPage.title.replace(/_/g, " "),
            category: wikiPage.category_name,
        }));
    } else if (normalizedTag.match(/^[\x20-\x24\x26-\x29\x2B\x2D-\x7F]+$/)) { // ASCII characters except percent, asterics, and comma
        // The index action on the tags endpoint does not support expirations
        tags = await get("/tags", {search: {name: normalizedTag}, only: TAG_FIELDS}, 0);
        tags = tags.map(tag => new Object({
            name: tag.name,
            prettyName: tag.name.replace(/_/g, " "),
            category: tag.category,
        }));
    }
    addDanbooruTags($(target), tags, options);
}

function addDanbooruTags($target, tags, options = {}) {
    if (tags.length === 0) {
        return;
    }
    let { classes = "",
          onadded = null, // ($tag)=>{},
          tagPosition: {
            searchAt = "nextAll",
            insertAt = "insertAfter"
          } = {}
    } = options;

    const $tagsContainer = $(noIndents`
        <span class="ex-translated-tags ${classes}">
            ${tags.map(tag => noIndents`
                <a class="ex-translated-tag-category-${tag.category}"
                   href="${BOORU}/posts?tags=${encodeURIComponent(tag.name)}">
                        ${_.escape(tag.prettyName)}
                </a>`)
            .join(", ")}
        </span>`);
    $tagsContainer[insertAt]($target);
    if (onadded) onadded($tagsContainer);
}

async function translateArtistByURL(element, profileUrl, options) {
    if (!profileUrl) return;

    const artists = await get("/artists", {search: {url_matches: profileUrl, is_active: true}, only: ARTIST_FIELDS});
    const pUrl = new URL(profileUrl.replace(/\/$/,"").toLowerCase());
    artists
        // fix of #18: for some unsupported domains, Danbooru returns false-positive results
        .filter(({urls}) => urls
            .flatMap(({url, normalized_url}) => [url, normalized_url])
            .map(url => new URL(url.replace(/\/$/,"").toLowerCase()))
            .some(aUrl => (pUrl.host==aUrl.host && pUrl.pathname==aUrl.pathname && pUrl.search==aUrl.search)))
        .map(artist => addDanbooruArtist($(element), artist, options));
}

async function translateArtistByName(element, artistName, options) {
    if (!artistName) return;

    const artists = await get("/artists", {search: {name: artistName.replace(/ /g, "_"), is_active: true}, only: ARTIST_FIELDS});
    artists.map(artist => addDanbooruArtist($(element), artist, options));
}

function addDanbooruArtist($target, artist, options = {}) {
    let { classes = "",
          onadded = null, // ($tag)=>{},
          tagPosition: {
            searchAt = "nextAll",
            insertAt = "insertAfter"
          } = {}
    } = options;

    classes += artist.is_banned ? " ex-artist-tag ex-banned-artist-tag" : " ex-artist-tag";
    artist.prettyName = artist.name.replace(/_/g, " ");
    artist.escapedName = _.escape(artist.prettyName);
    artist.encodedName = encodeURIComponent(artist.name);

    const qtip_settings = Object.assign(ARTIST_QTIP_SETTINGS, {
        content: { text: (event, qtip) => buildArtistTooltip(artist, qtip) }
    });

    let duplicates = $target[searchAt](".ex-artist-tag")
                        .filter((i,el) => el.innerText.trim() == artist.escapedName);
    if (duplicates.length) {
        // if qtip was removed then add it back
        if (!$.data(duplicates.find("a")[0]).qtip) {
            $(duplicates).find("a").qtip(qtip_settings);
        }
        return;
    }

    let $tag = $(noIndents`
        <div class="${classes}">
            <a href="${BOORU}/artists/${artist.id}">
                ${artist.escapedName}
            </a>
        </div>`);
    $tag[insertAt]($target);
    $tag.find("a").qtip(qtip_settings).end();
    if (onadded) onadded($tag);
}

async function attachShadow(target, callback) {
    if (target.shadowRoot) {
        return;
    } else if (!_.isFunction(document.body.attachShadow)) {
        const element = await callback();
        $(target).html(element);
    } else {
        const shadowRoot = target.attachShadow({ mode: "open" });
        const element = await callback();
        $(shadowRoot).append(element);
    }
}

function chooseBackgroundColorScheme($element) {
    const TRANSPARENT_COLOR = "rgba(0, 0, 0, 0)";
    //Halfway between white/black in the RGB scheme
    const MIDDLE_LUMINOSITY = 128;

    // Get background colors of all parent elements with a nontransparent background color
    let background_colors = $element.parents()
        .map((i,el) => $(el).css("background-color"))
        .get()
        .filter(color => color !== TRANSPARENT_COLOR);
    // calculate summary color and get RGB channels
    let color_array = background_colors
        .map(color => color.match(/(\d+(\.\d+)?)+/g))
        .reverse()
        .reduce(([r1,g1,b1],[r2,g2,b2,al=1]) => [r1*(1-al)+r2*al, g1*(1-al)+g2*al, b1*(1-al)+b2*al])
        .slice(0, 3); // Ignore alpha
    let median_luminosity = (Math.max(...color_array) + Math.min(...color_array)) / 2;
    let qtip_class = (median_luminosity < MIDDLE_LUMINOSITY ? "qtip-dark" : "qtip-light");
    let adjusted_array = color_array.map((color) => {
        let color_scale = (color - MIDDLE_LUMINOSITY) / MIDDLE_LUMINOSITY;
        let adjusted_color = ((Math.abs(color_scale)**0.7) // Exponentiation to reduce the scale
                             * Math.sign(color_scale)      // Get original sign back
                             * MIDDLE_LUMINOSITY)          // Get original amplitude back
                             + MIDDLE_LUMINOSITY;          // Get back to the RGB color range
        return Math.round(adjusted_color);
    });
    let adjusted_color = `rgb(${adjusted_array.join(", ")})`;
    return [qtip_class, adjusted_color];
}

async function buildArtistTooltip(artist, qtip) {
    attachShadow(qtip.elements.content.get(0), async () => {
        if (!(artist.name in rendered_qtips)) {
            //The index action on the posts and tags endpoints does not support expirations
            const posts = get(`/posts`, {tags: `status:any ${artist.name}`, limit: ARTIST_POST_PREVIEW_LIMIT, only: POST_FIELDS}, 0);
            const tags = get(`/tags`, {search: {name: artist.name}, only: POST_COUNT_FIELDS}, 0);

            rendered_qtips[artist.name] = buildArtistTooltipContent(artist, await tags, await posts);
            return rendered_qtips[artist.name];
        }
        return rendered_qtips[artist.name].clone();
    })
    .then(() => qtip.reposition(null, false));
    if (!qtip.elements.tooltip.hasClass("qtip-dark") && !qtip.elements.tooltip.hasClass("qtip-light")) {
        // select theme and background color based upon the background of surrounding elements
        let [qtip_class, adjusted_color] = chooseBackgroundColorScheme(qtip.elements.target);
        qtip.elements.tooltip.addClass(qtip_class);
        qtip.elements.tooltip.css("background-color", adjusted_color);
    }
}

function buildArtistTooltipContent(artist, [tag = {post_count:0}], posts = []) {
    let $content = $(noIndents`
        <style>
            :host {
                --preview_has_children_color: #0F0;
                --preview_has_parent_color: #CC0;
                --preview_deleted_color: #000;
                --preview_pending_color: #00F;
                --preview_flagged_color: #F00;
            }

            article.container {
                font-family: Verdana, Helvetica, sans-serif;
                padding: 10px;
            }

            section {
                margin-bottom: 15px;
            }

            h2 {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 5px;
            }

            a.artist-name {
                font-size: 20px;
            }

            .post-count {
                color: #888;
                margin-left: 3px;
            }

            ul.other-names {
                margin-top: 5px;
                line-height: 24px;
                padding: 0px;
                max-height: 48px;
            }

            ul.other-names li {
                display: inline;
            }

            ul.other-names li a {
                background-color: rgba(128,128,128,0.2);
                padding: 3px;
                margin: 0 2px;
                border-radius: 3px;
                white-space: nowrap;
            }

            section.urls ul {
                list-style: disc inside;
                padding: 0px;
                max-height: 145px;
            }

            section.urls ul li.artist-url-inactive a {
                color: red;
                text-decoration: underline;
                text-decoration-style: dotted;
            }


            /* Basic styles taken from Danbooru */
            a:link, a:visited {
                color: #0073FF;
                text-decoration: none;
            }

            a:hover {
                color: #80B9FF;
            }

            a.tag-category-artist {
                color: #A00;
            }

            a.tag-category-artist:hover {
                color: #B66;
            }



            /* Thumbnail styles taken from Danbooru */
            article.post-preview {
                /*height: 154px;*/
                width: 154px;
                margin: 0 10px 10px 0;
                float: left;
                overflow: hidden;
                text-align: center;
                position: relative;
            }

            article.post-preview a {
                margin: auto;
                border: 2px solid transparent;
                display: inline-block;
            }

            article.post-preview.post-status-has-children a {
                border-color: var(--preview_has_children_color);
            }

            article.post-preview.post-status-has-parent a {
                border-color: var(--preview_has_parent_color);
            }

            article.post-preview.post-status-has-children.post-status-has-parent a {
                border-color: var(--preview_has_children_color) var(--preview_has_parent_color) var(--preview_has_parent_color) var(--preview_has_children_color);
            }

            article.post-preview.post-status-deleted a {
                border-color: var(--preview_deleted_color);
            }

            article.post-preview.post-status-has-children.post-status-deleted a {
                border-color: var(--preview_has_children_color) var(--preview_deleted_color) var(--preview_deleted_color) var(--preview_has_children_color);
            }

            article.post-preview.post-status-has-parent.post-status-deleted a {
                border-color: var(--preview_has_parent_color) var(--preview_deleted_color) var(--preview_deleted_color) var(--preview_has_parent_color);
            }

            article.post-preview.post-status-has-children.post-status-has-parent.post-status-deleted a {
                border-color: var(--preview_has_children_color) var(--preview_deleted_color) var(--preview_deleted_color) var(--preview_has_parent_color);
            }

            article.post-preview.post-status-pending a,
            article.post-preview.post-status-flagged a {
                border-color: var(--preview_pending_color);
            }

            article.post-preview.post-status-has-children.post-status-pending a,
            article.post-preview.post-status-has-children.post-status-flagged a {
                border-color: var(--preview_has_children_color) var(--preview_pending_color) var(--preview_pending_color) var(--preview_has_children_color);
            }

            article.post-preview.post-status-has-parent.post-status-pending a,
            article.post-preview.post-status-has-parent.post-status-flagged a {
                border-color: var(--preview_has_parent_color) var(--preview_pending_color) var(--preview_pending_color) var(--preview_has_parent_color);
            }

            article.post-preview.post-status-has-children.post-status-has-parent.post-status-pending a,
            article.post-preview.post-status-has-children.post-status-has-parent.post-status-flagged a {
                border-color: var(--preview_has_children_color) var(--preview_pending_color) var(--preview_pending_color) var(--preview_has_parent_color);
            }

            article.post-preview[data-tags~=animated]:before {
                content: "►";
                position: absolute;
                width: 20px;
                height: 20px;
                color: white;
                background-color: rgba(0,0,0,0.5);
                margin: 2px;
                text-align: center;
            }

            article.post-preview[data-has-sound=true]:before {
                content: "♪";
                position: absolute;
                width: 20px;
                height: 20px;
                color: white;
                background-color: rgba(0,0,0,0.5);
                margin: 2px;
                text-align: center;
            }


            div.post-list {
                display: flex;
                flex-wrap: wrap;
                max-height: 420px;
                align-items: flex-end;
            }

            article.post-preview a {
                display: inline-block;
                /*height: 154px;*/
                overflow: hidden;
            }

            article.post-preview img {
                margin-bottom: -2px;
            }

            article.post-preview p {
                text-align: center;
                margin: 0 0 2px 0;
            }

            article.post-preview.blur-post img {
                filter: blur(10px);
            }

            article.post-preview.blur-post:hover img {
                filter: blur(0px);
                transition: filter 1s 0.5s;
            }

            .scrollable {
                overflow: auto;
            }
            .scrollable::-webkit-scrollbar {
                width: 6px;
            }

            .scrollable::-webkit-scrollbar-track {
                background-color: rgba(128,128,128,0.2);
                border-radius: 6px;
            }

            .scrollable::-webkit-scrollbar-thumb {
                background-color: rgba(128,128,128,0.4);
                border-radius: 6px;
            }

            .settings-icon {
                position:absolute;
                top: 10px;
                right: 10px;
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            .settings-icon path {
                fill: #888;
            }
        </style>

        <article class="container" part="container">
            <!-- icon by Gregor Cresnar @ flaticon.com -->
            <svg class="settings-icon" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
                     viewBox="0 0 478.703 478.703" style="enable-background:new 0 0 478.703 478.703;" xml:space="preserve">
                <title>Show translate-pixiv-tags settigns</title>
                <g>
                    <g>
                        <path d="M454.2,189.101l-33.6-5.7c-3.5-11.3-8-22.2-13.5-32.6l19.8-27.7c8.4-11.8,7.1-27.9-3.2-38.1l-29.8-29.8
                            c-5.6-5.6-13-8.7-20.9-8.7c-6.2,0-12.1,1.9-17.1,5.5l-27.8,19.8c-10.8-5.7-22.1-10.4-33.8-13.9l-5.6-33.2
                            c-2.4-14.3-14.7-24.7-29.2-24.7h-42.1c-14.5,0-26.8,10.4-29.2,24.7l-5.8,34c-11.2,3.5-22.1,8.1-32.5,13.7l-27.5-19.8
                            c-5-3.6-11-5.5-17.2-5.5c-7.9,0-15.4,3.1-20.9,8.7l-29.9,29.8c-10.2,10.2-11.6,26.3-3.2,38.1l20,28.1
                            c-5.5,10.5-9.9,21.4-13.3,32.7l-33.2,5.6c-14.3,2.4-24.7,14.7-24.7,29.2v42.1c0,14.5,10.4,26.8,24.7,29.2l34,5.8
                            c3.5,11.2,8.1,22.1,13.7,32.5l-19.7,27.4c-8.4,11.8-7.1,27.9,3.2,38.1l29.8,29.8c5.6,5.6,13,8.7,20.9,8.7c6.2,0,12.1-1.9,17.1-5.5
                            l28.1-20c10.1,5.3,20.7,9.6,31.6,13l5.6,33.6c2.4,14.3,14.7,24.7,29.2,24.7h42.2c14.5,0,26.8-10.4,29.2-24.7l5.7-33.6
                            c11.3-3.5,22.2-8,32.6-13.5l27.7,19.8c5,3.6,11,5.5,17.2,5.5l0,0c7.9,0,15.3-3.1,20.9-8.7l29.8-29.8c10.2-10.2,11.6-26.3,3.2-38.1
                            l-19.8-27.8c5.5-10.5,10.1-21.4,13.5-32.6l33.6-5.6c14.3-2.4,24.7-14.7,24.7-29.2v-42.1
                            C478.9,203.801,468.5,191.501,454.2,189.101z M451.9,260.401c0,1.3-0.9,2.4-2.2,2.6l-42,7c-5.3,0.9-9.5,4.8-10.8,9.9
                            c-3.8,14.7-9.6,28.8-17.4,41.9c-2.7,4.6-2.5,10.3,0.6,14.7l24.7,34.8c0.7,1,0.6,2.5-0.3,3.4l-29.8,29.8c-0.7,0.7-1.4,0.8-1.9,0.8
                            c-0.6,0-1.1-0.2-1.5-0.5l-34.7-24.7c-4.3-3.1-10.1-3.3-14.7-0.6c-13.1,7.8-27.2,13.6-41.9,17.4c-5.2,1.3-9.1,5.6-9.9,10.8l-7.1,42
                            c-0.2,1.3-1.3,2.2-2.6,2.2h-42.1c-1.3,0-2.4-0.9-2.6-2.2l-7-42c-0.9-5.3-4.8-9.5-9.9-10.8c-14.3-3.7-28.1-9.4-41-16.8
                            c-2.1-1.2-4.5-1.8-6.8-1.8c-2.7,0-5.5,0.8-7.8,2.5l-35,24.9c-0.5,0.3-1,0.5-1.5,0.5c-0.4,0-1.2-0.1-1.9-0.8l-29.8-29.8
                            c-0.9-0.9-1-2.3-0.3-3.4l24.6-34.5c3.1-4.4,3.3-10.2,0.6-14.8c-7.8-13-13.8-27.1-17.6-41.8c-1.4-5.1-5.6-9-10.8-9.9l-42.3-7.2
                            c-1.3-0.2-2.2-1.3-2.2-2.6v-42.1c0-1.3,0.9-2.4,2.2-2.6l41.7-7c5.3-0.9,9.6-4.8,10.9-10c3.7-14.7,9.4-28.9,17.1-42
                            c2.7-4.6,2.4-10.3-0.7-14.6l-24.9-35c-0.7-1-0.6-2.5,0.3-3.4l29.8-29.8c0.7-0.7,1.4-0.8,1.9-0.8c0.6,0,1.1,0.2,1.5,0.5l34.5,24.6
                            c4.4,3.1,10.2,3.3,14.8,0.6c13-7.8,27.1-13.8,41.8-17.6c5.1-1.4,9-5.6,9.9-10.8l7.2-42.3c0.2-1.3,1.3-2.2,2.6-2.2h42.1
                            c1.3,0,2.4,0.9,2.6,2.2l7,41.7c0.9,5.3,4.8,9.6,10,10.9c15.1,3.8,29.5,9.7,42.9,17.6c4.6,2.7,10.3,2.5,14.7-0.6l34.5-24.8
                            c0.5-0.3,1-0.5,1.5-0.5c0.4,0,1.2,0.1,1.9,0.8l29.8,29.8c0.9,0.9,1,2.3,0.3,3.4l-24.7,34.7c-3.1,4.3-3.3,10.1-0.6,14.7
                            c7.8,13.1,13.6,27.2,17.4,41.9c1.3,5.2,5.6,9.1,10.8,9.9l42,7.1c1.3,0.2,2.2,1.3,2.2,2.6v42.1H451.9z"/>
                        <path d="M239.4,136.001c-57,0-103.3,46.3-103.3,103.3s46.3,103.3,103.3,103.3s103.3-46.3,103.3-103.3S296.4,136.001,239.4,136.001
                            z M239.4,315.601c-42.1,0-76.3-34.2-76.3-76.3s34.2-76.3,76.3-76.3s76.3,34.2,76.3,76.3S281.5,315.601,239.4,315.601z"/>
                    </g>
                </g>
            </svg>
            <section class="header">
                <a class="artist-name tag-category-artist"
                   href="${BOORU}/artists/${artist.id}">
                    ${_.escape(artist.prettyName)}
                </a>
                <span class="post-count">${tag.post_count}</span>

                <ul class="other-names scrollable" part="other-names">
                    ${artist.other_names.filter(String).sort().map(other_name => `
                        <li>
                            <a href="${BOORU}/artists?search[name]=${encodeURIComponent(other_name)}">
                                ${_.escape(other_name.replace(/_/g, " "))}
                            </a>
                        </li>`
                    ).join("")}
                </ul>
            </section>
            <section class="urls">
                <h2>
                    URLs
                    (<a href="${BOORU}/artists/${artist.id}/edit">edit</a>)
                </h2>
                <ul class="scrollable" part="url-list">
                    ${buildArtistUrlsHtml(artist)}
                </ul>
            </section>
            <section class="posts">
                <h2>
                    Posts
                    <a href="${BOORU}/posts?tags=${artist.encodedName}">»</a>
                </h2>
                <div class="post-list scrollable" part="post-list"></div>
            </section>
        </article>
    `);
    $content.find(".post-list").append(posts.map(buildPostPreview));
    $content.find(".settings-icon").click(showSettings);
    return $content;
}

function buildArtistUrlsHtml(artist) {
    const domainSorter = artist_url => new URL(artist_url.normalized_url).host.match(/[^.]*\.[^.]*$/)[0];
    const artist_urls = _(artist.urls).chain()
                                      .uniq('normalized_url')
                                      .sortBy('normalized_url')
                                      .sortBy(domainSorter)
                                      .sortBy(artist_url => !artist_url.is_active);

    const html = artist_urls.map(artist_url => {
        const normalized_url = artist_url.normalized_url.replace(/\/$/, "");
        const urlClass = artist_url.is_active ? "artist-url-active" : "artist-url-inactive";

        return noIndents`
            <li class="${urlClass}">
                <a href="${normalized_url}">
                    ${_.escape(normalized_url)}
                </a>
            </li>`;
    }).join("");

    return html;
}

function timeToAgo(time) {
    const interval = new Date(Date.now() - new Date(time));
    if (interval < 60000) return "less than a minute ago";
    const values = [{
        value: interval.getUTCFullYear()-1970,
        unit: "year",
    }, {
        value: interval.getUTCMonth(),
        unit: "month",
    }, {
        value: interval.getUTCDate()-1,
        unit: "day",
    }, {
        value: interval.getUTCHours(),
        unit: "hour",
    }, {
        value: interval.getUTCMinutes(),
        unit: "minute",
    }];
    for (let {value, unit} of values) {
        if (value) return `${value} ${(value>1 ? unit+"s" : unit)} ago`;
    }
    return "∞ ago";
}
// based on https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function buildPostPreview(post) {
    const RATINGS = {s:0, q:1, e:2};
    let [width, height] = [150, 150];
    let preview_file_url = `${BOORU}/images/download-preview.png`;

    let preview_class = "post-preview";
    preview_class += post.is_pending           ? " post-status-pending"      : "";
    preview_class += post.is_flagged           ? " post-status-flagged"      : "";
    preview_class += post.is_deleted           ? " post-status-deleted"      : "";
    preview_class += post.parent_id            ? " post-status-has-parent"   : "";
    preview_class += post.has_visible_children ? " post-status-has-children" : "";
    if (RATINGS[post.rating] > RATINGS[SHOW_PREVIEW_RATING]) {
        preview_class += " blur-post";
    }

    const data_attributes = `
      data-id="${post.id}"
      data-has-sound="${!!post.tag_string.match(/(video_with_sound|flash_with_sound)/)}"
      data-tags="${_.escape(post.tag_string)}"
    `;

    let scale = Math.min(150 / post.image_width, 150 / post.image_height);
    scale = Math.min(1, scale);

    let $preview;
    if (post.preview_file_url) {
        width = Math.round(post.image_width * scale);
        height = Math.round(post.image_height * scale);
        if (CORS_IMAGE_DOMAINS.includes(location.host)) {
            // temporaly set transparent 1x1 image
            preview_file_url = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            getImage(post.preview_file_url).then((blob) => {
                let image_blob = blob.slice(0, blob.size, "image/jpeg");
                let blob_url = window.URL.createObjectURL(image_blob);
                $preview.find("img").prop("src", blob_url);
            });
        } else {
            preview_file_url = post.preview_file_url;
        }
    }

    const domain = post.source.match(/^https?:\/\//)
                    ? new URL(post.source).hostname.split(".").slice(-2).join(".")
                    : "NON-WEB";
    const img_size = [post.file_size, post.image_width, post.image_height].every(_.isFinite)
                    ? `${formatBytes(post.file_size)} (${post.image_width}x${post.image_height})`
                    : "";

    $preview = $(noIndents`
        <article itemscope
                 itemtype="http://schema.org/ImageObject"
                 class="${preview_class}"
                 ${data_attributes} >
            <a href="${BOORU}/posts/${post.id}">
                <img width="${width}"
                     height="${height}"
                     src="${preview_file_url}"
                     title="${_.escape(post.tag_string)}"
                     part="post-preview rating-${post.rating}">
            </a>
            <p>${img_size}</p>
            <p style="letter-spacing: -0.1px;">${domain}, rating:${post.rating.toUpperCase()}</p>
            <p>${timeToAgo(post.created_at)}</p>
        </article>
    `);
    return $preview;
}

function showSettings() {
    const settingToInput = (setting) => {
        const value = SETTINGS.get(setting.name);
        switch (setting.type) {
            case "number":
                return noIndents`
                    <input type="number"
                           min="0"
                           value="${value}"
                           name="${setting.name}" />`;
            case "list":
                return noIndents`
                    <select name="${setting.name}">
                        ${Object
                            .entries(setting.values)
                            .map(([val,descr]) =>
                                noIndents`
                                <option value="${val}" ${val==value?"selected":""}>
                                    ${descr}
                                </option>`)
                            .join("")}
                    </select>`;
            default:
                console.error("Unsupported type "+setting.type);
                return "";
        }
    };
    const $settings = $(
        noIndents`
        <style>
            #ui-settings {
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.25);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 16000;
            }
            #ui-settings.qtip-dark {
                background: rgba(0,0,0,0.75);
            }
            .container {
                padding: 20px;
                display: grid;
                grid-template-columns: 300px 1fr;
                grid-gap: 10px;
                font-size: 12px;
            }
            .qtip-light .container {
                background-color: #fff;
                color: #222;
            }
            .qtip-dark .container {
                background-color: #222;
                color: #fff;
            }
            .container div:nth-of-type(even) {
                display: flex;
                flex-direction: column-reverse;
            }
            .container h2 {
                grid-column: span 2;
                margin: auto;
            }
        </style>
        <div id="ui-settings">
            <div class="container">
                <h2>Translate Pixiv Tags settings</h2>
                ${SETTINGS.list
                    .map(setting => noIndents`
                        <div>${setting.descr}:</div>
                        <div>${settingToInput(setting)}</div>`)
                    .join("")
                }
                <h2>
                    <input class="refresh-page"
                           type="button"
                           value="Refresh page to apply changes"
                           disabled />
                </h2>
            </div>
        </div>
    `);
    let $shadowContainer = $("<div>").appendTo("#ex-qtips");
    $settings.click((ev) => {
        if ($(ev.target).is("#ui-settings")) $shadowContainer.remove();
    });
    $settings.find("input[type='number'], select").change((ev) => {
        let $input = $(ev.target);
        let value = $input.is("input[type='number']") ? +$input.val() : $input.val();
        SETTINGS.set($input.prop("name"), value);
        $settings.find(".refresh-page").removeAttr("disabled");
    });
    $settings.find(".refresh-page").click((ev) => {
        $shadowContainer.remove();
        window.location.reload();
    });
    let [className, bgcolor] = chooseBackgroundColorScheme($("#ex-qtips"));
    $settings.addClass(className);
    attachShadow($shadowContainer[0], () => $settings);
}

function findAndTranslate(mode, selector, options = {}) {
    options = Object.assign({
        asyncMode: false,
        requiredAttributes: null,
        predicate: null, // (el) => true,
        toProfileUrl: (el) => $(el).closest("a").prop("href"),
        toTagName: (el) => el.innerText,
        tagPosition: "afterend", // beforebegin, afterbegin, beforeend, afterend
        classes: "",
        onadded: null, // ($tag) => {},
    }, options);

    if (typeof options.predicate === "string") {
        const predicateSelector = options.predicate;
        options.predicate = (el) => $(el).is(predicateSelector);
    }
    options.tagPosition = {
        beforebegin: {searchAt:"prevAll", insertAt:"insertBefore"},
        afterbegin:  {searchAt:"find",    insertAt:"prependTo"},
        beforeend:   {searchAt:"find",    insertAt:"appendTo"},
        afterend:    {searchAt:"nextAll", insertAt:"insertAfter"},
    }[options.tagPosition] || {searchAt:"nextAll", insertAt:"insertAfter"};

    const tryToTranslate = (elem) => {
        if (!options.predicate || options.predicate(elem)) {
            switch (mode) {
                case "artist":
                    translateArtistByURL(elem, options.toProfileUrl(elem), options);
                    break;
                case "artistByName":
                    translateArtistByName(elem, options.toTagName(elem), options);
                    break;
                case "tag":
                    translateTag(elem, options.toTagName(elem), options);
                    break;
                default:
                    console.error("Unsupported mode "+mode);
            }
        }
    };

    $(selector).each((i, elem) => tryToTranslate(elem));

    if (!options.asyncMode) return;

    const query = { element: selector };
    if (options.requiredAttributes) query.elementAttributes = options.requiredAttributes;
    new MutationSummary({
        queries: [query],
        callback: ([summary]) => {
            let elems = summary.added;
            if (summary.attributeChanged) {
                elems = elems.concat(Object.values(summary.attributeChanged).flat(1));
            }
            elems.forEach(tryToTranslate);
        }
    });
}

function initializePixiv() {
    $("body").attr("id", "ex-pixiv");
    $(".illust-tag-translation").remove();

    findAndTranslate("tag", [
        // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=123456
        ".tag-cloud .tag",
        // https://www.pixiv.net/tags.php
        // https://www.pixiv.net/novel/tags.php
        ".tag-list li .tag-value",
        // https://www.pixiv.net/tags.php?tag=touhou
        ".tags-portal-header .title a",
        // https://www.pixiv.net/search.php?s_mode=s_tag&word=touhou
        "#wrapper div.layout-body h1.column-title a",
    ].join(", "));

    // https://dic.pixiv.net/a/東方
    findAndTranslate("tag", "#content_title #article-name", {tagPosition: "beforeend"});

    // tags on work pages: https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    findAndTranslate("tag", 'span', {
        predicate: ".GpJOYWW > span:first-child",
        asyncMode: true
    });

    // illust author https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    findAndTranslate("artist", "div.jkOmvR", {
        // predicate: 'aside a[href^="/member.php?id="]:not(:has([role=img]))',
        toProfileUrl: el => $(el).find("a").prop("href"),
        asyncMode: true,
        onadded: ($tag) => {
            const $container = $tag.prev();
            new MutationSummary({
                rootNode: $container.find(".hGNSdl")[0],
                queries: [{ characterData: true }],
                callback: () => {
                    $container.siblings(".ex-artist-tag").remove();
                    findAndTranslate("artist", $container, {
                        toProfileUrl: el => $(el).find("a").prop("href"),
                    });
                }
            });
        }
    });

    findAndTranslate("artist", "div.bAzGIx", {
        toProfileUrl: el => $(el).find("a").prop("href"),
        // classes: "inline",
        asyncMode: true
    });

    // artist profile pages: https://www.pixiv.net/member.php?id=29310, https://www.pixiv.net/member_illust.php?id=104471&type=illust
    let normalizePageUrl = () => `https://www.pixiv.net/member.php?id=${new URL(window.location.href).searchParams.get("id")}`;
    findAndTranslate("artist", ".VyO6wL2", {
        toProfileUrl: normalizePageUrl,
        asyncMode: true
    });

    // search pages: https://www.pixiv.net/bookmark_new_illust.php
    let toProfileUrl = (e => $(e).prop("href").replace(/member_illust/, "member").replace(/&ref=.*$/, ""));
    findAndTranslate("artist", ".ui-profile-popup", {
        predicate: "figcaption._3HwPt89 > ul > li > a.ui-profile-popup",
        toProfileUrl: toProfileUrl,
        asyncMode: true
    });

    // ranking pages: https://www.pixiv.net/ranking.php?mode=original
    findAndTranslate("artist", ".user-container.ui-profile-popup", {
        toProfileUrl: toProfileUrl,
        asyncMode: true
    });
}

function initializeNijie() {
    $("body").attr("id", "ex-nijie");

    // http://nijie.info/view.php?id=233339
    findAndTranslate("artist", "#pro .user_icon .name, .popup_member > a");

    // http://nijie.info/view.php?id=208491
    findAndTranslate("tag", ".tag .tag_name a:first-child", {
        tagPosition: "beforeend"
    });
    // https://nijie.info/dic/seiten/d/東方
    findAndTranslate("tag", "#seiten_dic h1#dic_title", {
        tagPosition: "beforeend"
    });
}

function initializeTinami() {
    $("body").attr("id", "ex-tinami");

    // http://www.tinami.com/view/979474
    findAndTranslate("tag", ".tag > span > a:nth-child(2)");

    // triggers on http://www.tinami.com/creator/profile/10262
    findAndTranslate("artist", "div.cre_name h1", {
        toProfileUrl: el => window.location.href,
        tagPosition: "beforeend",
        classes: "inline"
    });

    // triggers on http://www.tinami.com/view/934323
    findAndTranslate("artist", 'p:has(>a[href^="/creator/profile/"])', {
        toProfileUrl: el => $(el).find("a").prop("href")
    });
}

function initializeNicoSeiga() {
    $("body").attr("id", "ex-seiga");

    // http://seiga.nicovideo.jp/tag/艦これ
    findAndTranslate("tag", "h1:has(.icon_tag_big)", {
        tagPosition: "beforeend"
    });
    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate("tag", "a", {
        predicate: ".tag > a",
        tagPosition: "beforeend",
        asyncMode: true
    });
    findAndTranslate("artist", ".user_info h1 a", {
        classes: "inline"
    });
    findAndTranslate("artist", ".user_link > a .user_name", {
        tagPosition: "beforeend"
    });
}

function initializeBCY() {
    $("body").attr("id", "ex-bcy");

    // prfile page https://bcy.net/u/3935930
    findAndTranslate("artist", "div:has(>a.uname)", {
        toProfileUrl: el => $(el).find("a").prop("href")
    });

    // translate artists on illust pages (https://bcy.net/item/detail/6643704430988361988)
    findAndTranslate("artist", ".js-userTpl .user-name a", {
        toProfileUrl: el => el.href.replace(/\?.*$/,"")
    });

    // translate artists on search pages (https://bcy.net/tags/name/看板娘)
    findAndTranslate("artist", "a.title-txt", {
        toProfileUrl: el => el.href.replace(/\?.*$/,""),
        tagPosition: "beforeend",
        classes: "inline",
        asyncMode: true
    });

    // translate tags on search pages (https://bcy.net/tags/name/看板娘)
    findAndTranslate("tag", ".circle-desc-name, .tag", {tagPosition: "beforeend"});

    // translate tags on illust pages (https://bcy.net/illust/detail/6561698116674781447)
    findAndTranslate("tag", ".dm-tag-a", {tagPosition: "beforeend"});
}

function initializeDeviantArt() {
    $("body").attr("id", "ex-deviantart");

    // https://www.deviantart.com/koyorin
    // https://www.deviantart.com/koyorin/art/Ruby-570526828
    findAndTranslate("artist", ".gruserbadge .username, .dev-title-container .author .username", {
        classes: "inline"
    });

    findAndTranslate("tag", ".dev-about-tags-cc .discoverytag");
}

function initializeHentaiFoundry() {
    $("body").attr("id", "ex-hentaifoundry");

    // posts on https://www.hentai-foundry.com/user/Calm/profile
    findAndTranslate("artist", ".galleryViewTable .thumb_square > a:nth-child(4)", {
        classes: "inline"
    });
    // profile tab https://www.hentai-foundry.com/user/DrGraevling/profile
    findAndTranslate("artist", ".breadcrumbs a:contains('Users') + span", {
        toProfileUrl: el => window.location.href,
        tagPosition: "beforeend",
        classes: "inline"
    });
    // orher tabs https://www.hentai-foundry.com/pictures/user/DrGraevling
    findAndTranslate("artist", ".breadcrumbs a[href^='/user/']", {
        classes: "inline"
    });
}

function initializeTwitter() {
    $("body").attr("id", "ex-twitter");

    // old dedsign
    findAndTranslate("tag", ".twitter-hashtag", {
        asyncMode: true
    });

    // header card
    findAndTranslate("artist", ".ProfileHeaderCard-screennameLink", {
        asyncMode: true
    });
    // popuping user card info
    findAndTranslate("artist", ".ProfileCard-screennameLink", {
        asyncMode: true
    });
    // tweet authors and comments
    findAndTranslate("artist", "a.js-user-profile-link", {
        predicate: ":not(.js-retweet-text) > a",
        classes: "inline",
        asyncMode: true
    });
    // quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
    findAndTranslate("artist", ".username", {
        predicate: "div.js-user-profile-link .username",
        toProfileUrl: e => "https://twitter.com/" + $(e).find("b").text(),
        asyncMode: true,
        classes: "inline"
    });

    // new design
    findAndTranslate("tag", "a.r-1n1174f", {
        predicate: "a.r-1n1174f[href^='/hashtag/']",
        asyncMode: true,
    });
    // floating name of a channel
    const URLfromLocation = () => "https://twitter.com"+(window.location.pathname.match(/\/\w+/)||[])[0];
    findAndTranslate("artist", "div.css-1dbjc4n.r-xoduu5.r-18u37iz.r-dnmrzs", {
        predicate: "div[role='presentation']>div>div",
        toProfileUrl: URLfromLocation,
        asyncMode: true,
        classes: "inline",
        onadded: ($tag) => {
            const $container = $tag.prev();
            new MutationSummary({
                rootNode: $container.find("span>span")[0],
                queries: [{ characterData: true }],
                callback: () => {
                    $container.siblings(".ex-artist-tag").remove();
                    findAndTranslate("artist", $container, {
                        toProfileUrl: URLfromLocation,
                        classes: "inline",
                    });
                }
            });
        }
    });
    // tweet, expanded tweet and comment authors
    findAndTranslate("artist", "div.r-1wbh5a2.r-dnmrzs", {
        predicate: "div[data-testid='primaryColumn'] div:has(>a.r-1wbh5a2)",
        toProfileUrl: el => $(el).find("a").prop("href"),
        classes: "inline",
        asyncMode: true,
    });
    // quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
    findAndTranslate("artist", "div.r-1wbh5a2.r-1udh08x", {
        toProfileUrl: el => "https://twitter.com/"+$(el).find(".r-1f6r7vd").text().substr(1),
        classes: "inline",
        asyncMode: true
    });
    // user card info
    findAndTranslate("artist", "a", {
        predicate: "div.r-1g94qm0 > a",
        tagPosition: "beforeend",
        asyncMode: true,
    });
}

function initializeArtStation() {
    $("body").attr("id", "ex-artstation");

    function toFullURL(url) {
        if (url && typeof url !== "string") {
            url = (url[0] || url).getAttribute("href");
        }

        const getArtistName = (ref) => {
            if (!ref) {
                return "";
            } else if (ref.startsWith("/")) {
                let word = ref.match(/[a-z0-9_-]+/i);
                if (word) return word[0];
            } else if (ref.startsWith("https://www")) {
                let word = ref.match(/artstation\.com\/([a-z0-9_-]+)/i);
                if (word) return word[1];
            } else if (ref.startsWith("https://")) {
                let word = ref.match(/\/\/([a-z0-9_-]+)\.artstation\.com/i);
                if (word) return word[1];
            }
            return "";
        };

        let artistName = getArtistName(url) || getArtistName(window.location.href);
        if (artistName === "artwork") artistName = "";
        if (!artistName) {
            return "";
        }

        return "https://www.artstation.com/" + artistName;
    }

    function hasValidHref(el) {
        let href = el.getAttribute("href");
        return href && (href.startsWith("http") || href.startsWith("/")&&href.length>1);
    }

    // https://www.artstation.com/jubi
    // https://www.artstation.com/jubi/*
    // asyncAddTranslatedArtists("h1.artist-name", "h1.artist-name", toFullURL);
    findAndTranslate("artist", "h1.artist-name", {
        toProfileUrl: toFullURL,
        asyncMode: true
    });
    // https://www.artstation.com/artwork/0X40zG
    findAndTranslate("artist", "a[hover-card]", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".name > a") && hasValidHref(el),
        toProfileUrl: toFullURL,
        asyncMode: true,
    });
    findAndTranslate("tag", ".label-tag", {
        tagPosition: "beforeend",
        asyncMode: true
    });
    // hover card
    findAndTranslate("artist", "a", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".hover-card-name > a") && hasValidHref(el),
        asyncMode: true,
    });
    // https://www.artstation.com/jubi/following
    // https://www.artstation.com/jubi/followers
    // asyncAddTranslatedArtists(".users-grid-name", "div", e => toFullURL($(e).find("a")));
    findAndTranslate("artist", ".users-grid-name", {
        toProfileUrl: el => toFullURL($(el).find("a")),
        asyncMode: true
    });

    // default personal websites:
    // https://jubi.artstation.com/
    // https://snow7a.artstation.com/
    // customized personal websites:
    // https://inawong.artstation.com/
    // https://kastep.artstation.com/
    // https://tinadraw.artstation.com/
    // https://dylan-kowalski.artstation.com/
    // addTranslatedArtists(".site-title a", toFullURL);
    findAndTranslate("artist", ".site-title a", {
        toProfileUrl: toFullURL
    });
}

function initializeSauceNAO() {
    $("body").attr("id", "ex-saucenao");

    $(".resulttitle, .resultcontentcolumn")
        .contents()
        .filter(function(){return this.nodeType==3;}) // get text nodes
        .wrap("<span class=target>");
     $(".target:contains(',')")
        .replaceWith(function(){
            return this.innerText
                .split(", ")
                .map(s => `<span class="target">${s}</span>`)
                .join(", ");
        });

    findAndTranslate("artist", "strong:contains('Member: ')+a, strong:contains('Author: ')+a", {
        classes: "inline"
    });
    findAndTranslate("artistByName", ".resulttitle .target", {
        tagPosition: "beforebegin",
        classes: "inline"
    });
    findAndTranslate("tag", ".resultcontentcolumn .target", {
        tagPosition: "beforebegin"
    });
}

function initializePawoo() {
    $("body").attr("id", "ex-pawoo");

    // https://pawoo.net/@yamadorikodi
    // artist name in his card info
    findAndTranslate("artist", ".name small", {
        toProfileUrl: () => "https://pawoo.net" + window.location.pathname.match(/\/[^\/]+/)[0],
        tagPosition: "afterbegin"
    });
    // post author, commentor
    findAndTranslate("artist", "a.status__display-name span span", {
        classes: "inline"
    });
    // users in sidebar
    findAndTranslate("artist", "a.account__display-name span span");
    // cards of following users and followers
    findAndTranslate("artist", ".account-grid-card .name a");
    // tags https://pawoo.net/@SilSinn9801
    findAndTranslate("tag", ".hashtag");
}

function initialize() {
    $("head").append(`<style type="text/css">${QTIP_CSS}</style>`);

    switch (location.host) {
        case "www.pixiv.net":          initializePixiv();         break;
        case "dic.pixiv.net":          initializePixiv();         break;
        case "nijie.info":             initializeNijie();         break;
        case "seiga.nicovideo.jp":     initializeNicoSeiga();     break;
        case "www.tinami.com":         initializeTinami();        break;
        case "bcy.net":                initializeBCY();           break;
        case "www.hentai-foundry.com": initializeHentaiFoundry(); break;
        case "twitter.com":            initializeTwitter();       break;
        case "saucenao.com":           initializeSauceNAO();      break;
        case "pawoo.net":              initializePawoo();         break;
        case "www.deviantart.com":     initializeDeviantArt();    break;
        case "www.artstation.com":     initializeArtStation();    break;
        default:
            if (location.host.match(/artstation\.com/)) {
                initializeArtStation();
            }
    }
}

initialize();

