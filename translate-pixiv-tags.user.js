// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20170813172841
// @match        *://www.pixiv.net/*
// @match        *://dic.pixiv.net/*
// @match        *://nijie.info/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://www.tinami.com/*
// @match        *://bcy.net/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// ==/UserScript==

const BOORU = "https://danbooru.donmai.us"

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
    body.ex-pixiv .tag-list li {
        display: block;
    }

    /* Fix https://dic.pixiv.net/a/東方 to display Danbooru tag next to article title. */
    body.ex-pixiv #content_title #article-name {
       display: inline-block;
    }

    body.ex-nijie .ex-translated-tags {
       font-size: 12px;
       font-family: Verdana, Helvetica, sans-serif;
    }

    /* Position Nijie dictionary links to the right of Danbooru tag links. */
    body.ex-nijie .tag .tag_name a.dic {
       float: right !important;
    }

    /* Fix tag lists in http://nijie.info/view.php?id=203787 pages. */
    body.ex-nijie #dojin_left #view-tag .tag {
      white-space: nowrap;
      border: 0;
    }

    body.ex-nijie #seiten_dic .ex-translated-tags {
       font-size: 32px;
    }

    /* Fix tags in http://seiga.nicovideo.jp/seiga/im6950870 */
    body.ex-seiga .illust_tag .tag .ex-translated-tags {
       float: left;
    }

    /* Fix tags in http://seiga.nicovideo.jp/tag/艦これ */
    body.ex-seiga #ko_tagwatch .ex-translated-tags {
        font-size: 233.4%;
        line-height: 120%;
        vertical-align: middle;
    }

    body.ex-tinami .tag > span {
        display: inline;
        float: none;
    }

    body.ex-tinami .ex-translated-tags {
        font-family: Verdana, Helvetica, sans-serif;
        float: none !important;
        display: inline !important;
    }

    body.ex-bcy .tag > a > div {
        display: inline !important;
    }
</style>
`);

function translateTag(pixivTag) {
    pixivTag = pixivTag.trim().normalize("NFKC").replace(/\d+users入り$/, "");
    const request = $.getJSON(`${BOORU}/wiki_pages.json?search[other_names_match]=${encodeURIComponent(pixivTag)}`);

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
        const danbooruTagLink = $(`<a class="ex-translated-tag-category-${tag.category}" href="${BOORU}/posts?tags=${encodeURIComponent(tag.name)}">`).text(tag.prettyName);
        $tagsContainer.append(danbooruTagLink);

        if (i < tags.length - 1) {
            $tagsContainer.append(", ");
        }
    });
}

function initializeTranslatedTags() {
    const selectors = [
        "body.ex-pixiv .tags li .text",                             // https://www.pixiv.net/member_illust.php?mode=medium&illust_id=64362862
        "body.ex-pixiv .tag-list li .tag-name",                     // https://www.pixiv.net/tags.php
        "body.ex-pixiv .tags-portal-header .title",                 // https://www.pixiv.net/tags.php?tag=touhou
        "body.ex-pixiv #content_title #article-name",               // https://dic.pixiv.net/a/touhou
        "body.ex-pixiv #wrapper div.layout-body h1.column-title a", // https://www.pixiv.net/search.php?s_mode=s_tag&word=touhou
        "body.ex-nijie .tag .tag_name a:first-child",               // http://nijie.info/view.php?id=208491
        "body.ex-nijie #seiten_dic h1#dic_title",                   // https://nijie.info/dic/seiten/d/東方
        "body.ex-seiga #ko_tagwatch > div > h1",
        "body.ex-tinami .tag > span > a:nth-child(2)",
        "body.ex-bcy .tag > a > div",
    ];

    $(selectors.join(", ")).each((i, e) => {
        const $tag = $(e);

        translateTag($tag.text()).done(danbooruTags => {
            addDanbooruTags($tag, danbooruTags);
        });
    });
}

function initializePixiv() {
    $("body").addClass("ex-pixiv");

    // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=1234
    $("body.ex-pixiv .tag-cloud .tag").each((i, e) => {
        const $pixivTag = $(e);

        translateTag($pixivTag.data("tag")).done(danbooruTags => {
            addDanbooruTags($pixivTag, danbooruTags);
        });
    });
}

function initializeNijie() {
    $("body").addClass("ex-nijie");
}

function initializeTinami() {
    $("body").addClass("ex-tinami");
}

function initializeNicoSeiga() {
    $("body").addClass("ex-seiga");

    const observer = new MutationSummary({
        queries: [{ element: '.tag' }],
        callback: function (summaries) {
            const summary = summaries[0];

            summary.added.each(tag => {
                const $tag = $(tag).find("> a");

                translateTag($tag.text()).done(danbooruTags => {
                    addDanbooruTags($tag, danbooruTags);
                });
            });
        }
    });
}

function initializeBCY() {
    $("body").addClass("ex-bcy");
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
    }

    initializeTranslatedTags();
}

initialize();
