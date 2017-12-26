// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20171208174551
// @description  Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, BCY, and Monappy to Danbooru tags.
// @homepageURL  https://github.com/evazion/translate-pixiv-tags
// @supportURL   https://github.com/evazion/translate-pixiv-tags/issues
// @updateURL    https://github.com/evazion/translate-pixiv-tags/raw/stable/translate-pixiv-tags.user.js
// @match        *://www.pixiv.net/*
// @match        *://dic.pixiv.net/*
// @match        *://nijie.info/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://www.tinami.com/*
// @match        *://bcy.net/*
// @match        *://monappy.jp/*
// @match        *://*.deviantart.com/*
// @match        *://*.hentai-foundry.com/*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// @connect      donmai.us
// ==/UserScript==

const BOORU = "https://danbooru.donmai.us"

// https://gist.github.com/monperrus/999065
// This is a shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest.
// This allows us to use $.getJSON instead of using GM_xmlhttpRequest directly.
//
// This is necessary because some sites (e.g. Twitter, DeviantArt) have a
// Content Security Policy that blocks us from making cross-origin requests to
// Danbooru. Tampermonkey allows us to bypass the CSP, but only if we use GM_xmlhttpRequest.
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

    .ex-artist-tag a {
        color: #A00 !important;
        white-space: nowrap;
    }

    .ex-artist-tag::before {
        content: "";
        display: inline-block;
        background: url('https://danbooru.donmai.us/favicon.ico') no-repeat;
        background-size: 12px;
        width: 16px;
        height: 16px;
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

    /* Fix tags in http://seiga.nicovideo.jp/seiga/im6950870 */
    #ex-seiga .illust_tag .tag .ex-translated-tags {
       float: left;
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

    #ex-tinami .tag > span {
        display: inline;
        float: none;
    }

    #ex-tinami .ex-translated-tags {
        font-family: Verdana, Helvetica, sans-serif;
        float: none !important;
        display: inline !important;
    }

    #ex-bcy .tag > a > div {
        display: inline !important;
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
</style>
`);

async function addTranslation($element, tag = $element.text()) {
    const danbooruTags = await translateTag(tag);
    addDanbooruTags($element, danbooruTags);
}

async function translateTag(pixivTag) {
    const normalizedTag = pixivTag.trim().normalize("NFKC").replace(/\d+users入り$/, "");
    const wikiPages = await $.getJSON(`${BOORU}/wiki_pages.json?search[other_names_match]=${encodeURIComponent(normalizedTag)}`);

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

function addTranslatedArtists(element, toProfileUrl) {
    $(element).each(async (i, e) => {
        const profileUrl = toProfileUrl($(e));

        const artists = await $.getJSON(`${BOORU}/artists.json?search[url_matches]=${encodeURIComponent(profileUrl)}`);
        artists.forEach(artist => {
            let classes = artist.is_banned ? "ex-artist-tag ex-banned-artist-tag" : "ex-artist-tag";
            let prettyName = artist.name.replace(/_/g, " ");

            $(e).after(`
                <div class="${classes}">
                    <a href="${BOORU}/artists/${artist.id}">${prettyName}</a>
                </div>
            `);
        });
    });
}

function asyncAddTranslation(tagSelector, tagLink = "> a") {
    onElementsAdded(tagSelector, tag => {
        const $tag = $(tag).find(tagLink);
        addTranslation($tag);
    });
}

function asyncAddTranslatedArtists(selector, toProfileUrl) {
    onElementsAdded(selector, artist => {
        addTranslatedArtists(artist, toProfileUrl);
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
        "#ex-bcy .tag > a > div",
        "#ex-monappy span.picpr-tag > a",                       // https://monappy.jp/picture_places/view/13663
    ];

    $(selectors.join(", ")).each((i, e) => {
        addTranslation($(e));
    });
}

function initializePixiv() {
    $("body").attr("id", "ex-pixiv");

    // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=1234
    $(".tag-cloud .tag").each((i, e) => {
        addTranslation($(e), $(e).data("tag"));
    });

    let profileContainer = ".profile .user-name, .user .ui-profile-popup, .image-item .ui-profile-popup";
    let toProfileUrl = (e => $(e).prop("href").replace(/member_illust/, "member"));
    addTranslatedArtists(profileContainer, toProfileUrl);
    asyncAddTranslatedArtists(".ui-profile-popup", toProfileUrl);
}

function initializeNijie() {
    $("body").attr("id", "ex-nijie");
    addTranslatedArtists("#pro .user_icon .name, .popup_member > a", e => $(e).prop("href"));
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

    asyncAddTranslation('.tag');
    addTranslatedArtists(".user_info h1 a", e => $(e).prop("href"));
    addTranslatedArtists(".user_link > a", e => $(e).prop("href"));
}

function initializeBCY() {
    $("body").attr("id", "ex-bcy");
}

function initializeMonappy() {
    $("body").attr("id", "ex-monappy");
    asyncAddTranslation('.picpr-tag');

    let twitterProfileLink = `
        .picpre-container > div:nth-child(2) > div:nth-child(1) .inline-form > a:nth-child(2),
        .container > .row > .col-md-3.text-center > .inline-form > a:nth-child(3)
    `;
    addTranslatedArtists(twitterProfileLink, e => e.prop("href").toLowerCase());
}

function initializeDeviantArt() {
    $("body").attr("id", "ex-deviantart");

    // triggers on https://sakimichan.deviantart.com/art/Horoscope-series-Libra-641842522 pages
    addTranslatedArtists(".dev-title-container .author .username", e => $(e).prop("href"));

    // triggers on https://sakimichan.deviantart.com/art/Horoscope-series-Libra-641842522 pages
    $("#ex-deviantart .dev-about-tags-cc .discoverytag").each((i, e) => {
        addTranslation($(e), $(e).data("canonical-tag"));
    });
}

function initializeHentaiFoundry() {
    $("body").attr("id", "ex-hentaifoundry");

    // triggers on https://www.hentai-foundry.com/pictures/user/firolian/560377/Miss-Marvel---Selfie
    addTranslatedArtists("#picBox .boxtitle a", e => $(e).prop("href"));

    // triggers on https://www.hentai-foundry.com/user/Calm/profile
    addTranslatedArtists(".galleryViewTable .thumb_square > a:nth-child(4)", e => $(e).prop("href"));
}

function initialize() {
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
    } else if (location.host === "monappy.jp") {
        initializeMonappy();
    } else if (location.host == "www.hentai-foundry.com") {
        initializeHentaiFoundry();
    } else if (location.host.match(/deviantart\.com/)) {
        initializeDeviantArt();
    }

    initializeTranslatedTags();
}

initialize();
