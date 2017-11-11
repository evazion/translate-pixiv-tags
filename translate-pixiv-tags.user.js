// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20170813172841
// @match        *://www.pixiv.net/*
// @match        *://dic.pixiv.net/*
// @match        *://nijie.info/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://www.tinami.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// ==/UserScript==

const BOORU = "http://sonohara.donmai.us"

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

    /* Fix tags in http://seiga.nicovideo.jp/seiga/im6950870 */
    body.seiga .illust_tag .tag .ex-translated-tags {
       float: left;
    }

    /* Fix tags in http://seiga.nicovideo.jp/tag/艦これ */
    body.seiga #ko_tagwatch .ex-translated-tags {
        font-size: 233.4%;
        line-height: 120%;
        vertical-align: middle;
    }

    body.tinami .tag > span {
        display: inline;
        float: none;
    }

    body.tinami .ex-translated-tags {
        font-family: Verdana, Helvetica, sans-serif;
        float: none !important;
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
        "body.pixiv .tags li .text",                             // https://www.pixiv.net/member_illust.php?mode=medium&illust_id=64362862
        "body.pixiv .tag-list li .tag-name",                     // https://www.pixiv.net/tags.php
        "body.pixiv .tags-portal-header .title",                 // https://www.pixiv.net/tags.php?tag=touhou
        "body.pixiv #content_title #article-name",               // https://dic.pixiv.net/a/touhou
        "body.pixiv #wrapper div.layout-body h1.column-title a", // https://www.pixiv.net/search.php?s_mode=s_tag&word=touhou
        "body.nijie .tag .tag_name a:first-child",               // http://nijie.info/view.php?id=208491
        "body.nijie #seiten_dic h1#dic_title",                   // https://nijie.info/dic/seiten/d/東方
        "body.seiga #ko_tagwatch > div > h1",
        "body.tinami .tag > span > a:nth-child(2)",
    ];

    $(selectors.join(", ")).each((i, e) => {
        const $tag = $(e);

        translateTag($tag.text()).done(danbooruTags => {
            addDanbooruTags($tag, danbooruTags);
        });
    });
}

function initializePixiv() {
    $("body").addClass("pixiv");

    // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=1234
    $("body.pixiv .tag-cloud .tag").each((i, e) => {
        const $pixivTag = $(e);

        translateTag($pixivTag.data("tag")).done(danbooruTags => {
            addDanbooruTags($pixivTag, danbooruTags);
        });
    });
}

function initializeNijie() {
    $("body").addClass("nijie");
}

function initializeTinami() {
    $("body").addClass("tinami");
}

function initializeNicoSeiga() {
    $("body").addClass("seiga");

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

function initialize() {
    if (location.host === "www.pixiv.net" || location.host === "dic.pixiv.net") {
        initializePixiv();
    } else if (location.host === "nijie.info") {
        initializeNijie();
    } else if (location.host === "seiga.nicovideo.jp") {
        initializeNicoSeiga();
    } else if (location.host === "www.tinami.com") {
        initializeTinami();
    }

    initializeTranslatedTags();
}

initialize();
