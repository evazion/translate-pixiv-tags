// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20180406221423
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
// @match        *://*.twitter.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.js
// @connect      donmai.us
// ==/UserScript==

const BOORU = "https://danbooru.donmai.us";

// Number of recent posts to show in artist tooltips.
const ARTIST_POST_PREVIEW_LIMIT = 3;

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
    #ex-pixiv ._1tTPwGC a:before {
        content: "";
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

    /* Render the Danbooru artist tag on the same line as the Twitter username. */
    #ex-mobile-twitter ._2CFyTHU5 {
        white-space: normal;
    }

    #ex-mobile-twitter .ex-artist-tag {
        display: inline;
    }

    .ex-artist-tooltip .qtip-content {
        width: 520px !important;
        background: white;
    }
`);

const preview_has_children_color = "#0F0";
const preview_has_parent_color = "#CC0";
const preview_deleted_color = "#000";
const preview_pending_color = "#00F";
const preview_flagged_color = "#F00";

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

function addTranslatedArtists(element, toProfileUrl = (e) => $(e).prop("href")) {
    $(element).each(async (i, e) => {
        const profileUrl = toProfileUrl($(e));

        const artists = await $.getJSON(`${BOORU}/artists.json?search[url_matches]=${encodeURIComponent(profileUrl)}`);
        artists.forEach(artist => {
            let classes = artist.is_banned ? "ex-artist-tag ex-banned-artist-tag" : "ex-artist-tag";
            artist.prettyName = artist.name.replace(/_/g, " ");
            artist.encodedName = encodeURIComponent(artist.name);

            let artistTag = $(`
                <div class="${classes}">
                    <a href="${BOORU}/artists/${artist.id}">${artist.prettyName}</a>
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

async function buildArtistTooltip(artist, qtip) {
    if (qtip.elements.content.get(0).shadowRoot) {
        return;
    }

    const posts = await $.getJSON(`${BOORU}/posts.json?tags=status:any+${artist.encodedName}&limit=${ARTIST_POST_PREVIEW_LIMIT}`);
    const tags = await $.getJSON(`${BOORU}/tags.json?search[name]=${artist.encodedName}`);
    const tag = tags[0] || { name: artist.name, post_count: 0 };

    const tooltip = buildArtistTooltipHtml(artist, tag, posts);
    const shadowRoot = qtip.elements.content.get(0).attachShadow({ mode: "open" });
    $(shadowRoot).append(tooltip);
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
                <a class="artist-name tag-category-artist" href="${BOORU}/artists/${artist.id}">${artist.prettyName}</a>
                <span class="post-count">${tag.post_count}</span>

                <ul class="other-names">
                    ${artist.other_names.split(" ").filter(String).sort().map(other_name =>
                        `<li>
                            <a href="${BOORU}/artists?search[name]=${encodeURIComponent(other_name)}">${other_name}</a>
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
                    ${artist.urls.map(url => url.normalized_url.replace(/\/$/, "")).sort().map(normalized_url =>
                        `<li><a href="${normalized_url}">${normalized_url}</a></li>`
                    ).join("")}
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

function buildPostPreview(post) {
    let preview_class = "post-preview";
    preview_class += post.is_pending           ? " post-status-pending"      : "";
    preview_class += post.is_flagged           ? " post-status-flagged"      : "";
    preview_class += post.is_deleted           ? " post-status-deleted"      : "";
    preview_class += post.parent_id            ? " post-status-has-parent"   : "";
    preview_class += post.has_visible_children ? " post-status-has-children" : "";

    // XXX escape tag_string
    const data_attributes = `
      data-id="${post.id}"
      data-has-sound="${!!post.tag_string.match(/(video_with_sound|flash_with_sound)/)}"
      data-tags="${post.tag_string}"
    `;

    let scale = Math.min(150 / post.image_width, 150 / post.image_height);
    scale = Math.min(1, scale);

    const [width, height] = [Math.round(post.image_width * scale), Math.round(post.image_height * scale)];

    // XXX escape post.tag_string
    return `
        <article itemscope itemtype="http://schema.org/ImageObject" class="${preview_class}" ${data_attributes}>
            <a href="${BOORU}/posts/${post.id}">
                <img width="${width}" height="${height}" src="${post.preview_file_url}" title="${post.tag_string}">
            </a>
        </article>
    `;
}

function asyncAddTranslation(tagSelector, tagLink = "> a") {
    onElementsAdded(tagSelector, tag => {
        const $tag = $(tag).find(tagLink);
        addTranslation($tag);
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
        "#ex-monappy span.picpr-tag > a",                       // https://monappy.jp/picture_places/view/13663
    ];

    $(selectors.join(", ")).each((i, e) => {
        addTranslation($(e));
    });
}

function initializePixiv() {
    // HACK: Don't run if we're inside an iframe.
    //
    // Endless Pixiv Pages loads pages inside an iframe, which causes
    // asyncAddTranslatedArtists to run twice: first on the page inside the
    // iframe, then again after the iframe's content is moved into the main window.
    if (window.location != window.parent.location) {
        return;
    }

    $("body").attr("id", "ex-pixiv");
    $(".illust-tag-translation").remove();

    // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=1234
    $(".tag-cloud .tag").each((i, e) => {
        addTranslation($(e), $(e).data("tag"));
    });

    // https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    let profileContainer = ".profile .user-name, .user .ui-profile-popup, .image-item .ui-profile-popup";
    let toProfileUrl = (e => $(e).prop("href").replace(/member_illust/, "member").replace(/&ref=.*$/, ""));
    addTranslatedArtists(profileContainer, toProfileUrl);
    asyncAddTranslatedArtists("._3RqJTSD");

    // search pages: https://www.pixiv.net/bookmark_new_illust.php
    asyncAddTranslatedArtists(".ui-profile-popup", "figcaption._1IP8RNV > ul > li > a.ui-profile-popup", toProfileUrl);

    // ranking pages: https://www.pixiv.net/ranking.php?mode=original
    asyncAddTranslatedArtists(".ui-profile-popup", ".user-container.ui-profile-popup", toProfileUrl);

    // tags on work pages: https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    asyncAddTranslation('._1tTPwGC', '.qE_sxIX');
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

function initializeMonappy() {
    $("body").attr("id", "ex-monappy");
    asyncAddTranslation('.picpr-tag');

    // https://monappy.jp/picture_places/view/22693
    let twitterProfileLink = `
        .picpre-container > div:nth-child(2) > div:nth-child(1) .inline-form > a:nth-child(2),
        .container > .row > .col-md-3.text-center > .inline-form > a:nth-child(3)
    `;
    addTranslatedArtists(twitterProfileLink, e => e.prop("href").toLowerCase());
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

    asyncAddTranslatedArtists(".ProfileHeaderCard-screennameLink");
    asyncAddTranslatedArtists(".ProfileCard-screennameLink")
    asyncAddTranslatedArtists(".username", ".js-user-profile-link .username", e => "https://twitter.com/" + $(e).find("b").text());
}

function initializeMobileTwitter() {
    $("body").attr("id", "ex-mobile-twitter");

    // triggers on top profile section of https://mobile.twitter.com/anchobibi_fg
    asyncAddTranslatedArtists(".Z5IeoGpY", ".Z5IeoGpY", e => "https://twitter.com/" + $(e).text().replace(/^@/, ""));
}

function initialize() {
    $("head").append(`<link href="https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.css" rel="stylesheet" type="text/css">`);

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
    } else if (location.host == "twitter.com") {
        initializeTwitter();
    } else if (location.host == "mobile.twitter.com") {
        // initializeMobileTwitter();
    } else if (location.host.match(/deviantart\.com/)) {
        initializeDeviantArt();
    }

    initializeTranslatedTags();
}

initialize();
