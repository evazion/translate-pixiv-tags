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
        color: #A00 !important;
        display: block;
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
            $(e).after(`<a class="ex-artist-tag" href="${BOORU}/artists/${artist.id}">${artist.name.replace(/_/g, " ")}</a>`);
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
        "body.ex-monappy span.picpr-tag > a",                       // https://monappy.jp/picture_places/view/13663
    ];

    $(selectors.join(", ")).each((i, e) => {
        addTranslation($(e));
    });
}

function initializePixiv() {
    $("body").addClass("ex-pixiv");

    // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=1234
    $("body.ex-pixiv .tag-cloud .tag").each((i, e) => {
        addTranslation($(e), $(e).data("tag"));
    });

    let profileContainer = ".profile .user-name, .user .ui-profile-popup, .image-item .ui-profile-popup";
    let toProfileUrl = (e => $(e).prop("href").replace(/member_illust/, "member"));
    addTranslatedArtists(profileContainer, toProfileUrl);
    asyncAddTranslatedArtists(".ui-profile-popup", toProfileUrl);
}

function initializeNijie() {
    $("body").addClass("ex-nijie");
    addTranslatedArtists("#pro .user_icon .name, .popup_member > a", e => $(e).prop("href"));
}

function initializeTinami() {
    $("body").addClass("ex-tinami");

    // triggers on http://www.tinami.com/creator/profile/10262 pages
    addTranslatedArtists('body.ex-tinami img[src*="/creator/profile/sticker/"]', e => {
        // https://img.tinami.com//creator/profile/sticker/62414.gif
        let userId = $(e).prop("src").match(/\/creator\/profile\/sticker\/(\d+)\.gif$/)[1];
        return `http://www.tinami.com/creator/profile/${userId}`;
    });

    // triggers on http://www.tinami.com/view/934323 pages
    addTranslatedArtists('body.ex-tinami a[href^="/creator/profile/"] strong', e => {
        // e: '<a href="/creator/profile/10262"><strong>松永紅葉</strong></a>'
	let $strong = $(e);
	let $a = $(e).parent();
        let userId = $a.prop("href").match(/\/creator\/profile\/(\d+)$/)[1];
        return `http://www.tinami.com/creator/profile/${userId}`;
    });
}

function initializeNicoSeiga() {
    $("body").addClass("ex-seiga");
    asyncAddTranslation('.tag');
    addTranslatedArtists(".user_info h1 a", e => $(e).prop("href"));
    addTranslatedArtists(".user_link > a", e => $(e).prop("href"));
}

function initializeBCY() {
    $("body").addClass("ex-bcy");
}

function initializeMonappy() {
    $("body").addClass("ex-monappy");
    asyncAddTranslation('.picpr-tag');

    let twitterProfileLink = `
        .picpre-container > div:nth-child(2) > div:nth-child(1) .inline-form > a:nth-child(2),
        .container > .row > .col-md-3.text-center > .inline-form > a:nth-child(3)
    `;
    addTranslatedArtists(twitterProfileLink, e => e.prop("href").toLowerCase());
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
    }

    initializeTranslatedTags();
}

initialize();
