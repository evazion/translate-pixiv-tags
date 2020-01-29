// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20200124105946
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
                "https://kagamihara.donmai.us": "Kagamihara",
                "https://saitou.donmai.us":     "Saitou",
                "https://shima.donmai.us":      "Shima",
                "https://safebooru.donmai.us": "Safebooru",
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
            name: "debug",
            defValue: false,
            descr: "Print debug messages in console",
            type: "boolean",
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
            case "boolean": return typeof value === "boolean";
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
// Whether to show deleted images in the preview or from the posts link
const SHOW_DELETED = SETTINGS.get("show_deleted");
// Whether to print an additional info into the console
const DEBUG = SETTINGS.get("debug");

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
];

// The maximum size of a URL before using a POST request.
// The actual limit is 8154, but setting it lower accounts for the rest of the URL as well.
// It's preferable to use a GET request when able since GET supports caching and POST does not.
const MAXIMUM_URI_LENGTH = 8000;

// For network rate and error management
const MAX_PENDING_NETWORK_REQUESTS = 40;
const MIN_PENDING_NETWORK_REQUESTS = 5;
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

const CACHE_PARAM = (CACHE_LIFETIME ? { expires_in: CACHE_LIFETIME } : {});
// Setting this to the maximum since batches could return more than the amount being queried
const LIMIT_PARAM = { limit: 1000 };


const QUEUED_NETWORK_REQUESTS = [];

const NETWORK_REQUEST_DICT = {
    wiki: {
        url: "/wiki_pages",
        data_key: "other_names",
        data_type: "array",
        fields: "title,category_name,other_names",
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
        fields: "id,name,is_banned,other_names,urls",
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
        fields: "name,category",
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
        fields: "antecedent_name,consequent_name",
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
        data_key: "normalized_url",
        data_type: "string",
        params (urlList) {
            return {
                search: {
                    normalized_url_lower_array: urlList,
                },
                // The only parameter does not work with artist urls... yet
            };
        },
        filter: (artistUrls) => artistUrls.filter((artistUrl) => artistUrl.artist.is_active),
    },
};

function debuglog (...args) {
    if (DEBUG) {
        console.log(...args);
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

const TRANSLATE_PROFILE_URL = [{
    regex: /https?:\/\/www\.pixiv\.net(?:\/en)?\/users\/(\d+)/,
    replace: "https://www.pixiv.net/member.php?id=%REPLACE%",
}, {
    regex: /https?:\/\/www\.deviantart\.com\/([\w-]+)/,
    replace: "https://%REPLACE%.deviantart.com",
}, {
    regex: /https?:\/\/www\.artstation\.com\/([\w-]+)/,
    replace: "https://%REPLACE%.artstation.com",
}, {
    regex: /https?:\/\/([\w-]+)\.artstation\.com/,
    replace: "https://www.artstation.com/%REPLACE%",
}];

function translateProfileURL (profileUrl) {
    let translateUrl = profileUrl;
    TRANSLATE_PROFILE_URL.some((value) => {
        const match = profileUrl.match(value.regex);
        if (match) {
            translateUrl = value.replace.replace("%REPLACE%", match[1]);
        }
        // Returning true breaks the some loop
        return translateUrl !== profileUrl;
    });
    return translateUrl;
}

function getImage (imageUrl) {
    return GM
        .xmlHttpRequest({
            method: "GET",
            url: imageUrl,
            responseType: "blob",
        })
        .then(({ response }) => response);
}

function rateLimitedLog (level, ...messageData) {
    // Assumes that only simple arguments will be passed in
    const key = messageData.join(",");
    const options = rateLimitedLog[key] || (rateLimitedLog[key] = { log: true });

    if (options.log) {
        console[level](...messageData);
        options.log = false;
        // Have only one message with the same parameters per second
        setTimeout(() => { options.log = true; }, 1000);
    }
}

function checkNetworkErrors (domain, hasError) {
    const data = checkNetworkErrors[domain] || (checkNetworkErrors[domain] = { error: 0 });

    if (hasError) {
        console.log("Total errors:", data.error);
        data.error += 1;
    }
    if (data.error >= MAX_NETWORK_ERRORS) {
        rateLimitedLog(
            "error",
            "Maximun number of errors exceeded",
            MAX_NETWORK_ERRORS,
            "for",
            domain,
        );
        return false;
    }
    return true;
}

async function getJSONRateLimited (url, params) {
    const sleepHalfSecond = (resolve) => setTimeout(resolve, 500);
    const domain = new URL(url).hostname;
    const queries = (
        getJSONRateLimited[domain]
        || (getJSONRateLimited[domain] = {
            pending: 0,
            currentMax: MAX_PENDING_NETWORK_REQUESTS,
        })
    );

    // Wait until the number of pending network requests is below the max threshold
    /* eslint-disable no-await-in-loop */
    while (queries.pending >= queries.currentMax) {
        // Bail if the maximum number of network errors has been exceeded
        if (!(checkNetworkErrors(domain, false))) {
            return [];
        }
        rateLimitedLog(
            "warn",
            "Exceeded maximum pending requests",
            queries.currentMax,
            "for",
            domain,
        );
        await new Promise(sleepHalfSecond);
    }

    for (let i = 0; i < MAX_NETWORK_RETRIES; i++) {
        queries.pending += 1;
        try {
            return await $
                .getJSON(url, params)
                .always(() => { queries.pending -= 1; });
        } catch (ex) {
            // Backing off maximum to adjust to current network conditions
            queries.currentMax = Math.max(queries.currentMax - 1, MIN_PENDING_NETWORK_REQUESTS);
            console.error(
                "Failed try #",
                i + 1,
                "\nURL:",
                url,
                "\nParameters:",
                params,
                "\nHTTP Error:",
                ex.status,
            );
            if (!checkNetworkErrors(domain, true)) {
                return [];
            }
            await new Promise(sleepHalfSecond);
        }
    }
    /* eslint-enable no-await-in-loop */
    return [];
}

const getJSONMemoized = _.memoize(getJSONRateLimited, memoizeKey);

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
            const params = Object.assign(typeParam, LIMIT_PARAM, CACHE_PARAM);
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
                "Failed try #",
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
    requests.forEach((request) => {
        let found = [];
        if (NETWORK_REQUEST_DICT[type].data_type === "string") {
            // Check for matching case-insensitive results
            found = finalResp.filter((data) => data[dataKey].toLowerCase() === request.item.toLowerCase());
        } else if (NETWORK_REQUEST_DICT[type].data_type === "array") {
            // Check for inclusion of case-insensitive results
            found = finalResp.filter((data) => {
                const compareArray = data[dataKey].map((item) => item.toLowerCase());
                return compareArray.includes(request.item.toLowerCase());
            });
        }
        // Fulfill the promise which returns the results to the function that queued it
        request.promise.resolve(found);
    });
}

// Converts URLs to the same format used by the normalized URL column on Danbooru
function normalizeProfileURL (profileUrl) {
    const url = profileUrl.replace(/^https/, "http").replace(/\/$/, "");
    return `${url}/`;
}

async function translateTag (target, tagName, options) {
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
        tags = wikiPages.map((wikiPage) => ({
            name: wikiPage.title,
            prettyName: wikiPage.title.replace(/_/g, " "),
            category: wikiPage.category_name,
        }));
    // `normalizedTag` consists of only ASCII characters except percent, asterics, and comma
    } else if (normalizedTag.match(/^[\u0020-\u0024\u0026-\u0029\u002B\u002D-\u007F]+$/)) {
        // The server is already converting the values to
        // lowercase on its end so no need to do it here
        tags = await queueNetworkRequestMemoized("tag", normalizedTag);
        if (tags.length === 0) {
            tags = await queueNetworkRequestMemoized("alias", normalizedTag);
            if (tags.length > 0) {
                tags = await queueNetworkRequestMemoized("tag", tags[0].consequent_name);
            }
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
    insertTag($target, $tagsContainer);

    if (onadded) onadded($tagsContainer, options);
}

async function translateArtistByURL (element, profileUrl, options) {
    if (!profileUrl) return;

    const promiseArray = [];
    promiseArray.push(queueNetworkRequestMemoized("url", normalizeProfileURL(profileUrl)));
    const translatedUrl = translateProfileURL(profileUrl);
    if (translatedUrl !== profileUrl) {
        promiseArray.push(queueNetworkRequestMemoized("url", normalizeProfileURL(translatedUrl)));
    }
    const data = await Promise.all(promiseArray);
    const artistUrls = [].concat([], ...data);
    const artists = artistUrls.map((artistUrl) => artistUrl.artist);

    if (artists.length === 0) {
        debuglog(`No artist at "${profileUrl}", rule "${options.ruleName}"`);
        return;
    }

    // New fix of #18 v2
    // Dabooru does unwanted reverse search
    // which returns trashy results
    // and there are exaclty 10 artists
    if (artists.length === 10) {
        debuglog(`The results for "${profileUrl}" were rejected, rule "${options.ruleName}"`);
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
    insertTag($target, $tag);
    $tag.find("a").qtip(qtipSettings);

    if (onadded) onadded($tag, options);
}

function attachShadow ($target, $content) {
    // Return if the target already have shadow
    if ($target.prop("shadowRoot")) return;

    if (_.isFunction(document.body.attachShadow)) {
        const shadowRoot = $target.get(0).attachShadow({ mode: "open" });
        $(shadowRoot).append($content);
    } else {
        $target.empty().append($content);
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
    const qtipClass = (medianLuminosity < MIDDLE_LUMINOSITY ? "qtip-dark" : "qtip-light");
    return {
        qtipClass,
        adjustedColor,
    };
}

async function buildArtistTooltip (artist, qtip) {
    const renderedQtips = buildArtistTooltip.cache || (buildArtistTooltip.cache = {});

    if (!(artist.name in renderedQtips)) {
        const waitPosts = get(
            "/posts",
            {
                tags: `${(SHOW_DELETED ? "status:any" : "-status:deleted")} ${artist.name}`,
                limit: ARTIST_POST_PREVIEW_LIMIT,
                only: POST_FIELDS,
            },
        );
        const waitTags = get(
            "/tags",
            {
                search: { name: artist.name },
                only: POST_COUNT_FIELDS,
            },
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
        const { qtipClass, adjustedColor } = chooseBackgroundColorScheme(qtip.elements.target);
        qtip.elements.tooltip.addClass(qtipClass);
        qtip.elements.tooltip.css("background-color", adjustedColor);
    }

    let $qtipContent = (await renderedQtips[artist.name]);
    // For correct work of CORS images must not be cloned at first displaying
    if ($qtipContent.parent().length > 0) $qtipContent = $qtipContent.clone(true, true);
    attachShadow(qtip.elements.content, $qtipContent);
    qtip.reposition(null, false);
}

function buildArtistTooltipContent (artist, [tag = { post_count: 0 }], posts = []) {
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
                    <a href="${BOORU}/posts?tags=${artist.encodedName}+${(SHOW_DELETED ? "status%3Aany" : "-status%3Adeleted")}" target="_blank">»</a>
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
    const getDomain = (url) => safeMatchMemoized(new URL(url.normalized_url).host, /[^.]*\.[^.]*$/);
    const artistUrls = _(artist.urls)
        .chain()
        .uniq("normalized_url")
        .sortBy("normalized_url")
        .sortBy(getDomain)
        .sortBy((artistUrl) => !artistUrl.is_active);

    return artistUrls
        .map((artistUrl) => {
            const normalizedUrl = artistUrl.normalized_url.replace(/\/$/, "");
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
            <p style="letter-spacing: -0.1px;">${domain}, rating:${post.rating.toUpperCase()}</p>
            <p>${timeToAgo(post.created_at)}</p>
        </article>
    `);

    if (post.preview_file_url && !post.preview_file_url.endsWith("/images/download-preview.png")) {
        if (CORS_IMAGE_DOMAINS.includes(window.location.host)) {
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
    } else {
        $preview.find("img").prop({
            width: 150, height: 150,
        });
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

    const { qtipClass } = chooseBackgroundColorScheme($("#ex-qtips"));
    $settings.addClass(qtipClass);

    attachShadow($shadowContainer, $settings);
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

function deleteOnChange (targetSelector) {
    return ($tag, options) => {
        const $container = options.tagPosition.getTagContainer($tag);
        const watcher = new MutationSummary({
            rootNode: $container.find(targetSelector)[0],
            queries: [{ characterData: true }],
            callback: ([summary]) => {
                options.tagPosition.findTag($container).remove();
                watcher.disconnect();
            },
        });
    };
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
         * On the artist profile page, render the danbooru artist tag
         * between the artist's name and follower count.
         */
        div._3_qyP5m {
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
        /* Illust page: fix artist tag overflowing in related works and on search page */
        section li>div>div:nth-child(3),
        aside li>div>div:nth-child(3) {
            flex-direction: column;
            align-items: flex-start;
        }
        section li .ex-artist-tag,
        aside li .ex-artist-tag {
            margin-left: 2px;
            margin-top: -6px;
        }
    `);

    // To remove smth like `50000users入り`, e.g. here https://www.pixiv.net/en/artworks/68318104
    const getNormalizedTagName = (el) => el.textContent.replace(/\d+users入り$/, "");

    findAndTranslate("tag", [
        // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=123456
        ".tag-cloud .tag",
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
        predicate: "figcaption li > span:first-child",
        toTagName: getNormalizedTagName,
        asyncMode: true,
        ruleName: "artwork tags",
    });

    // New search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    findAndTranslate("tag", "div", {
        predicate: "#root>div>div:first-child>div>div>div:has(span:last-child:not(.ex-translated-tags))",
        toTagName: getNormalizedTagName,
        asyncMode: true,
        ruleName: "search tag",
    });

    // Illust author https://www.pixiv.net/en/artworks/66475847
    findAndTranslate("artist", "a", {
        predicate: "main+aside>section>h2>div>div>a",
        requiredAttributes: "href",
        tagPosition: {
            insertTag: ($container, $elem) => $container.closest("h2").append($elem),
            findTag: ($container) => $container.closest("h2").find(TAG_SELECTOR),
            getTagContainer: ($elem) => $elem.prev().find("a:eq(1)"),
        },
        asyncMode: true,
        onadded: deleteOnChange("div"),
        ruleName: "illust artist",
    });

    // Related work's artists https://www.pixiv.net/en/artworks/66475847
    // New search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    // Bookmarks: https://www.pixiv.net/en/users/29310/bookmarks/artworks
    findAndTranslate("artist", "a", {
        predicate: "section ul>li>div>div:last-child>div:first-child>a",
        tagPosition: TAG_POSITIONS.afterParent,
        asyncMode: true,
        ruleName: "artist below illust thumb",
    });

    // Artist profile pages: https://www.pixiv.net/en/users/29310, https://www.pixiv.net/en/users/104471/illustrations
    const normalizePageUrl = () => `https://www.pixiv.net/en/users/${safeMatch(window.location.pathname, /\d+/)}`;
    findAndTranslate("artist", ".VyO6wL2", {
        toProfileUrl: normalizePageUrl,
        asyncMode: true,
        ruleName: "artist profile",
    });

    // Posts of followed artists: https://www.pixiv.net/bookmark_new_illust.php
    findAndTranslate("artist", ".ui-profile-popup", {
        predicate: "figcaption._3HwPt89 > ul > li > a.ui-profile-popup",
        asyncMode: true,
        ruleName: "followed artists",
    });

    // Ranking pages: https://www.pixiv.net/ranking.php?mode=original
    findAndTranslate("artist", "a.user-container.ui-profile-popup", {
        asyncMode: true,
        ruleName: "ranking artist",
    });

    // Index page popup card
    findAndTranslate("artist", "a.user-name", {
        classes: "inline",
        asyncMode: true,
        ruleName: "index page popup",
    });

    // Illust page popup card
    findAndTranslate("artist", "a", {
        predicate: "div[role='none'] div:not(.ex-artist-tag) > a:nth-child(2)",
        asyncMode: true,
        ruleName: "illust page popup",
    });

    // Index page https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("artist", "a.user", {
        predicate: [
            ".gtm-illust-recommend-zone a",
            ".following-new-illusts a",
            ".everyone-new-illusts a",
            ".booth-follow-items a",
        ].join(","),
        toProfileUrl: (el) => el.href.replace("/artworks", ""),
        ruleName: "index page artist",
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

    // http://nijie.info/view.php?id=208491
    findAndTranslate("artist", "#pro .user_icon .name, .popup_member > a", {
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
        predicate: ".tag > a",
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        ruleName: "illust tags",
    });

    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate("artist", ".user_info h1 a", {
        classes: "inline",
        ruleName: "illust artist",
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

    // Illust pages https://bcy.net/item/detail/6643704430988361988
    findAndTranslate("artist", ".js-userTpl .user-name a", {
        toProfileUrl: (el) => el.href.replace(/\?.*$/, ""),
        ruleName: "illust artist",
    });

    // Search pages https://bcy.net/tags/name/看板娘
    findAndTranslate("artist", "a.title-txt", {
        toProfileUrl: (el) => el.href.replace(/\?.*$/, ""),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
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
        .AEPha + .ex-artist-tag {
            margin-bottom: 0.3em;
            font-weight: bold;
        }
        .ex-artist-tag + div._2Xb_O {
            margin-top: 0;
        }
        .ex-artist-tag {
            font-weight: bold;
        }
    `);

    // Old design
    if ($("body > div#output").length > 0) {
        // https://www.deviantart.com/koyorin
        // https://www.deviantart.com/koyorin/art/Ruby-570526828
        findAndTranslate(
            "artist",
            ".gruserbadge .username, .dev-title-container .author .username",
            {
                classes: "inline",
                ruleName: "artist",
            },
        );

        findAndTranslate("tag", ".dev-about-tags-cc .discoverytag", {
            ruleName: "tags",
        });

        return;
    }

    // New design

    // Profile page
    // https://www.deviantart.com/adsouto
    findAndTranslate("artist", "div", {
        toProfileUrl: linkInChildren,
        predicate: "#content-container>div>div>div>div>div:has(>a.user-link)",
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
        onadded: deleteOnChange("span"),
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
    if ($("body > div#doc").length > 0) {
        findAndTranslate("tag", ".twitter-hashtag", {
            asyncMode: true,
            toTagName: getNormalizedHashtagName,
            ruleName: "tags",
        });

        // Header card
        findAndTranslate("artist", ".ProfileHeaderCard-screennameLink", {
            asyncMode: true,
            ruleName: "channel header",
        });

        // Popuping user card info
        findAndTranslate("artist", ".ProfileCard-screennameLink", {
            asyncMode: true,
            ruleName: "artist popup",
        });

        // Tweet authors and comments
        findAndTranslate("artist", "a.js-user-profile-link", {
            predicate: ":not(.js-retweet-text) > a",
            classes: "inline",
            asyncMode: true,
            ruleName: "tweet/comment author",
        });

        // Quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
        findAndTranslate("artist", ".username", {
            predicate: "div.js-user-profile-link .username",
            toProfileUrl: (el) => `https://twitter.com/${$(el).find("b").text()}`,
            asyncMode: true,
            classes: "inline",
            ruleName: "quoted tweet author",
        });

        return;
    }

    // New design
    // Tags https://twitter.com/mugosatomi/status/1173231575959363584
    findAndTranslate("tag", "a.r-1n1174f", {
        predicate: "a.r-1n1174f[href^='/hashtag/']",
        asyncMode: true,
        toTagName: getNormalizedHashtagName,
        ruleName: "tags",
    });

    // Floating name of a channel https://twitter.com/mugosatomi
    const URLfromLocation = () => (
        `https://twitter.com${safeMatch(window.location.pathname, /\/\w+/)}`
    );
    findAndTranslate("artist", "div[data-testid='primaryColumn']>div>:first-child h2>div>div>div", {
        toProfileUrl: URLfromLocation,
        classes: "inline",
        onadded: deleteOnChange("span>span"),
        ruleName: "channel header 1",
    });
    // Look for (re-)adding of the top bar
    new MutationSummary({
        queries: [{ element: "h2" }],
        callback: ([summary]) => {
            const $h2 = $(summary.added[0]);
            // If it is the top bar
            if (!$h2.is("div[data-testid='primaryColumn']>div>:first-child h2")) {
                return;
            }
            // If now it is channel name
            const $div = $h2.find(">div>div>div");
            if ($div.length > 0) {
                findAndTranslate("artist", $div, {
                    toProfileUrl: URLfromLocation,
                    classes: "inline",
                    onadded: deleteOnChange("span>span"),
                    ruleName: "channel header 2",
                });
            }
            // Look for text changes of the top bar
            new MutationSummary({
                rootNode: $h2[0],
                queries: [{ characterData: true }],
                callback: () => {
                    const $div2 = $h2.find(">div>div>div");
                    // Return if it already translated, to avoid self-triggering
                    if ($div2.next(TAG_SELECTOR).length > 0) {
                        return;
                    }
                    findAndTranslate("artist", $div2, {
                        toProfileUrl: URLfromLocation,
                        classes: "inline",
                        onadded: deleteOnChange("span>span"),
                        ruleName: "channel header 3",
                    });
                },
            });
        },
    });

    // Tweet, expanded tweet and comment authors
    // https://twitter.com/mugosatomi/status/1173231575959363584
    findAndTranslate("artist", "div.r-1wbh5a2.r-dnmrzs", {
        predicate: "div[data-testid='primaryColumn'] article div:has(>a.r-1wbh5a2)",
        toProfileUrl: linkInChildren,
        classes: "inline",
        asyncMode: true,
        ruleName: "tweet/comment author",
    });

    // Quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
    findAndTranslate("artist", "div.r-1wbh5a2.r-1udh08x", {
        predicate: "article div",
        toProfileUrl: (el) => `https://twitter.com/${
            $(el)
                .find(".r-1f6r7vd")
                .text()
                .slice(1)
        }`,
        classes: "inline",
        asyncMode: true,
        ruleName: "quoted tweet author",
    });

    // User card info
    findAndTranslate("artist", "a", {
        predicate: "div.r-1g94qm0 > a",
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
    findAndTranslate("artist", "a[hover-card]", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".name > a") && hasValidHref(el),
        toProfileUrl: toFullURL,
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
    findAndTranslate("artist", "strong:contains('Member: ')+a, strong:contains('Author: ')+a", {
        classes: "inline",
        ruleName: "artist by link",
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
    // artist name in channel header
    findAndTranslate("artist", ".name small", {
        toProfileUrl: (el) => `https://pawoo.net/@${safeMatch(el.textContent, /[^@]+/)}`,
        tagPosition: TAG_POSITIONS.afterbegin,
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

    // Users in sidebar
    findAndTranslate("artist", "a.account__display-name span span", {
        ruleName: "sidebar artist",
    });

    // Cards of following users and followers
    findAndTranslate("artist", ".account-grid-card .name a", {
        ruleName: "artist followers",
    });

    // Tags https://pawoo.net/@SilSinn9801
    findAndTranslate("tag", ".hashtag", {
        ruleName: "tags",
    });
}

function initializeTweetDeck () {
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
        ruleName: "tweet/comment author",
    });
}

function initializePixivFanbox () {
    // https://www.pixiv.net/fanbox/creator/310631
    // channel header
    findAndTranslate("artist", "a", {
        predicate: "h1 a[href^='/fanbox/creator/']",
        classes: "inline",
        asyncMode: true,
        ruleName: "channel header",
    });

    // Post author
    findAndTranslate("artist", "div.sc-7161tb-4", {
        toProfileUrl: (el) => ($(el).closest("a").prop("href") || "").replace(/\/post\/\d+/, ""),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        asyncMode: true,
        ruleName: "post author",
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

    switch (window.location.host) {
        case "www.pixiv.net":
            if (window.location.pathname.startsWith("/fanbox")) {
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
            if (window.location.host.match(/artstation\.com/)) {
                initializeArtStation();
            }
    }

    // Check for new network requests every half-second
    setInterval(intervalNetworkHandler, 500);
}

//------------------------
// Program execution start
//------------------------

initialize();
