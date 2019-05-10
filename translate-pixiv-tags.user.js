// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20190510210546
// @description  Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, and BCY to Danbooru tags.
// @homepageURL  https://github.com/evazion/translate-pixiv-tags
// @supportURL   https://github.com/evazion/translate-pixiv-tags/issues
// @updateURL    https://github.com/evazion/translate-pixiv-tags/raw/stable/translate-pixiv-tags.user.js
// @match        *://www.pixiv.net/*
// @match        *://dic.pixiv.net/*
// @match        *://nijie.info/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://www.tinami.com/*
// @match        *://bcy.net/*
// @match        *://*.deviantart.com/*
// @match        *://*.hentai-foundry.com/*
// @match        *://*.twitter.com/*
// @match        *://*.artstation.com/*
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

// Which domain to send requests to
let temp_setting = GM_getValue('booru');
const BOORU = (typeof temp_setting === "string" && temp_setting.match(/^https?:\/\/(danbooru|kagamihara|saitou|shima)\.donmai\.us$/) ? temp_setting : "https://danbooru.donmai.us")
GM_setValue('booru',BOORU);

// How long (in seconds) to cache translated tag lookups. Default: 5 minutes.
temp_setting = GM_getValue('cache_lifetime');
const CACHE_LIFETIME = (Number.isInteger(temp_setting) ? temp_setting : 60 * 5);
GM_setValue('cache_lifetime',CACHE_LIFETIME);

// Inline qtip2 css to avoid CSP issues on twitter.
// https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.min.css
const QTIP_CSS = `#qtip-overlay.blurs,.qtip-close{cursor:pointer}.qtip{position:absolute;left:-28000px;top:-28000px;display:none;max-width:280px;min-width:50px;font-size:10.5px;line-height:12px;direction:ltr;box-shadow:none;padding:0}.qtip-content,.qtip-titlebar{position:relative;overflow:hidden}.qtip-content{padding:5px 9px;text-align:left;word-wrap:break-word}.qtip-titlebar{padding:5px 35px 5px 10px;border-width:0 0 1px;font-weight:700}.qtip-titlebar+.qtip-content{border-top-width:0!important}.qtip-close{position:absolute;right:-9px;top:-9px;z-index:11;outline:0;border:1px solid transparent}.qtip-titlebar .qtip-close{right:4px;top:50%;margin-top:-9px}* html .qtip-titlebar .qtip-close{top:16px}.qtip-icon .ui-icon,.qtip-titlebar .ui-icon{display:block;text-indent:-1000em;direction:ltr}.qtip-icon,.qtip-icon .ui-icon{-moz-border-radius:3px;-webkit-border-radius:3px;border-radius:3px;text-decoration:none}.qtip-icon .ui-icon{width:18px;height:14px;line-height:14px;text-align:center;text-indent:0;font:normal 700 10px/13px Tahoma,sans-serif;color:inherit;background:-100em -100em no-repeat}.qtip-default{border:1px solid #F1D031;background-color:#FFFFA3;color:#555}.qtip-default .qtip-titlebar{background-color:#FFEF93}.qtip-default .qtip-icon{border-color:#CCC;background:#F1F1F1;color:#777}.qtip-default .qtip-titlebar .qtip-close{border-color:#AAA;color:#111}.qtip-light{background-color:#fff;border-color:#E2E2E2;color:#454545}.qtip-light .qtip-titlebar{background-color:#f1f1f1}.qtip-dark{background-color:#505050;border-color:#303030;color:#f3f3f3}.qtip-dark .qtip-titlebar{background-color:#404040}.qtip-dark .qtip-icon{border-color:#444}.qtip-dark .qtip-titlebar .ui-state-hover{border-color:#303030}.qtip-cream{background-color:#FBF7AA;border-color:#F9E98E;color:#A27D35}.qtip-red,.qtip-red .qtip-icon,.qtip-red .qtip-titlebar .ui-state-hover{border-color:#D95252}.qtip-cream .qtip-titlebar{background-color:#F0DE7D}.qtip-cream .qtip-close .qtip-icon{background-position:-82px 0}.qtip-red{background-color:#F78B83;color:#912323}.qtip-red .qtip-titlebar{background-color:#F06D65}.qtip-red .qtip-close .qtip-icon{background-position:-102px 0}.qtip-green{background-color:#CAED9E;border-color:#90D93F;color:#3F6219}.qtip-green .qtip-titlebar{background-color:#B0DE78}.qtip-green .qtip-close .qtip-icon{background-position:-42px 0}.qtip-blue{background-color:#E5F6FE;border-color:#ADD9ED;color:#5E99BD}.qtip-blue .qtip-titlebar{background-color:#D0E9F5}.qtip-blue .qtip-close .qtip-icon{background-position:-2px 0}.qtip-shadow{-webkit-box-shadow:1px 1px 3px 1px rgba(0,0,0,.15);-moz-box-shadow:1px 1px 3px 1px rgba(0,0,0,.15);box-shadow:1px 1px 3px 1px rgba(0,0,0,.15)}.qtip-bootstrap,.qtip-rounded,.qtip-tipsy{-moz-border-radius:5px;-webkit-border-radius:5px;border-radius:5px}.qtip-rounded .qtip-titlebar{-moz-border-radius:4px 4px 0 0;-webkit-border-radius:4px 4px 0 0;border-radius:4px 4px 0 0}.qtip-youtube{-moz-border-radius:2px;-webkit-border-radius:2px;border-radius:2px;-webkit-box-shadow:0 0 3px #333;-moz-box-shadow:0 0 3px #333;box-shadow:0 0 3px #333;color:#fff;border:0 solid transparent;background:#4A4A4A;background-image:-webkit-gradient(linear,left top,left bottom,color-stop(0,#4A4A4A),color-stop(100%,#000));background-image:-webkit-linear-gradient(top,#4A4A4A 0,#000 100%);background-image:-moz-linear-gradient(top,#4A4A4A 0,#000 100%);background-image:-ms-linear-gradient(top,#4A4A4A 0,#000 100%);background-image:-o-linear-gradient(top,#4A4A4A 0,#000 100%)}.qtip-youtube .qtip-titlebar{background-color:#4A4A4A;background-color:rgba(0,0,0,0)}.qtip-youtube .qtip-content{padding:.75em;font:12px arial,sans-serif;filter:progid:DXImageTransform.Microsoft.Gradient(GradientType=0, StartColorStr=#4a4a4a, EndColorStr=#000000);-ms-filter:"progid:DXImageTransform.Microsoft.Gradient(GradientType=0,StartColorStr=#4a4a4a,EndColorStr=#000000);"}.qtip-youtube .qtip-icon{border-color:#222}.qtip-youtube .qtip-titlebar .ui-state-hover{border-color:#303030}.qtip-jtools{background:#232323;background:rgba(0,0,0,.7);background-image:-webkit-gradient(linear,left top,left bottom,from(#717171),to(#232323));background-image:-moz-linear-gradient(top,#717171,#232323);background-image:-webkit-linear-gradient(top,#717171,#232323);background-image:-ms-linear-gradient(top,#717171,#232323);background-image:-o-linear-gradient(top,#717171,#232323);border:2px solid #ddd;border:2px solid rgba(241,241,241,1);-moz-border-radius:2px;-webkit-border-radius:2px;border-radius:2px;-webkit-box-shadow:0 0 12px #333;-moz-box-shadow:0 0 12px #333;box-shadow:0 0 12px #333}.qtip-jtools .qtip-titlebar{background-color:transparent;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=#717171, endColorstr=#4A4A4A);-ms-filter:"progid:DXImageTransform.Microsoft.gradient(startColorstr=#717171,endColorstr=#4A4A4A)"}.qtip-jtools .qtip-content{filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=#4A4A4A, endColorstr=#232323);-ms-filter:"progid:DXImageTransform.Microsoft.gradient(startColorstr=#4A4A4A,endColorstr=#232323)"}.qtip-jtools .qtip-content,.qtip-jtools .qtip-titlebar{background:0 0;color:#fff;border:0 dashed transparent}.qtip-jtools .qtip-icon{border-color:#555}.qtip-jtools .qtip-titlebar .ui-state-hover{border-color:#333}.qtip-cluetip{-webkit-box-shadow:4px 4px 5px rgba(0,0,0,.4);-moz-box-shadow:4px 4px 5px rgba(0,0,0,.4);box-shadow:4px 4px 5px rgba(0,0,0,.4);background-color:#D9D9C2;color:#111;border:0 dashed transparent}.qtip-cluetip .qtip-titlebar{background-color:#87876A;color:#fff;border:0 dashed transparent}.qtip-cluetip .qtip-icon{border-color:#808064}.qtip-cluetip .qtip-titlebar .ui-state-hover{border-color:#696952;color:#696952}.qtip-tipsy{background:#000;background:rgba(0,0,0,.87);color:#fff;border:0 solid transparent;font-size:11px;font-family:'Lucida Grande',sans-serif;font-weight:700;line-height:16px;text-shadow:0 1px #000}.qtip-tipsy .qtip-titlebar{padding:6px 35px 0 10px;background-color:transparent}.qtip-tipsy .qtip-content{padding:6px 10px}.qtip-tipsy .qtip-icon{border-color:#222;text-shadow:none}.qtip-tipsy .qtip-titlebar .ui-state-hover{border-color:#303030}.qtip-tipped{border:3px solid #959FA9;-moz-border-radius:3px;-webkit-border-radius:3px;border-radius:3px;background-color:#F9F9F9;color:#454545;font-weight:400;font-family:serif}.qtip-tipped .qtip-titlebar{border-bottom-width:0;color:#fff;background:#3A79B8;background-image:-webkit-gradient(linear,left top,left bottom,from(#3A79B8),to(#2E629D));background-image:-webkit-linear-gradient(top,#3A79B8,#2E629D);background-image:-moz-linear-gradient(top,#3A79B8,#2E629D);background-image:-ms-linear-gradient(top,#3A79B8,#2E629D);background-image:-o-linear-gradient(top,#3A79B8,#2E629D);filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=#3A79B8, endColorstr=#2E629D);-ms-filter:"progid:DXImageTransform.Microsoft.gradient(startColorstr=#3A79B8,endColorstr=#2E629D)"}.qtip-tipped .qtip-icon{border:2px solid #285589;background:#285589}.qtip-tipped .qtip-icon .ui-icon{background-color:#FBFBFB;color:#555}.qtip-bootstrap{font-size:14px;line-height:20px;color:#333;padding:1px;background-color:#fff;border:1px solid #ccc;border:1px solid rgba(0,0,0,.2);-webkit-border-radius:6px;-moz-border-radius:6px;border-radius:6px;-webkit-box-shadow:0 5px 10px rgba(0,0,0,.2);-moz-box-shadow:0 5px 10px rgba(0,0,0,.2);box-shadow:0 5px 10px rgba(0,0,0,.2);-webkit-background-clip:padding-box;-moz-background-clip:padding;background-clip:padding-box}.qtip-bootstrap .qtip-titlebar{padding:8px 14px;margin:0;font-size:14px;font-weight:400;line-height:18px;background-color:#f7f7f7;border-bottom:1px solid #ebebeb;-webkit-border-radius:5px 5px 0 0;-moz-border-radius:5px 5px 0 0;border-radius:5px 5px 0 0}.qtip-bootstrap .qtip-titlebar .qtip-close{right:11px;top:45%;border-style:none}.qtip-bootstrap .qtip-content{padding:9px 14px}.qtip-bootstrap .qtip-icon{background:0 0}.qtip-bootstrap .qtip-icon .ui-icon{width:auto;height:auto;float:right;font-size:20px;font-weight:700;line-height:18px;color:#000;text-shadow:0 1px 0 #fff;opacity:.2;filter:alpha(opacity=20)}#qtip-overlay,#qtip-overlay div{left:0;top:0;width:100%;height:100%}.qtip-bootstrap .qtip-icon .ui-icon:hover{color:#000;text-decoration:none;cursor:pointer;opacity:.4;filter:alpha(opacity=40)}.qtip:not(.ie9haxors) div.qtip-content,.qtip:not(.ie9haxors) div.qtip-titlebar{filter:none;-ms-filter:none}.qtip .qtip-tip{margin:0 auto;overflow:hidden;z-index:10}.qtip .qtip-tip,x:-o-prefocus{visibility:hidden}.qtip .qtip-tip,.qtip .qtip-tip .qtip-vml,.qtip .qtip-tip canvas{position:absolute;color:#123456;background:0 0;border:0 dashed transparent}.qtip .qtip-tip canvas{top:0;left:0}.qtip .qtip-tip .qtip-vml{behavior:url(#default#VML);display:inline-block;visibility:visible}#qtip-overlay{position:fixed}#qtip-overlay div{position:absolute;background-color:#000;opacity:.7;filter:alpha(opacity=70);-ms-filter:"progid:DXImageTransform.Microsoft.Alpha(Opacity=70)"}.qtipmodal-ie6fix{position:absolute!important}`;

// Number of recent posts to show in artist tooltips.
temp_setting = GM_getValue('preview_limit');
const ARTIST_POST_PREVIEW_LIMIT = (Number.isInteger(temp_setting) ? temp_setting : 3);
GM_setValue('preview_limit',ARTIST_POST_PREVIEW_LIMIT);

// Settings for artist tooltips.
const ARTIST_QTIP_SETTINGS = {
    style: {
        classes: "qtip-light ex-artist-tooltip",
    },
    position: {
        my: "top center",
        at: "bottom center",
        viewport: true,
    },
    show: {
        delay: 150,
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

    #ex-twitter .ex-translated-tags * {
        white-space: inherit;
    }

    .ex-translated-tags::before {
        content: "(";
        white-space: nowrap;
    }

    .ex-translated-tags::after {
        content: ")";
        white-space: nowrap;
    }
    .ex-translated-tag-category-5 {
        color: #F80 !important;
    }

    .ex-translated-tag-category-4 {
        color: #0A0 !important;
    }

    .ex-translated-tag-category-3 {
        color: #A0A !important;
    }

    .ex-translated-tag-category-1 {
        color: #A00 !important;
    }

    .ex-translated-tag-category-0 {
        color: #0073ff !important;
    }

    .ex-artist-tag {
        white-space: nowrap;
    }

    .ex-artist-tag a {
        color: #A00 !important;
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

    /* Fix https://www.pixiv.net/tags.php to display tags as vertical list. */
    #ex-pixiv .tag-list li {
        display: block;
    }

    /* Fix https://dic.pixiv.net/a/東方 to display Danbooru tag next to article title. */
    #ex-pixiv #content_title #article-name {
       display: inline-block;
    }

    /* Don't underline translated artist tags */
    #ex-pixiv .ex-artist-tag a {
        text-decoration: none;
    }

    /* Hide Pixiv's translated tags  */
    #ex-pixiv .gtm-new-work-romaji-tag-event-click,
    #ex-pixiv .gtm-new-work-translate-tag-event-click {
        display: none;
    }

    /* Remove hashtags from translated tags */
    #ex-pixiv .GpJOYWW a:before {
        content: "";
    }

    /* Add space between pixiv artist name and danbooru tag in recommended posts section .*/
    #ex-pixiv .gtm-illust-recommend-user-name + .ex-artist-tag {
        margin-left: 0.5em;
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

    #ex-nijie .ex-translated-tags {
       font-size: 12px;
       font-family: Verdana, Helvetica, sans-serif;
    }

    /* Position Nijie dictionary links to the right of Danbooru tag links. */
    #ex-nijie .tag .tag_name a.dic {
       float: right !important;
    }

    /* Fix tag lists in http://nijie.info/view.php?id=203787 pages. */
    #ex-nijie #dojin_left #view-tag .tag {
      white-space: nowrap;
      border: 0;
    }

    #ex-nijie #seiten_dic .ex-translated-tags {
       font-size: 32px;
    }

    /* Fix tags in http://seiga.nicovideo.jp/seiga/im7626097 */
    #ex-seiga .illust_tag .tag {
        background: #ebebeb;
        height: auto;
        margin: 0 10px 5px 0;
    }

    #ex-seiga .illust_tag .tag ul {
        display: none;
    }

    /* Fix artist tag in http://seiga.nicovideo.jp/seiga/im6950870 */
    #ex-seiga .im_head_bar .ex-artist-tag a {
        display: inline-block;
        border: none;
        background: none;
        padding: 5px 0;
    }

    /* Fix tags in http://seiga.nicovideo.jp/tag/艦これ */
    #ex-seiga #ko_tagwatch .ex-translated-tags {
        font-size: 233.4%;
        line-height: 120%;
        vertical-align: middle;
    }

    /* Fix Clip button overlapping artist tag on http://seiga.nicovideo.jp/seiga/im8006360 */
    #ex-seiga .illust_main .illust_side .clip {
        margin-top: -44px;
    }

    #ex-tinami .tag > span {
        display: inline;
        float: none;
    }

    #ex-tinami .ex-translated-tags {
        font-family: Verdana, Helvetica, sans-serif;
        float: none !important;
        display: inline !important;
    }

    /* Fix tags in https://bcy.net/illust/detail/77708/2182055 */
    #ex-bcy ._tag {
        display: inline-block !important;
    }

    #ex-bcy .ex-translated-tags {
        margin: 0;
        display: inline-block;
        padding: 4px 10px 3px;
        border-radius: 0 2px 2px 0;
        background-color: #f0f4fa;
        font-size: 13px;
        vertical-align: top;
    }

    /* Fix tags in Ta关注的原作 box on https://bcy.net/u/2123332 */
    #ex-bcy #followWorks ._tag, #ex-bcy #followWorks .ex-translated-tags {
        float: left;
        clear: both;
    }

    /* XXX Hide translated tags on https://bcy.net/illust (badly formatted) */
    #ex-bcy .js-leftTags .ex-translated-tags {
        display: none;
    }

    /* Render the Danbooru artist tag on the same line as the HF artist name. */
    #ex-hentaifoundry .ex-artist-tag {
        display: inline-block;
    }

    #ex-deviantart .ex-artist-tag {
        display: inline-block;
    }

    #ex-deviantart .ex-artist-tag a {
        color: #A00 !important;
    }

    /* Add some space between twitter username and danbooru artist tag. */
    #ex-twitter .js-user-profile-link .ex-artist-tag {
        margin-left: 0.5em;
    }

    /* On post page locate the artist tag below author's @name. */
    #ex-twitter .permalink-header {
        display: grid;
        grid-template-columns: 1fr auto auto;
        height: auto;
    }
    #ex-twitter .permalink-header .ex-artist-tag {
        grid-row: 2;
    }

    #ex-twitter .ReplyingToContextBelowAuthor .ex-artist-tag {
        display: inline-block;
        margin-left: 5px;
    }

    /* Render the Danbooru artist tag on the same line as the Twitter username. */
    #ex-mobile-twitter ._2CFyTHU5 {
        white-space: normal;
    }

    #ex-mobile-twitter .ex-artist-tag {
        display: inline;
    }

    .ex-artist-tooltip.qtip {
        max-width: 538px !important;
    }
    .ex-artist-tooltip .qtip-content {
        width: 520px !important;
        background: white;
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
`);

const preview_has_children_color = "#0F0";
const preview_has_parent_color = "#CC0";
const preview_deleted_color = "#000";
const preview_pending_color = "#00F";
const preview_flagged_color = "#F00";

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
    const timestamp = Math.round((Date.now() / 1000 / cache));
    params = { ...params, expiry: 365, timestamp: timestamp };
    return getJSONMemoized(`${base_url}${url}.json`, params);
}

async function addTranslation($element, tag = $element.text()) {
    const danbooruTags = await translateTag(tag);
    addDanbooruTags($element, danbooruTags);
}

async function translateTag(pixivTag) {
    const normalizedTag = pixivTag.trim().normalize("NFKC").replace(/\d+users入り$/, "");

    /* tags like "5000users入り$" become empty after normalization; don't search for empty tags. */
    if (normalizedTag.length === 0) {
        return [];
    }

    const wikiPages = await get("/wiki_pages", { "search[other_names_match]": normalizedTag });

    return wikiPages.map(wikiPage => new Object({
        name: wikiPage.title,
        prettyName: wikiPage.title.replace(/_/g, " "),
        category: wikiPage.category_name,
    }));
}

function addDanbooruTags($target, tags) {
    if (tags.length === 0) {
        return;
    }

    const $tagsContainer = $(`<span class="ex-translated-tags">`);
    $target.after($tagsContainer);

    $.each(tags, (i, tag) => {
        const danbooruTagLink = $(`<a class="ex-translated-tag-category-${tag.category}" href="${BOORU}/posts?tags=${encodeURIComponent(tag.name)}">`).text(tag.prettyName);
        $tagsContainer.append(danbooruTagLink);

        if (i < tags.length - 1) {
            $tagsContainer.append(", ");
        }
    });
}

function addTranslatedArtists(element, toProfileUrl = (e) => $(e).prop("href")) {
    $(element).each(async (i, e) => {
        const profileUrl = toProfileUrl($(e));

        const artists = await get("/artists", { "search[url_matches]": profileUrl, "search[is_active]": true });
        artists.forEach(artist => {
            let classes = artist.is_banned ? "ex-artist-tag ex-banned-artist-tag" : "ex-artist-tag";
            artist.prettyName = artist.name.replace(/_/g, " ");
            artist.escapedName = _.escape(artist.prettyName);
            artist.encodedName = encodeURIComponent(artist.name);

            let duplicates = $(e).nextAll(".ex-artist-tag").filter((i,el) => el.innerText.trim() == artist.escapedName);

            if (duplicates.length) {
                // if qtip was remove then add it back
                if (!$.data(duplicates.find("a")[0]).qtip) {
                    const qtip_settings = Object.assign(ARTIST_QTIP_SETTINGS, {
                        content: {
                            text: (event, qtip) => buildArtistTooltip(artist, qtip)
                        }
                    });
                    $(duplicates).find("a").qtip(qtip_settings);
                }
                return;
            }

            let artistTag = $(`
                <div class="${classes}">
                    <a href="${BOORU}/artists/${artist.id}">${artist.escapedName}</a>
                </div>
            `);

            const qtip_settings = Object.assign(ARTIST_QTIP_SETTINGS, {
                content: {
                    text: (event, qtip) => buildArtistTooltip(artist, qtip)
                }
            });
            $(artistTag).find("a").qtip(qtip_settings);

            $(e).after(artistTag);
        });
    });
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

async function buildArtistTooltip(artist, qtip) {
    attachShadow(qtip.elements.content.get(0), async () => {
        if (!(artist.name in rendered_qtips)) {
            const posts = $.getJSON(`${BOORU}/posts.json?tags=status:any+${artist.encodedName}&limit=${ARTIST_POST_PREVIEW_LIMIT}`);
            const tags = $.getJSON(`${BOORU}/tags.json?search[name]=${artist.encodedName}`);

            const tooltip_html = buildArtistTooltipHtml(artist, (await tags)[0] || {post_count:0}, await posts);
            let $tooltip = $(tooltip_html);
            $("img",$tooltip).each((i,image)=>{
                let image_source = $(image).data('src');
                if (CORS_IMAGE_DOMAINS.includes(location.host)) {
                    getImage(image_source).then((blob)=>{
                        let image_blob = blob.slice(0, blob.size, "image/jpeg");
                        let blob_url = window.URL.createObjectURL(image_blob);
                        image.src = blob_url;
                    });
                } else {
                    image.src = image_source;
                }
            });
            rendered_qtips[artist.name] = $tooltip;
            return rendered_qtips[artist.name];
        }
        return rendered_qtips[artist.name].clone();
    });
}

function buildArtistTooltipHtml(artist, tag, posts) {
    return `
        <style>
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
                color: #CCC;
                margin-left: 3px;
            }

            ul.other-names {
                margin-top: 5px;
                line-height: 24px;
                padding: 0px;
            }

            ul.other-names li {
                display: inline;
            }

            ul.other-names li a {
                background-color: #EEE;
                padding: 3px;
                border-radius: 3px;
                white-space: nowrap;
            }

            section.urls ul {
                list-style: disc inside;
                padding: 0px;
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
                height: 154px;
                width: 154px;
                margin: 0 10px 10px 0;
                float: left;
                overflow: hidden;
                text-align: center;
                position: relative;
            }

            article.post-preview img {
                margin: auto;
                border: 2px solid transparent;
            }

            article.post-preview.post-status-has-children img {
                border-color: ${preview_has_children_color};
            }

            article.post-preview.post-status-has-parent img {
                border-color: ${preview_has_parent_color};
            }

            article.post-preview.post-status-has-children.post-status-has-parent img {
                border-color: ${preview_has_children_color} ${preview_has_parent_color} ${preview_has_parent_color} ${preview_has_children_color};
            }

            article.post-preview.post-status-deleted img {
                border-color: ${preview_deleted_color};
            }

            article.post-preview.post-status-has-children.post-status-deleted img {
                border-color: ${preview_has_children_color} ${preview_deleted_color} ${preview_deleted_color} ${preview_has_children_color};
            }

            article.post-preview.post-status-has-parent.post-status-deleted img {
                border-color: ${preview_has_parent_color} ${preview_deleted_color} ${preview_deleted_color} ${preview_has_parent_color};
            }

            article.post-preview.post-status-has-children.post-status-has-parent.post-status-deleted img {
                border-color: ${preview_has_children_color} ${preview_deleted_color} ${preview_deleted_color} ${preview_has_parent_color};
            }

            article.post-preview.post-status-pending img,
            article.post-preview.post-status-flagged img {
                border-color: ${preview_pending_color};
            }

            article.post-preview.post-status-has-children.post-status-pending img,
            article.post-preview.post-status-has-children.post-status-flagged img {
                border-color: ${preview_has_children_color} ${preview_pending_color} ${preview_pending_color} ${preview_has_children_color};
            }

            article.post-preview.post-status-has-parent.post-status-pending img,
            article.post-preview.post-status-has-parent.post-status-flagged img {
                border-color: ${preview_has_parent_color} ${preview_pending_color} ${preview_pending_color} ${preview_has_parent_color};
            }

            article.post-preview.post-status-has-children.post-status-has-parent.post-status-pending img,
            article.post-preview.post-status-has-children.post-status-has-parent.post-status-flagged img {
                border-color: ${preview_has_children_color} ${preview_pending_color} ${preview_pending_color} ${preview_has_parent_color};
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
        </style>

        <article class="container">
            <section class="header">
                <a class="artist-name tag-category-artist" href="${BOORU}/artists/${artist.id}">${_.escape(artist.prettyName)}</a>
                <span class="post-count">${tag.post_count}</span>

                <ul class="other-names">
                    ${artist.other_names.filter(String).sort().map(other_name =>
                        `<li>
                            <a href="${BOORU}/artists?search[name]=${encodeURIComponent(other_name)}">${_.escape(other_name)}</a>
                        </li>`
                    ).join("")}
                </ul>
            </section>
            <section class="urls">
                <h2>
                    URLs
                    (<a href="${BOORU}/artists/${artist.id}/edit">edit</a>)
                </h2>
                <ul>
                    ${buildArtistUrlsHtml(artist)}
                </ul>
            </section>
            <section class="posts">
                <h2>
                    Posts
                    <a href="${BOORU}/posts?tags=${artist.encodedName}">»</a>
                </h2>
                ${posts.map(post => buildPostPreview(post)).join("")}
            </section>
        </article>
    `;
}

function buildArtistUrlsHtml(artist) {
    const domainSorter = artist_url => new URL(artist_url.normalized_url).host.match(/[^.]*\.[^.]*$/)[0];
    const artist_urls = _(artist.urls).chain().uniq('normalized_url').sortBy('normalized_url').sortBy(domainSorter).sortBy(artist_url => !artist_url.is_active);

    const html = artist_urls.map(artist_url => {
        const normalized_url = artist_url.normalized_url.replace(/\/$/, "");
        const urlClass = artist_url.is_active ? "artist-url-active" : "artist-url-inactive";

        return `<li class="${urlClass}"><a href="${normalized_url}">${_.escape(normalized_url)}</a></li>`;
    }).join("");

    return html;
}

function buildPostPreview(post) {
    let [width, height] = [150, 150];
    let preview_file_url = `${BOORU}/images/download-preview.png`;

    let preview_class = "post-preview";
    preview_class += post.is_pending           ? " post-status-pending"      : "";
    preview_class += post.is_flagged           ? " post-status-flagged"      : "";
    preview_class += post.is_deleted           ? " post-status-deleted"      : "";
    preview_class += post.parent_id            ? " post-status-has-parent"   : "";
    preview_class += post.has_visible_children ? " post-status-has-children" : "";

    const data_attributes = `
      data-id="${post.id}"
      data-has-sound="${!!post.tag_string.match(/(video_with_sound|flash_with_sound)/)}"
      data-tags="${_.escape(post.tag_string)}"
    `;

    let scale = Math.min(150 / post.image_width, 150 / post.image_height);
    scale = Math.min(1, scale);

    if (post.preview_file_url) {
        [width, height] = [Math.round(post.image_width * scale), Math.round(post.image_height * scale)];
        preview_file_url = post.preview_file_url;
    }

    return `
        <article itemscope itemtype="http://schema.org/ImageObject" class="${preview_class}" ${data_attributes}>
            <a href="${BOORU}/posts/${post.id}">
                <img width="${width}" height="${height}" data-src="${preview_file_url}" title="${_.escape(post.tag_string)}">
            </a>
        </article>
    `;
}

function getTagPreload(tag, tagLink, isContainer) {
    if (isContainer) {
        return [$(tag),$(tag).find(tagLink).text()];
    } else {
        return [$(tag).find(tagLink),undefined];
    }
}

function asyncAddTranslation(tagSelector, tagLink = "> a", isContainer = false) {
    $(tagSelector).each((i, tag) => {
        addTranslation(...getTagPreload(tag, tagLink, isContainer));
    });
    onElementsAdded(tagSelector, tag => {
        addTranslation(...getTagPreload(tag, tagLink, isContainer));
    });
}

function asyncAddTranslatedArtists(selector, predicate = selector, toProfileUrl = (e) => $(e).prop("href")) {
    if (typeof predicate === "string") {
        const predicateSelector = predicate;
        predicate = (e) => $(e).is(predicateSelector);
    }

    $(selector).each((i, artist) => {
        if (predicate(artist)) {
            addTranslatedArtists(artist, toProfileUrl);
        }
    });

    onElementsAdded(selector, artist => {
        if (predicate(artist)) {
            addTranslatedArtists(artist, toProfileUrl);
        }
    });
}

function onElementsAdded(selector, callback) {
    const observer = new MutationSummary({
        queries: [{ element: selector }],
        callback: function (summaries) {
            const summary = summaries[0];

            summary.added.forEach(callback);
        }
    });
}

function asyncAddTranslatedArtists2(
        selector,
        selPredicate = selector,
        attribute = "href",
        attrPredicate = (e) => (e = $(e).attr("href")) && (e.startsWith("/") || e.startsWith("http")),
        toProfileUrl = (e) => $(e).prop("href"))
{
    if (typeof selPredicate === "string") {
        const predicateSelector = selPredicate;
        selPredicate = (e) => $(e).is(predicateSelector);
    }

    $(selector).each((i, artist) => {
        if (selPredicate(artist) && attrPredicate(artist)) {
            addTranslatedArtists(artist, toProfileUrl);
        }
    });

    onElementsAddedOrChanged(selector, attribute, artist => {
        if (selPredicate(artist) && attrPredicate(artist)) {
            addTranslatedArtists(artist, toProfileUrl);
        }
    });
}

function onElementsAddedOrChanged(selector, attribute, callback) {
    const observer = new MutationSummary({
        queries: [{ element: selector, elementAttributes: attribute }],
        callback: function (summaries) {
            const summary = summaries[0];
            summary.added.forEach(callback);
            summary.attributeChanged[attribute].forEach(callback);
        }
    });
}

function initializeTranslatedTags() {
    const selectors = [
        "#ex-pixiv .tags li .text",                             // https://www.pixiv.net/member_illust.php?mode=medium&illust_id=64362862
        "#ex-pixiv .tag-list li .tag-name",                     // https://www.pixiv.net/tags.php
        "#ex-pixiv .tags-portal-header .title",                 // https://www.pixiv.net/tags.php?tag=touhou
        "#ex-pixiv #content_title #article-name",               // https://dic.pixiv.net/a/touhou
        "#ex-pixiv #wrapper div.layout-body h1.column-title a", // https://www.pixiv.net/search.php?s_mode=s_tag&word=touhou
        "#ex-nijie .tag .tag_name a:first-child",               // http://nijie.info/view.php?id=208491
        "#ex-nijie #seiten_dic h1#dic_title",                   // https://nijie.info/dic/seiten/d/東方
        "#ex-seiga #ko_tagwatch > div > h1",
        "#ex-tinami .tag > span > a:nth-child(2)",
    ];

    $(selectors.join(", ")).each((i, e) => {
        addTranslation($(e));
    });
}

function initializePixiv() {
    $("body").attr("id", "ex-pixiv");
    $(".illust-tag-translation").remove();

    // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=1234
    $(".tag-cloud .tag").each((i, e) => {
        addTranslation($(e), $(e).data("tag"));
    });

    // https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    let toProfileUrl = (e => $(e).prop("href").replace(/member_illust/, "member").replace(/&ref=.*$/, ""));
    asyncAddTranslatedArtists("a", 'aside a[href^="/member.php?id="]:not(:has([role=img]))');

    // artist profile pages: https://www.pixiv.net/member.php?id=29310, https://www.pixiv.net/member_illust.php?id=104471&type=illust
    let normalizePageUrl = () => `https://www.pixiv.net/member.php?id=${new URL(window.location.href).searchParams.get("id")}`;
    asyncAddTranslatedArtists(".VyO6wL2", ".VyO6wL2", normalizePageUrl);

    // search pages: https://www.pixiv.net/bookmark_new_illust.php
    asyncAddTranslatedArtists(".ui-profile-popup", "figcaption._3HwPt89 > ul > li > a.ui-profile-popup", toProfileUrl);

    // ranking pages: https://www.pixiv.net/ranking.php?mode=original
    asyncAddTranslatedArtists(".ui-profile-popup", ".user-container.ui-profile-popup", toProfileUrl);

    // tags on work pages: https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    asyncAddTranslation('.GpJOYWW', '._3Xr7iJv');
}

function initializeNijie() {
    $("body").attr("id", "ex-nijie");

    // http://nijie.info/view.php?id=233339
    addTranslatedArtists("#pro .user_icon .name, .popup_member > a");
}

function initializeTinami() {
    $("body").attr("id", "ex-tinami");

    // triggers on http://www.tinami.com/creator/profile/10262 pages
    addTranslatedArtists('img[src*="/creator/profile/sticker/"]', e => {
        // https://img.tinami.com//creator/profile/sticker/62414.gif
        let userId = $(e).prop("src").match(/\/creator\/profile\/sticker\/(\d+)\.gif$/)[1];
        return `http://www.tinami.com/creator/profile/${userId}`;
    });

    // triggers on http://www.tinami.com/view/934323 pages
    addTranslatedArtists('a[href^="/creator/profile/"] strong', e => {
        // e: '<a href="/creator/profile/10262"><strong>松永紅葉</strong></a>'
        let $strong = $(e);
        let $a = $(e).parent();
        let userId = $a.prop("href").match(/\/creator\/profile\/(\d+)$/)[1];
        return `http://www.tinami.com/creator/profile/${userId}`;
    });
}

function initializeNicoSeiga() {
    $("body").attr("id", "ex-seiga");

    // http://seiga.nicovideo.jp/seiga/im7741859
    asyncAddTranslation('.tag');
    addTranslatedArtists(".user_info h1 a");
    addTranslatedArtists(".user_link > a");
}

function initializeBCY() {
    $("body").attr("id", "ex-bcy");

    // translate artists on illust pages (https://bcy.net/illust/detail/66626/1824973)
    addTranslatedArtists('.js-userTpl .fz14');

    // translate artists on search pages (https://bcy.net/tags/name/看板娘)
    asyncAddTranslatedArtists(".lh40", ".lh40");

    // translate tags on search pages (https://bcy.net/tags/name/看板娘)
    $("#ex-bcy ._tag").each((i, e) => addTranslation($(e)));

    // translate tags on illust pages (https://bcy.net/illust/detail/77708/2196418)
    asyncAddTranslation('.tag');
}

function initializeDeviantArt() {
    $("body").attr("id", "ex-deviantart");

    let usernameSelectors = [
      ".dev-title-container .author .username",  // https://sakimichan.deviantart.com/art/Horoscope-series-Libra-641842522 pages
      "#gmi-Gruser .gruserbadge .username",      // https://sakimichan.deviantart.com
    ];

    asyncAddTranslatedArtists(".username", usernameSelectors.join(", "));

    $("#ex-deviantart .dev-about-tags-cc .discoverytag").each((i, e) => {
        addTranslation($(e), $(e).data("canonical-tag"));
    });
}

function initializeHentaiFoundry() {
    $("body").attr("id", "ex-hentaifoundry");

    // triggers on https://www.hentai-foundry.com/pictures/user/firolian/560377/Miss-Marvel---Selfie
    addTranslatedArtists("#picBox .boxtitle a");

    // triggers on https://www.hentai-foundry.com/user/Calm/profile
    addTranslatedArtists(".galleryViewTable .thumb_square > a:nth-child(4)");
}

function initializeTwitter() {
    $("body").attr("id", "ex-twitter");

    asyncAddTranslation(".twitter-hashtag", ">b", true);

    asyncAddTranslatedArtists(".ProfileHeaderCard-screennameLink");
    asyncAddTranslatedArtists(".ProfileCard-screennameLink")
    asyncAddTranslatedArtists("a.js-user-profile-link", ":not(.js-retweet-text) > a");
    // quoted tweets
    asyncAddTranslatedArtists(".username", "div.js-user-profile-link .username", e => "https://twitter.com/" + $(e).find("b").text());
}

function initializeMobileTwitter() {
    $("body").attr("id", "ex-mobile-twitter");

    // triggers on top profile section of https://mobile.twitter.com/anchobibi_fg
    asyncAddTranslatedArtists(".Z5IeoGpY", ".Z5IeoGpY", e => "https://twitter.com/" + $(e).text().replace(/^@/, ""));
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
        }

        let artistName = getArtistName(url) || getArtistName(window.location.href);
        if (artistName === "artwork") artistName = "";
        if (!artistName) {
            return "";
        }

        return "https://www.artstation.com/" + artistName;
    };

    // https://www.artstation.com/jubi
    // https://www.artstation.com/jubi/*
    asyncAddTranslatedArtists("h1.artist-name", "h1.artist-name", toFullURL);
    // https://www.artstation.com/artwork/0X40zG
    asyncAddTranslatedArtists2("a[hover-card]", ".name > a", "href", toFullURL);
    // hover card
    asyncAddTranslatedArtists2("a", ".hover-card-name > a");
    // https://www.artstation.com/jubi/following
    // https://www.artstation.com/jubi/followers
    asyncAddTranslatedArtists("h4.name", "h4", e => toFullURL($(e).closest("a")));

    // default personal websites:
    // https://jubi.artstation.com/
    // https://snow7a.artstation.com/
    // customized personal websites:
    // https://inawong.artstation.com/
    // https://kastep.artstation.com/
    // https://tinadraw.artstation.com/
    // https://dylan-kowalski.artstation.com/
    addTranslatedArtists(".site-title a", toFullURL);
}

function initialize() {
    $("head").append(`<style type="text/css">${QTIP_CSS}</style>`);

    if (location.host === "www.pixiv.net" || location.host === "dic.pixiv.net") {
        initializePixiv();
    } else if (location.host === "nijie.info") {
        initializeNijie();
    } else if (location.host === "seiga.nicovideo.jp") {
        initializeNicoSeiga();
    } else if (location.host === "www.tinami.com") {
        initializeTinami();
    } else if (location.host === "bcy.net") {
        initializeBCY();
    } else if (location.host == "www.hentai-foundry.com") {
        initializeHentaiFoundry();
    } else if (location.host == "twitter.com") {
        initializeTwitter();
    } else if (location.host == "mobile.twitter.com") {
        // initializeMobileTwitter();
    } else if (location.host.match(/deviantart\.com/)) {
        initializeDeviantArt();
    } else if (location.host.match(/artstation\.com/)) {
        initializeArtStation();
    }

    initializeTranslatedTags();
}

initialize();

