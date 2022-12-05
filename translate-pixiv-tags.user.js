// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20220423150446
// @description  Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, and BCY to Danbooru tags.
// @homepageURL  https://github.com/evazion/translate-pixiv-tags
// @supportURL   https://github.com/evazion/translate-pixiv-tags/issues
// @updateURL    https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.user.js
// @downloadURL  https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.user.js
// @match        *://www.pixiv.net/*
// @match        *://dic.pixiv.net/*
// @match        *://nijie.info/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://www.tinami.com/*
// @match        *://bcy.net/*
// @match        *://*.deviantart.com/*
// @match        *://*.hentai-foundry.com/*
// @match        *://twitter.com/*
// @match        *://mobile.twitter.com/*
// @match        *://tweetdeck.twitter.com/*
// @match        *://*.artstation.com/*
// @match        *://saucenao.com/*
// @match        *://pawoo.net/*
// @match        *://*.fanbox.cc/*
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

/* globals MutationSummary _ GM_jQuery_setup */

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
                "https://safebooru.donmai.us":  "Safebooru",
                "https://betabooru.donmai.us":  "Betabooru",
                "https://donmai.moe/":          "Donmai.moe",
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
        }, {
            name: "show_deleted",
            defValue: true,
            descr: "Check to show deleted posts, uncheck to hide",
            type: "boolean",
        }, {
            name: "show_settings",
            defValue: true,
            descr: "Show the settings button in the script manager menu",
            type: "boolean",
        }, {
            name: "debug",
            defValue: false,
            descr: "Print debug messages in console",
            type: "boolean",
        },
    ],
    isValid (settingName, value) {
        const setting = this.list.find((s) => s.name === settingName);
        if (!setting) {
            console.error(`[TPT]: No setting ${settingName}`);
            return false;
        }
        switch (setting.type) {
            case "number": return Number.isInteger(value) && value > 0;
            case "list": return value in setting.values;
            case "boolean": return typeof value === "boolean";
            default:
                console.error(`[TPT]: Unsupported type ${setting.type}`);
                return false;
        }
    },
    get (settingName) {
        const setting = this.list.find((s) => s.name === settingName);
        if (!setting) {
            console.error(`[TPT]: No setting ${settingName}`);
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
            console.error(`[TPT]: No setting ${settingName}`);
            return null;
        }
        if (this.isValid(settingName, value)) {
            GM_setValue(settingName, value);
            return true;
        }
        console.warn(`[TPT]: Invalid value ${value} for ${settingName}`);
        return false;
    },
};

// Which domain to send requests to
const BOORU = SETTINGS.get("booru");
// How long (in seconds) to cache translated tag lookups.
const CACHE_LIFETIME = `${SETTINGS.get("cache_lifetime")}s`;
// Number of recent posts to show in artist tooltips.
const ARTIST_POST_PREVIEW_LIMIT = SETTINGS.get("preview_limit");
// The upper level of rating to show preview. Higher ratings will be blurred.
const SHOW_PREVIEW_RATING = SETTINGS.get("show_preview_rating");
// Whether to show deleted images in the preview or from the posts link
const SHOW_DELETED = SETTINGS.get("show_deleted");
// Whether to print an additional info into the console
const DEBUG = SETTINGS.get("debug");

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
        leave: false, // Prevent hiding when cursor hovers a browser tooltip
    },
};

// Domains where images outside of whitelist are blocked
const CORS_IMAGE_DOMAINS = [
    "twitter.com",
    "bcy.net",
];

// The maximum size of a URL before using a POST request.
// The actual limit is 8154, but setting it lower accounts for the rest of the URL as well.
// Seems like Danbooru's limit is 6577 of unencoded data, so, with space for encoding, let it be 4k.
// It's preferable to use a GET request when able since GET supports caching and POST does not.
const MAXIMUM_URI_LENGTH = 4000;

// For network error management
const MAX_NETWORK_ERRORS = 25;
const MAX_NETWORK_RETRIES = 3;

const TAG_SELECTOR = ".ex-translated-tags, .ex-artist-tag";

const TAG_POSITIONS = {
    beforebegin: {
        insertTag: ($container, $elem) => $container.before($elem),
        findTag: ($container) => $container.prevAll(TAG_SELECTOR),
        getTagContainer: ($elem) => $elem.next(),
    },
    afterbegin:  {
        insertTag: ($container, $elem) => $container.prepend($elem),
        findTag: ($container) => $container.find(TAG_SELECTOR),
        getTagContainer: ($elem) => $elem.parent(),
    },
    beforeend:   {
        insertTag: ($container, $elem) => $container.append($elem),
        findTag: ($container) => $container.find(TAG_SELECTOR),
        getTagContainer: ($elem) => $elem.parent(),
    },
    afterend:    {
        insertTag: ($container, $elem) => $container.after($elem),
        findTag: ($container) => $container.nextAll(TAG_SELECTOR),
        getTagContainer: ($elem) => $elem.prev(),
    },
    afterParent: {
        insertTag: ($container, $elem) => $container.parent().after($elem),
        findTag: ($container) => $container.parent().nextAll(TAG_SELECTOR),
        getTagContainer: ($elem) => $elem.prev().find("a"),
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
    color: #fd9200 !important;
}
.ex-translated-tag-category-4:not(#id) {
    color: #00ab2c !important;
}
.ex-translated-tag-category-3:not(#id) {
    color: #a800aa !important;
}
.ex-translated-tag-category-1:not(#id) {
    color: #c00004 !important;
}
.ex-translated-tag-category-0:not(#id) {
    color: #0075f8 !important;
}
.tpt-dark .ex-translated-tag-category-5:not(#id) {
    color: #ead084 !important;
}
.tpt-dark .ex-translated-tag-category-4:not(#id) {
    color: #35c64a !important;
}
.tpt-dark .ex-translated-tag-category-3:not(#id) {
    color: #c797ff !important;
}
.tpt-dark .ex-translated-tag-category-1:not(#id) {
    color: #ff8a8b !important;
}
.tpt-dark .ex-translated-tag-category-0:not(#id) {
    color: #009be6 !important;
}

.ex-artist-tag {
    white-space: nowrap;
}
.ex-artist-tag.inline {
    display: inline-block;
    margin-left: 0.5em;
}
.ex-artist-tag a:not(#id) {
    color: #c00004 !important;
    margin-left: 0.3ch;
    text-decoration: none;
}
.tpt-dark .ex-artist-tag a:not(#id) {
    color: #ff8a8b !important;
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
    max-width: 558px !important;
    background-color: white;
}
.ex-artist-tooltip.qtip-dark {
    background-color: black;
}
.ex-artist-tooltip .qtip-content {
    width: 540px !important;
    box-sizing: initial;
}
`;

const CACHE_PARAM = (CACHE_LIFETIME ? { expires_in: CACHE_LIFETIME } : {});
// Setting this to the maximum since batches could return more than the amount being queried
const API_LIMIT = 1000;

const QUEUED_NETWORK_REQUESTS = [];

const NETWORK_REQUEST_DICT = {
    wiki: {
        url: "/wiki_pages",
        data_key: "other_names",
        data_type: "array",
        fields: "title,other_names,tag[category]",
        params (otherNamesList) {
            return {
                search: {
                    other_names_include_any_lower_array: otherNamesList,
                    is_deleted: false,
                },
                only: this.fields,
            };
        },
    },
    artist: {
        url: "/artists",
        data_key: "name",
        data_type: "string",
        fields: "id,name,is_banned,other_names,urls[url,is_active]",
        params (nameList) {
            return {
                search: {
                    name_lower_comma: nameList.join(","),
                    is_active: true,
                },
                only: this.fields,
            };
        },
    },
    tag: {
        url: "/tags",
        data_key: "name",
        data_type: "string",
        fields: "name,category,post_count",
        params (nameList) {
            return {
                search: {
                    name_lower_comma: nameList.join(","),
                },
                only: this.fields,
            };
        },
    },
    alias: {
        url: "/tag_aliases",
        data_key: "antecedent_name",
        data_type: "string",
        fields: "antecedent_name,consequent_tag[name,category,post_count]",
        params (nameList) {
            return {
                search: {
                    antecedent_name_lower_comma: nameList.join(","),
                },
                only: this.fields,
            };
        },
    },
    url: {
        url: "/artist_urls",
        data_key: "url",
        data_type: "string",
        fields: "url,artist[id,name,is_deleted,is_banned,other_names,urls[url,is_active]]",
        params (urlList) {
            return {
                search: {
                    url_lower_array: urlList,
                },
                only: this.fields,
            };
        },
        filter: (artistUrls) => artistUrls.filter((artistUrl) => !artistUrl.artist.is_deleted),
    },
    // This can only be used as a single use and not as part a group
    post: {
        url: "/posts",
        data_key: "tag_string",
        data_type: "string_list",
        fields: [
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
        ].join(","),
        params (tagList) {
            return {
                // As this is called immediately and as a single use, only pass the first tag
                tags: `${(SHOW_DELETED ? "status:any" : "-status:deleted")} ${tagList[0].tag}`,
                page: tagList[0].page,
                only: this.fields,
            };
        },
        limit: ARTIST_POST_PREVIEW_LIMIT,
    },
};

function debuglog (...args) {
    if (DEBUG) {
        console.log("[TPT]:", ...args);
    }
}

function memoizeKey (...args) {
    const paramHash = Object.assign(...args.map((param, i) => ({ [i]: param })));
    return $.param(paramHash);
}

// Tag function for template literals to remove newlines and leading spaces
function noIndents (strings, ...values) {
    // Remove all spaces before/after a tag and leave one in other cases
    const compactStrings = strings.map((str) => (
        str.replace(
            /(>)?\n *(<)?/g,
            (s, lt, gt) => (lt && gt ? lt + gt : (lt || gt ? (lt || gt) : " ")),
        )
    ));

    const res = new Array(values.length * 2 + 1);
    // eslint-disable-next-line unicorn/no-for-loop
    for (let i = 0; i < values.length; i++) {
        res[i * 2] = compactStrings[i];
        res[i * 2 + 1] = values[i];
    }
    res[res.length - 1] = compactStrings[compactStrings.length - 1];

    return res.join("");
}

// For safe ways to use regexes in a single line of code
function safeMatch (string, regex, group = 0, defaultValue = "") {
    const match = string.match(regex);
    if (match) {
        return match[group];
    }
    return defaultValue;
}

const safeMatchMemoized = _.memoize(safeMatch, memoizeKey);

function getImage (imageUrl) {
    return GM
        .xmlHttpRequest({
            method: "GET",
            url: imageUrl,
            responseType: "blob",
        })
        .then(({ response }) => response);
}

function checkNetworkErrors (domain, hasError) {
    const data = checkNetworkErrors[domain] || (checkNetworkErrors[domain] = { error: 0 });

    if (hasError) {
        console.log("[TPT]: Total errors:", data.error);
        data.error += 1;
    }
    if (data.error >= MAX_NETWORK_ERRORS) {
        console.error(
            "[TPT]: Maximun number of errors exceeded",
            MAX_NETWORK_ERRORS,
            "for",
            domain,
        );
        return false;
    }
    return true;
}

function queueNetworkRequest (type, item) {
    const request = {
        type,
        item,
        promise: $.Deferred(),
    };
    QUEUED_NETWORK_REQUESTS.push(request);
    return request.promise;
}

const queueNetworkRequestMemoized = _.memoize(queueNetworkRequest, memoizeKey);

function intervalNetworkHandler () {
    Object.keys(NETWORK_REQUEST_DICT).forEach((type) => {
        const requests = QUEUED_NETWORK_REQUESTS.filter((request) => (request.type === type));
        if (requests.length > 0) {
            const items = requests.map((request) => request.item);
            const typeParam = NETWORK_REQUEST_DICT[type].params(items);
            const limitParam = { limit: API_LIMIT };
            if (NETWORK_REQUEST_DICT[type].limit) {
                limitParam.limit = NETWORK_REQUEST_DICT[type].limit;
            }
            const params = Object.assign(typeParam, limitParam, CACHE_PARAM);
            const url = `${BOORU}${NETWORK_REQUEST_DICT[type].url}.json`;
            getLong(url, params, requests, type);
        }
    });
    // Clear the queue once all network requests have been sent
    QUEUED_NETWORK_REQUESTS.length = 0;
}

async function getLong (url, params, requests, type) {
    const sleepHalfSecond = (resolve) => setTimeout(resolve, 500);
    const domain = new URL(url).hostname;
    if (!(checkNetworkErrors(domain, false))) {
        requests.forEach((request) => request.promise.resolve([]));
        return;
    }

    // Default to GET requests
    let func = $.getJSON;
    let finalParams = params;
    if ($.param(params).length > MAXIMUM_URI_LENGTH) {
        // Use POST requests only when needed
        finalParams = Object.assign(finalParams, { _method: "get" });
        func = $.post;
    }

    /* eslint-disable no-await-in-loop */
    let resp = [];
    for (let i = 0; i < MAX_NETWORK_RETRIES; i++) {
        try {
            resp = await func(url, finalParams);
            break;
        } catch (error) {
            console.error(
                "[TPT]: Failed try #",
                i + 1,
                "\nURL:",
                url,
                "\nParameters:",
                finalParams,
                "\nHTTP Error:",
                error.status,
            );
            if (!checkNetworkErrors(domain, true)) {
                requests.forEach((request) => request.promise.resolve([]));
                return;
            }
            await new Promise(sleepHalfSecond);
        }
    }
    /* eslint-enable no-await-in-loop */

    let finalResp = resp;
    if (NETWORK_REQUEST_DICT[type].filter) {
        // Do any necessary filtering after the network request completes
        finalResp = NETWORK_REQUEST_DICT[type].filter(resp);
    }

    // Get the data key which is used to find successful hits in the batch results
    const dataKey = NETWORK_REQUEST_DICT[type].data_key;
    let includes;
    switch (NETWORK_REQUEST_DICT[type].data_type) {
        case "string":
            // Check for matching case-insensitive results
            includes = (data, item) => data.toLowerCase() === item.toLowerCase();
            break;
        case "array":
            // Check for inclusion of case-insensitive results
            includes = (data, item) => data
                .map((it) => it.toLowerCase())
                .includes(item.toLowerCase());
            break;
        case "string_list":
            // Check for inclusion of case-insensitive results
            includes = (data, item) => data
                .toLowerCase()
                .split(" ")
                .includes(item.tag.toLowerCase());
            break;
        default:
            console.error("[TPT]: Unsupported type of response data");
            return;
    }
    requests.forEach((request) => {
        const found = finalResp.filter((data) => {
            if (includes(data[dataKey], request.item)) {
                data.used = true; // eslint-disable-line no-param-reassign
                return true;
            }
            return false;
        });
        // Fulfill the promise which returns the results to the function that queued it
        request.promise.resolve(found);
    });
    const unusedData = finalResp.filter((data) => !data.used);
    if (unusedData.length > 0) {
        debuglog("Unused results found:", unusedData);
    }
}

const NORMALIZE_PROFILE_URL = {
    ".artstation.com": {
        path: /^\/[\w-]+$/,
        normalize (url) {
            const username = safeMatchMemoized(url.hostname, /([\w_-]+)\.artstation\.com/, 1);
            return `https://www.artstation.com/${username}`;
        },
    },
    "bcy.net": {
        path: /^\/u\/\d+$/,
    },
    ".deviantart.com": {
        path: /^\/[\w-]+$/,
        normalize (url) {
            const username = safeMatchMemoized(url.hostname, /([\w-]+)\.deviantart\.com/, 1);
            return `https://www.deviantart.com/${username}`;
        },
    },
    ".fanbox.cc": { path: /^\/$/ },
    "mobile.twitter.com": {
        path: /^x$/, // Just invalidate any path
        normalize (url) {
            return normalizeProfileURL(`https://twitter.com${url.pathname}`);
        },
    },
    "www.hentai-foundry.com": {
        path: /^\/user\/[\w_-]+$/,
        normalize (url) {
            const username = safeMatchMemoized(url.pathname, /\/user\/([\w_-]+)(\/profile)?/, 1);
            return `https://www.hentai-foundry.com/user/${username}`;
        },
    },
    "medibang.com": {},
    "seiga.nicovideo.jp": {
        path: /^\/user\/illust\/\d+$/,
    },
    "www.nicovideo.jp": {
        path: /^\/user\/\d+$/,
    },
    "nijie.info": {
        path: /^\/members\.php$/,
        params: /id=\d+/,
    },
    "pawoo.net": {
        path: /^\/@[\w_-]+$/,
    },
    "www.pixiv.net": {
        path: /^\/users\/\d+$/,
        normalize (url) {
            const userId = url.pathname === "/member.php"
                ? safeMatchMemoized(url.search, /id=(\d+)/, 1)
                : safeMatchMemoized(url.pathname, /(?:\/en)?\/users\/(\d+)/, 1);
            return `https://www.pixiv.net/users/${userId}`;
        },
    },
    "www.tinami.com": {
        path: /^\/creator\/profile\/\d+$/,
    },
    "twitter.com": {
        path: /^\/[\w_-]+|\/intent\/user$/,
    },
};

// Converts URLs to the same format used by the URL column on Danbooru
function normalizeProfileURL (profileUrl, depth = 0) {
    const url = new URL(profileUrl.toLowerCase());
    if (url.protocol !== "https:") url.protocol = "https:";
    let host = url.hostname;
    if (!(host in NORMALIZE_PROFILE_URL)) {
        host = ".".concat(host.split(".").slice(-2).join("."));
    }
    if (!(host in NORMALIZE_PROFILE_URL)) {
        console.warn("[TPT]: Unsupported domain:", host);
        return profileUrl;
    }

    const { path, params, normalize } = NORMALIZE_PROFILE_URL[host];
    if (path && !path.test(url.pathname) || params && !params.test(url.search)) {
        if (!normalize) {
            console.error("[TPT]: Normalization isn't implemented:", profileUrl);
            return null;
        }
        // Normalize and validate the url without infinite loop
        const res = depth < 10  ? normalizeProfileURL(normalize(url), depth + 1) : null;
        if (!res || res === profileUrl) {
            console.error("[TPT]: Failed to normalize URL:", profileUrl);
        }
        return res;
    }
    let link = url.toString();
    if (link.endsWith("/")) link = link.slice(0, -1);
    return link;
}

async function translateTag (target, tagName, options) {
    if (!tagName) return;

    const normalizedTag = tagName
        // .trim()
        .normalize("NFKC")
        .replace(/^#/, "")
        .replace(/[*]/g, "\\*") // Escape * (wildcard)
        .replace(/\s/g, "_"); // Wiki other names cannot contain spaces

    /* Don't search for empty tags. */
    if (normalizedTag.length === 0) {
        return;
    }

    const wikiPages = await queueNetworkRequestMemoized("wiki", normalizedTag);

    let tags = [];
    if (wikiPages.length > 0) {
        tags = wikiPages
            // Ignore wiki pages of non-tags
            .filter(({ tag }) => tag)
            .map(({ title, tag }) => ({
                name: title,
                prettyName: title.replace(/_/g, " "),
                category: tag.category,
            }));
    // `normalizedTag` consists of only ASCII characters except percent, asterics, and comma
    } else if (normalizedTag.match(/^[\u0020-\u0024\u0026-\u0029\u002B\u002D-\u007F]+$/)) {
        // The server is already converting the values to
        // lowercase on its end so no need to do it here
        tags = await queueNetworkRequestMemoized("tag", normalizedTag);
        if (tags.length === 0) {
            const aliases = await queueNetworkRequestMemoized("alias", normalizedTag);
            tags = aliases.map((alias) => alias.consequent_tag);
        }
        tags = tags.map((tag) => ({
            name: tag.name,
            prettyName: tag.name.replace(/_/g, " "),
            category: tag.category,
        }));
    }

    if (tags.length === 0) {
        debuglog(`No translation for "${normalizedTag}", rule "${options.ruleName}"`);
        return;
    }

    addDanbooruTags($(target), tags, options);
}

function addDanbooruTags ($target, tags, options = {}) {
    if (tags.length === 0) return;

    const renderedTags = addDanbooruTags.cache || (addDanbooruTags.cache = {});
    const {
        onadded = null, // ($tag, options)=>{},
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
        } = {},
    } = options;
    let { classes = "" } = options;
    classes = `ex-translated-tags ${classes}`;

    const key = tags.map((tag) => tag.name).join("");
    if (!(key in renderedTags)) {
        renderedTags[key] = $(noIndents`
            <span class="${classes}">
                ${tags.map((tag) => (
                    noIndents`
                    <a class="ex-translated-tag-category-${tag.category}"
                       href="${BOORU}/posts?tags=${encodeURIComponent(tag.name)}"
                       target="_blank">
                            ${_.escape(tag.prettyName)}
                    </a>`
                ))
                .join(", ")}
            </span>`);
    }
    const $tagsContainer = renderedTags[key].clone().prop("className", classes);
    if (DEBUG) $tagsContainer.attr("rulename", options.ruleName || "");
    insertTag($target, $tagsContainer);

    if (onadded) onadded($tagsContainer, options);
}

async function translateArtistByURL (element, profileUrls, options) {
    if (!profileUrls || profileUrls.length === 0) return;

    const promiseArray = (Array.isArray(profileUrls) ? profileUrls : [profileUrls])
        .map(normalizeProfileURL)
        .filter((url) => url)
        .map((url) => queueNetworkRequestMemoized("url", url));

    const artistUrls = (await Promise.all(promiseArray)).flat();
    const artists = artistUrls.map((artistUrl) => artistUrl.artist);
    if (artists.length === 0) {
        const urls = Array.isArray(profileUrls) ? profileUrls.join(", ") : profileUrls;
        debuglog(`No artist at "${urls}", rule "${options.ruleName}"`);
        return;
    }

    artists.forEach((artist) => addDanbooruArtist($(element), artist, options));
}

async function translateArtistByName (element, artistName, options) {
    if (!artistName) return;

    const artists = await queueNetworkRequestMemoized("artist", artistName.replace(/ /g, "_"));

    if (artists.length === 0) {
        debuglog(`No artist "${artistName}", rule "${options.ruleName}"`);
        return;
    }

    artists.forEach((artist) => addDanbooruArtist($(element), artist, options));
}

function addDanbooruArtist ($target, artist, options = {}) {
    const renderedArtists = addDanbooruArtist.cache || (addDanbooruArtist.cache = {});
    const {
        onadded = null, // ($tag, options)=>{},
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
            findTag = TAG_POSITIONS.afterend.findTag,
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

    const $duplicates = findTag($target)
        .filter((i, el) => el.textContent.trim() === artist.escapedName);
    if ($duplicates.length > 0) {
        // If qtip was removed then add it back
        if (!$.data($duplicates.find("a")[0]).qtip) {
            $duplicates.find("a").qtip(qtipSettings);
        }
        return;
    }

    if (!(artist.id in renderedArtists)) {
        renderedArtists[artist.id] = $(noIndents`
            <div class="${classes}">
                <a href="${BOORU}/artists/${artist.id}" target="_blank">
                    ${artist.escapedName}
                </a>
            </div>`);
    }
    const $tag = renderedArtists[artist.id].clone().prop("className", classes);
    if (DEBUG) $tag.attr("rulename", options.ruleName || "");
    insertTag($target, $tag);
    $tag.find("a").qtip(qtipSettings);

    if (onadded) onadded($tag, options);
}

function attachShadow ($target, $content, css) {
    // Return if the target already have shadow
    if ($target.prop("shadowRoot")) return;

    if (_.isFunction(document.body.attachShadow)) {
        const shadowRoot = $target.get(0).attachShadow({ mode: "open" });
        $(shadowRoot).append($content);
        if ("adoptedStyleSheets" in shadowRoot) {
            const sheet = new CSSStyleSheet();
            sheet.replace(css);
            shadowRoot.adoptedStyleSheets = [sheet];
        } else {
            $(shadowRoot).append(`<style>${css}</style>`);
        }
    } else {
        $target.empty().append($content, `<style>${css}</style>`);
    }
}

function chooseBackgroundColorScheme ($element) {
    const TRANSPARENT_COLOR = "rgba(0, 0, 0, 0)";
    // Halfway between white/black in the RGB scheme
    const MIDDLE_LUMINOSITY = 128;

    // Get background colors of all parent elements with a nontransparent background color
    const backgroundColors = $element.parents().addBack()
        .map((i, el) => $(el).css("background-color"))
        .get()
        .filter((color) => color !== TRANSPARENT_COLOR);
    if (backgroundColors.length === 0) backgroundColors.push("rgb(255,255,255)");
    // Calculate summary color and get RGB channels
    const colorChannels = backgroundColors
        .map((color) => color.match(/\d+/g))
        .reverse()
        .reduce(([r1, g1, b1], [r2, g2, b2, al = 1]) => [
            r1 * (1 - al) + r2 * al,
            g1 * (1 - al) + g2 * al,
            b1 * (1 - al) + b2 * al,
        ])
        .slice(0, 3); // Ignore alpha
    const medianLuminosity = (Math.max(...colorChannels) + Math.min(...colorChannels)) / 2;
    const adjustedChannels = colorChannels.map((color) => {
        const colorScale = (color - MIDDLE_LUMINOSITY) / MIDDLE_LUMINOSITY; // To range [-1..+1]
        return Math.round(
            (Math.abs(colorScale) ** 0.7)            // "Move" value away from 0 which equal to 128
            * Math.sign(colorScale)                  // Get original sign back
            * MIDDLE_LUMINOSITY + MIDDLE_LUMINOSITY, // Get back to the RGB range [0..255]
        );
    });
    const adjustedColor = `rgb(${adjustedChannels.join(", ")})`;
    const theme = (medianLuminosity < MIDDLE_LUMINOSITY ? "dark" : "light");
    return {
        theme,
        adjustedColor,
    };
}

async function buildArtistTooltip (artist, qtip) {
    const renderedQtips = buildArtistTooltip.cache || (buildArtistTooltip.cache = {});

    if (!(artist.name in renderedQtips)) {
        renderedQtips[artist.name] = buildArtistTooltipContent(artist);
    }

    if (
        !qtip.elements.tooltip.hasClass("qtip-dark")
        && !qtip.elements.tooltip.hasClass("qtip-light")
    ) {
        // Select theme and background color based upon the background of surrounding elements
        const { theme, adjustedColor } = chooseBackgroundColorScheme(qtip.elements.target);
        qtip.elements.content.addClass(`qtip-content-${theme}`);
        qtip.elements.tooltip.addClass(`qtip-${theme}`);
        qtip.elements.tooltip.css("background-color", adjustedColor);
    }

    let $qtipContent = await renderedQtips[artist.name];
    // For correct work of CORS images must not be cloned at first displaying
    if ($qtipContent.parent().length > 0) $qtipContent = $qtipContent.clone(true, true);
    // eslint-disable-next-line no-use-before-define
    attachShadow(qtip.elements.content, $qtipContent, ARTIST_TOOLTIP_CSS);
    qtip.reposition(null, false);
}

const ARTIST_TOOLTIP_CSS = `
    :host {
        --preview_has_children_color: #35c64a;
        --preview_has_parent_color: #ccaa00;
        --preview_deleted_color: #1e1e2c;
        --preview_pending_color: #0075f8;
        --preview_flagged_color: #ed2426;
    }
    :host(.qtip-content-dark) {
        --preview_has_children_color: #35c64a;
        --preview_has_parent_color: #fd9200;
        --preview_deleted_color: #ababbc;
        --preview_pending_color: #009be6;
        --preview_flagged_color: #ed2426;
    }

    article.container {
        font-family: Verdana, Helvetica, sans-serif;
        padding: 10px;
    }

    section {
        margin-bottom: 15px;
        line-height: 12.5px;
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
        display: inline-block;
    }

    ul.other-names li a {
        background-color: rgba(128,128,128,0.2);
        padding: 3px 5px;
        margin: 0 2px;
        border-radius: 3px;
        white-space: nowrap;
    }

    section.urls ul {
        list-style: disc inside;
        padding: 0px;
        max-height: 145px;
    }

    section.urls ul ::marker {
        font-size: 10px;
    }

    section.urls ul li.artist-url-inactive a {
        color: red;
        text-decoration: underline;
        text-decoration-style: dotted;
    }
    :host(.qtip-content-dark) section.urls ul li.artist-url-inactive a {
        color: red;
        text-decoration: underline;
        text-decoration-style: dotted;
    }


    /* Basic styles taken from Danbooru */
    a:link, a:visited {
        color: #0075f8;
        text-decoration: none;
    }
    a:hover {
        color: #8caaff;
    }
    a.tag-category-artist {
        color: #c00004;
    }
    a.tag-category-artist:hover {
        color: #ed2426;
    }
    :host(.qtip-content-dark) a:link, :host(.qtip-content-dark) a:visited {
        color: #009be6;
    }
    :host(.qtip-content-dark) a:hover {
        color: #4bb4ff;
    }
    :host(.qtip-content-dark) a.tag-category-artist {
        color: #ff8a8b;
    }
    :host(.qtip-content-dark) a.tag-category-artist:hover {
        color: #ffc3c3;
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
    article.post-preview:nth-child(3n),
    article.post-preview:last-child {
        margin: 0 2px 10px 0;
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
        border-color: var(--preview_has_children_color)
                      var(--preview_has_parent_color)
                      var(--preview_has_parent_color)
                      var(--preview_has_children_color);
    }

    article.post-preview.post-status-deleted a {
        border-color: var(--preview_deleted_color);
    }

    article.post-preview.post-status-has-children.post-status-deleted a {
        border-color: var(--preview_has_children_color)
                      var(--preview_deleted_color)
                      var(--preview_deleted_color)
                      var(--preview_has_children_color);
    }

    article.post-preview.post-status-has-parent.post-status-deleted a {
        border-color: var(--preview_has_parent_color)
                      var(--preview_deleted_color)
                      var(--preview_deleted_color)
                      var(--preview_has_parent_color);
    }

    article.post-preview.post-status-has-children.post-status-has-parent.post-status-deleted a {
        border-color: var(--preview_has_children_color)
                      var(--preview_deleted_color)
                      var(--preview_deleted_color)
                      var(--preview_has_parent_color);
    }

    article.post-preview.post-status-pending a,
    article.post-preview.post-status-flagged a {
        border-color: var(--preview_pending_color);
    }

    article.post-preview.post-status-has-children.post-status-pending a,
    article.post-preview.post-status-has-children.post-status-flagged a {
        border-color: var(--preview_has_children_color)
                      var(--preview_pending_color)
                      var(--preview_pending_color)
                      var(--preview_has_children_color);
    }

    article.post-preview.post-status-has-parent.post-status-pending a,
    article.post-preview.post-status-has-parent.post-status-flagged a {
        border-color: var(--preview_has_parent_color)
                      var(--preview_pending_color)
                      var(--preview_pending_color)
                      var(--preview_has_parent_color);
    }

    article.post-preview.post-status-has-children.post-status-has-parent.post-status-pending a,
    article.post-preview.post-status-has-children.post-status-has-parent.post-status-flagged a {
        border-color: var(--preview_has_children_color)
                      var(--preview_pending_color)
                      var(--preview_pending_color)
                      var(--preview_has_parent_color);
    }

    article.post-preview[data-tags~=animated]::before {
        content: "►";
        position: absolute;
        width: 20px;
        height: 20px;
        color: white;
        background-color: rgba(0,0,0,0.5);
        margin: 2px;
        text-align: center;
        line-height: 18px;
        z-index: 1;
    }

    article.post-preview[data-has-sound=true]::before {
        content: "♪";
        position: absolute;
        width: 20px;
        height: 20px;
        color: white;
        background-color: rgba(0,0,0,0.5);
        margin: 2px;
        text-align: center;
        line-height: 18px;
        z-index: 1;
    }

    div.post-pager {
        display: flex;
        align-items: stretch;
        gap: 3px;
    }
    div.post-pager.loading {
        opacity: 0.5;
        cursor: wait;
    }
    div.post-pager.loading a {
        cursor: progress;
    }
    div.post-pager .btn {
        width: 12px;
        flex-shrink: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
    }
    div.post-pager .btn.disabled {
        opacity: 0.5;
        cursor: default;
    }
    div.post-pager.loading .btn {
        cursor: inherit;
    }
    div.post-pager .btn:last-child {
        justify-content: flex-end;
    }
    div.post-pager .btn:hover {
        background: #8884;
        border-radius: 3px;
    }


    div.post-list {
        display: grid;
        grid-template-columns: repeat(3, auto);
        grid-auto-rows: max-content;
        max-height: 422px;
        margin-right: auto;
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
        letter-spacing: -0.1px;
    }

    article.post-preview.blur-post img {
        filter: blur(10px);
    }

    article.post-preview.blur-post:hover img {
        filter: blur(0px);
        transition: filter 1s 0.5s;
    }

    .scrollable {
        overflow-y: auto;
        overflow-x: hidden;
        /* Firefox */
        scrollbar-color: rgba(128,128,128,0.4) rgba(128,128,128,0.2);
        scrollbar-width: thin;
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
`;

async function buildArtistTooltipContent (artist) {
    const waitPosts = queueNetworkRequestMemoized("post", { tag: artist.name, page: 1 });
    const waitTags = queueNetworkRequestMemoized("tag", artist.name);
    // Process the queue immediately
    intervalNetworkHandler();

    const [[tag = { post_count: 0 }], posts = []] = await Promise.all([waitTags, waitPosts]);


    const otherNames = artist.other_names
        .filter(String)
        .sort()
        .map((otherName) => (
            noIndents`
            <li>
                <a href="${BOORU}/artists?search[name]=${encodeURIComponent(otherName)}"
                   target="_blank">
                    ${_.escape(otherName.replace(/_/g, " "))}
                </a>
            </li>`
        ))
        .join("");

    const status = SHOW_DELETED ? "status%3Aany" : "-status%3Adeleted";
    const nextBtnClass = tag.post_count <= ARTIST_POST_PREVIEW_LIMIT ? "disabled" : "";
    const $content = $(noIndents`
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
                    ${otherNames}
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
                    <a href="${BOORU}/posts?tags=${artist.encodedName}+${status}" target="_blank">
                        »
                    </a>
                </h2>
                <div class="post-pager"
                    data-tag="${artist.encodedName}"
                    data-page="1"
                    data-last-page="${Math.ceil(tag.post_count / ARTIST_POST_PREVIEW_LIMIT)}"
                >
                    <div class="btn disabled">&lt;</div>
                    <div class="post-list scrollable" part="post-list"></div>
                    <div class="btn ${nextBtnClass}">&gt;</div>
                </div>
            </section>
        </article>
    `);
    $content.find(".post-list").append(posts.map(buildPostPreview));
    $content.find(".settings-icon").click(showSettings);
    $content.find(".btn").click(loadNextPage);
    return $content;
}

function buildArtistUrlsHtml (artist) {
    const getDomain = (url) => safeMatchMemoized(new URL(url.url).host, /[^.]*\.[^.]*$/);
    const artistUrls = _(artist.urls)
        .chain()
        .uniq("url")
        .sortBy("url")
        .sortBy(getDomain)
        .sortBy((artistUrl) => !artistUrl.is_active);

    return artistUrls
        .map((artistUrl) => {
            const normalizedUrl = artistUrl.url.replace(/\/$/, "");
            const urlClass = artistUrl.is_active ? "artist-url-active" : "artist-url-inactive";

            return noIndents`
                <li class="${urlClass}">
                    <a href="${normalizedUrl}" target="_blank">
                        ${_.escape(normalizedUrl)}
                    </a>
                </li>`;
        })
        .join("");
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
    const previewFileUrl = `${BOORU}/images/download-preview.png`;

    let previewClass = "post-preview";
    if (post.is_pending)           previewClass += " post-status-pending";
    if (post.is_flagged)           previewClass += " post-status-flagged";
    if (post.is_deleted)           previewClass += " post-status-deleted";
    if (post.parent_id)            previewClass += " post-status-has-parent";
    if (post.has_visible_children) previewClass += " post-status-has-children";
    if (RATINGS[post.rating] > RATINGS[SHOW_PREVIEW_RATING]) {
        previewClass += " blur-post";
    }

    const dataAttributes = `
      data-id="${post.id}"
      data-has-sound="${Boolean(post.tag_string.match(/(video_with_sound|flash_with_sound)/))}"
      data-tags="${_.escape(post.tag_string)}"
    `;

    const scale = Math.min(150 / post.image_width, 150 / post.image_height, 1);
    const width = Math.round(post.image_width * scale);
    const height = Math.round(post.image_height * scale);

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
            <p>${domain}, rating:${post.rating.toUpperCase()}</p>
            <p>${timeToAgo(post.created_at)}</p>
        </article>
    `);

    if (CORS_IMAGE_DOMAINS.includes(window.location.host)) {
        // Temporaly set transparent 1x1 image
        $preview.find("img").prop("src", "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
        getImage(post.preview_file_url || previewFileUrl).then((blob) => {
            const imageBlob = blob.slice(0, blob.size, "image/jpeg");
            const blobUrl = window.URL.createObjectURL(imageBlob);
            $preview.find("img").prop("src", blobUrl);
        });
    } else {
        $preview.find("img").prop("src", post.preview_file_url);
    }
    if (!post.preview_file_url || post.preview_file_url.endsWith("/images/download-preview.png")) {
        $preview.find("img").prop({
            width: 150, height: 150,
        });
    }

    return $preview;
}

async function loadNextPage (ev) {
    const $btn = $(ev.target);
    const $container = $btn.parent();
    if ($container.is(".loading")) return;

    const tag = $container.data("tag");
    let page = +$container.data("page");
    const lastPage = +$container.data("lastPage");
    const dir = $btn.is(":first-child") ? -1 : +1;
    page += dir;
    if (page < 1 || page > lastPage) return;

    $container.find(".btn.disabled").removeClass("disabled");
    if (page === 1) $container.find(".btn:first-child").addClass("disabled");
    if (page === lastPage) $container.find(".btn:last-child").addClass("disabled");

    $container.data("page", page).addClass("loading");
    const waitPosts = queueNetworkRequestMemoized("post", { tag, page });
    // Process the queue immediately
    intervalNetworkHandler();
    const posts = await waitPosts;
    $container.removeClass("loading");
    $container.find(".post-list").empty().append(posts.map(buildPostPreview));
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
            case "list": {
                const options = Object
                    .entries(setting.values)
                    .map(([val, descr]) => noIndents`
                        <option value="${val}" ${val === value ? "selected" : ""}>
                            ${descr}
                        </option>`)
                    .join("");

                return noIndents`
                    <select name="${setting.name}">
                        ${options}
                    </select>`;
            }
            case "boolean":
                return noIndents`
                    <input type="checkbox"
                           ${value ? "checked" : ""}
                           name="${setting.name}" />`;
            default:
                console.error(`[TPT]: Unsupported type ${setting.type}`);
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

    const styles = `
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
    `;
    const $settings = $(noIndents`
        <div id="ui-settings">
            <div class="container">
                <h2>Translate Pixiv Tags settings</h2>
                ${SETTINGS.list
                    .map((setting) => (
                        noIndents`
                        <div>${setting.descr}:</div>
                        <div>${settingToInput(setting)}</div>`
                    ))
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
    $settings.find("input[type='number'], input[type='checkbox'], select").change((ev) => (
        $settings.find(".refresh-page").removeAttr("disabled")
    ));
    $settings.find(".refresh-page").click((ev) => {
        $settings.find("input[type='number'], input[type='checkbox'], select").each((i, el) => {
            const $input = $(el);
            let value = null;
            if ($input.is("select")) {
                value = $input.val();
            } else if ($input.prop("type") === "number") {
                value = Number($input.val());
            } else if ($input.prop("type") === "checkbox") {
                value = $input.prop("checked");
            } else {
                return;
            }
            SETTINGS.set($input.prop("name"), value);
        });
        closeSettings();
        window.location.reload();
    });
    $settings.find(".cancel").click(closeSettings);
    $(document).keydown(closeSettingsOnEscape);

    const { theme } = chooseBackgroundColorScheme($("#ex-qtips"));
    $settings.addClass(`qtip-${theme}`);

    attachShadow($shadowContainer, $settings, styles);
}

function findAndTranslate (mode, selector, options = {}) {
    const fullOptions = {
        asyncMode: false,
        requiredAttributes: null,
        predicate: null, // (el) => true,
        toProfileUrl: (el) => $(el).closest("a").prop("href"),
        toTagName: (el) => el.textContent,
        tagPosition: TAG_POSITIONS.afterend,
        classes: "",
        onadded: null, // ($tag, options) => {},
        mode,
        ...options,
    };

    if (typeof fullOptions.predicate === "string") {
        const predicateSelector = fullOptions.predicate;
        fullOptions.predicate = (el) => $(el).is(predicateSelector);
    }

    const { translate, getData } = (function fn () {
        switch (mode) {
            case "artist":
                return {
                    translate: translateArtistByURL,
                    getData: fullOptions.toProfileUrl,
                };
            case "artistByName":
                return {
                    translate: translateArtistByName,
                    getData: fullOptions.toTagName,
                };
            case "tag":
                return {
                    translate: translateTag,
                    getData: fullOptions.toTagName,
                };
            default:
                throw new Error(`Unsupported mode ${mode}`);
        }
    }());

    const tryToTranslate = (elem) => {
        if (!fullOptions.predicate || fullOptions.predicate(elem)) {
            translate(elem, getData(elem), fullOptions);
        }
    };

    $(selector).each((i, elem) => tryToTranslate(elem));

    if (!fullOptions.asyncMode) return;

    const query = { element: selector };
    if (fullOptions.requiredAttributes) query.elementAttributes = fullOptions.requiredAttributes;
    new MutationSummary({
        rootNode: document.body,
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

function deleteOnUrlChange ($tag, options) {
    const $container = options.tagPosition.getTagContainer($tag);
    const watcher = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.attributeName === "href")) {
            $tag.remove();
            watcher.disconnect();
        }
    });
    watcher.observe($container[0], { attributes: true });
}

function linkInChildren (el) {
    return $(el).find("a").prop("href");
}

/* https://twitter.com/search?q=%23ガルパン版深夜のお絵描き60分一本勝負 */
/* #艦これ版深夜のお絵描き60分一本勝負 search query for TweetDeck */
const COMMON_HASHTAG_REGEXES = [
    /生誕祭\d*$/,
    /誕生祭\d*$/,
    /版もうひとつの深夜の真剣お絵描き60分一本勝負(?:_\d+$|$)/,
    /版深夜の真剣お絵描き60分一本勝負(?:_\d+$|$)/,
    /深夜の真剣お絵描き60分一本勝負(?:_\d+$|$)/,
    /版深夜のお絵描き60分一本勝負(?:_\d+$|$)/,
    /版真剣お絵描き60分一本勝負(?:_\d+$|$)/,
    /版真剣お絵描き60分一本勝(?:_\d+$|$)/,
    /版お絵描き60分一本勝負(?:_\d+$|$)/,
];
const getNormalizedHashtagName = (el) => {
    const tagName = el.textContent;
    // eslint-disable-next-line no-restricted-syntax
    for (const regexp of COMMON_HASHTAG_REGEXES) {
        const normalizedTagName = tagName.replace(regexp, "");
        if (normalizedTagName !== tagName) {
            if (normalizedTagName !== "") {
                return normalizedTagName;
            }
            break;
        }
    }
    return tagName;
};

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
        .ex-translated-tags + div,
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
        /* Fix styles for tags on search page */
        div + .ex-translated-tags {
            font-size: 20px;
            font-weight: bold;
        }
        /**
         * On the artist profile page, locate the danbooru artist tag
         * between the artist name and follower count because there can be
         * "premium" and "accepting requests" labels to the right of the artist name
         */
        div.dqLunY {
            display: grid;
            grid-gap: 4px;
            grid-auto-rows: 16px;
            grid-template-columns: auto auto 1fr;
            justify-items: start;
        }
        .dqLunY .ex-artist-tag {
            grid-area: 2/1 / 3/4;
        }
        .dqLunY .ex-artist-tag + .ex-artist-tag {
            grid-area: 3/1 / 4/4;
        }
        /* Illust page: fix locate artist tag to not trigger native tooltip */
        main>section h2:not(#id),
        main+aside>section>h2:not(#id) {
            display: flex;
            flex-direction: column-reverse;
            align-items: flex-start;
        }
        main>section h2>.ex-artist-tag+:not(.ex-artist-tag),
        main+aside>section>h2>.ex-artist-tag+:not(.ex-artist-tag) {
            pointer-events: none;
        }
        main>section h2>.ex-artist-tag+div>a,
        main>section h2>.ex-artist-tag+div>div>*,
        main+aside>section>h2>.ex-artist-tag+div>div>*,
        main+aside>section>h2>.ex-artist-tag+div>a {
            pointer-events: all;
        }
        main>section h2>.ex-artist-tag+div>::after,
        main+aside>section>h2>.ex-artist-tag+div>::after {
            content: "";
            height: 18px;
        }
        main>section h2>.ex-artist-tag+.ex-artist-tag+div>::after,
        main+aside>section>h2>.ex-artist-tag+.ex-artist-tag+div>::after {
            height: 30px;
        }
        main>section h2 .ex-artist-tag,
        main+aside>section>h2 .ex-artist-tag {
            margin-left: 50px;
            height: 0;
            position: relative;
            top: -24px;
        }
        main>section h2 .ex-artist-tag + .ex-artist-tag,
        main+aside>section>h2 .ex-artist-tag + .ex-artist-tag {
            top: -38px;
        }
        main section h2+button {
            margin-left: 8px;
        }
        /* Illust page: fix artist tag overflowing in related works and on search page */
        section div[type="illust"] ~ div:last-child,
        aside li>div>div:nth-child(3) {
            flex-direction: column;
            align-items: flex-start;
        }
        section ul .ex-artist-tag,
        aside ul .ex-artist-tag {
            margin-left: 6px;
        }
        /* Tags in a box */
        a[color] > div:not(#id) {
            max-width: initial;
        }
        a[color] > div > .ex-translated-tags a {
            font-weight: bold;
        }
        .shadow.ex-translated-tags a {
            text-shadow: 0 0 3px #fff8;
        }
        .tpt-dark .shadow.ex-translated-tags a, dark-shadow.ex-translated-tags a {
            text-shadow: 0 0 3px #000B;
        }
        .ex-translated-tags.no-brackets::before,
        .ex-translated-tags.no-brackets::after {
            content: none;
        }
        /* On contest page */
        span.user-name {
            text-align: left;
        }
    `);

    // To remove smth like `50000users入り`, e.g. here https://www.pixiv.net/en/artworks/68318104
    const getNormalizedTagName = (el) => el.textContent.replace(/\d+users入り$/, "");

    findAndTranslate("tag", [
        // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=123456
        ".work-tags-container .tag",
        // https://www.pixiv.net/tags.php
        // https://www.pixiv.net/novel/tags.php
        ".tag-list li .tag-value",
    ].join(", "), {
        toTagName: getNormalizedTagName,
        ruleName: "simple tags",
    });

    // https://dic.pixiv.net/a/東方
    findAndTranslate("tag", "#content_title #article-name", {
        tagPosition: TAG_POSITIONS.beforeend,
        toTagName: getNormalizedTagName,
        ruleName: "wiki tag",
    });

    // Tags on work pages: https://www.pixiv.net/en/artworks/66475847
    findAndTranslate("tag", "span", {
        predicate: "figcaption li > span > span:first-child",
        toTagName: getNormalizedTagName,
        asyncMode: true,
        ruleName: "artwork tags",
    });

    // Main tag on search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    findAndTranslate("tag", "div", {
        predicate: "#root>div>div>div>div:nth-child(2)>div>div>div:has(>span:first-child)",
        asyncMode: true,
        ruleName: "search tag",
    });

    // Tags in box:
    // Search page: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    // The index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    // Artist profile: https://www.pixiv.net/en/users/104471/illustrations
    findAndTranslate("tag", "div", {
        predicate: "a[color]>div>div:last-child",
        tagPosition: {
            insertTag: ($container, $elem) => $container.parent().prepend($elem),
            findTag: ($container) => $container.parent().find(TAG_SELECTOR),
            getTagContainer: ($elem) => $elem.nextUntil(":last-child"),
        },
        classes: "no-brackets shadow",
        asyncMode: true,
        // Fix bad contrast of tag color over colored bg
        onadded: ($tag) => $tag
            .closest("section,ul")
            .find("a[color!='']")
            .css("background-color", (_, color) => {
                const alpha = $("body").is(".tpt-dark") ? 0.5 : 0.75;
                return `${color.slice(0, -1)}, ${alpha})`;
            })
            .attr("color", ""),
        ruleName: "related tag",
    });

    // Popular tags on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("tag", "div", {
        predicate: "a.gtm-toppage-tag-popular-tag-illustration>div>div:first-child>div:only-child",
        tagPosition: TAG_POSITIONS.beforebegin,
        classes: "no-brackets dark-shadow",
        asyncMode: true,
        ruleName: "popular tag",
    });

    // Tag of recommended illusts on index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("tag", "h2", {
        predicate: "section > div > div > h2",
        toTagName: (el) => (el.textContent.includes("#")
            ? el.textContent.slice(el.textContent.indexOf("#") + 1)
            : null),
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        ruleName: "tag of recommended illusts",
    });

    // Illust author aside https://www.pixiv.net/en/artworks/66475847
    // Illust author below https://www.pixiv.net/en/artworks/66475847
    findAndTranslate("artist", "a", {
        predicate: "main+aside>section>h2>div>div>a, main>section h2>div>div>a",
        requiredAttributes: "href",
        tagPosition: {
            insertTag: ($container, $elem) => $container.closest("h2").prepend($elem),
            findTag: ($container) => $container.closest("h2").find(TAG_SELECTOR),
            getTagContainer: ($elem) => $elem.parent().find("div>div>a"),
        },
        asyncMode: true,
        onadded: deleteOnUrlChange,
        ruleName: "illust artist",
    });

    // Related work's artists https://www.pixiv.net/en/artworks/66475847
    // New search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    // Bookmarks: https://www.pixiv.net/en/users/29310/bookmarks/artworks
    // Thumbs on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    // Posts of followed artists: https://www.pixiv.net/bookmark_new_illust.php
    findAndTranslate("artist", "a", {
        predicate: "section ul div>div:last-child:not([type='illust'])>div[aria-haspopup]:not(.ex-artist-tag)>a:last-child",
        tagPosition: TAG_POSITIONS.afterParent,
        asyncMode: true,
        ruleName: "artist below illust thumb",
    });

    // Artist profile pages: https://www.pixiv.net/en/users/29310, https://www.pixiv.net/en/users/104471/illustrations
    const normalizePageUrl = () => `https://www.pixiv.net/en/users/${safeMatchMemoized(window.location.pathname, /\d+/)}`;
    findAndTranslate("artist", "h1", {
        predicate: "div.dqLunY > h1",
        toProfileUrl: normalizePageUrl,
        asyncMode: true,
        ruleName: "artist profile",
    });

    // Deleted artist profile: https://www.pixiv.net/en/users/1843825
    findAndTranslate("artist", ".error-title", {
        // Trigger only on profile page
        toProfileUrl: () => (safeMatchMemoized(window.location.pathname, /^\/(en\/)?users/)
            ? normalizePageUrl()
            : ""),
        tagPosition: TAG_POSITIONS.afterbegin,
        ruleName: "deleted artist profile",
    });

    // Ranking pages: https://www.pixiv.net/ranking.php?mode=original
    findAndTranslate("artist", "a.user-container.ui-profile-popup", {
        asyncMode: true,
        ruleName: "ranking artist",
    });

    // Artist info modern popup
    findAndTranslate("artist", "a[class][data-gtm-value]", {
        predicate: "div[open] a+a",
        asyncMode: true,
        ruleName: "artist info modern popup",
    });

    // Artist info old popup
    findAndTranslate("artist", "a.user-name", {
        classes: "inline",
        asyncMode: true,
        ruleName: "artist info old popup",
    });

    // Section of recommended artists on the index page:
    // https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("artist", "a", {
        predicate: "section ul>div>div>div:last-child>a+div>a:first-child",
        tagPosition: TAG_POSITIONS.afterend,
        asyncMode: true,
        ruleName: "recommended artist",
    });

    // Winners of a contest
    // https://www.pixiv.net/contest/touhoulostword
    findAndTranslate("artist", ".user-info>a>span.user-name", {
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "contest winner",
    });

    // Participants of a contest
    // https://www.pixiv.net/contest/touhoulostword
    findAndTranslate("artist", "a", {
        predicate: "._user-icon-container>a",
        tagPosition: TAG_POSITIONS.afterend,
        classes: "inline",
        asyncMode: true,
        ruleName: "contest participant",
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
        #login_illust_detail .ex-artist-tag {
            display: inline-block;
            margin-left: 0.5em;
        }
    `);

    // http://nijie.info/view.php?id=208491
    findAndTranslate("artist", "#pro .user_icon .name, .popup_member > a, #login_illust_detail a", {
        ruleName: "artist",
    });

    // http://nijie.info/view.php?id=208491
    findAndTranslate("tag", ".tag .tag_name a:first-child", {
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "illust tags",
    });

    // https://nijie.info/dic/seiten/d/東方
    findAndTranslate("tag", "#seiten_dic h1#dic_title", {
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "tag page",
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
    findAndTranslate("tag", ".tag > span > a:nth-child(2)", {
        ruleName: "illust tags",
    });

    // Triggers on http://www.tinami.com/creator/profile/10262
    findAndTranslate("artist", "div.cre_name h1", {
        toProfileUrl: (el) => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "artist profile",
    });

    // Triggers on http://www.tinami.com/view/934323
    findAndTranslate("artist", "p:has(>a[href^='/creator/profile/'])", {
        toProfileUrl: linkInChildren,
        ruleName: "illust artist",
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
        ruleName: "tag search",
    });

    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate("tag", "a", {
        predicate: ".tag > a, a.tag",
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        ruleName: "illust tags",
    });

    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate("artist", ".user_info h1 a", {
        classes: "inline",
        ruleName: "illust artist",
    });

    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate("artist", "div.lg_txt_illust:has(strong)", {
        classes: "inline",
        tagPosition: TAG_POSITIONS.beforeend,
        toProfileUrl: (el) => $("a:has(.pankuzu_suffix)").prop("href"),
        ruleName: "illust artist anon",
    });

    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate("artist", ".user_link > a .user_name", {
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist profile",
    });
}

function initializeBCY () {
    // Prfile page https://bcy.net/u/3935930
    findAndTranslate("artist", "div.user-info-name", {
        toProfileUrl: (el) => $(el).closest(".user-info").find("a.avatar-user").prop("href"),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "artist profile",
    });

    // Illust pages https://bcy.net/item/detail/6561698116674781447
    findAndTranslate("artist", ".col-small .user-name a", {
        toProfileUrl: (el) => el.href.replace(/\?.*$/, ""),
        ruleName: "illust artist",
        onadded: ($tag, options) => $tag.parent().css("top", "15px"),
    });

    // Search pages https://bcy.net/tags/name/看板娘
    findAndTranslate("artist", "a.title-txt", {
        toProfileUrl: (el) => el.href.replace(/\?.*$/, ""),
        tagPosition: TAG_POSITIONS.afterend,
        classes: "inline title-txt",
        asyncMode: true,
        ruleName: "artist on search",
    });

    // Search pages https://bcy.net/tags/name/看板娘
    findAndTranslate("tag", ".circle-desc-name, .tag", {
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        ruleName: "tag search",
    });

    // Illust pages https://bcy.net/item/detail/6561698116674781447
    findAndTranslate("tag", ".dm-tag-a", {
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "illust tags",
    });
}

function initializeDeviantArt () {
    GM_addStyle(`
        .ex-artist-tag {
            font-weight: bold;
        }
        div.W9O1j + .ex-artist-tag {
            margin-left: -0.5em;
        }
        .ex-artist-tag + button {
            margin-left: 1em;
        }
        /* fix cropped long tags */
        a[href^='https://www.deviantart.com/tag/'] {
            max-width: initial;
        }
    `);

    // Profile page
    // https://www.deviantart.com/adsouto
    findAndTranslate("artist", "h1", {
        toProfileUrl: linkInChildren,
        predicate: "h1:has(>a.user-link)",
        asyncMode: true,
        ruleName: "artist profile",
    });

    // Post page
    // https://www.deviantart.com/koyorin/art/Ruby-570526828
    findAndTranslate("artist", "a.user-link", {
        predicate: "div[data-hook='deviation_meta'] a.user-link:not(:has(img))",
        requiredAttributes: "href",
        tagPosition: TAG_POSITIONS.afterParent,
        classes: "inline",
        asyncMode: true,
        onadded: deleteOnUrlChange,
        ruleName: "illust artist",
    });

    // Popup card
    findAndTranslate("artist", "a.user-link", {
        predicate: "body > div:not(#root) a.user-link:not(:has(img))",
        asyncMode: true,
        ruleName: "artist popup",
    });

    findAndTranslate("tag", "span", {
        predicate: "a[href^='https://www.deviantart.com/tag/'] > span:first-child",
        asyncMode: true,
        ruleName: "tags",
    });
}

function initializeHentaiFoundry () {
    // Posts on https://www.hentai-foundry.com/user/DrGraevling/profile
    findAndTranslate("artist", ".galleryViewTable .thumb_square > a:nth-child(4)", {
        classes: "inline",
        ruleName: "thumb artist",
    });

    // Profile tab https://www.hentai-foundry.com/user/DrGraevling/profile
    findAndTranslate("artist", ".breadcrumbs a:contains('Users') + span", {
        toProfileUrl: () => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "main profile tab",
    });

    // Orher tabs https://www.hentai-foundry.com/pictures/user/DrGraevling
    findAndTranslate("artist", ".breadcrumbs a[href^='/user/']", {
        classes: "inline",
        ruleName: "sub-profile tab",
    });
}

function initializeTwitter () {
    GM_addStyle(`
        .ex-artist-tag {
            font-family: system-ui, -apple-system, BlinkMacSystemFont,
                "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif;
        }
        /* Fix position of the artist tag in the channel header */
        h2 .r-1ny4l3l>.r-1ny4l3l {
            flex-direction: row;
        }
        /* In the non-expanded tweets add spacing before the artist tag */
        .r-18u37iz>.ex-artist-tag {
            margin-left: 0.5em;
        }
    `);

    // Tags https://twitter.com/mugosatomi/status/1173231575959363584
    findAndTranslate("tag", "a[role='link']", {
        predicate: "a[href^='/hashtag/']",
        asyncMode: true,
        toTagName: getNormalizedHashtagName,
        ruleName: "tags",
    });

    // Floating name of a channel https://twitter.com/mugosatomi
    const URLfromLocation = () => (
        `https://twitter.com${safeMatchMemoized(window.location.pathname, /\/\w+/)}`
    );
    const channelNameSelector = "div[data-testid='primaryColumn']>div>:first-child h2>div>div>div";
    // On switching to a channel from another channel, Twitter updates only text nodes
    // so, for correct work, it's required to watch for
    // the channel name regardless whether it was translated
    const watchForChanges = (elem) => {
        if (!elem.matches(channelNameSelector) || elem.matches(TAG_SELECTOR)) {
            return;
        }
        findAndTranslate("artist", elem, {
            toProfileUrl: URLfromLocation,
            classes: "inline",
            ruleName: "channel header 1",
        });
        new MutationSummary({
            rootNode: elem,
            queries: [{ characterData: true }],
            callback: () => {
                TAG_POSITIONS.afterend.findTag($(elem)).remove();
                findAndTranslate("artist", elem, {
                    toProfileUrl: URLfromLocation,
                    classes: "inline",
                    ruleName: "channel header 2",
                });
            },
        });
    };
    $(channelNameSelector).each((i, elem) => watchForChanges(elem));
    new MutationSummary({
        queries: [{ element: "div" }],
        callback: ([summary]) => summary.added.forEach((elem) => watchForChanges(elem)),
    });

    // Deleted channel https://twitter.com/6o2_iii
    findAndTranslate("artist", "span.r-qvutc0", {
        predicate: ".r-135wba7.r-3s2u2q span .r-qvutc0",
        toProfileUrl: URLfromLocation,
        classes: "inline",
        asyncMode: true,
        ruleName: "delete artist profile",
    });

    // Tweet, expanded tweet, comment authors, "in this photo", people in sidebar
    // https://twitter.com/mugosatomi/status/1173231575959363584
    // https://twitter.com/Merryweatherey/status/1029008151411023872/media_tags
    findAndTranslate("artist", "div.r-1wbh5a2.r-18u37iz", {
        predicate: `div:has(>div>a.r-1wbh5a2[tabindex])`,
        toProfileUrl: linkInChildren,
        asyncMode: true,
        ruleName: "tweet/comment author",
    });

    // Quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
    findAndTranslate("artist", "div.r-13hce6t", {
        predicate: "div.r-1867qdf div",
        toProfileUrl: (el) => `https://twitter.com/${el.textContent.slice(1)}`,
        classes: "inline",
        asyncMode: true,
        ruleName: "quoted tweet author",
    });

    // User card info
    findAndTranslate("artist", "a", {
        predicate: "div.r-nsbfu8 > div.r-14gqq1x > div > div > a",
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        ruleName: "artist popup",
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

    const getArtistName = (ref) => {
        if (!ref) return "";
        if (ref.startsWith("/")) {
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

    function toFullURL (url) {
        if (url && typeof url !== "string") {
            // eslint-disable-next-line no-param-reassign
            url = (url[0] || url).getAttribute("href");
        }

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
        ruleName: "arist profile",
    });

    // https://www.artstation.com/artwork/0X40zG
    findAndTranslate("artist", "a", {
        predicate: (el) => el.matches(".name > a[hover-card], .project-author-name > a") && hasValidHref(el),
        requiredAttributes: "href",
        toProfileUrl: (el) => el.href,
        asyncMode: true,
        ruleName: "illust artist",
    });

    findAndTranslate("tag", ".label-tag", {
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        ruleName: "tags",
    });

    // Hover card
    findAndTranslate("artist", "a", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".hover-card-name > a:first-child") && hasValidHref(el),
        asyncMode: true,
        ruleName: "artist popup",
    });

    // https://www.artstation.com/jubi/following
    // https://www.artstation.com/jubi/followers
    findAndTranslate("artist", ".users-grid-name", {
        toProfileUrl: (el) => toFullURL($(el).find("a")),
        asyncMode: true,
        ruleName: "artist followers",
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
        ruleName: "perosnal sites",
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
    $(".target:contains(', ')").replaceWith((i, html) => (
        html
            .split(", ")
            .map((str) => `<span class="target">${str}</span>`)
            .join(", ")
    ));

    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2F5e%2F8e%2F5e8e7a03c49906aaad157de8aeb188e4.jpg
    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2Fad%2F90%2Fad90ad1cc3407f03955f22b427d21707.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fmedibangpaint.com%2Fwp-content%2Fuploads%2F2015%2F05%2Fgallerylist-04.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fpastyle.net%2FPLFG-0001_MelangelicTone%2Fimage%2Fartwork_MelangelicTone.jpg
    findAndTranslate("artist", [
        "strong:contains('Member:')+a",
        "strong:contains('Author:')+a",
        "strong:contains('Twitter:')+a",
        "strong:contains('User ID:')+a",
    ].join(), {
        classes: "inline",
        ruleName: "artist by link",
        toProfileUrl: (el) => {
            const { href } = el;
            if (!href.startsWith("https://twitter.com/")) return href;
            return [
                `https://twitter.com/${el.textContent.slice(1)}`,
                `https://twitter.com/intent/user?user_id=${href.match(/\d+/)[0]}`,
            ];
        },
    });

    findAndTranslate("artistByName", ".resulttitle .target", {
        tagPosition: TAG_POSITIONS.beforebegin,
        classes: "inline",
        ruleName: "artist by name",
    });

    findAndTranslate("tag", ".resultcontentcolumn .target", {
        tagPosition: TAG_POSITIONS.beforebegin,
        ruleName: "tags",
    });
}

function initializePawoo () {
    GM_addStyle(`
        .ex-artist-tag {
            line-height: 100%;
        }
    `);

    // https://pawoo.net/@yamadorikodi
    // artist name in channel header
    findAndTranslate("artist", ".public-account-header__tabs__name small", {
        toProfileUrl: (el) => `https://pawoo.net/@${safeMatchMemoized(el.textContent.trim(), /[^@]+/)}`,
        tagPosition: TAG_POSITIONS.beforebegin,
        classes: "inline",
        ruleName: "artist profile",
    });

    // Post author, commentor
    // Pawoo can include reposted messages from other mastodon-based sites
    findAndTranslate("artist", "a[href^='https://pawoo.net/@'].status__display-name span span", {
        classes: "inline",
        ruleName: "post/comment author",
    });

    // Expanded post author
    // https://pawoo.net/@mayumani/102910946688187767
    findAndTranslate("artist", "a.detailed-status__display-name span strong", {
        classes: "inline",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "expanded post author",
    });

    // Cards of following users and followers
    findAndTranslate("artist", ".card__bar .display-name span:not([id])", {
        tagPosition: TAG_POSITIONS.beforebegin,
        ruleName: "artist followers",
    });

    // Tags https://pawoo.net/@SilSinn9801
    findAndTranslate("tag", ".hashtag", {
        ruleName: "tags",
    });
}

function initializeTweetDeck () {
    GM_addStyle(`
        .tweet .ex-artist-tag {
            flex-grow: 100;
        }
    `);
    // https://tweetdeck.twitter.com/

    findAndTranslate("tag", "span.link-complex-target", {
        predicate: "a[rel='hashtag'] span.link-complex-target",
        asyncMode: true,
        toTagName: getNormalizedHashtagName,
        ruleName: "tags",
    });

    // User card info
    findAndTranslate("artist", "p.username", {
        asyncMode: true,
        ruleName: "artist info",
    });

    // Tweet authors and comments
    findAndTranslate("artist", "a.account-link", {
        predicate: "a:has(.username)",
        asyncMode: true,
        classes: "inline",
        ruleName: "tweet/comment author",
    });
}

function initializePixivFanbox () {
    const getPixivLink = async (userNick) => {
        // Use direct query
        const resp = await (
            await fetch(`https://api.fanbox.cc/creator.get?creatorId=${userNick}`)
        ).json();
        return `https://www.pixiv.net/users/${resp.body.user.userId}`;
    };
    const getPixivLinkMemoized = _.memoize(getPixivLink);

    const addPixivTranslation = (options, el) => {
        const url = new URL(el.closest("a").href);
        const userNick = url.host === "www.fanbox.cc"
            ? url.pathname.match(/[\d\w_-]+/)[0]
            : url.host.match(/[\d\w_-]+/)[0];
        getPixivLinkMemoized(userNick)
            .then((pixivLink) => findAndTranslate("artist", el, {
                ...options,
                toProfileUrl: () => pixivLink,
            }));
        // Allow to translate artist by fanbox link
        return url.origin;
    };

    // https://agahari.fanbox.cc/
    // channel header
    findAndTranslate("artist", "a", {
        predicate: "h1 > a",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            classes: "inline",
            ruleName: "channel header pixiv",
        }),
        classes: "inline",
        ruleName: "channel header fanbox",
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
    if (SETTINGS.get("show_settings")) {
        GM_registerMenuCommand("Settings", showSettings, "S");
    }

    switch (window.location.host) {
        case "www.pixiv.net":          initializePixiv();         break;
        case "dic.pixiv.net":          initializePixiv();         break;
        case "nijie.info":             initializeNijie();         break;
        case "seiga.nicovideo.jp":     initializeNicoSeiga();     break;
        case "www.tinami.com":         initializeTinami();        break;
        case "bcy.net":                initializeBCY();           break;
        case "www.hentai-foundry.com": initializeHentaiFoundry(); break;
        case "twitter.com":            initializeTwitter();       break;
        case "mobile.twitter.com":     initializeTwitter();       break;
        case "tweetdeck.twitter.com":  initializeTweetDeck();     break;
        case "saucenao.com":           initializeSauceNAO();      break;
        case "pawoo.net":              initializePawoo();         break;
        case "www.deviantart.com":     initializeDeviantArt();    break;
        case "www.artstation.com":     initializeArtStation();    break;
        default:
            if (window.location.host.endsWith("artstation.com")) {
                initializeArtStation();
            } else if (window.location.host.endsWith("fanbox.cc")) {
                initializePixivFanbox();
            }
    }

    let theme;
    // Pixiv keeps theme in localStorage and applies it quiet lately
    if ("theme" in localStorage) {
        theme = localStorage.theme === "dark" ? "dark" : "light";
    } else {
        theme = chooseBackgroundColorScheme($(document.body)).theme;
    }
    $("html").addClass(`tpt-${theme}`);
    debuglog(`set ${theme} theme mode`);

    // Check for new network requests every half-second
    setInterval(intervalNetworkHandler, 500);
}

//------------------------
// Program execution start
//------------------------

initialize();
