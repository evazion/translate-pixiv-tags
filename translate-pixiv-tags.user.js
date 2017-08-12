// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20170811233214
// @match        *://www.pixiv.net/*
// @match        *://dic.pixiv.net/*
// @match        *://nijie.info/*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @connect      donmai.us
// ==/UserScript==

// https://gist.github.com/monperrus/999065
// This is an shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest. This allows us to use $.getJSON instead of using GM_xmlhttpRequest directly.
function GM_XHR() {
    this.type = null;
    this.url = null;
    this.async = null;
    this.username = null;
    this.password = null;
    this.status = null;
    this.readyState = null;
    this.headers = {};

    this.abort = function() {
        this.readyState = 0;
    };

    this.getAllResponseHeaders = function(name) {
        if (this.readyState!=4) return "";
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

    this.send = function(data) {
        this.data = data;
        var that = this;
        // http://wiki.greasespot.net/GM_xmlhttpRequest
        GM_xmlhttpRequest({
            method: this.type,
            url: this.url,
            headers: this.headers,
            data: this.data,
            responseType: this.responseType,
            onload: function(rsp) {
                // Populate wrapper object with returned data
                // including the Greasemonkey specific "responseHeaders"
                for (var k in rsp) {
                    that[k] = rsp[k];
                }
                // now we call onreadystatechange
                if (that.onload) {
                    that.onload();
                } else {
                    that.onreadystatechange();
                }
            },
            onerror: function(rsp) {
                for (var k in rsp) {
                    that[k] = rsp[k];
                }
                // now we call onreadystatechange
                if (that.onerror) {
                    that.onerror();
                } else {
                    that.onreadystatechange();
                }
            }
        });
    };
}

$.ajaxSetup({
    xhr: function () { return new GM_XHR(); },
});

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
    }

    .ex-translated-tags::after {
        content: ")";
    }

    .ex-translated-tag-category-4 {
        color: #0A0 !important;
    }

    .ex-translated-tag-category-3 {
        color: #A0A !important;
    }

    .ex-translated-tag-category-0 {
        color: #0073ff !important;
    }

    /* Fix https://www.pixiv.net/tags.php to display tags as vertical list. */
    body.pixiv .tag-list li {
        display: block;
    }

    /* Fix https://dic.pixiv.net/a/東方 to display Danbooru tag next to article title. */
    body.pixiv #content_title #article-name {
       display: inline-block;
    }

    body.nijie .ex-translated-tags {
       font-size: 12px;
       font-family: Verdana, Helvetica, sans-serif;
    }

    /* Position Nijie dictionary links to the right of Danbooru tag links. */
    body.nijie .tag .tag_name a.dic {
       float: right !important;
    }

    /* Fix tag lists in http://nijie.info/view.php?id=203787 pages. */
    body.nijie #dojin_left #view-tag .tag {
      white-space: nowrap;
      border: 0;
    }

    body.nijie #seiten_dic .ex-translated-tags {
       font-size: 32px;
    }
</style>
`);

function translateTag(pixivTag) {
    pixivTag = pixivTag.replace(/\d+users入り$/, "");
    const request = $.getJSON(`https://danbooru.donmai.us/wiki_pages.json?search[other_names_match]=${encodeURIComponent(pixivTag)}`);

    return request.then(wikiPages => {
        return $.map(wikiPages, wikiPage => {
            return {
                name: wikiPage.title,
                prettyName: wikiPage.title.replace(/_/g, " "),
                category: wikiPage.category_name,
            };
        });
    });
}

function addDanbooruTags($target, tags) {
    if (tags.length === 0) {
        return;
    }

    const $tagsContainer = $(`<span class="ex-translated-tags">`);
    $target.after($tagsContainer);

    $.each(tags, (i, tag) => {
        const danbooruTagLink = $(`<a class="ex-translated-tag-category-${tag.category}" href="https://danbooru.donmai.us/posts?tags=${encodeURIComponent(tag.name)}">`).text(tag.prettyName);
        $tagsContainer.append(danbooruTagLink);

        if (i < tags.length - 1) {
            $tagsContainer.append(", ");
        }
    });
}

if (location.host === "www.pixiv.net" || location.host === "dic.pixiv.net") {
    $("body").addClass("pixiv");
} else if (location.host === "nijie.info") {
    $("body").addClass("nijie");
}

// Add links to Danbooru tags after every Pixiv tag.
const selectors = [
  "body.pixiv .tags li .text",                             // https://www.pixiv.net/member_illust.php?mode=medium&illust_id=64362862
  "body.pixiv .tag-list li .tag-name",                     // https://www.pixiv.net/tags.php
  "body.pixiv .tags-portal-header .title",                 // https://www.pixiv.net/tags.php?tag=touhou
  "body.pixiv #content_title #article-name",               // https://dic.pixiv.net/a/touhou
  "body.pixiv #wrapper div.layout-body h1.column-title a", // https://www.pixiv.net/search.php?s_mode=s_tag&word=touhou
  "body.nijie .tag .tag_name a:first-child",               // http://nijie.info/view.php?id=208491
  "body.nijie #seiten_dic h1#dic_title",                   // https://nijie.info/dic/seiten/d/東方
];

$(selectors.join(", ")).each((i, e) => {
    const $pixivTag = $(e);

    translateTag($pixivTag.text()).done(danbooruTags => {
        addDanbooruTags($pixivTag, danbooruTags);
    });
});

// https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=1234
$("body.pixiv .tag-cloud .tag").each((i, e) => {
    const $pixivTag = $(e);

    translateTag($pixivTag.data("tag")).done(danbooruTags => {
        addDanbooruTags($pixivTag, danbooruTags);
    });
});
