// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20190920004146
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
// @match        *://tweetdeck.twitter.com/*
// @match        *://*.artstation.com/*
// @match        *://saucenao.com/*
// @match        *://pawoo.net/*
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore.js
// @require      https://github.com/evazion/translate-pixiv-tags/raw/lib-20190830/lib/jquery-gm-shim.js
// @resource     jquery_qtip_css https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.min.css
// @resource     danbooru_icon https://github.com/evazion/translate-pixiv-tags/raw/resource-20190903/resource/danbooru-icon.ico
// @resource     settings_icon https://github.com/evazion/translate-pixiv-tags/raw/resource-20190903/resource/settings-icon.svg
// @connect      donmai.us
// @noframes
// ==/UserScript==

"use strict";

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
            defValue: 60 * 5,
            descr:
                "The amount of time in seconds to cache data from Danbooru before querying again",
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
                s: "Safe",
                q: "Questionable",
                e: "Explicit", // eslint-disable-line id-blacklist
            },
        },
    ],
    isValid (settingName, value) {
        const setting = this.list.find((s) => s.name === settingName);
        if (!setting) {
            console.error(`No setting ${settingName}`);
            return false;
        }
        switch (setting.type) {
            case "number": return Number.isInteger(value) && value > 0;
            case "list": return value in setting.values;
            default:
                console.error(`Unsupported type ${setting.type}`);
                return false;
        }
    },
    get (settingName) {
        const setting = this.list.find((s) => s.name === settingName);
        if (!setting) {
            console.error(`No setting ${settingName}`);
            return null;
        }
        const value = GM_getValue(settingName);
        if (typeof value === "undefined" || !this.isValid(settingName, value)) {
            GM_setValue(settingName, setting.defValue);
            return setting.defValue;
        }
        return value;
    },
    set (settingName, value) {
        const setting = this.list.find((s) => s.name === settingName);
        if (!setting) {
            console.error(`No setting ${settingName}`);
            return null;
        }
        if (this.isValid(settingName, value)) {
            GM_setValue(settingName, value);
            return true;
        }
        console.warn(`Invalid value ${value} for ${settingName}`);
        return false;
    },
};

// Which domain to send requests to
const BOORU = SETTINGS.get("booru");
// How long (in seconds) to cache translated tag lookups.
const CACHE_LIFETIME = SETTINGS.get("cache_lifetime");
// Number of recent posts to show in artist tooltips.
const ARTIST_POST_PREVIEW_LIMIT = SETTINGS.get("preview_limit");
// The upper level of rating to show preview. Higher ratings will be blurred.
const SHOW_PREVIEW_RATING = SETTINGS.get("show_preview_rating");

// Values needed from Danbooru API calls using the "only" parameter
const POST_FIELDS = [
    "created_at",
    "file_size",
    "has_visible_children",
    "id",
    "image_height",
    "image_width",
    "is_flagged",
    "is_pending",
    "is_deleted",
    "parent_id",
    "preview_file_url",
    "rating",
    "source",
    "tag_string",
].join(",");
const POST_COUNT_FIELDS = "post_count";
const TAG_FIELDS = "name,category";
const WIKI_FIELDS = "title,category_name";
const ARTIST_FIELDS = "id,name,is_banned,other_names,urls";

// Settings for artist tooltips.
const ARTIST_QTIP_SETTINGS = {
    style: {
        classes: "ex-artist-tooltip",
    },
    position: {
        my: "top center",
        at: "bottom center",
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

// Domains where images outside of whitelist are blocked
const CORS_IMAGE_DOMAINS = [
    "twitter.com",
];

// Memory storage for already rendered artist tooltips
const renderedQtips = {};

// For network rate and error management
const MAX_PENDING_NETWORK_REQUESTS = 40;
const MIN_PENDING_NETWORK_REQUESTS = 5;
const MAX_NETWORK_ERRORS = 25;
const MAX_NETWORK_RETRIES = 3;

const TAG_POSITIONS = {
    beforebegin: {
        searchAt: "prevAll",
        insertAt: "insertBefore",
    },
    afterbegin:  {
        searchAt: "find",
        insertAt: "prependTo",
    },
    beforeend:   {
        searchAt: "find",
        insertAt: "appendTo",
    },
    afterend:    {
        searchAt: "nextAll",
        insertAt: "insertAfter",
    },
};

const PROGRAM_CSS = `
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
/* dirt hack for DevianArt: add :not(#id) to rapidly increase rule specificity */
.ex-translated-tag-category-5:not(#id) {
    color: #F80 !important;
}
.ex-translated-tag-category-4:not(#id) {
    color: #0A0 !important;
}
.ex-translated-tag-category-3:not(#id) {
    color: #A0A !important;
}
.ex-translated-tag-category-1:not(#id) {
    color: #A00 !important;
}
.ex-translated-tag-category-0:not(#id) {
    color: #0073ff !important;
}

.ex-artist-tag {
    white-space: nowrap;
}
.ex-artist-tag.inline {
    display: inline-block;
    margin-left: 0.5em;
}
.ex-artist-tag a:not(#id) {
    color: #A00 !important;
    margin-left: 0.3ch;
    text-decoration: none;
}
.ex-artist-tag::before {
    content: "";
    display: inline-block;
    background-image: url(${GM_getResourceURL("danbooru_icon")});
    background-repeat: no-repeat;
    background-size: 0.8em;
    width: 0.8em;
    height: 0.8em;
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
`;

// Tag function for template literals to remove newlines and leading spaces
function noIndents (strings, ...values) {
    // Remove all spaces before/after a tag and leave one in other cases
    const compactStrings = strings.map((str) => str.replace(
        /(>)?\n *(<)?/g,
        (s, lt, gt) => (lt && gt ? lt + gt : lt || gt ? (lt || gt) : " ")
    ));
    const res = new Array(values.length * 2 + 1);
    for (let i = 0; i < values.length; i++) {
        res[i * 2] = compactStrings[i];
        res[i * 2 + 1] = values[i];
    }
    res[res.length - 1] = strings[strings.length - 1];
    return res.join("");
}

function getImage (imageUrl) {
    return GM
        .xmlHttpRequest({
            method: "GET",
            url: imageUrl,
            responseType: "blob",
        })
        .then((resp) => resp.response);
}

function rateLimitedLog (level, ...messageData) {
    // Assumes that only simple arguments will be passed in
    const key = messageData.join(",");
    rateLimitedLog[key] = rateLimitedLog[key] || { log: true };
    if (rateLimitedLog[key].log) {
        console[level](...messageData);
        rateLimitedLog[key].log = false;
        // Have only one message with the same parameters per second
        setTimeout(() => { rateLimitedLog[key].log = true; }, 1000);
    }
}

function checkNetworkErrors (domain, hasError) {
    checkNetworkErrors[domain] = checkNetworkErrors[domain] || { error: 0 };
    if (hasError) {
        console.log("Total errors:", checkNetworkErrors[domain].error);
        checkNetworkErrors[domain].error += 1;
    }
    if (checkNetworkErrors[domain].error >= MAX_NETWORK_ERRORS) {
        rateLimitedLog(
            "error",
            "Maximun number of errors exceeded",
            MAX_NETWORK_ERRORS,
            "for",
            domain
        );
        return false;
    }
    return true;
}

async function getJSONRateLimited (url, params) {
    const sleepHalfSecond = (resolve) => setTimeout(resolve, 500);
    const domain = new URL(url).hostname;
    getJSONRateLimited[domain] = (
        getJSONRateLimited[domain]
        || {
            pending: 0,
            currentMax: MAX_PENDING_NETWORK_REQUESTS,
        }
    );
    // Wait until the number of pending network requests is below the max threshold
    /* eslint-disable no-await-in-loop */
    while (getJSONRateLimited[domain].pending >= getJSONRateLimited[domain].current_max) {
        // Bail if the maximum number of network errors has been exceeded
        if (!(checkNetworkErrors(domain, false))) {
            return [];
        }
        rateLimitedLog(
            "warn",
            "Exceeded maximum pending requests",
            getJSONRateLimited[domain].current_max,
            "for",
            domain
        );
        await new Promise(sleepHalfSecond);
    }
    for (let i = 0; i < MAX_NETWORK_RETRIES; i++) {
        getJSONRateLimited[domain].pending += 1;
        try {
            return await $
                .getJSON(url, params)
                .always(() => { getJSONRateLimited[domain].pending -= 1; });
        } catch (ex) {
            // Backing off maximum to adjust to current network conditions
            getJSONRateLimited[domain].currentMax = (
                Math.max(getJSONRateLimited[domain].current_max - 1, MIN_PENDING_NETWORK_REQUESTS)
            );
            console.error(
                "Failed try #",
                i + 1,
                "\nURL:",
                url,
                "\nParameters:",
                params,
                "\nHTTP Error:",
                ex.status
            );
            if (!checkNetworkErrors(domain, true)) {
                return [];
            }
            await new Promise(sleepHalfSecond);
            continue;
        }
    }
    /* eslint-enable no-await-in-loop */
    return [];
}

const getJSONMemoized = _.memoize(
    (url, params) => getJSONRateLimited(url, params),
    (url, params) => url + $.param(params)
);

function get (url, params, cache = CACHE_LIFETIME, baseUrl = BOORU) {
    const finalParams = (cache > 0)
        ? {
            ...params,
            expires_in: cache,
        }
        : params;
    return getJSONMemoized(`${baseUrl}${url}.json`, finalParams)
        .catch((xhr) => {
            console.error(xhr.status, xhr);
            return [];
        });
}

async function translateTag (target, tagName, options) {
    const normalizedTag = tagName
        .trim()
        .normalize("NFKC")
        .replace(/\d+users入り$/, "")
        .replace(/^#/, "");

    /* Tags like "5000users入り$" become empty after normalization; don't search for empty tags. */
    if (normalizedTag.length === 0) {
        return;
    }

    let tags = [];

    const wikiPages = await get(
        "/wiki_pages",
        {
            search: {
                other_names_match: normalizedTag,
                is_deleted: false,
            },
            only: WIKI_FIELDS,
        }
    );
    if (wikiPages.length) {
        tags = wikiPages.map((wikiPage) => ({
            name: wikiPage.title,
            prettyName: wikiPage.title.replace(/_/g, " "),
            category: wikiPage.category_name,
        }));
    // `normalizedTag` consists of only ASCII characters except percent, asterics, and comma
    } else if (normalizedTag.match(/^[\x20-\x24\x26-\x29\x2B\x2D-\x7F]+$/)) {
        tags = await get(
            "/tags",
            {
                search: { name: normalizedTag },
                only: TAG_FIELDS,
            }
        );
        tags = tags.map((tag) => ({
            name: tag.name,
            prettyName: tag.name.replace(/_/g, " "),
            category: tag.category,
        }));
    }
    addDanbooruTags($(target), tags, options);
}

function addDanbooruTags ($target, tags, options = {}) {
    if (tags.length === 0) {
        return;
    }
    const {
        classes = "",
        onadded = null, // ($tag)=>{},
        tagPosition: {
            insertAt = "insertAfter",
        } = {},
    } = options;

    const $tagsContainer = $(noIndents`
        <span class="ex-translated-tags ${classes}">
            ${tags.map((tag) => noIndents`
                <a class="ex-translated-tag-category-${tag.category}"
                   href="${BOORU}/posts?tags=${encodeURIComponent(tag.name)}"
                   target="_blank">
                        ${_.escape(tag.prettyName)}
                </a>`)
            .join(", ")}
        </span>`);
    $tagsContainer[insertAt]($target);
    if (onadded) onadded($tagsContainer);
}

function normalizeURL (url) {
    return url.replace(/\/$/, "").toLowerCase();
}

function areURLsEqual (ref1, ref2) {
    const url1 = typeof ref1 === "string" ? new URL(normalizeURL(ref1)) : ref1;
    const url2 = typeof ref2 === "string" ? new URL(normalizeURL(ref2)) : ref2;
    return url1.host === url2.host
        && url1.pathname === url2.pathname
        && url1.search === url2.search;
}

async function translateArtistByURL (element, profileUrl, options) {
    if (!profileUrl) return;

    const artists = await get(
        "/artists",
        {
            search: {
                url_matches: profileUrl,
                is_active: true,
            },
            only: ARTIST_FIELDS,
        }
    );
    const pUrl = new URL(normalizeURL(profileUrl));
    artists
        // Fix of #18: for some unsupported domains, Danbooru returns false-positive results
        .filter(({ urls }) => urls.some(({ url, normalized_url: url2 }) => (
            areURLsEqual(pUrl, url) || areURLsEqual(pUrl, url2)
        )))
        .map((artist) => addDanbooruArtist($(element), artist, options));
}

async function translateArtistByName (element, artistName, options) {
    if (!artistName) return;

    const artists = await get(
        "/artists",
        {
            search: {
                name: artistName.replace(/ /g, "_"),
                is_active: true,
            },
            only: ARTIST_FIELDS,
        }
    );
    artists.map((artist) => addDanbooruArtist($(element), artist, options));
}

function addDanbooruArtist ($target, artist, options = {}) {
    const {
        onadded = null, // ($tag)=>{},
        tagPosition: {
            searchAt = "nextAll",
            insertAt = "insertAfter",
        } = {},
    } = options;
    let { classes = "" } = options;

    classes += artist.is_banned ? " ex-artist-tag ex-banned-artist-tag" : " ex-artist-tag";
    /* eslint-disable no-param-reassign */
    artist.prettyName = artist.name.replace(/_/g, " ");
    artist.escapedName = _.escape(artist.prettyName);
    artist.encodedName = encodeURIComponent(artist.name);
    /* eslint-enable no-param-reassign */

    const qtipSettings = Object.assign(ARTIST_QTIP_SETTINGS, {
        content: { text: (ev, qtip) => buildArtistTooltip(artist, qtip) },
    });

    const duplicates = $target[searchAt](".ex-artist-tag")
        .filter((i, el) => el.innerText.trim() === artist.escapedName);
    if (duplicates.length) {
        // If qtip was removed then add it back
        if (!$.data(duplicates.find("a")[0]).qtip) {
            $(duplicates).find("a").qtip(qtipSettings);
        }
        return;
    }

    const $tag = $(noIndents`
        <div class="${classes}">
            <a href="${BOORU}/artists/${artist.id}" target="_blank">
                ${artist.escapedName}
            </a>
        </div>`);
    $tag[insertAt]($target);
    $tag.find("a").qtip(qtipSettings);
    if (onadded) onadded($tag);
}

function attachShadow ($target, $content) {
    // If the target doesn't have shadow yet
    if (!$target.prop("shadowRoot")) {
        if (_.isFunction(document.body.attachShadow)) {
            const shadowRoot = $target.get(0).attachShadow({ mode: "open" });
            $(shadowRoot).append($content);
        } else {
            $target.empty().append($content);
        }
    }
}

function chooseBackgroundColorScheme ($element) {
    const TRANSPARENT_COLOR = "rgba(0, 0, 0, 0)";
    // Halfway between white/black in the RGB scheme
    const MIDDLE_LUMINOSITY = 128;

    // Get background colors of all parent elements with a nontransparent background color
    const backgroundColors = $element.parents()
        .map((i, el) => $(el).css("background-color"))
        .get()
        .filter((color) => color !== TRANSPARENT_COLOR);
    // Calculate summary color and get RGB channels
    const colorArray = backgroundColors
        .map((color) => color.match(/(\d+(\.\d+)?)+/g))
        .reverse()
        .reduce(([r1, g1, b1], [r2, g2, b2, al = 1]) => [
            r1 * (1 - al) + r2 * al,
            g1 * (1 - al) + g2 * al,
            b1 * (1 - al) + b2 * al,
        ])
        .slice(0, 3); // Ignore alpha
    const medianLuminosity = (Math.max(...colorArray) + Math.min(...colorArray)) / 2;
    const qtipClass = (medianLuminosity < MIDDLE_LUMINOSITY ? "qtip-dark" : "qtip-light");
    const adjustedArray = colorArray.map((color) => {
        const colorScale = (color - MIDDLE_LUMINOSITY) / MIDDLE_LUMINOSITY;
        const adjustedColor = ((Math.abs(colorScale) ** 0.7) // Exponentiation to reduce the scale
                             * Math.sign(colorScale)         // Get original sign back
                             * MIDDLE_LUMINOSITY)            // Get original amplitude back
                             + MIDDLE_LUMINOSITY;            // Get back to the RGB color range
        return Math.round(adjustedColor);
    });
    const adjustedColor = `rgb(${adjustedArray.join(", ")})`;
    return [qtipClass, adjustedColor];
}

async function buildArtistTooltip (artist, qtip) {
    if (!(artist.name in renderedQtips)) {
        const waitPosts = get(
            "/posts",
            {
                tags: `status:any ${artist.name}`,
                limit: ARTIST_POST_PREVIEW_LIMIT,
                only: POST_FIELDS,
            }
        );
        const waitTags = get(
            "/tags",
            {
                search: { name: artist.name },
                only: POST_COUNT_FIELDS,
            }
        );

        renderedQtips[artist.name] = Promise
            .all([waitTags, waitPosts])
            .then(([tags, posts]) => buildArtistTooltipContent(artist, tags, posts));
    }

    if (
        !qtip.elements.tooltip.hasClass("qtip-dark")
        && !qtip.elements.tooltip.hasClass("qtip-light")
    ) {
        // Select theme and background color based upon the background of surrounding elements
        const [qtipClass, adjustedColor] = chooseBackgroundColorScheme(qtip.elements.target);
        qtip.elements.tooltip.addClass(qtipClass);
        qtip.elements.tooltip.css("background-color", adjustedColor);
    }

    const $qtipContent = (await renderedQtips[artist.name]).clone(true, true);
    attachShadow(qtip.elements.content, $qtipContent);
    qtip.reposition(null, false);
}

function buildArtistTooltipContent (artist, [tag = { post_count: 0 }], posts = []) {
    const $content = $(noIndents`
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
            ${GM_getResourceText("settings_icon")}
            <section class="header">
                <a class="artist-name tag-category-artist"
                   href="${BOORU}/artists/${artist.id}"
                   target="_blank">
                    ${_.escape(artist.prettyName)}
                </a>
                <span class="post-count">${tag.post_count}</span>

                <ul class="other-names scrollable" part="other-names">
                    ${artist.other_names
                        .filter(String)
                        .sort()
                        .map((otherName) => `
                            <li>
                                <a href="${BOORU}/artists?search[name]=${encodeURIComponent(otherName)}"
                                   target="_blank">
                                    ${_.escape(otherName.replace(/_/g, " "))}
                                </a>
                            </li>
                        `)
                        .join("")}
                </ul>
            </section>
            <section class="urls">
                <h2>
                    URLs
                    (<a href="${BOORU}/artists/${artist.id}/edit" target="_blank">edit</a>)
                </h2>
                <ul class="scrollable" part="url-list">
                    ${buildArtistUrlsHtml(artist)}
                </ul>
            </section>
            <section class="posts">
                <h2>
                    Posts
                    <a href="${BOORU}/posts?tags=${artist.encodedName}" target="_blank">»</a>
                </h2>
                <div class="post-list scrollable" part="post-list"></div>
            </section>
        </article>
    `);
    $content.find(".post-list").append(posts.map(buildPostPreview));
    $content.find(".settings-icon").click(showSettings);
    return $content;
}

function buildArtistUrlsHtml (artist) {
    const getDomain = (url) => new URL(url.normalized_url).host.match(/[^.]*\.[^.]*$/)[0];
    const artistUrls = _(artist.urls)
        .chain()
        .uniq("normalized_url")
        .sortBy("normalized_url")
        .sortBy(getDomain)
        .sortBy((artistUrl) => !artistUrl.is_active);

    const html = artistUrls.map((artistUrl) => {
        const normalizedUrl = artistUrl.normalized_url.replace(/\/$/, "");
        const urlClass = artistUrl.is_active ? "artist-url-active" : "artist-url-inactive";

        return noIndents`
            <li class="${urlClass}">
                <a href="${normalizedUrl}" target="_blank">
                    ${_.escape(normalizedUrl)}
                </a>
            </li>`;
    }).join("");

    return html;
}

function timeToAgo (time) {
    const interval = new Date(Date.now() - new Date(time));
    if (interval < 60000) return "less than a minute ago";
    const ranks = [{
        value: interval.getUTCFullYear() - 1970,
        unit: "year",
    }, {
        value: interval.getUTCMonth(),
        unit: "month",
    }, {
        value: interval.getUTCDate() - 1,
        unit: "day",
    }, {
        value: interval.getUTCHours(),
        unit: "hour",
    }, {
        value: interval.getUTCMinutes(),
        unit: "minute",
    }];
    const rank = ranks.find(({ value }) => value);
    if (rank.value) {
        return `${rank.value} ${(rank.value > 1 ? `${rank.unit}s` : rank.unit)} ago`;
    }
    return "∞ ago";
}

// Based on https://stackoverflow.com/questions/15900485
function formatBytes (bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / (1024 ** i)).toFixed(2))} ${sizes[i]}`;
}

function buildPostPreview (post) {
    const RATINGS = {
        s: 0,
        q: 1,
        e: 2, // eslint-disable-line id-blacklist
    };
    let [width, height] = [150, 150];
    const previewFileUrl = `${BOORU}/images/download-preview.png`;

    let previewClass = "post-preview";
    previewClass += post.is_pending           ? " post-status-pending"      : "";
    previewClass += post.is_flagged           ? " post-status-flagged"      : "";
    previewClass += post.is_deleted           ? " post-status-deleted"      : "";
    previewClass += post.parent_id            ? " post-status-has-parent"   : "";
    previewClass += post.has_visible_children ? " post-status-has-children" : "";
    if (RATINGS[post.rating] > RATINGS[SHOW_PREVIEW_RATING]) {
        previewClass += " blur-post";
    }

    const dataAttributes = `
      data-id="${post.id}"
      data-has-sound="${Boolean(post.tag_string.match(/(video_with_sound|flash_with_sound)/))}"
      data-tags="${_.escape(post.tag_string)}"
    `;

    let scale = Math.min(150 / post.image_width, 150 / post.image_height);
    scale = Math.min(1, scale);

    const domain = post.source.match(/^https?:\/\//)
        ? new URL(post.source).hostname
            .split(".")
            .slice(-2)
            .join(".")
        : "NON-WEB";
    const imgSize = [post.file_size, post.image_width, post.image_height].every(_.isFinite)
        ? `${formatBytes(post.file_size)} (${post.image_width}x${post.image_height})`
        : "";

    const $preview = $(noIndents`
        <article itemscope
                 itemtype="http://schema.org/ImageObject"
                 class="${previewClass}"
                 ${dataAttributes} >
            <a href="${BOORU}/posts/${post.id}" target="_blank">
                <img width="${width}"
                     height="${height}"
                     src="${previewFileUrl}"
                     title="${_.escape(post.tag_string)}"
                     part="post-preview rating-${post.rating}">
            </a>
            <p>${imgSize}</p>
            <p style="letter-spacing: -0.1px;">${domain}, rating:${post.rating.toUpperCase()}</p>
            <p>${timeToAgo(post.created_at)}</p>
        </article>
    `);

    if (post.preview_file_url) {
        width = Math.round(post.image_width * scale);
        height = Math.round(post.image_height * scale);
        if (CORS_IMAGE_DOMAINS.includes(location.host)) {
            // Temporaly set transparent 1x1 image
            $preview.find("img").prop("src", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
            getImage(post.preview_file_url).then((blob) => {
                const imageBlob = blob.slice(0, blob.size, "image/jpeg");
                const blobUrl = window.URL.createObjectURL(imageBlob);
                $preview.find("img").prop("src", blobUrl);
            });
        } else {
            $preview.find("img").prop("src", post.preview_file_url);
        }
    }

    return $preview;
}

function showSettings () {
    function settingToInput (setting) {
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
                            .map(([val, descr]) => noIndents`
                                <option value="${val}" ${val === value ? "selected" : ""}>
                                    ${descr}
                                </option>`)
                            .join("")}
                    </select>`;
            default:
                console.error(`Unsupported type ${setting.type}`);
                return "";
        }
    }

    const $shadowContainer = $("<div>").appendTo("#ex-qtips");

    function closeSettings () {
        $shadowContainer.remove();
        $(document).off("keydown", closeSettingsOnEscape);
    }

    function closeSettingsOnEscape (ev) {
        if (ev.key === "Escape" && !ev.altKey && !ev.ctrlKey && !ev.shiftKey) {
            closeSettings();
            return false;
        }
        return true;
    }

    const $settings = $(noIndents`
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
            input[type="button"] {
                margin: 0 5px;
            }
        </style>
        <div id="ui-settings">
            <div class="container">
                <h2>Translate Pixiv Tags settings</h2>
                ${SETTINGS.list
                    .map((setting) => noIndents`
                        <div>${setting.descr}:</div>
                        <div>${settingToInput(setting)}</div>`)
                    .join("")
                }
                <h2>
                    <input class="cancel" type="button" value="Cancel" />
                    <input class="refresh-page"
                           type="button"
                           value="Refresh page to apply changes"
                           disabled />
                </h2>
            </div>
        </div>
    `);
    $settings.click((ev) => {
        if ($(ev.target).is("#ui-settings")) closeSettings();
    });
    $settings.find("input[type='number'], select").change((ev) => {
        $settings.find(".refresh-page").removeAttr("disabled");
    });
    $settings.find(".refresh-page").click((ev) => {
        $settings.find("input[type='number'], select").each((i, el) => {
            const $input = $(el);
            const value = $input.is("input[type='number']") ? Number($input.val()) : $input.val();
            SETTINGS.set($input.prop("name"), value);
        });
        closeSettings();
        window.location.reload();
    });
    $settings.find(".cancel").click(closeSettings);
    $(document).keydown(closeSettingsOnEscape);
    const [className] = chooseBackgroundColorScheme($("#ex-qtips"));
    $settings.addClass(className);
    attachShadow($shadowContainer, $settings);
}

function findAndTranslate (mode, selector, options = {}) {
    const fullOptions = {
        asyncMode: false,
        requiredAttributes: null,
        predicate: null, // (el) => true,
        toProfileUrl: (el) => $(el).closest("a").prop("href"),
        toTagName: (el) => el.innerText,
        tagPosition: TAG_POSITIONS.afterend,
        classes: "",
        onadded: null, // ($tag) => {},
        ...options,
    };

    if (typeof fullOptions.predicate === "string") {
        const predicateSelector = fullOptions.predicate;
        fullOptions.predicate = (el) => $(el).is(predicateSelector);
    }

    const tryToTranslate = (elem) => {
        if (!fullOptions.predicate || fullOptions.predicate(elem)) {
            switch (mode) {
                case "artist":
                    translateArtistByURL(elem, fullOptions.toProfileUrl(elem), fullOptions);
                    break;
                case "artistByName":
                    translateArtistByName(elem, fullOptions.toTagName(elem), fullOptions);
                    break;
                case "tag":
                    translateTag(elem, fullOptions.toTagName(elem), fullOptions);
                    break;
                default:
                    console.error(`Unsupported mode ${mode}`);
            }
        }
    };

    $(selector).each((i, elem) => tryToTranslate(elem));

    if (!fullOptions.asyncMode) return;

    const query = { element: selector };
    if (fullOptions.requiredAttributes) query.elementAttributes = fullOptions.requiredAttributes;
    new MutationSummary({
        queries: [query],
        callback: ([summary]) => {
            let elems = summary.added;
            if (summary.attributeChanged) {
                elems = elems.concat(Object.values(summary.attributeChanged).flat(1));
            }
            elems.forEach(tryToTranslate);
        },
    });
}

const linkInChildren = (el) => $(el).find("a").prop("href");

function initializePixiv () {
    GM_addStyle(`
        /* Fix https://www.pixiv.net/tags.php to display tags as vertical list. */
        .tag-list.slash-separated li {
            display: block;
        }
        .tag-list.slash-separated li + li:before {
            content: none;
        }
        /* Hide Pixiv's translated tags  */
        .ex-translated-tags + span .gtm-new-work-romaji-tag-event-click,
        .ex-translated-tags + span .gtm-new-work-translate-tag-event-click {
            display: none;
        }
        /* Remove hashtags from translated tags */
        a.tag-value::before,
        span.ex-translated-tags a::before,
        figcaption li > span:first-child > a::before {
            content: "";
        }
        /* On the artist profile page, render the danbooru artist tag between the artist's name and follower count. */
        ._3_qyP5m {
            display: grid;
            grid-auto-rows: 16px;
            grid-template-columns: auto 1fr;
            justify-items: start;
        }
        ._3_qyP5m a[href^="/premium"] {
            grid-area: 1 / 2;
        }
        ._3_qyP5m .ex-artist-tag {
            grid-area: span 1 / span 2;
        }
        /* Illust page: fix locate artist tag to not trigger native tooltip */
        main+aside>section>h2 {
            position: relative;
        }
        h2>div>div {
            margin-bottom: 16px;
        }
        main+aside>section>h2 .ex-artist-tag {
            position: absolute;
            bottom: 0;
            left: 47px;
        }
        /* Illust page: fix artist tag overflowing in related works */
        aside li>div>div:last-child {
            flex-direction: column;
            align-items: flex-start;
        }
        aside li .ex-artist-tag {
            margin-left: 2px;
            margin-top: -6px;
        }
    `);

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
    findAndTranslate("tag", "#content_title #article-name", {
        tagPosition: TAG_POSITIONS.beforeend,
    });

    // Tags on work pages: https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    findAndTranslate("tag", "span", {
        predicate: "figcaption li > span:first-child",
        asyncMode: true,
    });

    // Illust author https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    findAndTranslate("artist", "h2", {
        predicate: "main+aside>section>h2",
        toProfileUrl: linkInChildren,
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        onadded: ($tag) => {
            const $container = $tag.prev();
            new MutationSummary({
                rootNode: $container.find("div:not(:has(*))")[0],
                queries: [{ characterData: true }],
                callback: () => {
                    $container.siblings(".ex-artist-tag").remove();
                    findAndTranslate("artist", $container, {
                        toProfileUrl: linkInChildren,
                    });
                },
            });
        },
    });

    // Related work's artists https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    findAndTranslate("artist", "div", {
        predicate: "aside li>div>div:last-child>div:first-child",
        toProfileUrl: linkInChildren,
        asyncMode: true,
    });

    // Artist profile pages: https://www.pixiv.net/member.php?id=29310, https://www.pixiv.net/member_illust.php?id=104471&type=illust
    const normalizePageUrl = () => `https://www.pixiv.net/member.php?id=${new URL(window.location.href).searchParams.get("id")}`;
    findAndTranslate("artist", ".VyO6wL2", {
        toProfileUrl: normalizePageUrl,
        asyncMode: true,
    });

    // Search pages: https://www.pixiv.net/bookmark_new_illust.php
    const toProfileUrl = ((el) => $(el)
        .prop("href")
        .replace(/member_illust/, "member")
        .replace(/&ref=.*$/, "")
    );
    findAndTranslate("artist", ".ui-profile-popup", {
        predicate: "figcaption._3HwPt89 > ul > li > a.ui-profile-popup",
        toProfileUrl,
        asyncMode: true,
    });

    // Ranking pages: https://www.pixiv.net/ranking.php?mode=original
    findAndTranslate("artist", ".user-container.ui-profile-popup", {
        toProfileUrl,
        asyncMode: true,
    });
}

function initializeNijie () {
    GM_addStyle(`
        .ex-translated-tags {
            font-family: Verdana, Helvetica, sans-serif;
        }
        /* Fix tag lists in http://nijie.info/view.php?id=203787 pages. */
        #dojin_left #view-tag .tag {
            white-space: nowrap;
            border: 0;
        }
    `);

    // http://nijie.info/view.php?id=233339
    findAndTranslate("artist", "#pro .user_icon .name, .popup_member > a");

    // http://nijie.info/view.php?id=208491
    findAndTranslate("tag", ".tag .tag_name a:first-child", {
        tagPosition: TAG_POSITIONS.beforeend,
    });
    // https://nijie.info/dic/seiten/d/東方
    findAndTranslate("tag", "#seiten_dic h1#dic_title", {
        tagPosition: TAG_POSITIONS.beforeend,
    });
}

function initializeTinami () {
    GM_addStyle(`
        .ex-translated-tags {
            font-family: Verdana, Helvetica, sans-serif;
            float: none !important;
            display: inline !important;
        }
    `);

    // http://www.tinami.com/view/979474
    findAndTranslate("tag", ".tag > span > a:nth-child(2)");

    // Triggers on http://www.tinami.com/creator/profile/10262
    findAndTranslate("artist", "div.cre_name h1", {
        toProfileUrl: (el) => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
    });

    // Triggers on http://www.tinami.com/view/934323
    findAndTranslate("artist", "p:has(>a[href^='/creator/profile/'])", {
        toProfileUrl: linkInChildren,
    });
}

function initializeNicoSeiga () {
    GM_addStyle(`
        /* Fix tags in http://seiga.nicovideo.jp/seiga/im7626097 */
        .illust_tag .tag {
            background: #ebebeb;
            height: auto;
            margin: 0 10px 5px 0;
        }
        /* Fix artist tag in http://seiga.nicovideo.jp/seiga/im6950870 */
        .im_head_bar .inner .user ul .user_link .ex-artist-tag a {
            display: inline-block;
            border: none;
            background: none;
            padding: 0;
        }
    `);

    // http://seiga.nicovideo.jp/tag/艦これ
    findAndTranslate("tag", "h1:has(.icon_tag_big)", {
        tagPosition: TAG_POSITIONS.beforeend,
    });
    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate("tag", "a", {
        predicate: ".tag > a",
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
    });
    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate("artist", ".user_info h1 a", {
        classes: "inline",
    });
    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate("artist", ".user_link > a .user_name", {
        tagPosition: TAG_POSITIONS.beforeend,
    });
}

function initializeBCY () {
    $("body").attr("id", "ex-bcy");

    // Prfile page https://bcy.net/u/3935930
    findAndTranslate("artist", "div:has(>a.uname)", {
        toProfileUrl: linkInChildren,
    });

    // Illust pages https://bcy.net/item/detail/6643704430988361988
    findAndTranslate("artist", ".js-userTpl .user-name a", {
        toProfileUrl: (el) => el.href.replace(/\?.*$/, ""),
    });

    // Search pages https://bcy.net/tags/name/看板娘
    findAndTranslate("artist", "a.title-txt", {
        toProfileUrl: (el) => el.href.replace(/\?.*$/, ""),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        asyncMode: true,
    });

    // Search pages https://bcy.net/tags/name/看板娘
    findAndTranslate("tag", ".circle-desc-name, .tag", {
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
    });

    // Illust pages https://bcy.net/item/detail/6561698116674781447
    findAndTranslate("tag", ".dm-tag-a", { tagPosition: TAG_POSITIONS.beforeend });
}

function initializeDeviantArt () {
    // https://www.deviantart.com/koyorin
    // https://www.deviantart.com/koyorin/art/Ruby-570526828
    findAndTranslate("artist", ".gruserbadge .username, .dev-title-container .author .username", {
        classes: "inline",
    });

    findAndTranslate("tag", ".dev-about-tags-cc .discoverytag");
}

function initializeHentaiFoundry () {
    $("body").attr("id", "ex-hentaifoundry");

    // Posts on https://www.hentai-foundry.com/user/Calm/profile
    findAndTranslate("artist", ".galleryViewTable .thumb_square > a:nth-child(4)", {
        classes: "inline",
    });
    // Profile tab https://www.hentai-foundry.com/user/DrGraevling/profile
    findAndTranslate("artist", ".breadcrumbs a:contains('Users') + span", {
        toProfileUrl: () => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
    });
    // Orher tabs https://www.hentai-foundry.com/pictures/user/DrGraevling
    findAndTranslate("artist", ".breadcrumbs a[href^='/user/']", {
        classes: "inline",
    });
}

function initializeTwitter () {
    GM_addStyle(`
        .ex-artist-tag {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif;
        }
        /* Old design: on post page locate the artist tag below author's @name. */
        .permalink-header {
            display: grid;
            grid-template-columns: 1fr auto auto;
            height: auto;
        }
        .permalink-header .ex-artist-tag {
            grid-row: 2;
            margin-left: 0;
        }
        /* Fix position of artist tag in an expanded tweet */
        .r-18u37iz.r-thb0q2.r-wgs6xk .r-zl2h9q {
            display: grid;
            grid-template-columns: auto 32px;
        }
        .r-18u37iz.r-thb0q2.r-wgs6xk .r-zl2h9q .ex-artist-tag {
            grid-area: 2/1;
            margin: 0;
        }
    `);

    // Old dedsign
    if ($("body > div#doc").length) {
        findAndTranslate("tag", ".twitter-hashtag", {
            asyncMode: true,
        });

        // Header card
        findAndTranslate("artist", ".ProfileHeaderCard-screennameLink", {
            asyncMode: true,
        });
        // Popuping user card info
        findAndTranslate("artist", ".ProfileCard-screennameLink", {
            asyncMode: true,
        });
        // Tweet authors and comments
        findAndTranslate("artist", "a.js-user-profile-link", {
            predicate: ":not(.js-retweet-text) > a",
            classes: "inline",
            asyncMode: true,
        });
        // Quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
        findAndTranslate("artist", ".username", {
            predicate: "div.js-user-profile-link .username",
            toProfileUrl: (el) => `https://twitter.com/${$(el).find("b").text()}`,
            asyncMode: true,
            classes: "inline",
        });

        return;
    }

    // New design
    // Tags https://twitter.com/mugosatomi/status/1173231575959363584
    findAndTranslate("tag", "a.r-1n1174f", {
        predicate: "a.r-1n1174f[href^='/hashtag/']",
        asyncMode: true,
    });
    // Floating name of a channel https://twitter.com/mugosatomi
    const URLfromLocation = () => (
        `https://twitter.com${(window.location.pathname.match(/\/\w+/) || [])[0]}`
    );
    findAndTranslate("artist", "div.css-1dbjc4n.r-xoduu5.r-18u37iz.r-dnmrzs", {
        predicate: "h2>div>div>div",
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
                },
            });
        },
    });
    // Tweet, expanded tweet and comment authors
    // https://twitter.com/mugosatomi/status/1173231575959363584
    findAndTranslate("artist", "div.r-1wbh5a2.r-dnmrzs", {
        predicate: "div[data-testid='primaryColumn'] article div:has(>a.r-1wbh5a2)",
        toProfileUrl: (el) => linkInChildren,
        classes: "inline",
        asyncMode: true,
    });
    // Quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
    findAndTranslate("artist", "div.r-1wbh5a2.r-1udh08x", {
        toProfileUrl: (el) => `https://twitter.com/${
            $(el)
                .find(".r-1f6r7vd")
                .text()
                .substr(1)
        }`,
        classes: "inline",
        asyncMode: true,
    });
    // User card info
    findAndTranslate("artist", "a", {
        predicate: "div.r-1g94qm0 > a",
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
    });
}

function initializeArtStation () {
    GM_addStyle(`
        .qtip-content {
            box-sizing: initial;
        }
        .artist-name-and-headline .ex-artist-tag {
            font-size: 12pt;
            line-height: 150%;
        }
        .hover-card .ex-artist-tag {
            font-size: 12pt;
            margin-top: -10px;
        }
        a.user .ex-artist-tag {
            line-height: 100%;
        }
        .site-title .ex-artist-tag {
            font-size: 12pt;
            line-height: 100%;
            margin-top: -10px;
        }
        .site-title .ex-artist-tag a {
            font-size: 12pt;
        }
    `);

    function toFullURL (url) {
        if (url && typeof url !== "string") {
            // eslint-disable-next-line no-param-reassign
            url = (url[0] || url).getAttribute("href");
        }

        const getArtistName = (ref) => {
            if (!ref) {
                return "";
            } else if (ref.startsWith("/")) {
                const word = ref.match(/[a-z0-9_-]+/i);
                if (word) return word[0];
            } else if (ref.startsWith("https://www")) {
                const word = ref.match(/artstation\.com\/([a-z0-9_-]+)/i);
                if (word) return word[1];
            } else if (ref.startsWith("https://")) {
                const word = ref.match(/\/\/([a-z0-9_-]+)\.artstation\.com/i);
                if (word) return word[1];
            }
            return "";
        };

        let artistName = getArtistName(url) || getArtistName(window.location.href);
        if (artistName === "artwork") artistName = "";
        if (!artistName) {
            return "";
        }

        return `https://www.artstation.com/${artistName}`;
    }

    function hasValidHref (el) {
        const href = el.getAttribute("href");
        return href && (href.startsWith("http") || href.startsWith("/") && href.length > 1);
    }

    // https://www.artstation.com/jubi
    // https://www.artstation.com/jubi/*
    findAndTranslate("artist", "h1.artist-name", {
        toProfileUrl: toFullURL,
        asyncMode: true,
    });
    // https://www.artstation.com/artwork/0X40zG
    findAndTranslate("artist", "a[hover-card]", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".name > a") && hasValidHref(el),
        toProfileUrl: toFullURL,
        asyncMode: true,
    });
    findAndTranslate("tag", ".label-tag", {
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
    });
    // Hover card
    findAndTranslate("artist", "a", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".hover-card-name > a") && hasValidHref(el),
        asyncMode: true,
    });
    // https://www.artstation.com/jubi/following
    // https://www.artstation.com/jubi/followers
    findAndTranslate("artist", ".users-grid-name", {
        toProfileUrl: (el) => toFullURL($(el).find("a")),
        asyncMode: true,
    });

    // Default personal websites:
    // https://jubi.artstation.com/
    // https://anninosart.artstation.com/
    // Customized personal websites:
    // https://inawong.artstation.com/
    // https://kastep.artstation.com/
    // https://tinadraw.artstation.com/
    // https://dylan-kowalski.artstation.com/
    findAndTranslate("artist", ".site-title a", {
        toProfileUrl: toFullURL,
    });
}

function initializeSauceNAO () {
    GM_addStyle(`
        .ex-translated-tags {
            margin: 0;
        }
        .ex-translated-tags::before, .ex-translated-tags::after {
            content: none;
        }
        .ex-translated-tags + .target, .ex-artist-tag + .target {
            display: none;
        }
    `);

    $(".resulttitle, .resultcontentcolumn")
        .contents()
        .filter((i, el) => el.nodeType === 3) // Get text nodes
        .wrap("<span class=target>");
    $(".target:contains(', ')").replaceWith(
        (i, html) => html
            .split(", ")
            .map((str) => `<span class="target">${str}</span>`)
            .join(", ")
    );

    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2F5e%2F8e%2F5e8e7a03c49906aaad157de8aeb188e4.jpg
    findAndTranslate("artist", "strong:contains('Member: ')+a, strong:contains('Author: ')+a", {
        classes: "inline",
    });
    findAndTranslate("artistByName", ".resulttitle .target", {
        tagPosition: TAG_POSITIONS.beforebegin,
        classes: "inline",
    });
    findAndTranslate("tag", ".resultcontentcolumn .target", {
        tagPosition: TAG_POSITIONS.beforebegin,
    });
}

function initializePawoo () {
    GM_addStyle(`
        .ex-artist-tag {
            line-height: 100%;
        }
        /* Active Users sidebar */
        .account__avatar-wrapper {
            display: flex;
            height: 100%;
            align-items: center;
        }
        /* fix newline in arist tag in cards of following users and followers */
        .ex-artist-tag a {
            display: inline !important;
        }
    `);

    // https://pawoo.net/@yamadorikodi
    // artist name in his card info
    findAndTranslate("artist", ".name small", {
        toProfileUrl: () => `https://pawoo.net${window.location.pathname.match(/\/[^/]+/)[0]}`,
        tagPosition: TAG_POSITIONS.afterbegin,
    });
    // Post author, commentor
    findAndTranslate("artist", "a.status__display-name span span", {
        classes: "inline",
    });
    // Users in sidebar
    findAndTranslate("artist", "a.account__display-name span span");
    // Cards of following users and followers
    findAndTranslate("artist", ".account-grid-card .name a");
    // Tags https://pawoo.net/@SilSinn9801
    findAndTranslate("tag", ".hashtag");
}

function initializeTweetDeck () {
    findAndTranslate("tag", "span.link-complex-target", {
        predicate: "a[rel='hashtag'] span.link-complex-target",
        asyncMode: true,
    });
    // User card info
    findAndTranslate("artist", "p.username", {
        asyncMode: true,
    });
    // Tweet authors and comments
    findAndTranslate("artist", "a.account-link", {
        predicate: "a:has(.username)",
        asyncMode: true,
    });
}

function initializePixivFanbox () {
    // https://www.pixiv.net/fanbox/creator/310631
    // channel header
    findAndTranslate("artist", "a.sc-1upaq18-16", {
        classes: "inline a.sc-1upaq18-16",
        asyncMode: true,
    });
    // Post author
    findAndTranslate("artist", "div.sc-7161tb-4", {
        toProfileUrl: (el) => ($(el).closest("a").prop("href") || "").replace(/\/post\/\d+/, ""),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        asyncMode: true,
    });
}

function initializeQtipContainer () {
    // Container and viewport for qTips
    const $div = $(`<div id="ex-qtips"></div>`).appendTo("body");
    ARTIST_QTIP_SETTINGS.position.viewport = $div;
    ARTIST_QTIP_SETTINGS.position.container = $div;
}

function initialize () {
    initializeQtipContainer();
    GM_jQuery_setup();
    GM_addStyle(PROGRAM_CSS);
    GM_addStyle(GM_getResourceText("jquery_qtip_css"));
    GM_registerMenuCommand("Settings", showSettings, "S");

    switch (location.host) {
        case "www.pixiv.net":
            if (location.pathname.startsWith("/fanbox")) {
                initializePixivFanbox();
            } else {
                initializePixiv();
            }
            break;
        case "dic.pixiv.net":          initializePixiv();         break;
        case "nijie.info":             initializeNijie();         break;
        case "seiga.nicovideo.jp":     initializeNicoSeiga();     break;
        case "www.tinami.com":         initializeTinami();        break;
        case "bcy.net":                initializeBCY();           break;
        case "www.hentai-foundry.com": initializeHentaiFoundry(); break;
        case "twitter.com":            initializeTwitter();       break;
        case "tweetdeck.twitter.com":  initializeTweetDeck();     break;
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

//------------------------
// Program execution start
//------------------------

initialize();
