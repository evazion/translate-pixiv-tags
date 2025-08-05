/* spell-checker: disable */
// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion, 7nik, BrokenEagle, hdk5
// @version      20250707163746
// @description  Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, and BCY to Danbooru tags.
// @homepageURL  https://github.com/evazion/translate-pixiv-tags
// @supportURL   https://github.com/evazion/translate-pixiv-tags/issues
// @updateURL    https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.user.js
// @downloadURL  https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.user.js
// @match        *://*.artstation.com/*
// @match        *://baraag.net/*
// @match        *://bsky.app/*
// @match        *://ci-en.net/*
// @match        *://ci-en.dlsite.com/*
// @match        *://*.deviantart.com/*
// @match        *://*.fanbox.cc/*
// @match        *://fantia.jp/*
// @match        *://*.hentai-foundry.com/*
// @match        *://misskey.art/*
// @match        *://misskey.design/*
// @match        *://misskey.io/*
// @match        *://nijie.info/*
// @match        *://pawoo.net/*
// @match        *://dic.pixiv.net/*
// @match        *://www.pixiv.net/*
// @match        *://saucenao.com/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://skeb.jp/*
// @match        *://www.tinami.com/*
// @match        *://twitter.com/*
// @match        *://mobile.twitter.com/*
// @match        *://tweetdeck.twitter.com/*
// @match        *://m.weibo.cn/*
// @match        *://www.weibo.com/*
// @match        *://x.com/*
// @match        *://www.xiaohongshu.com/*
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_addElement
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/psl/1.9.0/psl.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// @require      https://cdn.jsdelivr.net/npm/@floating-ui/core@1.0.3/dist/floating-ui.core.umd.min.js
// @require      https://cdn.jsdelivr.net/npm/@floating-ui/dom@1.0.8/dist/floating-ui.dom.umd.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore.js
// @require      https://github.com/evazion/translate-pixiv-tags/raw/lib-20221207/lib/tooltip.js
// @require      https://github.com/evazion/translate-pixiv-tags/raw/lib-20250707/lib/jquery-gm-shim.js
// @resource     danbooru_icon https://github.com/evazion/translate-pixiv-tags/raw/resource-20190903/resource/danbooru-icon.ico
// @resource     settings_icon https://github.com/evazion/translate-pixiv-tags/raw/resource-20190903/resource/settings-icon.svg
// @resource     globe_icon https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/svgs/solid/globe.svg
// @resource     sound_icon https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/svgs/solid/volume-high.svg
// @connect      donmai.us
// @connect      donmai.moe
// @connect      raw.githubusercontent.com
// @connect      icons.duckduckgo.com
// @noframes
// ==/UserScript==

/* spell-checker: enable */
// cSpell:ignoreRegExp [-\.#]\w+

/* globals MutationSummary _ GM_jQuery_setup tooltipGenerator psl */

// @ts-expect-error - it has no exports or import but types are get correctly
/** @typedef {import("./node_modules/mutation-summary/src/mutation-summary")} */

"use strict";

/**
 * @template {string} N, T
 * @typedef {{ name: string, defValue: T, descr: string, type: N }} SettingT
 */
/**
 * @typedef {SettingT<"number", number>
 * | SettingT<"boolean", boolean>
 * | SettingT<"list", string> & { values: Record<string, string> }
 * } Setting
*/
/**
 * @template {Setting} S
 * @typedef {S["type"] extends "boolean" ? boolean
 * : S["type"] extends "number" ? number
 * : S extends { values: Record<string, string> }
 * ? keyof S["values"] : never
 * } SettingType
 */

/** @satisfies {Setting[]} */
const SETTINGS_SCHEMA = /** @type {const} */([
    {
        name: "booru",
        defValue: "https://danbooru.donmai.us",
        descr: "Danbooru subdomain for sending requests",
        type: "list",
        values: {
            "https://danbooru.donmai.us":   "Danbooru",
            "https://safebooru.donmai.us":  "Safebooru",
            "https://betabooru.donmai.us":  "Betabooru",
            "https://donmai.moe":           "Donmai.moe",
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
            g: "General",
            s: "Sensitive",
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
    }, {
        name: "display_network_errors",
        defValue: true,
        descr: "Display a message when a request error occurs",
        type: "boolean",
    },
]);

/** @typedef {typeof SETTINGS_SCHEMA[number]["name"]} SettingsNames */
/**
 * @template {SettingsNames} N
 * @typedef {Extract<typeof SETTINGS_SCHEMA[number], { name: N }>} GetSetting
 */
/**
 * @template {SettingsNames} N
 * @typedef {SettingType<GetSetting<N>>} GetSettingType
 */

const SETTINGS = {
    /**
     * @param {string} settingName
     * @param {any} value
     */
    isValid (settingName, value) {
        const setting = SETTINGS_SCHEMA.find((s) => s.name === settingName);
        if (!setting) {
            console.error(`[TPT]: No setting ${settingName}`);
            return false;
        }
        switch (setting.type) {
            case "number": return Number.isInteger(value) && value > 0;
            case "list": return value in setting.values;
            case "boolean": return typeof value === "boolean";
            default:
                // @ts-expect-error - here `type` is `never`
                console.error(`[TPT]: Unsupported type ${setting.type}`);
                return false;
        }
    },
    /**
     * @template {SettingsNames} N
     * @param {N} settingName
     * @returns {GetSettingType<N>}
     */
    get (settingName) {
        const setting = SETTINGS_SCHEMA.find((s) => s.name === settingName);
        if (!setting) {
            console.error(`[TPT]: No setting ${settingName}`);
            return /** @type {never} */ (null);
        }
        const value = GM_getValue(settingName);
        if (value === undefined || !this.isValid(settingName, value)) {
            GM_setValue(settingName, setting.defValue);
            return /** @type {GetSettingType<N>} */(setting.defValue);
        }
        return value;
    },
    /**
     * @template {SettingsNames} N
     * @param {N} settingName
     * @param {GetSettingType<N>} value
     */
    set (settingName, value) {
        const setting = SETTINGS_SCHEMA.find((s) => s.name === settingName);
        if (!setting) {
            console.error(`[TPT]: No setting ${settingName}`);
            return null;
        }
        if (this.isValid(settingName, value)) {
            GM_setValue(settingName, value);
            return true;
        }
        console.warn(`[TPT]: Invalid value ${String(value)} for ${settingName}`);
        return false;
    },
};

/** @typedef {"g"|"s"|"q"|"e"} Rating */

/** Which domain to send requests to */
const BOORU = SETTINGS.get("booru");
/** How long (in seconds) to cache translated tag lookups */
const CACHE_LIFETIME = `${SETTINGS.get("cache_lifetime")}s`;
/** Number of recent posts to show in artist tooltips */
const ARTIST_POST_PREVIEW_LIMIT = SETTINGS.get("preview_limit");
/** The upper level of rating to show preview. Higher ratings will be blurred */
const SHOW_PREVIEW_RATING = SETTINGS.get("show_preview_rating");
/** Whether to show deleted images in the preview or from the posts link */
const SHOW_DELETED = SETTINGS.get("show_deleted");
/** Whether to print an additional info into the console */
const DEBUG = SETTINGS.get("debug");
/** Show an error message when a request error happens */
const DISPLAY_NETWORK_ERRORS = SETTINGS.get("display_network_errors");

// Domains where images outside of whitelist are blocked
const DOMAIN_USES_CSP = [
    "twitter.com",
    "bcy.net",
    "pawoo.net",
    "x.com",
    "baraag.net",
].includes(window.location.host);

// The maximum size of a URL before using a POST request.
// The actual limit is 8154, but setting it lower accounts for the rest of the URL as well.
// Seems like Danbooru's limit is 6577 of unencoded data, so, with space for encoding, let it be 4k.
// It's preferable to use a GET request when able since GET supports caching and POST does not.
const MAXIMUM_URI_LENGTH = 4000;

// For network error management
const MAX_NETWORK_ERRORS = 12;
const MAX_NETWORK_RETRIES = 3;
const REQUEST_INTERVAL = 500; // in ms
const RETRY_REQUEST_INTERVAL = 30_000; // in ms

const TAG_SELECTOR = ".ex-translated-tags, .ex-artist-tag";

/**
 * @typedef {object} TagPosition
 * @prop {($container: JQuery, $elem: JQuery) => void} insertTag Adds the tag  around the container
 * @prop {($container: JQuery) => JQuery} findTag Finds a tag around the container
 * @prop {($elem: JQuery) => JQuery} getTagContainer Get the tag's container
 */

/** @satisfies {Record<string, TagPosition>} */
const TAG_POSITIONS = {
    beforebegin: {
        insertTag: ($container, $elem) => $container.before($elem),
        findTag: ($container) => $container.prevAll(TAG_SELECTOR),
        getTagContainer: ($elem) => $elem.next(),
    },
    afterbegin: {
        insertTag: ($container, $elem) => $container.prepend($elem),
        findTag: ($container) => $container.find(TAG_SELECTOR),
        getTagContainer: ($elem) => $elem.parent(),
    },
    beforeend: {
        insertTag: ($container, $elem) => $container.append($elem),
        findTag: ($container) => $container.find(TAG_SELECTOR),
        getTagContainer: ($elem) => $elem.parent(),
    },
    afterend: {
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

const PROGRAM_CSS = /* CSS */`
:root, .tpt-light, .tpt-auto {
    --tpt-artist: #c00004;
    --tpt-cat-0: #0075f8;
    --tpt-cat-1: #c00004;
    --tpt-cat-3: #a800aa;
    --tpt-cat-4: #00ab2c;
    --tpt-cat-5: #fd9200;
}
.tpt-dark {
    --tpt-artist: #ff8a8b;
    --tpt-cat-0: #009be6;
    --tpt-cat-1: #ff8a8b;
    --tpt-cat-3: #c797ff;
    --tpt-cat-4: #35c64a;
    --tpt-cat-5: #ead084;
}
@media (prefers-color-scheme: dark) {
    .tpt-auto {
        --tpt-artist: #ff8a8b;
        --tpt-cat-0: #009be6;
        --tpt-cat-1: #ff8a8b;
        --tpt-cat-3: #c797ff;
        --tpt-cat-4: #35c64a;
        --tpt-cat-5: #ead084;
    }
}

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
.ex-translated-tags.no-brackets::before,
.ex-translated-tags.no-brackets::after {
    content: none;
}
/* dirt hack for DevianArt: add :not(#id) to rapidly increase rule specificity */
.ex-translated-tag-category-5:not(#id) {
    color: var(--tpt-cat-5) !important;
}
.ex-translated-tag-category-4:not(#id) {
    color: var(--tpt-cat-4) !important;
}
.ex-translated-tag-category-3:not(#id) {
    color: var(--tpt-cat-3) !important;
}
.ex-translated-tag-category-1:not(#id) {
    color: var(--tpt-cat-1) !important;
}
.ex-translated-tag-category-0:not(#id) {
    color: var(--tpt-cat-0) !important;
}

.ex-artist-tag {
    white-space: nowrap;
}
.ex-artist-tag.inline {
    display: inline-block;
    margin-left: 0.5em;
}
.ex-artist-tag a:not(#id) {
    color: var(--tpt-artist) !important;
    margin-left: 0.3ch;
    text-decoration: none;
}
.ex-artist-tag::before {
    content: "";
    display: inline-block;
    background-image: url(${getResourceUrl("danbooru_icon", true)});
    background-repeat: no-repeat;
    background-size: 0.8em;
    width: 0.8em;
    height: 0.8em;
    vertical-align: middle;
}
.ex-banned-artist-tag a::after {
    content: " (banned)";
}

#ex-settings, #ex-message {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 3000001;
}
`;

const TOOLTIP_CSS = /* CSS */`
.loading-data, .loading-data a {
    cursor: wait;
}
#ex-tips {
    pointer-events: none;
}
#ex-tips > * {
    pointer-events: all;
    z-index: 3000000;
}

.ex-tip {
    position: absolute;
    --bc: #E2E2E2;
    background: var(--bg, white);
    padding: 5px 9px;
    max-width: 622px;
    font-size: 10.5px;
    line-height: 12px;
    box-sizing: initial;
    border: 1px solid var(--bc);
    text-align: left;
    color: #454545;
}
.ex-tip.tip-dark {
    --bc: #303030;
    color: #f3f3f3;
}
.ex-tip .arrow {
    position: absolute;
    bottom: -8px;
    border-left: 3px solid transparent;
    border-right: 3px solid transparent;
    border-top: 8px solid var(--bg);
    filter: drop-shadow(1px 1px var(--bc)) drop-shadow(-1px 1px var(--bc));
}
.ex-tip[data-placement=bottom] .arrow {
    bottom: auto;
    top: -8px;
    border-top: none;
    border-bottom: 8px solid var(--bg);
    filter: drop-shadow(1px -1px var(--bc)) drop-shadow(-1px -1px var(--bc));
}
`;

/** @typedef {{tooltip: HTMLElement, content: HTMLElement, target: HTMLElement}} TooltipInstance */
/**
 * @callback TooltipConstructor
 * @param {HTMLElement} target Element triggering the tooltip
 * @param {(tip: TooltipInstance) => void} contentProvider Tooltip content setter
 * @returns {void}
 */

/** @type {TooltipConstructor} */
const addTooltip = tooltipGenerator({
    showDelay: 500,
    hideDelay: 250,
    interactive: true,
    className: "ex-tip",
    containerName: "ex-tips",
});

/** @type {{expires_in:number} | {}} */
const CACHE_PARAM = (CACHE_LIFETIME ? { expires_in: CACHE_LIFETIME } : {});
// Setting this to the maximum since batches could return more than the amount being queried
const API_LIMIT = 1000;

/**
 * @template {object|object[]} T
 * @typedef {T extends object[] ? T[number] : T} Single
 */

/** @typedef {"wiki"|"artist"|"tag"|"alias"|"url"|"post"|"count"} RequestName */
/**
 * @template {object} Resp
 * @typedef {object} RequestDefinition
 * @prop {string} url Api endpoint
 * @prop {string} fields Fields to request
 * @prop {(requests: string[]) => UrlParams} params Convert data requests to endpoint request params
 * @prop {(response: Single<Resp>, request: string) => boolean} matches
 *  Check whether the response is for the passed request
 * @prop {(responses: Resp) => Resp} [filter] Filters the responded items
 * @prop {number} [limit] Limit number of items in the response
 */
/**
 * @typedef {object} ResponseWiki
 * @prop {string} title
 * @prop {string[]} other_names
 * @prop {{ category: number }} tag
 */
/**
 * @typedef {object} ResponseArtist
 * @prop {number} id
 * @prop {string} name
 * @prop {boolean} is_banned
 * @prop {string[]} other_names
 * @prop {Array<{ url: string, is_active: boolean }>} urls
 */
/**
 * @typedef {object} ResponseTag
 * @prop {string} name
 * @prop {number} post_count
 * @prop {number} category
 */
/**
 * @typedef {object} ResponseTagAlias
 * @prop {string} antecedent_name
 * @prop {{ name: string, category: number, post_count: number }} consequent_tag
 */
/** @typedef {ResponseArtist & { is_deleted: boolean }} ResponseUrl */
/**
 * @typedef {object} MediaAssetVariant
 * @prop {string} type
 * @prop {string} url
 * @prop {number} width
 * @prop {number} height
 * @prop {string} file_ext
 */
/**
 * @typedef {object} MediaAsset
 * @prop {number} id
 * @prop {string} file_ext
 * @prop {number} file_size
 * @prop {number|null} duration
 * @prop {number} image_width
 * @prop {number} image_height
 * @prop {MediaAssetVariant[]} variants
 */
/**
 * @typedef {object} ResponsePosts
 * @prop {number} id
 * @prop {string} created_at
 * @prop {string} source
 * @prop {Rating} rating
 * @prop {number|null} parent_id
 * @prop {boolean} is_pending
 * @prop {boolean} is_flagged
 * @prop {boolean} is_deleted
 * @prop {boolean} is_banned
 * @prop {boolean} has_visible_children
 * @prop {string} tag_string_general
 * @prop {string} tag_string_character
 * @prop {string} tag_string_copyright
 * @prop {string} tag_string_artist
 * @prop {string} tag_string_meta
 * @prop {MediaAsset} media_asset
 */
/** @typedef {{ counts: { posts: number} }} ResponseCount */
/**
 * @template {RequestName} N
 * @typedef {N extends "wiki" ? ResponseWiki :
 * N extends "artist" ? ResponseArtist :
 * N extends "tag" ? ResponseTag :
 * N extends "alias" ? ResponseTagAlias :
 * N extends "url" ? ResponseUrl :
 * N extends "post" ? ResponsePosts :
 * N extends "count" ? ResponseCount :
 * never} ResponseEntity
 */
/**
 * @template {RequestName} N
 * @typedef {N extends "count" ? ResponseCount : ResponseEntity<N>[]} DBResponse
*/
/**
 * @template {RequestName} N
 * @typedef {object} RequestPromise
 * @prop {N} type
 * @prop {string} item
 * @prop {JQuery.Deferred<DBResponse<N>, any, any>} promise
 */

/**
 * @type {RequestPromise<RequestName>[]}
 */
const QUEUED_NETWORK_REQUESTS = [];

const REQUEST_DATA_MATCHERS = {
    /**
     * Case-insensitive comparing strings
     * @param {string} data
     * @param {string} item
     */
    string: (data, item) => data.toLowerCase() === item.toLowerCase(),
    /**
     * Case-insensitive looking in array of strings
     * @param {string[]} data
     * @param {string} item
     */
    array: (data, item) => data
        .map((it) => it.toLowerCase())
        .includes(item.toLowerCase()),
    /**
     * Case-insensitive looking in string-array
     * @param {string} data
     * @param {string} item
     */
    string_list: (data, item) => data
        .toLowerCase()
        .split(" ")
        .includes(item.toLowerCase()),
};

/** @type {{ [N in RequestName]: RequestDefinition<DBResponse<N>> }} */
const NETWORK_REQUEST_DICT = {
    wiki: {
        url: "/wiki_pages",
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
        matches (data, item) {
            return REQUEST_DATA_MATCHERS.array(data.other_names, item);
        },
    },
    artist: {
        url: "/artists",
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
        matches (data, item) {
            return REQUEST_DATA_MATCHERS.string(data.name, item);
        },
    },
    tag: {
        url: "/tags",
        fields: "name,category,post_count",
        params (nameList) {
            return {
                search: {
                    name_lower_comma: nameList.join(","),
                },
                only: this.fields,
            };
        },
        filter: (items) => items.filter((item) => item.post_count > 0),
        matches (data, item) {
            return REQUEST_DATA_MATCHERS.string(data.name, item);
        },
    },
    alias: {
        url: "/tag_aliases",
        fields: "antecedent_name,consequent_tag[name,category,post_count]",
        params (nameList) {
            return {
                search: {
                    antecedent_name_lower_comma: nameList.join(","),
                },
                only: this.fields,
            };
        },
        matches (data, item) {
            return REQUEST_DATA_MATCHERS.string(data.antecedent_name, item);
        },
    },
    url: {
        url: "/artists",
        fields: "id,name,is_deleted,is_banned,other_names,urls[url,is_active]",
        params (urlList) {
            return {
                search: {
                    url_matches: urlList,
                },
                only: this.fields,
            };
        },
        filter: (artists) => artists.filter((artist) => !artist.is_deleted),
        matches (data, item) {
            return REQUEST_DATA_MATCHERS.array(data.urls.map((url) => url.url), item);
        },
    },
    // This can only be used as a single use and not as part a group
    post: {
        url: "/posts",
        fields: [
            "created_at",
            "has_visible_children",
            "id",
            "is_flagged",
            "is_pending",
            "is_deleted",
            "is_banned",
            "parent_id",
            "media_asset[id,file_ext,file_size,image_width,image_height,duration,variants]",
            "rating",
            "source",
            "tag_string_general",
            "tag_string_character",
            "tag_string_copyright",
            "tag_string_artist",
            "tag_string_meta",
        ].join(","),
        params (tagList) {
            const [tag, page] = tagList[0].split(" ");
            return {
                // As this is called immediately and as a single use, only pass the first tag
                tags: `${SHOW_DELETED ? "status:any" : "-status:deleted"} ${tag}`,
                page,
                only: this.fields,
            };
        },
        matches (data, item) {
            return REQUEST_DATA_MATCHERS.string_list(data.tag_string_artist, item.split(" ")[0]);
        },
        limit: ARTIST_POST_PREVIEW_LIMIT,
    },
    count: {
        url: "/counts/posts",
        fields: "",
        params: (tags) => ({ tags: tags.join(" ") }),
        matches: () => true,
    },
};

const debuglog = DEBUG ? console.log.bind(console, "[TPT]:") : () => {};

/** @param {object[]} args */
function memoizeKey (...args) {
    const paramHash = Object.fromEntries(args.entries());
    return $.param(paramHash);
}

/**
 * Tag function for template literals to remove newlines and leading spaces
 * @param {TemplateStringsArray} strings
 * @param {(string|number)[]} values
 */
function noIndents (strings, ...values) {
    // Remove all spaces before/after a tag and leave one in other cases
    const compactStrings = strings.map((str) => (
        str.replaceAll(
            /(>)?\n *(<)?/g,
            (s, lt, gt) => (lt && gt ? lt + gt : ((lt || gt) ?? " ")),
        )
    ));

    const res = Array.from({ length: values.length * 2 + 1 });
    // eslint-disable-next-line unicorn/no-for-loop
    for (let i = 0; i < values.length; i++) {
        res[i * 2] = compactStrings[i];
        res[i * 2 + 1] = values[i];
    }
    res[res.length - 1] = compactStrings.at(-1);

    return res.join("");
}

/** @type {(string: string, regex: RegExp) => RegExpMatchArray|null} */
const matchMemoized = _.memoize((string, regex) => string.match(regex), memoizeKey);

/**
 * For safe ways to use regexp in a single line of code
 * @param {string} string
 * @param {RegExp} regex
 * @param {number} [group=0]
 * @param {string} [defaultValue=""]
 */
function safeMatchMemoized (string, regex, group = 0, defaultValue = "") {
    const match = matchMemoized(string ?? "", regex);
    if (match) {
        return match[group];
    }
    return defaultValue;
}

/** @param {string} string */
function capitalize (string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

/**
 * @param {string} s1
 * @param {string} s2
 */
function naturalCompare (s1, s2) {
    const parts1 = s1.split(/(\d+)/);
    const parts2 = s2.split(/(\d+)/);

    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
        const elem1 = Number.parseInt(parts1[i], 10) || parts1[i];
        const elem2 = Number.parseInt(parts2[i], 10) || parts2[i];

        // eslint-disable-next-line no-continue
        if (elem1 === elem2) continue;

        if (typeof elem1 === "number" && typeof elem2 === "number") {
            return elem1 - elem2;
        }

        return elem1.toString().localeCompare(elem2.toString());
    }

    return parts1.length - parts2.length;
}

// https://github.com/danbooru/danbooru/blob/69dc86865679f8affc31547b57c3af6c5406a827/app/models/artist_url.rb#L97
/* spell-checker: disable */
const SITE_ORDER = [
    "Pixiv",
    "Twitter",
    "Anifty",
    "ArtStation",
    "Baraag",
    "Bilibili",
    "BCY",
    "Booth",
    "Deviant Art",
    "Fantia",
    "Foundation",
    "Furaffinity",
    "Hentai Foundry",
    "Lofter",
    "Newgrounds",
    "Nico Seiga",
    "Nijie",
    "Pawoo",
    "Fanbox",
    "Pixiv Sketch",
    "Plurk",
    "Reddit",
    "Arca.live",
    "DC Inside",
    "Skeb",
    "Tinami",
    "Tumblr",
    "Weibo",
    "Misskey.io",
    "Misskey.art",
    "Misskey.design",
    "Xfolio",
    "Ask.fm",
    "Facebook",
    "FC2",
    "Gumroad",
    "Instagram",
    "Ko-fi",
    "Livedoor",
    "Mihuashi",
    "Mixi.jp",
    "Patreon",
    "Piapro.jp",
    "Picarto",
    "Privatter",
    "Sakura.ne.jp",
    "Stickam",
    "Twitch",
    "Youtube",
    "Amazon",
    "Circle.ms",
    "DLSite",
    "Doujinshi.org",
    "Erogamescape",
    "Mangaupdates",
    "Melonbooks",
    "Toranoana",
    "Wikipedia",
];

const SITE_RULES = [
    // https://github.com/danbooru/danbooru/blob/d72eeb8b5054c6646f25663c7b1fc3991d4f6111/app/logical/source/url.rb#L32

    // Fanbox, Pixiv Sketch, Booth must be before Pixiv
    { name: "Fanbox", domain: "fanbox.cc" },
    { name: "Fanbox", domain: "pixiv.net", pathname: "/fanbox/" },
    { name: "Pixiv Sketch", hostname: "sketch.pixiv.net" },
    { name: "Booth", domain: "booth.pm" },
    { name: "Pixiv", domain: "pixiv.net" },
    { name: "Pixiv", domain: "pixiv.me" },
    { name: "Pixiv", domain: "pixiv.cc" },

    // TwitPic must be before twitter
    { name: "TwitPic", hostname: "twitpic.com" },
    { name: "Twitter", domain: "twitter.com" },
    { name: "Twitter", domain: "t.co" },

    { name: "About Me", domain: "about.me" },
    { name: "Arca.live", domain: "arca.live" },
    { name: "ArtStation", domain: "artstation.com" },
    { name: "ArtStreet", domain: "medibang.com" },
    { name: "BCY", domain: "bcy.net" },
    { name: "Blogger", tld: "blogspot.com" },
    { name: "Blogger", tld: "blogspot.ca" },
    { name: "Blogger", tld: "blogspot.de" },
    { name: "Blogger", tld: "blogspot.jp" },
    { name: "Blogger", tld: "blogspot.kr" },
    { name: "Blogger", tld: "blogspot.tw" },
    { name: "Bluesky", domain: "bsky.app" },
    { name: "Carrd", tld: "carrd.co" },
    { name: "Carrd", tld: "crd.co" },
    { name: "Ci-En", domain: "ci-en.net" },
    { name: "Danbooru", domain: "donmai.us" },
    { name: "Deviant Art", domain: "deviantart.com" },
    { name: "Deviant Art", domain: "fav.me" },
    { name: "Deviant Art", domain: "sta.sh" },
    { name: "Discord", domain: "discordapp.com" },
    { name: "e621", domain: "e621.net" },
    { name: "Fandom", domain: "wikia.com" },
    { name: "FC2", domain: "fc2blog.net" },
    { name: "FC2", domain: "fc2blog.us" },
    { name: "Galleria", domain: "emotionflow.com" },
    { name: "Rule34.xxx", domain: "rule34.xxx" },
    { name: "Gumroad", domain: "gum.co" },
    { name: "Hentai Foundry", domain: "hentai-foundry.com" },
    { name: "Ko-fi", domain: "ko-fi.com" },
    { name: "Lofter", domain: "127.net" },
    { name: "Misskey.io", domain: "misskey.io" },
    { name: "Misskey.art", domain: "misskey.art" },
    { name: "Misskey.design", domain: "misskey.design" },
    { name: "Miyoushe", domain: "mihoyo.com" },
    { name: "Yande.re", domain: "yande.re" },
    { name: "Adobe Portfolio", domain: "myportfolio.com" },
    { name: "Naver Blog", hostname: "blog.naver.com" },
    { name: "Naver Post", hostname: "cafe.naver.com" },
    { name: "Naver Cafe", hostname: "post.naver.com" },
    { name: "Nico Seiga", domain: "nicovideo.jp" },
    { name: "Nico Seiga", domain: "nico.ms" },
    { name: "OpenSea", domain: "opensea.io" },
    { name: "Piapro.jp", domain: "piapro.jp" },
    { name: "Reddit", domain: "redd.it" },
    { name: "Toyhouse", domain: "toyhou.se" },
    { name: "Weibo", domain: "sinaimg.cn" },

    // https://github.com/danbooru/danbooru/blob/a9593dda98db89576278defc06eb20650faa784d/app/logical/source/url/null.rb#L10
    { name: "7-Eleven MyShip", hostname: "myship.7-11.com.tw" },
    { name: "AllMyLinks", domain: "allmylinks.com" },
    { name: "Anime News Network", domain: "animenewsnetwork.com" },
    { name: "Amino", domain: "aminoapps.com" },
    { name: "AniList", domain: "anilist.co" },
    { name: "Apple Music", hostname: "music.apple.com" },
    { name: "Archive of Our Own", domain: "archiveofourown.org" },
    { name: "Art Fight", domain: "artfight.net" },
    { name: "Artists&Clients", domain: "artistsnclients.com" },
    { name: "Ask.fm", domain: "ask.fm" },
    { name: "Bahamut", domain: "gamer.com.tw" },
    { name: "BASE", domain: "theshop.jp" },
    { name: "Big Cartel", domain: "bigcartel.com" },
    { name: "Buy Me a Coffee", domain: "buymeacoffee.com" },
    { name: "Cash App", domain: "cash.app" },
    { name: "Circle.ms", domain: "circle.ms" },
    { name: "Clibo", domain: "cli-bo.com" },
    { name: "Colors Live", domain: "colorslive.com" },
    { name: "Comic Vine", hostname: "comicvine.gamespot.com" },
    { name: "Curious Cat", domain: "curiouscat.live" },
    { name: "Curious Cat", domain: "curiouscat.me" },
    { name: "Curious Cat", domain: "curiouscat.qa" },
    { name: "DLSite", domain: "dlsite.com" },
    { name: "DLSite", domain: "dlsite.net" },
    { name: "DLSite", domain: "dlsite.jp" },
    { name: "DC Inside", domain: "dcinside.com" },
    { name: "Direct.me", domain: "direct.me" },
    { name: "Doujinshi.org", domain: "doujinshi.org" },
    { name: "Doujinshi.org", hostname: "doujinshi.mugimugi.org" },
    { name: "E-Hentai", domain: "e-hentai.org" },
    { name: "E-Hentai", domain: "exhentai.org" },
    { name: "Eth.co", domain: "eth.co" },
    { name: "Excite Blog", domain: "exblog.jp" },
    { name: "Facebook", domain: "fbcdn.net" },
    { name: "FanFiction.Net", domain: "fanfiction.net" },
    { name: "Final Fantasy XIV", domain: "finalfantasyxiv.com" },
    { name: "GameFAQs", hostname: "gamefaqs.gamespot.com" },
    { name: "Gank", domain: "ganknow.com" },
    { name: "GitHub", domain: "github.com" },
    { name: "Gunsta", domain: "gumpla.jp" },
    { name: "Hatena Blog", domain: "hatenablog.com" },
    { name: "Hatena Blog", domain: "hatenablog.jp" },
    { name: "Hatena Blog", domain: "hateblo.jp" },
    { name: "Hatena Blog", domain: "st-hatena.com" },
    { name: "HoYoLAB", domain: "hoyolab.com" },
    { name: "html.co.jp", domain: "html.co.jp" },
    { name: "Image Comics", domain: "imagecomics.com" },
    { name: "Instabio", domain: "linkbio.co" },
    { name: "Itch.io", domain: "itch.io" },
    { name: "League of Comic Geeks", domain: "leagueofcomicgeeks.com" },
    { name: "LinkedIn", domain: "linkedin.com" },
    { name: "Linktree", domain: "linktr.ee" },
    { name: "Livedoor", hostname: "livedoor.blogimg.jp" },
    { name: "Livedoor", domain: "blog.jp" },
    { name: "Livedoor", domain: "diary.to" },
    { name: "Livedoor", domain: "doorblog.jp" },
    { name: "Livedoor", domain: "dreamlog.jp" },
    { name: "Livedoor", domain: "gger.jp" },
    { name: "Livedoor", domain: "ldblog.jp" },
    { name: "Livedoor", domain: "officialblog.jp" },
    { name: "Livedoor", domain: "publog.jp" },
    { name: "Livedoor", domain: "weblog.to" },
    { name: "Livedoor", domain: "xxxblog.jp" },
    { name: "Lit.link", domain: "lit.link" },
    { name: "Kirby's Comic Art", domain: "kirbyscomicart.com" },
    { name: "Kiru Made", domain: "kirumade.com" },
    { name: "Kemono Party", domain: "kemono.party" },
    { name: "Last.fm", domain: "last.fm" },
    { name: "Manga Library Z", domain: "mangaz.com" },
    { name: "Mangano", domain: "manga-no.com" },
    { name: "MarppleShop", domain: "marpple.shop" },
    { name: "Mastodon", domain: "mstdn.jp" },
    { name: "Milkshake", domain: "msha.ke" },
    { name: "MyAnimeList", domain: "myanimelist.net" },
    { name: "MyFigureCollection", domain: "myfigurecollection.net" },
    { name: "Mixi.jp", domain: "mixi.jp" },
    { name: "OCN", domain: "ocn.ne.jp" },
    { name: "OnlyFans", domain: "onlyfans.com" },
    { name: "Ou Xiang Xie Zhen", domain: "ouxiangxiezhen.com" },
    { name: "PayPal", domain: "paypal.com" },
    { name: "PayPal", domain: "paypal.me" },
    { name: "Pixel Joint", domain: "pixeljoint.com" },
    { name: "Planet Minecraft", domain: "planetminecraft.com" },
    { name: "Pronouns.page", domain: "pronouns.page" },
    { name: "Pronouny.xyz", domain: "pronouny.xyz" },
    { name: "Joyreactor", domain: "reactor.cc" },
    { name: "Jump Rookie!", hostname: "rookie.shonenjump.com" },
    { name: "RedGIFs", domain: "redgifs.com" },
    { name: "Sakura.ne.jp", domain: "sakura.ne.jp" },
    { name: "Sankaku Complex", domain: "sankakucomplex.com" },
    { name: "Scratch", hostname: "scratch.mit.edu" },
    { name: "Secret Drawing Box", hostname: "drawme.share-on.me" },
    { name: "Sheezy.art", domain: "sheezy.art" },
    { name: "Solo.to", domain: "solo.to" },
    { name: "SoundCloud", domain: "soundcloud.com" },
    { name: "Square", domain: "squareup.com" },
    { name: "Steam", domain: "steamcommunity.com" },
    { name: "SubscribeStar", domain: "subscribestar.adult" },
    { name: "SubscribeStar", domain: "subscribestar.com" },
    { name: "SuperRare", domain: "superrare.com" },
    { name: "Taiwan Doujinshi Center", domain: "doujin.com.tw" },
    { name: "TeePublic", domain: "teepublic.com" },
    { name: "Telegram", domain: "t.me" },
    { name: "TensorArt", domain: "tensor.art" },
    { name: "The Interviews", domain: "theinterviews.jp" },
    { name: "Toyhouse", domain: "toyhou.se" },
    { name: "tsunagu.cloud", domain: "tsunagu.cloud" },
    { name: "Vimeo", domain: "livestream.com" },
    { name: "Weebly", domain: "weeblysite.com" },
    { name: "Willow", domain: "wlo.link" },
    { name: "Wix", domain: "wixsite.com" },
    { name: "WordPress", domain: "wordpress.com" },
    { name: "Youtube", domain: "youtu.be" },

    // Known sites without specific rules
    // https://github.com/danbooru/danbooru/tree/22e1b4d3bf0a8776dbac282f4e3a83d62facc537/public/images
    { name: "4chan" },
    { name: "Afdian" },
    { name: "Aibooru" },
    { name: "Amazon" },
    { name: "Ameblo" },
    { name: "Anifty" },
    { name: "Animexx" },
    { name: "Artfol" },
    { name: "Artistree" },
    { name: "Aryion" },
    { name: "Atwiki" },
    { name: "Baidu" },
    { name: "Bandcamp" },
    { name: "Baraag" },
    { name: "Beacons" },
    { name: "Behance" },
    { name: "Biglobe" },
    { name: "Bilibili" },
    { name: "Booklive" },
    { name: "Boosty" },
    { name: "Cafe24" },
    { name: "Carbonmade" },
    { name: "Catbox" },
    { name: "Charasuji" },
    { name: "Chongya" },
    { name: "Civitai" },
    { name: "Class101" },
    { name: "Clip-studio" },
    { name: "Coconala" },
    { name: "Cohost" },
    { name: "Commishes" },
    { name: "Creatorlink" },
    { name: "Crepu" },
    { name: "Cubebrush" },
    { name: "Dc" },
    { name: "Dmm" },
    { name: "Dotpict" },
    { name: "Douyin" },
    { name: "Drawcrowd" },
    { name: "Drum" },
    { name: "Enty" },
    { name: "Erogamescape" },
    { name: "Etsy" },
    { name: "Famiport" },
    { name: "Fansly" },
    { name: "Fantia" },
    { name: "Fiverr" },
    { name: "Flavors" },
    { name: "Flickr" },
    { name: "Foriio" },
    { name: "Foundation" },
    { name: "Furaffinity" },
    { name: "Fusetter" },
    { name: "Gelbooru" },
    { name: "Geocities" },
    { name: "Giftee" },
    { name: "Goo" },
    { name: "Google" },
    { name: "Grafolio" },
    { name: "Hatena" },
    { name: "Hitomi" },
    { name: "Huaban" },
    { name: "Imagis" },
    { name: "Imgur" },
    { name: "Infoseek" },
    { name: "Inkbunny" },
    { name: "Inprnt" },
    { name: "Instagram" },
    { name: "Itaku" },
    { name: "Iwara" },
    { name: "Jimdo" },
    { name: "Kakao" },
    { name: "Kickstarter" },
    { name: "Konachan" },
    { name: "Letterboxd" },
    { name: "Line" },
    { name: "Listography" },
    { name: "Luscious" },
    { name: "Lynkfire" },
    { name: "M-pe" },
    { name: "Makersplace" },
    { name: "Manba" },
    { name: "Mangaupdates" },
    { name: "Marshmallow-qa" },
    { name: "Marvel" },
    { name: "Mblg" },
    { name: "Mega" },
    { name: "Melonbooks" },
    { name: "Mihoyo" },
    { name: "Mihuashi" },
    { name: "Mobygames" },
    { name: "Monappy" },
    { name: "Mottohomete" },
    { name: "Neocities" },
    { name: "Newgrounds" },
    { name: "Nijie" },
    { name: "Nizima" },
    { name: "Note" },
    { name: "Notion" },
    { name: "Objkt" },
    { name: "Odaibako" },
    { name: "Ofuse" },
    { name: "Onaco" },
    { name: "Overdoll" },
    { name: "Partme" },
    { name: "Patreon" },
    { name: "Pawoo" },
    { name: "Peing" },
    { name: "Photozou" },
    { name: "Picarto" },
    { name: "Picdig" },
    { name: "Picrew" },
    { name: "Piczel" },
    { name: "Pillowfort" },
    { name: "Pinterest" },
    { name: "Pixellent" },
    { name: "Pixiv-comic" },
    { name: "Plurk" },
    { name: "Poipiku" },
    { name: "Pornhub" },
    { name: "Portfoliobox" },
    { name: "Postype" },
    { name: "Potofu" },
    { name: "Privatter" },
    { name: "Profcard" },
    { name: "Recomet" },
    { name: "Redbubble" },
    { name: "Rentry" },
    { name: "Retrospring" },
    { name: "Roblox" },
    { name: "Rule34.us" },
    { name: "Safebooru" },
    { name: "Shopee" },
    { name: "Skeb" },
    { name: "Sketchfab" },
    { name: "Sketchmob" },
    { name: "Skima" },
    { name: "Society6" },
    { name: "Spinspin" },
    { name: "Spotify" },
    { name: "Stickam" },
    { name: "Storenvy" },
    { name: "Streamlabs" },
    { name: "Suzuri" },
    { name: "Taittsuu" },
    { name: "Taobao" },
    { name: "Tapas" },
    { name: "Taplink" },
    { name: "Tbib" },
    { name: "Tellonym" },
    { name: "Threadless" },
    { name: "Threads" },
    { name: "Throne" },
    { name: "Tictail" },
    { name: "Tiktok" },
    { name: "Tinami" },
    { name: "Tistory" },
    { name: "Togetter" },
    { name: "Toranoana" },
    { name: "Trakteer" },
    { name: "Trello" },
    { name: "Tumblr" },
    { name: "Twipple" },
    { name: "Twitcasting" },
    { name: "Twitch" },
    { name: "Twpf" },
    { name: "Ustream" },
    { name: "Venmo" },
    { name: "Vgen" },
    { name: "Vk" },
    { name: "Wavebox" },
    { name: "Weasyl" },
    { name: "Webmshare" },
    { name: "Webtoons" },
    { name: "Wikipedia" },
    { name: "Xfolio" },
    { name: "Xiaohongshu" },
    { name: "Yahoo" },
    { name: "Yfrog" },
    { name: "Zerochan" },
];
/* spell-checker: enable */

/** @param {string} siteName */
function getSitePriority (siteName) {
    const priority = SITE_ORDER.indexOf(siteName);
    return priority < 0 ? 1000 : priority;
}

/** @param {string} siteUrl */
function getSiteName (siteUrl) {
    const { hostname, pathname } = new URL(siteUrl);
    const { domain, sld, tld } = /** @type {import("psl").ParsedDomain} */ (psl.parse(hostname));

    const match = SITE_RULES.find(
        (rule) => (rule.hostname || rule.domain || rule.tld || rule.pathname)
            && (!rule.hostname || rule.hostname === hostname)
            && (!rule.domain || rule.domain === domain)
            && (!rule.tld || rule.tld === tld)
            && (!rule.pathname || pathname.includes(rule.pathname)),
    );

    return match ? match.name : capitalize(sld || tld || hostname);
}

/** @param {string} siteUrl */
function getSiteDisplayDomain (siteUrl) {
    const { hostname } = new URL(siteUrl);
    const { domain, tld } = /** @type {import("psl").ParsedDomain} */ (psl.parse(hostname));
    return domain || tld || hostname;
}

const SITE_ICON_FOLDER = "https://raw.githubusercontent.com/danbooru/danbooru/22e1b4d3bf0a8776dbac282f4e3a83d62facc537/public/images/";

/**
 * Try to resolve the site icon
 * @param {string} siteName Site name in SITE_RULES
 * @param {string} url Site url
 * @returns {Promise<string|null>}
 */
function getSiteIconUrl (siteName, url) {
    if (SITE_RULES.every((site) => site.name !== siteName)) {
        return new Promise((resolve) => {
            GM.xmlHttpRequest({
                method: "GET",
                url: `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`,
                responseType: "blob",
                onload: (xhr) => {
                    // for unresolved icons the response is 404 + fallback icon
                    if (xhr.status === 200) {
                        resolve(window.URL.createObjectURL(xhr.response));
                    } else {
                        resolve(null);
                    }
                },
            });
        });
    }
    const fileName = siteName.toLowerCase().replaceAll(/[^\w.]/g, "-");
    return getImage(`${SITE_ICON_FOLDER}${fileName}-logo.png`);
}

const getSiteIconUrlMemoized = _.memoize(getSiteIconUrl, memoizeKey);

/**
 * @param {string} siteUrl
 * @see https://github.com/danbooru/danbooru/blob/848c8fa8e9ecfc46e8c9588ab055e7d5cf4f5de0/app/models/artist_url.rb#L75
 */
function isSecondaryUrl (siteUrl) {
    return [
        /pixiv\.net\/stacc/i,
        /pixiv\.net\/fanbox/i,
        /twitter\.com\/intent/i,
        /(www|com|dic)\.nicovideo\.jp/i,
        /pawoo\.net\/web\/accounts/i,
        /misskey\.(io|art|design)\/users/i,
        /inkbunny\.net\/user\.php/i,
        /bsky\.app\/profile\/did:/i,
    ].some((rule) => rule.test(siteUrl));
}

/**
 * Get a resource url
 * TM always returns the resource as base64 while other script managers use blob by default.
 * Although blob is more efficient, it is affected by CORS.
 * @param {string} name The `@resource` name
 * @param {boolean} [asBase64] Force base64 format
 */
function getResourceUrl (name, asBase64 = false) {
    return /** @type {(name:string, asBlob:boolean)=>string} */(GM_getResourceURL)(
        name,
        !asBase64 && !DOMAIN_USES_CSP,
    );
}

/**
 * Get the image as blob-link in CORS-safe way
 * @param {string} imageUrl
 * @returns {Promise<string>}
 */
function getImage (imageUrl) {
    return new Promise((resolve) => {
        GM.xmlHttpRequest({
            method: "GET",
            url: imageUrl,
            responseType: "blob",
            onload: ({ response }) => resolve(window.URL.createObjectURL(response)),
        });
    });
}

/** @type {Record<string, {error:number}>} */
const networkErrors = {};

/**
 * Checks whether the number of failed requests to the domain reached the limit
 * @param {string} domain The domain to check
 * @param {boolean} logError Increase the number of errors
 */
function tooManyNetworkErrors (domain, logError = false) {
    const data = networkErrors[domain] ?? (networkErrors[domain] = { error: 0 });

    if (logError) {
        console.log("[TPT]: Total errors:", data.error);
        data.error += 1;
    }
    if (data.error < MAX_NETWORK_ERRORS) return false;
    if (logError) {
        if (data.error === MAX_NETWORK_ERRORS) {
            setTimeout(() => {
                console.log("[TPT]: Errors reset");
                data.error = 0;
            }, RETRY_REQUEST_INTERVAL);
        }
        console.error(
            "[TPT]: Maximum number of errors exceeded",
            MAX_NETWORK_ERRORS,
            "for",
            domain,
        );
    }
    return true;
}

/**
 * @template {RequestName} T
 * @param {T} type
 * @param {string} item
 * @returns {RequestPromise<T>["promise"]}
 */
function queueNetworkRequest (type, item) {
    const request = {
        type,
        item,
        promise: /** @type {RequestPromise<T>["promise"]} */($.Deferred()),
    };
    QUEUED_NETWORK_REQUESTS.push(request);
    return request.promise;
}

/** @type {typeof queueNetworkRequest} */
const queueNetworkRequestMemoized = _.memoize(queueNetworkRequest, memoizeKey);

function intervalNetworkHandler () {
    if (QUEUED_NETWORK_REQUESTS.length === 0) return;
    if (!navigator.onLine) {
        if (DISPLAY_NETWORK_ERRORS) {
            showMessage("No Internet connection");
        }
        return;
    }
    if (tooManyNetworkErrors(new URL(BOORU).hostname)) return;

    const types = /** @template {RequestName} T @type {T[]} */(Object.keys(NETWORK_REQUEST_DICT));
    for (const type of types) {
        const requests = QUEUED_NETWORK_REQUESTS.filter((request) => (request.type === type));
        if (requests.length <= 0) continue; // eslint-disable-line no-continue

        const requestTools = NETWORK_REQUEST_DICT[type];
        const url = `${BOORU}${requestTools.url}.json`;
        const limitParam = { limit: requestTools.limit ?? API_LIMIT };
        if (type === "count") {
            for (const request of requests) {
                const typeParam = requestTools.params([request.item]);
                const params = Object.assign(typeParam, limitParam, CACHE_PARAM);
                getLong(url, params, [request], requestTools).catch(() => {
                    // in case of error return the request to the queue
                    QUEUED_NETWORK_REQUESTS.push(request);
                });
            }
        } else {
            const typeParam = requestTools.params(requests.map((request) => request.item));
            const params = Object.assign(typeParam, limitParam, CACHE_PARAM);
            getLong(url, params, requests, requestTools).catch(() => {
                // in case of error return requests to the queue
                QUEUED_NETWORK_REQUESTS.push(...requests);
            });
        }
    }
    // Clear the queue once all network requests have been sent
    QUEUED_NETWORK_REQUESTS.length = 0;
}

/** @typedef {{ [k: string]: string|number|boolean|string[]|UrlParams}} UrlParams */

/**
 * @template {RequestName} T
 * @param {string} url
 * @param {UrlParams} params
 * @param {RequestPromise<RequestName>[]} requests
 * @param {RequestDefinition<DBResponse<T>>} tools
 */
async function getLong (url, params, requests, tools) {
    // Default to GET requests
    let method = "get";
    let finalParams = params;
    if ($.param(params).length > MAXIMUM_URI_LENGTH) {
        // Use POST requests only when needed
        finalParams = Object.assign(finalParams, { _method: "get" });
        method = "post";
    }

    /** @type {DBResponse<T>} */
    let resp = await makeRequest(method, url, finalParams);
    // Do any necessary filtering after the network request completes
    if (tools.filter) resp = tools.filter(resp);

    if (!Array.isArray(resp)) {
        for (const request of requests) {
            request.promise.resolve(resp);
        }
        return;
    }

    /** @type {Set<ResponseEntity<RequestName>>} */
    const unusedResp = new Set(resp);
    for (const request of requests) {
        const found = /** @type {DBResponse<T>} */ (resp.filter((data) => {
            if (tools.matches(/** @type {any} */(data), request.item)) {
                unusedResp.delete(data);
                return true;
            }
            return false;
        }));
        // Fulfill the promise which returns the results to the function that queued it
        request.promise.resolve(found);
    }
    if (unusedResp.size > 0) {
        debuglog("Unused results found:", [...unusedResp.values()]);
    }
}

/**
 * @param {string} method
 * @param {string} url
 * @param {UrlParams} data
 */
async function makeRequest (method, url, data) {
    const sleepHalfSecond = () => new Promise((resolve) => { setTimeout(resolve, 500); });
    const domain = new URL(url).hostname;
    if (tooManyNetworkErrors(domain)) {
        throw new Error(`${domain} had too many network errors`);
    }
    let status = -1;
    let statusText = "";

    for (let i = 0; i < MAX_NETWORK_RETRIES; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const resp = await $.ajax(url, {
                dataType: "json",
                data,
                method,
                // Do not use the failed and cached first try
                cache: i === 0,
            });
            showMessage("");
            return resp;
        } catch (error) {
            tooManyNetworkErrors(domain, true);
            ({ status, statusText } = /** @type {XMLHttpRequest} */(error));
            console.error(
                "[TPT]: Failed try #",
                i + 1,
                "\nURL:",
                url,
                "\nParameters:",
                data,
                "\nHTTP Error:",
                status,
                statusText,
            );
            // eslint-disable-next-line no-await-in-loop
            await sleepHalfSecond();
        }
    }
    const errorMsg = (!status || statusText?.startsWith("NetworkError"))
        ? `Failed to connect to ${domain}`
        : (status >= 500
            ? `Bad response from ${domain}: ${status} ${statusText}`
            : `Invalid response from ${domain}: ${status} ${statusText}`);
    if (DISPLAY_NETWORK_ERRORS) {
        showMessage(errorMsg);
    }
    throw new Error(errorMsg);
}

/**
 * Checks whether the url is normalized and optionally normalizes
 * @typedef {object} UrlNormalizer
 * @prop {false} [valid] Mark all domain's urls as requiring normalization
 * @prop {RegExp} [path] Test for normalized url path
 * @prop {RegExp} [params] Test for normalized url search params
 * @prop {(url:URL) => string} [normalize] Url normalizer
 */

/**
 * Converts URLs to the same format used by the URL column on Danbooru
 * @param {string} targetUrl
 * @param {Record<string, UrlNormalizer>} normalizers
 * @param {number} [depth]
 * @returns {{ url:string, error:string }}
 */
function normalizeURL (targetUrl, normalizers, depth = 0) {
    if (depth > 10) {
        return {
            url: targetUrl,
            error: `Recursive URL normalization: ${targetUrl}`,
        };
    }
    const url = new URL(targetUrl);
    if (url.protocol !== "https:") url.protocol = "https:";
    let host = url.hostname;
    if (!(host in normalizers)) {
        host = ".".concat(host.split(".").slice(-2).join("."));
    }
    if (!(host in normalizers)) {
        return {
            url: targetUrl,
            error: `Unsupported domain: ${host}`,
        };
    }

    const {
        valid, path, params, normalize,
    } = normalizers[host];
    if (valid === false || path && !path.test(url.pathname) || params && !params.test(url.search)) {
        if (!normalize) {
            return {
                url: targetUrl,
                error: `Normalization isn't implemented: ${targetUrl}`,
            };
        }
        // Normalize and validate the url without infinite loop
        const normalizedUrl = normalize(url);
        if (normalizedUrl === targetUrl) {
            return {
                url: normalizedUrl,
                error: `URL normalized to itself: ${targetUrl}`.trim(),
            };
        }
        return normalizeURL(normalizedUrl, normalizers, depth + 1);
    }
    let normalizedUrl = url.toString();
    if (normalizedUrl.endsWith("/")) normalizedUrl = normalizedUrl.slice(0, -1);
    return {
        url: normalizedUrl,
        error: "",
    };
}

/** @type {Record<string, UrlNormalizer>} */
const NORMALIZE_PROFILE_URL = {
    ".artstation.com": {
        path: /^\/[\w-]+$/,
        normalize (url) {
            const username = safeMatchMemoized(url.hostname, /([\w-]+)\.artstation\.com/, 1);
            return `https://www.artstation.com/${username}`;
        },
    },
    "baraag.net": {
        path: /^\/@[\w-]+$/,
    },
    "bcy.net": {
        path: /^\/u\/\d+$/,
    },
    "bsky.app": {},
    "ci-en.net": {
        path: /^\/creator\/\d+$/,
    },
    ".deviantart.com": {
        path: /^\/[\w-]+$/,
        normalize (url) {
            const username = safeMatchMemoized(url.hostname, /([\w-]+)\.deviantart\.com/, 1);
            return `https://www.deviantart.com/${username}`;
        },
    },
    ".fanbox.cc": { path: /^\/$/ },
    "fantia.jp": {
        path: /^\/(\w+|fanclubs\/\d+)$/,
    },
    "www.hentai-foundry.com": {
        path: /^\/user\/[\w-]+$/,
        normalize (url) {
            const username = safeMatchMemoized(url.pathname, /\/user\/([\w-]+)(\/profile)?/, 1);
            return `https://www.hentai-foundry.com/user/${username}`;
        },
    },
    "medibang.com": {},
    "misskey.art": {
        path: /^\/@\w+$/,
    },
    "misskey.design": {
        path: /^\/@\w+$/,
    },
    "misskey.io": {
        path: /^\/@\w+$/,
    },
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
        path: /^\/@[\w-]+$/,
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
    "skeb.jp": {
        path: /^\/@\w+$/,
    },
    "www.tinami.com": {
        path: /^\/creator\/profile\/\d+$/,
    },
    "twitter.com": {
        path: /^\/[\w-]+|\/intent\/user$/,
    },
    "mobile.twitter.com": {
        valid: false,
        normalize (url) {
            return `https://twitter.com${url.pathname}`;
        },
    },
    "www.weibo.com": {
        path: /^\/([pu]\/\d+)|(n\/)/,
    },
    ".weibo.com": {
        valid: false,
        normalize (url) {
            return `https://www.weibo.com${url.pathname}`;
        },
    },
    "x.com": {
        valid: false,
        normalize (url) {
            return `https://twitter.com${url.pathname}`;
        },
    },
    "www.xiaohongshu.com": {
        valid: false,
        normalize (url) {
            return `https://www.xiaohongshu.com${url.pathname}`;
        },
    },
};

/**
 * Converts URLs to the same format used by the URL column on Danbooru
 * @param {string} profileUrl
 * @returns {string}
 */
function normalizeProfileURL (profileUrl) {
    const { url, error } = normalizeURL(profileUrl.toLowerCase(), NORMALIZE_PROFILE_URL);
    if (error) {
        console.error("[TPT]:", error);
    }
    return url;
}

/** @typedef {string|RegExp|[string[]]|[string|string[]|RegExp, string]} RCCond */
/** @template {RCCond} C @typedef {C extends Readonly<[any, string]> ? C[1] : never} RCKey */
// eslint-disable-next-line max-len
/** @template {RCCond} C @typedef {C extends Readonly<[any, string]> ? C[0] extends `*` ? string[] : C[0] extends RegExp ? RegExpMatchArray : string : never} RCProp */
// eslint-disable-next-line max-len
/** @template {RCCond[]} C @typedef {Readonly<{[K in C[number] as RCKey<K>]: RCProp<K>}>} RCMatch */
// eslint-disable-next-line max-len
/** @template C @template M @template R @typedef {[C] | [C, (m:M)=>R] | [C, (m:M)=>boolean, (m:M)=>R]} RCCaseParams */
// eslint-disable-next-line max-len
/** @typedef {<const C extends RCCond[], R extends Record<string, any> = RCMatch<C>> (...args: RCCaseParams<C, RCMatch<C>, R>) => (array:string[])=>R|null} RCCaseFn */
// For some reason contextually typed function fails to infer the R type, so cannot type the fn directly. Probably https://github.com/microsoft/TypeScript/issues/58580
/**
 * A single case for rubyArraySwitch.
 * The first param - pattern of the string array: `Array<pattern|[pattern, name]>` where
 * `pattern` is `"_"` (anything), `"**"` (any number of any items), string or
 * string array (exact match) or RegExp, and `name` is name for the saving the match.
 * The second optional param - extra check for the matching.
 * The last optional param - converter of matched data.
 * @type {RCCaseFn}
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
function rubyArrayCase (checks, fn1, fn2) {
    const afterCheck = fn2 ? fn1 : null;
    const convert = fn2 ?? fn1;
    return (array) => {
        /** @type {any} */
        const matches = {};
        let i = 0;
        // eslint-disable-next-line no-labels, no-restricted-syntax
        mainLoop: for (let j = 0; j < checks.length; j++) {
            const check = checks[j];
            const [pattern, prop] = Array.isArray(check) ? check : [check];
            if (i >= array.length && check !== "**") {
                return null;
            }
            if (pattern instanceof RegExp) {
                const match = pattern.exec(array[i]);
                if (!match) return null;
                if (prop) matches[prop] = match;
            } else if (Array.isArray(pattern)) {
                if (pattern.includes(array[i])) {
                    if (prop) matches[prop] = array[i];
                } else {
                    return null;
                }
            } else {
                switch (pattern) {
                    case "**": {
                        const restChecks = checks.slice(j + 1);
                        for (let ii = array.length; ii > i; ii--) {
                            const res = rubyArrayCase(restChecks)(array.slice(ii));
                            if (res) {
                                if (prop) matches[prop] = array.slice(ii);
                                Object.assign(matches, res);
                                i = array.length - 1;
                                // eslint-disable-next-line no-labels
                                break mainLoop;
                            }
                        }
                        if (prop) matches[prop] = [];
                        break;
                    }
                    case "_":
                        if (prop) matches[prop] = array[i];
                        break;
                    case array[i]:
                        if (prop) matches[prop] = array[i];
                        break;
                    default:
                        return null;
                }
            }
            i += 1;
        }
        if (i < array.length - 1) return null;
        if (afterCheck && !afterCheck(matches)) return null;
        return convert ? convert(matches) : matches;
    };
}

// https://stackoverflow.com/questions/65750673/collapsing-a-discriminated-union-derive-an-umbrella-type-with-all-possible-key
// eslint-disable-next-line max-len
/** @template U @typedef {(U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never} UnionToIntersection */
/** @template T @typedef {T & { [str: string]: undefined; }} Indexable */
/** @template T @typedef {{ [K in keyof T]: undefined }} UndefinedValues */
/** @template T @typedef {keyof UnionToIntersection<UndefinedValues<T>>} AllUnionKeys */
/** @template T @typedef {{ [K in AllUnionKeys<T> & string]: Indexable<T>[K] }} CollapseUnion */

/**
 * Ruby-like implementation of case-in for arrays
 * @template {Array<(arr: string[]) => any>} C
 * @param {string[]} array - the strings to match
 * @param {C} cases - rubyArrayCase's
 * @returns {Partial<CollapseUnion<Exclude<ReturnType<C[number]>, null>>>}
 */
function rubyArraySwitch (array, ...cases) {
    for (const rubyCase of cases) {
        const res = rubyCase(array);
        if (res !== null) return res;
    }
    // @ts-ignore
    return {};
}

/**
 * Split url into parts
 * @param {URL} url
 */
function splitUrl (url) {
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const {
        subdomain, domain,
    } = /** @type {import("psl").ParsedDomain} */(psl.parse(url.hostname));
    return {
        subdomain: subdomain ?? "",
        domain: domain ?? "",
        pathSegments,
    };
}

/**
 * Based on `page_url` methods in https://github.com/danbooru/danbooru/tree/master/app/logical/source/url
 * @satisfies {Record<string, UrlNormalizer["normalize"]>}
 */
const SOURCE_NORMALIZER = {
    deviantArt (url) {
        const { subdomain, domain, pathSegments } = splitUrl(url);
        const { id, filename } = rubyArraySwitch(
            [domain, ...pathSegments],
            rubyArrayCase(["deviantart.net", "**", ["_", "filename"]]),
            rubyArrayCase(["deviantart.com", "download", ["_", "id"], "**"]),
            rubyArrayCase(["deviantart.com", [["deviation", "view"]], ["_", "id"]]),
            rubyArrayCase(
                ["deviantart.com", ["_", "user"], "art", [/^(?:([\w-]+)-)?(\d+)$/i, "reg"]],
                (m) => ({ ...m, id: m.reg[2] }),
            ),
            rubyArrayCase(
                ["deviantart.com", "art", [/^([\w-]+)-(\d+)$/i, "reg"]],
                () => subdomain !== "www",
                (m) => ({ ...m, id: m.reg[2] }),
            ),
            rubyArrayCase(
                ["deviantart.com", [["view.php", "view-full.php"]]],
                () => !!url.searchParams.get("id")?.match(/^\d+$/),
                () => ({ id: url.searchParams.get("id") }),
            ),
        );

        let workId = id ?? 0;
        if (filename) {
            const name = filename.replace(/\.\w+$/, "");
            const regexps = [
                /^.+_by_.+[_-]d([\da-z]+)(?:-\w+)?$/i,
                /^[\da-f]{32}-d([\da-z]+)$/,
                /^d([\da-z]{6})-h{8}(?:-h{4}){3}-h{12}/,
            ];
            for (const reg of regexps) {
                const match = reg.exec(name);
                if (match) {
                    workId = Number.parseInt(match[1], 36);
                    break;
                }
            }
        }

        if (workId) return `https://www.deviantart.com/deviation/${workId}`;
        return url.toString();
    },
    fandom (url) {
        /** @type {Record<string, string|undefined>} */
        const WIKI_NAMES = {
            // "lang/database_name": subdomain
            /* spell-checker: disable */
            "/adventuretimewithfinnandjake": "adventuretime",
            "/age-of-ishtaria": "ishtaria",
            "/atelierseries": "atelier",
            "/b-dapedia": "bdaman",
            "/blackbullet2": "blackbullet",
            "/blacksurvival_gamepedia_en": "blacksurvival",
            "/capcomdatabase": "capcom",
            "/dragalialost_gamepedia_en": "dragalialost",
            "/dragonauttheresonance": "dragonaut",
            "/dungeon-ni-deai-o-motomeru": "danmachi",
            "/dynastywarriors": "koei",
            "/fault-milestone8968": "fault-series",
            "/genjitsushugisha": "genkoku",
            "/gen-impact": "genshin-impact",
            "/gensin-impact": "genshin-impact",
            "/grimm-notes-jp": "grimms-notes-jp",
            "/guilty-gear": "guiltygear",
            "/harvestmoonrunefactory": "therunefactory",
            "/honkaiimpact3_gamepedia_en": "honkaiimpact3",
            "/isekai-maou-to-shoukan-shoujo-dorei-majutstu": "isekai-maou",
            "/kagura": "senrankagura",
            "/langrisser_gamepedia_en": "langrisser",
            "/littlewitch": "little-witch-academia",
            "/madannooutovanadis": "madan",
            "/magiarecord-en": "magireco",
            "/magic-school-lussid": "sid-story",
            "/mahousenseinegima": "negima",
            "/masterofeternity_gamepedia_en": "masterofeternity",
            "/ninehourspersonsdoors": "zeroescape",
            "/onigiri-en": "onigiri",
            "/p__": "hero",
            "/ritualofthenight": "bloodstained",
            "/rockman_x_dive": "rockman-x-dive",
            "/romancingsaga": "saga",
            "/shirocolle": "shiropro",
            "/silent": "silenthill",
            "/strikewitches": "worldwitches",
            "/sword-art-online": "swordartonline",
            "ru/sword-art-online": "sword-art-online",
            "es/sao": "swordartonline",
            "/senkizesshousymphogear": "symphogear",
            "/talesofseries-the-tales-of": "tales-of",
            "/tensei-shitara-slime-datta-ke": "tensura",
            "/the-dreath-mage-who-doesnt-want-a-fourth-time": "death-mage",
            "/to-aru-majutsu-no-index": "toarumajutsunoindex",
            "/utawareru": "utawarerumono",
            "/yorukuni": "nightsofazure",
            "/youkoso-jitsuryoku-shijou-shugi-no-kyoushitsu-e": "you-zitsu",
            "/zoe": "zoneoftheenders",
            /* spell-checker: enable */
        };

        const { pathSegments } = splitUrl(url);

        if (pathSegments[0]?.match(/^__cb\d+$/)) pathSegments.shift();
        const { wikiName, prefix, file } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(
                // unresolvable case
                [[/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/, "imageUuid"], "**"],
            ),
            rubyArrayCase(
                [["_", "wikiName"], "images", /^[\da-f]$/, /^[\da-f]{2}$/, ["_", "file"], "**"],
                (match) => ({
                    ...match,
                    prefix: url.searchParams.get("path-prefix"),
                }),
            ),
            rubyArrayCase(
                // eslint-disable-next-line max-len
                [["_", "wikiName"], ["_", "prefix"], "images", /^[\da-f]$/, /^[\da-f]{2}$/, ["_", "file"], "**"],
            ),
            rubyArrayCase(
                // eslint-disable-next-line max-len
                [["_", "wikiName"], "images", "thumb", /^[\da-f]$/, /^[\da-f]{2}$/, ["_", "file"], "**"],
                (match) => ({
                    ...match,
                    prefix: url.searchParams.get("path-prefix"),
                }),
            ),
            rubyArrayCase(
                // eslint-disable-next-line max-len
                [["_", "wikiName"], ["_", "prefix"], "images", "thumb", /^[\da-f]$/, /^[\da-f]{2}$/, ["_", "file"], "**"],
            ),
        );

        const lang = prefix === "en" || !prefix?.match(/^\w{2,3}(-\w{2,3})?$/) ? "" : prefix;
        const subdomain = WIKI_NAMES[`${lang}/${wikiName}`] ?? wikiName;
        const site = wikiName ? (lang ? `https://${subdomain}.fandom.com/${lang}` : `https://${subdomain}.fandom.com`) : null;
        if (site && file) return `${site}/wiki/File:${file}`;
        return url.toString();
    },
    fantia (url) {
        const { pathSegments } = splitUrl(url);
        const { postId, productId } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(
                // eslint-disable-next-line max-len
                ["uploads", ["_", "type"], [["file", "image"]], ["_", "id"], [/(\w+_)?([\w-]+\.\w+)/, "ref"]],
                (m) => {
                    switch (m.type) {
                        case "post": return { postId: m.id };
                        case "product": return { productId: m.id };
                        default: return {};
                    }
                },
            ),
            rubyArrayCase(
                ["posts", ["_", "postId"], "album_image"],
                () => url.searchParams.has("query"),
                (m) => m,
            ),
            rubyArrayCase(
                ["posts", [/\d+/, "id"], "**"],
                (m) => ({ postId: m.id[0] }),
            ),
            rubyArrayCase(
                ["products", [/\d+/, "id"], "**"],
                (m) => ({ productId: m.id[0] }),
            ),
        );

        if (postId) return `https://fantia.jp/posts/${postId}`;
        if (productId) return `https://fantia.jp/products/${productId}`;
        return url.toString();
    },
    hentaiFoundry (url) {
        const { subdomain, pathSegments } = splitUrl(url);

        const { workId, username } = rubyArraySwitch(
            [subdomain, ...pathSegments],
            rubyArrayCase(
                ["pictures", "_", ["_", "username"], [/^\d+$/, "workId"], ["_", "filename"]],
                (m) => ({ ...m, workId: m.workId[0] }),
            ),
            rubyArrayCase(
                ["pictures", "_", ["_", "username"], [/^(\d+)\.\w+$/, "filename"]],
                (m) => ({ ...m, workId: m.filename[1] }),
            ),
            rubyArrayCase(
                ["_", "piccies", "user", ["_", "username"], [/^\d+$/, "workId"], "**"],
                (m) => ({ ...m, workId: m.workId[0] }),
            ),
            rubyArrayCase(
                ["_", [/^pic\w*-(\d+)/, "filename"]],
                (m) => ({ workId: m.filename[1] }),
            ),
            rubyArrayCase(
                ["thumbs", "thumb.php"],
                () => url.searchParams.has("pid"),
                () => ({ workId: url.searchParams.get("pid") }),
            ),
        );

        if (username && workId) {
            return `https://www.hentai-foundry.com/pictures/user/${username}/${workId}`;
        }
        if (workId) return `https://www.hentai-foundry.com/pic-${workId}`;
        return url.toString();
    },
    imgur (url) {
        const { pathSegments } = splitUrl(url);
        const { albumId, imageId } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(
                [[/^\w+\.(jpeg|jpg|png|gif|gifv|webp|avif|webm|mp4)$/i, "file"]],
                (m) => ({ imageId: m.file[0].match(/^(\w{7}|\w{5})/)?.[1] }),
            ),
            rubyArrayCase(
                ["download", ["_", "imageId"], "**"],
            ),
            rubyArrayCase(
                [[["gallery", "a"]], ["_", "file"], "**"],
                (m) => ({ albumId: m.file.split("-").at(-1) }),
            ),
            rubyArrayCase(
                ["t", "_", ["_", "albumId"]],
            ),
            rubyArrayCase(
                [[/\w{5,7}$/i, "ending"]],
                (m) => ({ imageId: m.ending[0] }),
            ),
        );

        if (albumId) return `https://imgur.com/a/${albumId}`;
        if (imageId) return `https://imgur.com/${imageId}`;
        return url.toString();
    },
    newGrounds (url) {
        const { pathSegments } = splitUrl(url);
        const { username, title, videoId } = rubyArraySwitch(
            [url.hostname, ...pathSegments],
            rubyArrayCase(
                ["www.newgrounds.com", "art", "view", ["_", "username"], ["_", "title"]],
            ),
            rubyArrayCase(
                ["www.newgrounds.com", "portal", [["view", "video"]], ["_", "videoId"]],
            ),
            rubyArrayCase(
                // eslint-disable-next-line max-len
                ["art.ngfiles.com", [["medium_views", "images"]], "_", [/^(\d+)_(\d+)_([^_]+)_(.*)\.([\da-f]{32})\.\w+$/, "reg"]],
                () => ({}), // images with hash cannot be resolved
            ),
            rubyArrayCase(
                ["art.ngfiles.com", "images", "_", [/^(\d+)_([^_]+)_(.*)\.\w+$/, "reg"]],
                (m) => ({
                    username: m.reg[2],
                    title: m.reg[3],
                }),
            ),
        );

        if (username && title) {
            return `https://www.newgrounds.com/art/view/${username}/${title}`;
        }
        if (videoId) return `https://www.newgrounds.com/portal/view/${videoId}`;
        return url.toString();
    },
    nijie (url) {
        const { subdomain, domain, pathSegments } = splitUrl(url);
        // eslint-disable-next-line prefer-const
        let { workId, filename } = rubyArraySwitch(
            [domain, ...pathSegments],
            rubyArrayCase(
                ["nijie.info", [["view.php", "view_popup.php"]]],
                () => url.searchParams.has("id"),
                () => ({ workId: url.searchParams.get("id") }),
            ),
            rubyArrayCase(
                // eslint-disable-next-line max-len
                ["_", /^\d{2}$/, "nijie", /^\d{2}$/, /^\d{2}$/, ["_", "userId"], "illust", ["_", "filename"]],
                () => subdomain.startsWith("pic"),
                (m) => m,
            ),
            rubyArrayCase(
                ["**", "nijie_picture", "**", ["_", "filename"]],
                () => subdomain.startsWith("pic"),
                (m) => m,
            ),
        );

        if (!workId && filename) {
            ({ workId } = rubyArraySwitch(
                filename.replace(/\.\w+$/, "").split("_"),
                rubyArrayCase(
                    [[/^\d+$/, "workId"], /^\d+$/, [/^\d+$/, "userId"], [/^\d{14}$/, "time"]],
                    (m) => m.workId[0] !== "0",
                    (m) => ({ workId: m.workId[0] }),
                ),
                rubyArrayCase(
                    [[/^\d+$/, "workId"], [/^\d+$/, "userId"], [/^\d{14}$/, "time"], /^\d+$/],
                    (m) => ({ workId: m.workId[0] }),
                ),
                rubyArrayCase(
                    [[/^\d+$/, "workId"], /^\d+$/, /^[\da-f]+$/, /^[\da-f]+$/],
                    (m) => m.workId[0] !== "0",
                    (m) => ({ workId: m.workId[0] }),
                ),
            ));
        }

        if (workId) return `https://nijie.info/view.php?id=${workId}`;
        return url.toString();
    },
    patreon (url) {
        const { pathSegments } = splitUrl(url);
        const { postId } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(["_", "patreon-media", "p", "post", ["_", "postId"], "**"]),
        );

        if (postId) return `https://www.patreon.com/posts/${postId}`;
        return url.toString();
    },
    pixiv (url) {
        const { subdomain, domain, pathSegments } = splitUrl(url);
        const isImageUrl = url.hostname === "i.pximg.net"
            || url.hostname === "i-f.pximg.net"
            || /^(i\d+|img\d+)\.pixiv\.net$/.test(url.hostname);
        let match = rubyArraySwitch(
            [subdomain, domain, ...pathSegments],
            rubyArrayCase(
                // eslint-disable-next-line max-len
                ["**", [["img-original", "img-master", "img-zip-ugoira", "img-inf", "custom-thumb", "novel-cover-original", "novel-cover-master"], "imageType"], "img", ["_", "year"], ["_", "month"], ["_", "day"], ["_", "hour"], ["_", "min"], ["_", "sec"], ["_", "filename"]],
                () => isImageUrl,
                (m) => m,
            ),
            rubyArrayCase(
                ["**", "img", ["_", "username"], ["_", "filename"]],
                () => isImageUrl,
                (m) => m,
            ),
            rubyArrayCase(
                ["_", "pixiv.net", "**", "artwork", ["_", "workId"]],
            ),
            rubyArrayCase(
                ["_", "pixiv.net", "novel", "show.php"],
                () => url.searchParams.has("id"),
                () => ({ novelId: url.searchParams.get("id") }),
            ),
            rubyArrayCase(
                ["embed", "pixiv.net", "novel.php"],
                () => url.searchParams.has("id"),
                () => ({ novelId: url.searchParams.get("id") }),
            ),
            rubyArrayCase(
                ["_", "pixiv.net", "novel", "series", [/^\d+$/, "novelSeriesId"]],
                (m) => ({ novelSeriesId: m.novelSeriesId[0] }),
            ),
            rubyArrayCase(
                ["_", "pixiv.net", "i", ["_", "workId"]],
            ),
            rubyArrayCase(
                ["_", "pixiv.net", "member_illust.php"],
                () => url.searchParams.has("illust_id"),
                () => ({ workId: url.searchParams.get("illust_id") }),
            ),
        );

        if (match.filename) {
            match = {
                ...match,
                ...rubyArraySwitch(
                    match.filename.replace(/\.\w+$/, "").split("_"),
                    rubyArrayCase(
                        [[/^\d+$/, "workId"], /^p\d+$/, "**"],
                        (m) => ({ workId: m.workId[0] }),
                    ),
                    rubyArrayCase(
                        [[/^\d+$/, "workId"], "big", /^p\d+$/],
                        (m) => ({ workId: m.workId[0] }),
                    ),
                    rubyArrayCase(
                        [[/^(?:ci)?(\d+)$/, "novelId"], /^[\da-f]{32}$/, "**"],
                        (m) => ({ novelId: m.novelId[1] }),
                    ),
                    rubyArrayCase(
                        [[/^sci(\d+)$/, "novelSeriesId"], /^[\da-f]{32}$/, "**"],
                        (m) => ({ novelSeriesId: m.novelSeriesId[1] }),
                    ),
                    rubyArrayCase(
                        [[/^\d+$/, "workId"], "**"],
                        (m) => ({ workId: m.workId[0] }),
                    ),
                ),
            };
        }

        if (match.workId) return `https://www.pixiv.net/artworks/${match.workId}`;
        if (match.novelId) return `https://www.pixiv.net/novel/show.php?id=${match.novelId}`;
        if (match.novelSeriesId) return `https://www.pixiv.net/novel/series/${match.novelSeriesId}`;
        return url.toString();
    },
    weibo (url) {
        const { subdomain, domain, pathSegments } = splitUrl(url);

        const { imgBase62Id, imgLongId, userShortId } = rubyArraySwitch(
            [subdomain, domain, ...pathSegments],
            rubyArrayCase(
                ["tw", "weibo.com", /^\w+$/, [/^\d+$/, "imgLongId"]],
            ),
            rubyArrayCase(
                // eslint-disable-next-line max-len
                ["_", [["weibo.com", "weibo.cn"]], [/^\d+$/, "userShortId"], [/^\w+$/, "imgBase62Id"]],
            ),
            rubyArrayCase(
                // eslint-disable-next-line max-len
                ["photo", "weibo.com", [/^\d+$/, "userShortId"], "_", "_", "_", [/^\d+$/, "imgLongId"], "**"],
            ),
            rubyArrayCase(
                ["_", [["weibo.com", "weibo.cn"]], "detail", [/^\d+$/, "imgLongId"]],
            ),
            rubyArrayCase(
                ["share.api", "weibo.cn", "share", [/^(\d+),(\d+)/, "img"]],
                (m) => ({ imgLongId: m.img[2] }),
            ),
            rubyArrayCase(
                ["m", "weibo.cn", "status", [/^\w+$/, "imgBase62Id"]],
            ),
        );

        if (imgBase62Id && userShortId) return `https://www.weibo.com/${userShortId}/${imgBase62Id}`;
        if (imgLongId) return `https://m.weibo.cn/detail/${imgLongId}`;
        if (imgBase62Id) return `https://m.weibo.cn/status/${imgBase62Id}`;

        return url.toString();
    },
    zerochan (url) {
        const { pathSegments } = splitUrl(url);
        const { workId } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(
                [[/^(full|\d+)$/, "size"], /\d{2}/, /\d{2}/, [/(\d+)\.(jpg|png|gif)$/, "file"]],
                (m) => ({ workId: m.file[1] }),
            ),
            rubyArrayCase(
                [[/^(.*?)\.(full|\d+)\.(\d+)\.(jpg|png|gif)$/, "file"]],
                (m) => ({ workId: m.file[3] }),
            ),
            rubyArrayCase(
                ["full", [/^\d+$/, "workId"]],
            ),
            rubyArrayCase(
                [[/^\d+$/, "reg"]],
                (m) => ({ workId: m.reg[0] }),
            ),
        );

        if (workId) return `https://www.zerochan.net/${workId}#full`;

        return url.toString();
    },
};

/**
 * @type {Record<string, UrlNormalizer>}
 */
const NORMALIZE_SOURCE_URL = {
    "art.ngfiles.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.newGrounds,
    },
    "www.deviantart.com": {
        path: /(^\/[\w-_]+\/art\/)|(^\/deviation\/)/,
        normalize: SOURCE_NORMALIZER.deviantArt,
    },
    ".deviantart.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.deviantArt,
    },
    ".deviantart.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.deviantArt,
    },
    "fantia.jp": {
        path: /^\/(posts|products)\/\d+$/,
        normalize: SOURCE_NORMALIZER.fantia,
    },
    ".fantia.jp": {
        valid: false,
        normalize: SOURCE_NORMALIZER.fantia,
    },
    "imgur.com": {
        path: /^(\/a)?\/\w+$/,
        params: /^$/, // no params
        normalize: SOURCE_NORMALIZER.imgur,
    },
    ".imgur.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.imgur,
    },
    ".nijie.info": {
        path: /^\/view\.php$/,
        normalize: SOURCE_NORMALIZER.nijie,
    },
    ".nijie.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.nijie,
    },
    ".nocookie.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.fandom,
    },
    "pictures.hentai-foundry.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.hentaiFoundry,
    },
    "thumbs.hentai-foundry.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.hentaiFoundry,
    },
    ".patreonusercontent.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.patreon,
    },
    "www.pixiv.net": {
        path: /^(\/en)?\/(artworks\/\d+|novel\/show.php|novel\/series\/\d+)$/,
        params: /^(\?id=\d+)?$/,
        normalize: SOURCE_NORMALIZER.pixiv,
    },
    ".pixiv.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.pixiv,
    },
    ".pximg.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.pixiv,
    },
    ".sinaimg.cn": {
        valid: false,
        normalize: SOURCE_NORMALIZER.weibo,
    },
    ".weibo.cn": {
        path: /^\/(detail\/\d+|status\/\w+)$/,
        normalize: SOURCE_NORMALIZER.weibo,
    },
    "www.weibo.com": {
        path: /^\/\d+\/\w+$/,
        params: /^$/, // no params
        normalize: SOURCE_NORMALIZER.weibo,
    },
    ".weibo.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.weibo,
    },
    ".weibocdn.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.weibo,
    },
    ".zerochan.net": {
        path: /^\/\d+(#full)?$/,
        normalize: SOURCE_NORMALIZER.zerochan,
    },
};

/**
 * Converts URLs to the same format used by the URL column on Danbooru
 * @param {string} sourceUrl
 * @returns {string}
 */
function normalizeSourceURL (sourceUrl) {
    const { url, error } = normalizeURL(sourceUrl, NORMALIZE_SOURCE_URL);
    if (error && !error.startsWith("Unsupported domain:")) {
        console.warn("[TPT]:", error);
    }
    return url;
}

/** @typedef {{name:string, prettyName:string, category:number}} TranslatedTag */

/**
 * Translate a regular tag on the given element
 * @param {HTMLElement} target The element to attach translation
 * @param {string} tagName The tag name to translate
 * @param {TranslationOptionsFull} options Translation options
 */
async function translateTag (target, tagName, options) {
    if (!tagName) return;

    const normalizedTag = tagName
        .normalize("NFKC")
        .replace(/^#/, "")
        .trim()
        .replaceAll(/\s/g, "_"); // Wiki other names cannot contain spaces

    /* Don't search for empty tags. */
    if (normalizedTag.length === 0) {
        return;
    }

    const wikiPages = await queueNetworkRequestMemoized("wiki", normalizedTag);

    /** @type {TranslatedTag[]} */
    let tags = [];
    if (wikiPages.length > 0) {
        tags = wikiPages
            // Ignore wiki pages of non-tags
            .filter(({ tag }) => tag)
            .map(({ title, tag }) => ({
                name: title,
                prettyName: title.replaceAll("_", " "),
                category: tag.category,
            }));
    // `normalizedTag` consists of only ASCII characters except percent, asterisks, and comma
    } else if (/^[\u0020-\u0024\u0026-\u0029+\u002D-\u007F]+$/.test(normalizedTag)) {
        // The server is already converting the values to
        // lowercase on its end so no need to do it here
        let rawTags = await queueNetworkRequestMemoized("tag", normalizedTag);
        if (rawTags.length === 0) {
            const aliases = await queueNetworkRequestMemoized("alias", normalizedTag);
            rawTags = aliases.map((alias) => alias.consequent_tag);
        }
        tags = rawTags.map((tag) => ({
            name: tag.name,
            prettyName: tag.name.replaceAll("_", " "),
            category: tag.category,
        }));
    }

    if (tags.length === 0) {
        debuglog(`No translation for "${normalizedTag}", rule "${options.ruleName}"`);
        return;
    }

    addDanbooruTags($(target), tags, options);
}

/** @type {Record<string, JQuery>} */
const renderedTagsCache = {};
/**
 * Attaches translations to the target element
 * @param {JQuery} $target The element to attach the translation
 * @param {TranslatedTag[]} tags Translated tags
 * @param {TranslationOptionsFull} options Translation options
 */
function addDanbooruTags ($target, tags, options) {
    if (tags.length === 0) return;

    const {
        onadded = null,
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
            findTag = TAG_POSITIONS.afterend.findTag,
        } = {},
        ruleName,
    } = options;
    let { classes = "" } = options;
    classes = `ex-translated-tags ${classes}`;

    const key = tags.map((tag) => tag.name).join("");
    if (!(key in renderedTagsCache)) {
        renderedTagsCache[key] = $(noIndents/* HTML */`
            <span class="${classes}">
                ${tags.map((tag) => noIndents/* HTML */`
                    <a class="ex-translated-tag-category-${tag.category}"
                       href="${BOORU}/posts?tags=${encodeURIComponent(tag.name)}"
                       target="_blank">
                            ${_.escape(tag.prettyName)}
                    </a>
                `)
                .join(", ")}
            </span>
        `);
    }
    const $tagsContainer = renderedTagsCache[key].clone().prop("className", classes);

    const $duplicates = findTag($target)
        .filter((i, el) => el.textContent?.trim() === $tagsContainer.text().trim());
    if ($duplicates.length > 0) {
        return;
    }

    if (DEBUG) $tagsContainer.attr("rulename", ruleName || "");
    insertTag($target, $tagsContainer);

    if (onadded) onadded($tagsContainer, options);
}

/**
 * Translate an artist on the given element using the url to their profile
 * @param {HTMLElement} element The element to attach the translations
 * @param {string} profileUrl The artist's urls to translate
 * @param {TranslationOptionsFull} options Translation options
 */
async function translateArtistByURL (element, profileUrl, options) {
    if (!profileUrl) return;

    const normalizedUrl = normalizeProfileURL(profileUrl);
    if (!normalizedUrl) return;

    const artists = await queueNetworkRequestMemoized("url", normalizedUrl);
    if (artists.length === 0) {
        const urls = Array.isArray(profileUrl) ? profileUrl.join(", ") : profileUrl;
        debuglog(`No artist at "${urls}", rule "${options.ruleName}"`);
        return;
    }

    let filteredArtists = artists;
    if (artists.length > 1) {
        const urlLower = normalizedUrl.toLowerCase();
        filteredArtists = artists.filter((artist) => artist.urls.some(
            (urlObj) => urlLower === urlObj.url.toLowerCase() && urlObj.is_active,
        ));

        if (filteredArtists.length === 0) {
            filteredArtists = artists;
        }
    }

    for (const artist of filteredArtists) addDanbooruArtist($(element), artist, options);
}

/**
 * Translate an artist on the given element using the their name
 * @param {HTMLElement} element The element to attach the translations
 * @param {string} artistName The artist name
 * @param {TranslationOptionsFull} options Translation options
 */
async function translateArtistByName (element, artistName, options) {
    if (!artistName) return;

    const artists = await queueNetworkRequestMemoized("artist", artistName.replaceAll(" ", "_"));

    if (artists.length === 0) {
        debuglog(`No artist "${artistName}", rule "${options.ruleName}"`);
        return;
    }

    for (const artist of artists) addDanbooruArtist($(element), artist, options);
}

/** @type {Record<string, JQuery>} */
const renderedArtistsCache = {};

/**
 * @typedef {ResponseArtist & {
 *      prettyName: string,
 *      escapedName: string,
 *      encodedName: string,
 *  }} TranslatedArtist
 * */
/**
 * Attach the artist's translation to the target element
 * @param {JQuery} $target The target element to attach the translation
 * @param {ResponseArtist} rawArtist The artist data
 * @param {TranslationOptionsFull} options Translation options
 */
function addDanbooruArtist ($target, rawArtist, options) {
    const {
        onadded = null,
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
            findTag = TAG_POSITIONS.afterend.findTag,
        } = {},
        ruleName,
    } = options;
    let { classes = "" } = options;

    const artist = {
        ...rawArtist,
        prettyName: rawArtist.name.replaceAll("_", " "),
        escapedName: _.escape(rawArtist.name.replaceAll("_", " ")),
        encodedName: encodeURIComponent(rawArtist.name),
    };

    classes += artist.is_banned ? " ex-artist-tag ex-banned-artist-tag" : " ex-artist-tag";

    const $duplicates = findTag($target)
        .filter((i, el) => el.textContent?.trim() === artist.prettyName);
    if ($duplicates.length > 0) {
        return;
    }

    if (!(artist.id in renderedArtistsCache)) {
        renderedArtistsCache[artist.id] = $(noIndents/* HTML */`
            <div class="${classes}">
                <a href="${BOORU}/artists/${artist.id}" target="_blank">
                    ${artist.escapedName}
                </a>
            </div>
        `);
    }
    const $tag = renderedArtistsCache[artist.id].clone().prop("className", classes);
    if (DEBUG) $tag.attr("rulename", ruleName || "");
    insertTag($target, $tag);
    addTooltip(
        $tag.find("a")[0],
        (tip) => buildArtistTooltip(artist, tip),
    );

    if (onadded) onadded($tag, options);
}

/** @type {(css:string) => CSSStyleSheet} */
const makeStyleSheetMemoized = _.memoize((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
});

/**
 * Universal method to add a content as Shadow DOM
 * @param {JQuery} $target Container for the Shadow DOM
 * @param {JQuery} $content The Shadow DOM content
 * @param {string} css The Shadow DOM CSS
 */
function attachShadow ($target, $content, css) {
    // Return if the target already have shadow
    if ($target.prop("shadowRoot")) return;

    if (_.isFunction(document.body.attachShadow)) {
        const shadowRoot = $target.get(0).attachShadow({ mode: "open" });
        $(shadowRoot).append($content);
        if ("adoptedStyleSheets" in shadowRoot) {
            try {
                shadowRoot.adoptedStyleSheets = [makeStyleSheetMemoized(css)];
                return;
            } catch { /* empty */ }
        }
        GM_addElement(/** @type {any} */(shadowRoot), "style", { textContent: css });
    } else {
        $target.empty().append($content, `<style>${css}</style>`);
    }
}

/**
 * Get a color similar to the background under the element and theme type
 * @param {JQuery} $element The target element
 * @returns {{ theme:"dark"|"light", adjustedColor:string}}
 */
function chooseBackgroundColorScheme ($element) {
    const TRANSPARENT_COLOR = "rgba(0, 0, 0, 0)";
    // Halfway between white/black in the RGB scheme
    const MIDDLE_LUMINOSITY = 128;

    // Get background colors of all parent elements with a nontransparent background color
    const backgroundColors = _.compact($element.parents().addBack()
        .get()
        .map((el) => $(el).css("background-color"))
        .filter((color) => color !== TRANSPARENT_COLOR)
        .reverse()
        .map((color) => color.match(/\d+(\.\d+)?/g)));
    // Calculate summary color and get RGB channels
    let colorChannels = backgroundColors.shift()?.map(Number) ?? [255, 255, 255];
    for (const channels of backgroundColors) {
        // If there is no transparency
        if (colorChannels[3] === 1) break;
        const [r1, g1, b1, al1 = 1] = colorChannels;
        const [r2, g2, b2, al2 = 1] = channels.map(Number);
        colorChannels = [
            r1 * al1 * (1 - al2) + r2 * al2,
            g1 * al1 * (1 - al2) + g2 * al2,
            b1 * al1 * (1 - al2) + b2 * al2,
            al1 * (1 - al2) + al2,
        ];
    }
    // Drop alpha channel
    colorChannels.length = 3;
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

/** @type {Record<string, Promise<JQuery>>} */
const renderedTipsCache = {};

/**
 * Fills the artist tooltip with a content
 * @param {TranslatedArtist} artist The artist data
 * @param {TooltipInstance} tip The tooltip instance
 */
async function buildArtistTooltip (artist, { tooltip, content, target }) {
    if (!(artist.name in renderedTipsCache)) {
        renderedTipsCache[artist.name] = buildArtistTooltipContent(artist);
    }

    if (
        !tooltip.classList.contains("tip-dark")
        && !tooltip.classList.contains("tip-light")
    ) {
        // Select theme and background color based upon the background of surrounding elements
        const { theme, adjustedColor } = chooseBackgroundColorScheme($(target));
        content.classList.add(`tip-content-${theme}`);
        tooltip.classList.add(`tip-${theme}`);
        tooltip.style.setProperty("--bg", adjustedColor);
    }

    target.classList.add("loading-data");
    let $tipContent = await renderedTipsCache[artist.name];
    // For correct work of CORS images must not be cloned at first displaying
    if ($tipContent.parent().length > 0) $tipContent = $tipContent.clone(true, true);
    // eslint-disable-next-line no-use-before-define
    attachShadow($(content), $tipContent, ARTIST_TOOLTIP_CSS);
    target.classList.remove("loading-data");
}

const ARTIST_TOOLTIP_CSS = /* CSS */`
    :host {
        --preview_has_children_color: #35c64a;
        --preview_has_parent_color: #ccaa00;
        --preview_deleted_color: #1e1e2c;
        --preview_pending_color: #0075f8;
        --preview_banned_color: #ed2426;
    }
    :host(.tip-content-dark) {
        --preview_has_children_color: #35c64a;
        --preview_has_parent_color: #fd9200;
        --preview_deleted_color: #ababbc;
        --preview_pending_color: #009be6;
        --preview_banned_color: #ed2426;
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
        padding: 0px;
        max-height: 145px;
        line-height: 1.5em;
    }

    section.urls ul ::marker {
        font-size: 10px;
    }

    section.urls ul li.artist-url-inactive a {
        color: red;
        text-decoration: underline;
        text-decoration-style: dotted;
    }
    :host(.tip-content-dark) section.urls ul li.artist-url-inactive a {
        color: red;
        text-decoration: underline;
        text-decoration-style: dotted;
    }
    .artist-url-icon {
        display: inline-block;
        width: 1.5em;
    }
    .artist-url-icon * {
        width: 1.5em;
        fill: currentColor;
        vertical-align: middle;
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
    :host(.tip-content-dark) a:link, :host(.tip-content-dark) a:visited {
        color: #009be6;
    }
    :host(.tip-content-dark) a:hover {
        color: #4bb4ff;
    }
    :host(.tip-content-dark) a.tag-category-artist {
        color: #ff8a8b;
    }
    :host(.tip-content-dark) a.tag-category-artist:hover {
        color: #ffc3c3;
    }


    /* Thumbnail styles taken from Danbooru */
    article.post-preview {
        /*height: 184px;*/
        width: 184px;
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

    article.post-preview a.post-link {
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

    article.post-preview.post-status-banned a {
        border-color: var(--preview_banned_color);
    }

    article.post-preview.post-status-has-children.post-status-banned a {
        border-color: var(--preview_has_children_color)
                      var(--preview_banned_color)
                      var(--preview_banned_color)
                      var(--preview_has_children_color);
    }

    article.post-preview.post-status-has-parent.post-status-banned a {
        border-color: var(--preview_has_parent_color)
                      var(--preview_banned_color)
                      var(--preview_banned_color)
                      var(--preview_has_parent_color);
    }

    article.post-preview.post-status-has-children.post-status-has-parent.post-status-banned a {
        border-color: var(--preview_has_children_color)
                      var(--preview_banned_color)
                      var(--preview_banned_color)
                      var(--preview_has_parent_color);
    }

    article.post-preview img {
        display: block;
    }

    article.post-preview .post-icon {
        position: absolute;
        top: 0;
        left: 0;
        color: white;
        background-color: rgba(0,0,0,0.7);
        border-radius: 4px;
        font-size: 11px;
        font-family: "Arial", "Helvetica", sans-serif;
        line-height: 1em;
        padding: 2px 4px;
        margin: 2px;
        display: flex;
        align-items: center;
        gap: 0.5ch;
        z-index: 1;
    }
    article.post-preview .post-icon.ai-icon {
        left: auto;
        right: 0;
    }
    article.post-preview .post-icon * {
        height: 1em;
        line-height: 1em;
        fill: currentColor;
        vertical-align: middle;
    }
    article.post-preview .post-icon .animation-icon {
        font-weight: bold;
    }
    article.post-preview .post-icon .ai-generated {
        color: red;
        font-weight: bold;
        margin-bottom: -1px;
    }
    article.post-preview .post-icon .ai-assisted {
        color: orange;
        margin-bottom: -1px;
        margin-left: -1px;
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
        flex-grow: 1;
    }
    div.post-list:empty::after {
        content: "No posts here";
        text-align: center;
        grid-column: 1/4;
    }

    article.post-preview a {
        position: relative;
        display: inline-block;
        /*height: 184px;*/
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

    article.post-preview p a {
        display: inline;
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

/**
 * Builds artist tooltip content
 * @param {TranslatedArtist} artist The artist data
 */
async function buildArtistTooltipContent (artist) {
    const status = SHOW_DELETED ? "status:any" : "-status:deleted";
    const rating = ["https://safebooru.donmai.us", "https://donmai.moe/"].includes(BOORU)
        ? "rating:g"
        : "";

    const waitPosts = queueNetworkRequestMemoized("post", `${artist.name} 1`);
    const waitTotalPostCount = queueNetworkRequestMemoized("count", `${artist.name} status:any`);
    const waitVisiblePostCount = artist.is_banned
        ? Promise.resolve({ counts: { posts: 0 } })
        : queueNetworkRequestMemoized("count", `${artist.name} ${status} ${rating}`.trim());

    // Process the queue immediately
    intervalNetworkHandler();
    const [
        { counts: { posts: visiblePostsCount } } = { counts: { posts: 0 } },
        { counts: { posts: totalPostsCount } } = { counts: { posts: 0 } },
        posts,
    ] = await Promise.all([waitVisiblePostCount, waitTotalPostCount, waitPosts]);

    const otherNames = artist.other_names
        .filter(String)
        .sort()
        .map((otherName) => noIndents/* HTML */`
            <li>
                <a href="${BOORU}/artists?search[name]=${encodeURIComponent(otherName)}"
                   target="_blank">
                    ${_.escape(otherName.replaceAll("_", " "))}
                </a>
            </li>
        `)
        .join("");

    const nextBtnClass = visiblePostsCount <= ARTIST_POST_PREVIEW_LIMIT ? "disabled" : "";
    const lastPage = Math.ceil(visiblePostsCount / ARTIST_POST_PREVIEW_LIMIT);
    const $content = $(noIndents/* HTML */`
        <article class="container" part="container">
            ${GM_getResourceText("settings_icon")}
            <section class="header">
                <a class="artist-name tag-category-artist"
                   href="${BOORU}/artists/${artist.id}"
                   target="_blank">
                    ${_.escape(artist.prettyName)}
                </a>
                <span class="post-count">
                    ${visiblePostsCount}
                    ${totalPostsCount === visiblePostsCount ? "" : `(${totalPostsCount})`}
                </span>

                <ul class="other-names scrollable" part="other-names">
                    ${otherNames}
                </ul>
            </section>
            <section class="urls">
                <h2>
                    URLs
                    (<a href="${BOORU}/artists/${artist.id}/edit" target="_blank">edit</a>)
                </h2>
                <ul class="scrollable" part="url-list"></ul>
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
                    data-last-page="${lastPage}"
                >
                    <div class="btn disabled">&lt;</div>
                    <div class="post-list scrollable" part="post-list"></div>
                    <div class="btn ${nextBtnClass}">&gt;</div>
                </div>
            </section>
        </article>
    `);
    $content.find(".urls ul").append(...buildArtistUrls(artist));
    $content.find(".post-list")
        // prevent width change on posts pagination
        .css("width", `${Math.min(visiblePostsCount, ARTIST_POST_PREVIEW_LIMIT, 3) * 194 - 8}px`)
        .append(...posts.map(buildPostPreview));
    $content.find(".settings-icon").click(showSettings);
    $content.find(".btn").click(loadNextPage);
    return $content;
}

/**
 * Format artist urls
 * @param {TranslatedArtist} artist The artist data
 */
function buildArtistUrls (artist) {
    const artistUrls = _(artist.urls)
        .chain()
        .uniq("url")
        .map((artistUrl) => ({ ...artistUrl, siteName: getSiteName(artistUrl.url) }))
        // @ts-expect-error - incorrect definition in library
        .sort((u1, u2) => naturalCompare(u1.url, u2.url))
        .sortBy((artistUrl) => isSecondaryUrl(artistUrl.url))
        .sortBy((artistUrl) => getSiteDisplayDomain(artistUrl.url))
        .sortBy((artistUrl) => getSitePriority(artistUrl.siteName))
        .sortBy((artistUrl) => !artistUrl.is_active);

    return artistUrls
        .map((artistUrl) => {
            const normalizedUrl = artistUrl.url.replace(/\/$/, "");
            const urlClass = artistUrl.is_active ? "artist-url-active" : "artist-url-inactive";
            const iconUrl = getSiteIconUrlMemoized(artistUrl.siteName, artistUrl.url);

            const item = $(noIndents/* HTML */`
                <li class="${urlClass}">
                    <a href="${normalizedUrl}" target="_blank">
                        <span class="artist-url-icon"></span> ${_.escape(normalizedUrl)}
                    </a>
                </li>
            `);

            iconUrl?.then((url) => {
                item.find(".artist-url-icon").append(
                    // we have to insert globe_icon as is because it's svg and we style it
                    url ? `<img src="${url}">` : GM_getResourceText("globe_icon"),
                );
            });
            return item;
        })
        .value();
}

/**
 * Format time in relative form
 * @param {number|string} time Timestamp
 */
function timeToAgo (time) {
    const interval = new Date(Date.now() - new Date(time).getTime());
    if (interval.getTime() < 60_000) return "less than a minute ago";
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
    if (rank?.value) {
        return `${rank.value} ${rank.unit}${rank.value > 1 ? "s" : ""} ago`;
    }
    return "∞ ago";
}

/**
 * Format time in MM:SS format
 * @param {number} seconds
 */
function formatDuration (seconds) {
    const sec = Math.round(seconds) || 1;

    const mm = Math.floor(sec / 60 % 60);
    const ss = String(sec % 60).padStart(2, "0");

    return `${mm}:${ss}`;
}

/**
 * Format file size in CI units
 * @param {number} bytes
 * @see https://stackoverflow.com/questions/15900485
 */
function formatBytes (bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Number.parseFloat((bytes / (1024 ** i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format the post tags
 * @param {ResponsePosts} post The post data
 */
function formatTagString (post) {
    return _([
        post.tag_string_artist,
        post.tag_string_copyright,
        post.tag_string_character,
        post.tag_string_meta,
        post.tag_string_general,
    ])
        .chain()
        .compact()
        .map(_.escape)
        .join("\n")
        .value();
}

/**
 * Format the post image info
 * @param {ResponsePosts} post The post data
 */
function formatImageInfo (post) {
    if (![
        post.media_asset.file_size,
        post.media_asset.image_width,
        post.media_asset.image_height,
    ].every(_.isFinite)) {
        return "";
    }
    return `${formatBytes(post.media_asset.file_size)}
        .${post.media_asset.file_ext},
        <a href="${BOORU}/media_assets/${post.media_asset.id}">
            ${post.media_asset.image_width}x${post.media_asset.image_height}
        </a>`;
}

/**
 * Extract the post preview info
 * @param {ResponsePosts} post The post data
 */
function getPostPreview (post) {
    const hiDpi = window.devicePixelRatio > 1;
    const size = hiDpi ? "360x360" : "180x180";
    const scale = hiDpi ? 0.5 : 1;
    const previewAsset = post.media_asset.variants?.find((variant) => variant.type === size);

    const info = previewAsset
        ? {
            url: previewAsset.url,
            safeUrl: /** @type {Promise<string>|null} */(null),
            width: previewAsset.width * scale,
            height: previewAsset.height * scale,
        }
        : {
            url: post.media_asset.file_ext === "swf"
                ? `${BOORU}/images/flash-preview.png`
                : `https://cdn.donmai.us/images/download-preview.png`,
            safeUrl: /** @type {Promise<string>|null} */(null),
            width: 180,
            height: 180,
        };

    if (DOMAIN_USES_CSP) {
        info.safeUrl = getImage(info.url);
        // transparent 1x1 image
        info.url = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    }
    return info;
}

/**
 * Get icons for a post
 * @param {ResponsePosts} post The post data
 */
function buildPostIcons (post) {
    const hasSound = /\bsound\b/.test(post.tag_string_meta);
    const soundIcon = hasSound ? GM_getResourceText("sound_icon") : "";
    const animationIcon = post.media_asset.duration
        ? noIndents/* HTML */`
            <div class="post-icon animation-icon"
                 title="Animated post ${hasSound ? "with a sound" : ""}"
            >
                <span class="post-duration">
                    ${formatDuration(post.media_asset.duration)}
                </span>
                ${soundIcon}
            </div>
        `
        : "";

    const aiIcon = /\bai-generated\b/.test(post.tag_string_meta)
        ? /* HTML */`
            <div class="post-icon ai-icon" title="AI generated image">
                    <span class="ai-generated">AI</span>
            </div>
        `
        : (/\bai-assisted\b/.test(post.tag_string_meta)
            ? /* HTML */`
                <div class="post-icon ai-icon" title="AI assisted image">
                    <span class="ai-assisted">+AI</span>
                </div>
            `
            : "");
    return animationIcon + aiIcon;
}

/**
 * Build the post preview
 * @param {ResponsePosts} post The post data
 */
function buildPostPreview (post) {
    const RATINGS = {
        g: 0,
        s: 1,
        q: 2,
        e: 3, // eslint-disable-line id-blacklist
    };

    let previewClass = "post-preview";
    if (post.is_pending)           previewClass += " post-status-pending";
    if (post.is_flagged)           previewClass += " post-status-flagged";
    if (post.is_deleted)           previewClass += " post-status-deleted";
    if (post.is_banned)            previewClass += " post-status-banned";
    if (post.parent_id)            previewClass += " post-status-has-parent";
    if (post.has_visible_children) previewClass += " post-status-has-children";
    if (RATINGS[post.rating] > RATINGS[SHOW_PREVIEW_RATING]) {
        previewClass += " blur-post";
    }

    const dataAttributes = `
      data-id="${post.id}"
      data-tags="${formatTagString(post)}"
    `;

    const preview = getPostPreview(post);

    const sourceUrl = /^https?:\/\//.test(post.source) ? normalizeSourceURL(post.source) : null;
    const domain = sourceUrl
        ? `<a href="${_.escape(sourceUrl)}" target="_blank">${getSiteDisplayDomain(sourceUrl)}</a>`
        : `<span title="${_.escape(post.source)}">NON-WEB</span>`;

    const $preview = $(noIndents/* HTML */`
        <article itemscope
                 itemtype="http://schema.org/ImageObject"
                 class="${previewClass}"
                 ${dataAttributes} >
            <a class="post-link" href="${BOORU}/posts/${post.id}" target="_blank">
                ${buildPostIcons(post)}
                <img width="${preview.width}"
                     height="${preview.height}"
                     src="${preview.url}"
                     title="${formatTagString(post)}"
                     referrerpolicy="origin"
                     part="post-preview rating-${post.rating}">
            </a>
            <p>${formatImageInfo(post)}</p>
            <p>${domain}, rating:${post.rating.toUpperCase()}</p>
            <p>${timeToAgo(post.created_at)}</p>
        </article>
    `);

    preview.safeUrl?.then((url) => {
        $preview.find("img").prop("src", url);
    });

    return $preview;
}

/**
 * Load a neighbor page of posts
 * @param {JQuery.Event} ev Event of pressing the button
 */
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
    const waitPosts = queueNetworkRequestMemoized("post", `${tag} ${page}`);
    // Process the queue immediately
    intervalNetworkHandler();
    const posts = await waitPosts;
    $container.removeClass("loading");
    $container.find(".post-list").empty().append(...posts.map(buildPostPreview));
}

function showSettings () {
    /**
     * Generate input for a setting
     * @param {typeof SETTINGS_SCHEMA[number]} setting
     */
    function settingToInput (setting) {
        const value = SETTINGS.get(setting.name);
        switch (setting.type) {
            case "number":
                return noIndents/* HTML */`
                    <input type="number"
                           min="0"
                           value="${value}"
                           name="${setting.name}"
                    />
                `;
            case "list": {
                const options = Object
                    .entries(setting.values)
                    .map(([val, descr]) => noIndents/* HTML */`
                        <option value="${val}" ${val === value ? "selected" : ""}>
                            ${descr}
                        </option>
                    `)
                    .join("");

                return noIndents/* HTML */`
                    <select name="${setting.name}">
                        ${options}
                    </select>
                `;
            }
            case "boolean":
                return noIndents/* HTML */`
                    <input type="checkbox"
                           ${value ? "checked" : ""}
                           name="${setting.name}"
                    />
                `;
            default:
                // @ts-expect-error - here `type` is `never`
                console.error(`[TPT]: Unsupported type ${setting.type}`);
                return "";
        }
    }

    const $shadowContainer = $("<div id=ex-settings>").appendTo("body");

    function closeSettings () {
        $shadowContainer.remove();
        $(document).off("keydown", closeSettingsOnEscape);
    }

    /** @param {JQuery.Event} ev */
    function closeSettingsOnEscape (ev) {
        if (ev.key === "Escape" && !ev.altKey && !ev.ctrlKey && !ev.shiftKey) {
            closeSettings();
            return false;
        }
        return true;
    }

    const styles = /* CSS */`
        #ui-settings {
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 3100000;
        }
        #ui-settings.tip-dark {
            background: rgba(0,0,0,0.75);
        }
        .container {
            font-family: Verdana, Helvetica, sans-serif;
            padding: 20px;
            display: grid;
            grid-template-columns: 300px 1fr;
            grid-gap: 10px;
            font-size: 12px;
        }
        .tip-light .container {
            background-color: #fff;
            color: #222;
        }
        .tip-dark .container {
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
    const $settings = $(noIndents/* HTML */`
        <div id="ui-settings">
            <div class="container">
                <h2>Translate Pixiv Tags settings</h2>
                ${SETTINGS_SCHEMA
                    .map((setting) => noIndents/* HTML */`
                        <div>${setting.descr}:</div>
                        <div>${settingToInput(setting)}</div>
                    `)
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
            } else if (/** @type {string} */($input.prop("type")) === "number") {
                value = Number($input.val());
            } else if (/** @type {string} */($input.prop("type")) === "checkbox") {
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

    const { theme } = chooseBackgroundColorScheme($("body"));
    $settings.addClass(`tip-${theme}`);

    attachShadow($shadowContainer, $settings, styles);
}

/** @type {JQuery} */
let $messageContainer;

/** @param {string} msg */
function showMessage (msg) {
    if ($messageContainer) {
        if ($messageContainer.find("#msg").text() === msg) return;
        $messageContainer.toggleClass("hide", !msg).find("#msg").text(msg);
        return;
    }
    if (!$messageContainer && !msg) return;

    const $shadowContainer = $("<div id=ex-message>").appendTo("body");

    const styles = /* CSS */`
        #ui-message {
            width: 100vw;
            height: 0;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            position: relative;
            z-index: 3100000;
        }
        .container {
            font-family: Verdana, Helvetica, sans-serif;
            padding: 20px;
            font-size: 12px;
            opacity: 1;
            transform: translateY(20px);
            transition: all 0.5s;
            box-shadow: 0 0 50px #f00;
        }
        .hide .container {
            opacity: 0;
            transform: translateY(-100%);
        }
        .tip-light .container {
            background-color: #fff;
            border: 1px solid #888;
            color: #222;
        }
        .tip-dark .container {
            background-color: #222;
            border: 1px solid #888;
            color: #fff;
        }
        .container h2 {
            margin: auto;
        }
        input[type="button"] {
            margin: 0 5px;
        }

        .settings-icon {
            position:absolute;
            top: 5px;
            right: 5px;
            width: 16px;
            height: 16px;
            cursor: pointer;
        }
        .settings-icon path {
            fill: #888;
        }
    `;
    $messageContainer = $(noIndents/* HTML */`
        <div id="ui-message" class="hide">
            <div class="container">
                Translate Pixiv Tags: <span id="msg"></span>
                <input class="close" type="button" value="Close" />
                ${GM_getResourceText("settings_icon")}
            </div>
        </div>
    `);

    $messageContainer.find(".settings-icon").click(showSettings);
    $messageContainer.find(".close").click(() => $messageContainer.addClass("hide"));

    const { theme } = chooseBackgroundColorScheme($("body"));
    $messageContainer.addClass(`tip-${theme}`);

    attachShadow($shadowContainer, $messageContainer, styles);

    showMessage(msg);
}

/**
 * Light/dark theme switching:
 * artstation - dark only
 * bcy - light only?
 * deviantart - body.theme-dark/theme-light
 * hentai-foundry - dark only?
 * nico seiga - light only
 * nijie - css file, full reload
 * pawoo - body.theme-default/?
 * pixiv - html[data-theme=default/dark]
 * tinami - light only?
 * twitter, tweetdeck - body[style] + body[data-nightmode=true/false]
 * saucenao - dark only
 * @param {HTMLElement} elem The element that contains theme info
 * @param {string} attr The attribute name with the theme info
 * @param {(el:HTMLElement) => string} themeExtractor Theme getter
 */
function watchSiteTheme (elem, attr, themeExtractor) {
    /** @type {string} */
    let theme;
    function updateTheme () {
        const newTheme = themeExtractor(elem);
        if (newTheme === theme) return;
        theme = newTheme;
        $(":root").removeClass("tpt-dark tpt-light tpt-auto")
            .addClass(`tpt-${theme}`);
        debuglog(`theme changed to ${theme}`);
    }

    // eslint-disable-next-line unicorn/no-array-for-each
    new MutationObserver((mutations) => mutations.forEach(updateTheme))
        .observe(elem, {
            attributeFilter: [attr],
        });
    updateTheme();
}

/**
 * @typedef {object} TranslationOptions
 * @prop {"tag" | "artist" | "artistByName"} mode Method of translating
 * @prop {string} ruleName Just a name of rule for translations
 * @prop {boolean} [asyncMode] Watch for new entries to translate, by default - no
 * @prop {string | null} [requiredAttributes] Required attributes on the element
 * @prop {string | ((el:HTMLElement) => boolean) | null} [predicate]
 *  Checks whether the element is translatable
 * @prop {(el:HTMLElement) => string | string[] | null} [toProfileUrl]
 *  Extracts the link to the profile from the element, by default - `href` from closest `<a>`
 * @prop {(el:HTMLElement) => string | null} [toTagName]
 *  Extracts the tag name from the element, by default - the element's text
 * @prop {TagPosition} [tagPosition]
 *  Methods for inserting and retrieving the tag element relatively to the
 *  matched element, by default it's `afterend`
 * @prop {string} [classes] Extra classes to add to the tag element
 * @prop {string} [css] General piece of CSS related to this rule
 * @prop {(($el:JQuery, options: Required<TranslationOptions>) => void) | null} [onadded]
 *  Handler for the added tag elements
 */
/** @typedef {Required<TranslationOptions>} TranslationOptionsFull */

/**
 * Add translations to the matched elements
 * @template {TranslationOptions["mode"]} T
 * @param {T} mode Method of translating the element
 * @param {string|HTMLElement} selector Simple selector of the translated element.
 *  Max example: `div.class#id[attr][attr2=val], *[attr3~="part"][attr4='val']`
 * @param {T extends "artist"
 *  ? Omit<TranslationOptions, "mode"|"toTagName">
 *  : Omit<TranslationOptions, "mode"|"toProfileUrl">
 * } [options] Extra options for translating
 */
function findAndTranslate (mode, selector, options) {
    /** @type {TranslationOptionsFull} */
    const fullOptions = {
        asyncMode: false,
        requiredAttributes: null,
        predicate: null,
        toProfileUrl: /** @type {(el:HTMLElement)=>any} */((el) => $(el).closest("a").prop("href")),
        toTagName: (el) => el.textContent,
        tagPosition: TAG_POSITIONS.afterend,
        classes: "",
        css: "",
        onadded: null,
        ruleName: "<not provided>",
        mode,
        ...options,
    };

    const canTranslate = (typeof fullOptions.predicate === "string")
        ? (/** @type {HTMLElement} */el) => $(el).is(/** @type {string} */(fullOptions.predicate))
        : fullOptions.predicate ?? (() => true);

    const { translate, getData } = {
        artist: {
            translate: translateArtistByURL,
            getData: fullOptions.toProfileUrl,
        },
        artistByName: {
            translate: translateArtistByName,
            getData: fullOptions.toTagName,
        },
        tag: {
            translate: translateTag,
            getData: fullOptions.toTagName,
        },
    }[mode];

    /** @param {Node} elem */
    const tryToTranslate = (elem) => {
        if (!(elem instanceof HTMLElement)) return;
        if (!canTranslate(elem)) return;
        const data = getData(elem);
        if (Array.isArray(data)) {
            // eslint-disable-next-line unicorn/no-array-for-each
            data.forEach((item) => translate(elem, item, fullOptions));
        } else if (data) {
            translate(elem, data, fullOptions);
        }
    };

    if (fullOptions.css) GM_addStyle(fullOptions.css);

    $(selector).each((i, elem) => tryToTranslate(elem));

    if (!fullOptions.asyncMode) return;

    /** @type {Query} */
    const query = { element: /** @type {string} */(selector) };
    if (fullOptions.requiredAttributes) query.elementAttributes = fullOptions.requiredAttributes;
    new MutationSummary({
        rootNode: document.body,
        queries: [query],
        callback: ([summary]) => {
            let elements = summary.added;
            if (summary.attributeChanged) {
                elements = [...elements, ...Object.values(summary.attributeChanged).flat(1)];
            }
            // eslint-disable-next-line unicorn/no-array-for-each
            elements.forEach(tryToTranslate);
        },
    });
}

/**
 * Delete the tag element when the target element will change url (`href`)
 * @param {JQuery} $tag The tag to remove
 * @param {TranslationOptionsFull} options Translation options
 */
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

/**
 * When the tag is inside another <a>, prevents soft navigation by the outer link
 * @param {JQuery} $el
 */
const preventSiteNavigation = ($el) => $el.click((ev) => ev.stopPropagation());

/**
 * Find and get link in child elements
 * @param {HTMLElement} el The parent element
 * @returns {string}
 */
function linkInChildren (el) {
    return $(el).find("a").prop("href");
}

/* https://twitter.com/search?q=%23ガルパン版深夜のお絵描き60分一本勝負 */
/* #艦これ版深夜のお絵描き60分一本勝負 search query for TweetDeck */
const COMMON_HASHTAG_REGEXPS = [
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
/**
 * Get tag name without common prefixes or suffixes
 * @param {HTMLElement} el The target element
 */
const getNormalizedHashtagName = (el) => {
    const tagName = el.textContent;
    // eslint-disable-next-line no-restricted-syntax
    for (const regexp of COMMON_HASHTAG_REGEXPS) {
        const normalizedTagName = tagName?.replace(regexp, "") ?? null;
        if (normalizedTagName !== tagName) {
            if (normalizedTagName !== "") {
                return normalizedTagName;
            }
            break;
        }
    }
    return tagName;
};

/**
 * Normalize profile url for soc.net. like Mastodon or Misskey
 * @param {HTMLElement} el The target element
 */
const getNormalizedDecentralizedSocNetUrl = (el) => {
    const fullName = el.textContent?.trim() ?? "";

    // eslint-disable-next-line max-len
    const [, name, host = window.location.host] = matchMemoized(fullName, /^@(\w+)(?:@([\w.-]+))?$/) || [];

    return name ? `https://${host}/@${name}` : null;
};

function initializePixiv () {
    watchSiteTheme(document.documentElement, "data-theme", (html) => {
        switch (html.dataset.theme) {
            case "dark": return "dark";
            case "default": return "light";
            default: return "auto";
        }
    });

    // To remove something like `50000users入り`, e.g. here https://www.pixiv.net/en/artworks/68318104
    /** @param {HTMLElement} el */
    const getNormalizedTagName = (el) => el.textContent?.replace(/\d+users入り$/, "") ?? null;

    findAndTranslate("tag", [
        // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=123456
        ".work-tags-container .tag",
        // https://www.pixiv.net/tags.php
        // https://www.pixiv.net/novel/tags.php
        ".tag-list li .tag-value",
    ].join(", "), {
        toTagName: getNormalizedTagName,
        css: /* CSS */`
            /* Display popular tags as vertical list */
            .tag-list.slash-separated li {
                display: block;
            }
            .tag-list.slash-separated li + li:before {
                content: none;
            }
        `,
        ruleName: "simple tags",
    });

    // https://dic.pixiv.net/a/東方
    findAndTranslate("tag", "#article-content-header #article-name", {
        tagPosition: TAG_POSITIONS.beforeend,
        toTagName: getNormalizedTagName,
        classes: "tpt-light",
        ruleName: "wiki tag",
    });

    // Tags on work pages: https://www.pixiv.net/en/artworks/66475847
    findAndTranslate("tag", "span", {
        predicate: "figcaption li > span > span:first-child",
        toTagName: getNormalizedTagName,
        asyncMode: true,
        css: /* CSS */`
            /* Prevent adding # to translated tags */
            span.ex-translated-tags a::before { content:none; }
            /* Hide Pixiv's translated tags */
            .ex-translated-tags + span .gtm-new-work-romaji-tag-event-click,
            .ex-translated-tags + span .gtm-new-work-translate-tag-event-click {
                display: none;
            }
        `,
        ruleName: "artwork tags",
    });

    // Main tag on search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    findAndTranslate("tag", "div", {
        // eslint-disable-next-line max-len
        predicate: "#__next>div>div>div>div>div>div>div:nth-last-of-type(2)>div>div:has(>span:first-child)",
        asyncMode: true,
        css: /* CSS */`
            .ex-translated-tags[rulename='search tag'] {
                font-size: 20px;
                font-weight: bold;
                align-self: center;
                & + div { display: none; }
            }`,
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
        asyncMode: true,
        classes: "no-brackets tpt-light",
        css: /* CSS */`
            /* Hide Pixiv's translated tags */
            .ex-translated-tags + div:not(:last-child) {
                display: none;
            }
            .ex-translated-tags + div:last-child {
                font-weight: normal;
                font-size: 10px;
            }
            a[color] {
                text-shadow: 0 0 5px #0003;
            }
            a[color] > div:not(#id) {
                max-width: initial;
            }
            a[color] > div > .ex-translated-tags a {
                font-weight: bold;
                text-shadow: 0 0 5px #fff4;
            }
            a[color] > div > .ex-translated-tags a.ex-translated-tag-category-5:not(#id) {
                color: #794906 !important;
            }
            a[color] > div > .ex-translated-tags a.ex-translated-tag-category-4:not(#id) {
                color: #008020 !important;
            }
            a[color] > div > .ex-translated-tags a.ex-translated-tag-category-0:not(#id) {
                color: #003cb3 !important;
            }
        `,
        // Fix bad contrast of tag color over colored bg
        onadded: ($tag) => {
            preventSiteNavigation($tag);
            const [category] = $tag.find("a").prop("className").match(/\d/) ?? [];
            const hue = [230, 5, 0, 300, 110, 50][category];
            $tag.closest("section,ul")
                .find("a[color]:not([style])")
                .css("background-color", () => `hsl(${Math.random() * 40 + 150}, 35%, 65%)`);
            $tag.closest("a")
                .css("background-color", `hsl(${hue + Math.random() * 40 - 20}, 35%, 65%)`);
        },
        ruleName: "related tag",
    });

    // Popular tags on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("tag", "div", {
        predicate: "a.gtm-toppage-tag-popular-tag-illustration>div>div:first-child>div:only-child",
        tagPosition: TAG_POSITIONS.beforebegin,
        asyncMode: true,
        classes: "no-brackets dark-shadow",
        css: /* CSS */`
            .ex-translated-tags[rulename='popular tag'] {
                text-shadow: 0 0 3px #000B;
                & + div { display: none }
            }
        `,
        onadded: preventSiteNavigation,
        ruleName: "popular tag",
    });

    // Tag of recommended posts on index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("tag", "h2", {
        predicate: "section > div > div > h2",
        toTagName: (el) => (el.textContent?.includes("#")
            ? el.textContent.slice(el.textContent.indexOf("#") + 1).replaceAll(" ", "_")
            : null),
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        ruleName: "tag of recommended posts",
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
        css: /* CSS */`
            /* Locate artist tag without triggering native tooltip */
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
        `,
        ruleName: "illust artist",
    });

    // Related work's artists https://www.pixiv.net/en/artworks/66475847
    // New search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    // Bookmarks: https://www.pixiv.net/en/users/29310/bookmarks/artworks
    // Thumbs on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    // Posts of followed artists: https://www.pixiv.net/bookmark_new_illust.php
    findAndTranslate("artist", "a", {
        // eslint-disable-next-line max-len
        predicate: "section ul>*>div>div:last-child>div[aria-haspopup]>a",
        tagPosition: TAG_POSITIONS.afterParent,
        asyncMode: true,
        css: /* CSS */`
            .ex-artist-tag[rulename='artist below illust thumb'] {
                margin-left: 6px;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                /* Fix artist tag overflowing */
                ul>*>div>div:last-child:has(>&) {
                    flex-direction: column;
                    align-items: flex-start;
                }
            }
        `,
        ruleName: "artist below illust thumb",
    });

    // Artist profile pages: https://www.pixiv.net/en/users/29310, https://www.pixiv.net/en/users/104471/illustrations
    const normalizePageUrl = () => `https://www.pixiv.net/en/users/${safeMatchMemoized(window.location.pathname, /\d+/)}`;
    findAndTranslate("artist", "h1", {
        predicate: () => !!safeMatchMemoized(window.location.pathname, /^(\/en)?\/users\/\d+/),
        toProfileUrl: normalizePageUrl,
        asyncMode: true,
        css: /* CSS */`
            /**
             * Locate the artist tag between the artist name and
             * followers count because there can be "premium" and
             * "accepting requests" labels to the right of the artist name
             */
            div:has(> h1 + .ex-artist-tag):not(:has(p)) {
                display: grid;
                grid-gap: 4px;
                grid-auto-rows: 16px;
                grid-template-columns: auto auto 1fr;
                justify-items: start;
                .ex-artist-tag {
                    grid-row-start: 2;
                }
            }
        `,
        ruleName: "artist profile",
    });

    // Deleted artist profile: https://www.pixiv.net/en/users/1843825
    // findAndTranslate("artist", "h1", {
    //     predicate: "#root>div>div>div>h1",
    //     asyncMode: true,
    //     // Trigger only on profile page
    //     toProfileUrl: () => (safeMatchMemoized(window.location.pathname, /^\/(en\/)?users/)
    //         ? normalizePageUrl()
    //         : ""),
    //     tagPosition: TAG_POSITIONS.beforebegin,
    //     ruleName: "deleted artist profile",
    // });

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
        css: /* CSS */`
            .ex-artist-tag[rulename="recommended artist"] {
                line-height: 0;
            }
        `,
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

    // Booth items of artist you follow on the index page:
    // https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("artist", "div", {
        // eslint-disable-next-line max-len
        predicate: "a.gtm-toppage-thumbnail-illustration-booth-following + div>div:has(>div[title]>a)",
        tagPosition: TAG_POSITIONS.afterend,
        classes: "inline",
        toProfileUrl: linkInChildren,
        asyncMode: true,
        ruleName: "booth item artist",
    });
}

function initializeNijie () {
    // http://nijie.info/view.php?id=208491
    findAndTranslate("artist", "#pro .user_icon .name, .popup_member > a, #login_illust_detail a", {
        classes: "inline",
        ruleName: "artist",
    });

    // https://nijie.info/view.php?id=325606
    findAndTranslate("artist", "#dojin_left > .right > :first-child > a", {
        classes: "inline",
        ruleName: "dojin artist",
    });

    // http://nijie.info/view.php?id=208491
    findAndTranslate("tag", ".tag .tag_name a:first-child", {
        tagPosition: TAG_POSITIONS.beforeend,
        css: /* CSS */`
            .ex-translated-tags {
                font-family: Verdana, Helvetica, sans-serif;
            }
            #dojin_left #view-tag .tag {
                white-space: nowrap;
                border: 0;
            }
        `,
        ruleName: "illust tags",
    });

    // https://nijie.info/dic/seiten/d/東方
    findAndTranslate("tag", "#seiten_dic h1#dic_title", {
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "tag page",
    });
}

function initializeTinami () {
    // http://www.tinami.com/view/1165789
    findAndTranslate("tag", ".tag > span > a:nth-child(2)", {
        css: /* CSS */`
            .ex-translated-tags {
                font-family: Verdana, Helvetica, sans-serif;
                float: none !important;
                display: inline !important;
            }
        `,
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
        css: /* CSS */`
            /* When authorized */
            .illust_tag .tag {
                background: #ebebeb;
                height: auto;
                margin: 0 10px 5px 0;
            }
        `,
        ruleName: "illust tags",
    });

    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate("artist", ".user_info h1 a", {
        classes: "inline",
        css: /* CSS */`
            .im_head_bar .inner .user ul .user_link .ex-artist-tag a {
                display: inline-block;
                border: none;
                background: none;
                padding: 0;
            }
        `,
        ruleName: "illust artist",
    });

    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate("artist", "div.lg_txt_illust:has(strong)", {
        classes: "inline",
        tagPosition: TAG_POSITIONS.beforeend,
        toProfileUrl: () => $("a:has(.pankuzu_suffix)").prop("href"),
        ruleName: "illust artist anon",
    });

    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate("artist", ".user_link > a .user_name", {
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist profile",
    });
}

function initializeDeviantArt () {
    watchSiteTheme(document.body, "class", (body) => (
        body.classList.contains("theme-dark") ? "dark" : "light"
    ));

    // Profile page
    // https://www.deviantart.com/adsouto
    findAndTranslate("artist", "h1", {
        toProfileUrl: linkInChildren,
        predicate: "h1:has(>a.user-link)",
        asyncMode: true,
        css: /* CSS */`
            .ex-artist-tag {
                font-weight: bold;
            }
            .ex-artist-tag[rulename='artist profile'] {
                margin-top: -10px;
            }
        `,
        ruleName: "artist profile",
    });

    // Post page
    // https://www.deviantart.com/koyorin/art/Ruby-570526828
    findAndTranslate("artist", "a.user-link", {
        toProfileUrl: (a) => /** @type {HTMLAnchorElement} */(a).href.replace("/gallery", ""),
        predicate: "main>*>:nth-child(3) :nth-child(2) > a.user-link:not(:has(img))",
        requiredAttributes: "href",
        tagPosition: TAG_POSITIONS.afterParent,
        asyncMode: true,
        onadded: deleteOnUrlChange,
        classes: "inline",
        css: /* CSS */`
            .ex-artist-tag[rulename='illust artist'] {
                margin-left: -0.5em;
            }
            .ex-artist-tag[rulename='illust artist'] + button {
                margin-left: 1em;
            }
        `,
        ruleName: "illust artist",
    });

    // Popup card
    findAndTranslate("artist", "a.user-link", {
        predicate: "body > .popper-portal a.user-link:not(:has(img))",
        asyncMode: true,
        classes: "tpt-light",
        ruleName: "artist popup",
    });

    findAndTranslate("tag", "span", {
        predicate: "a[href^='https://www.deviantart.com/tag/'] > span:first-child",
        asyncMode: true,
        css: /* CSS */`
            /* fix cropped long tags */
            a[href^='https://www.deviantart.com/tag/'] {
                max-width: initial;
            }
        `,
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

    // Other tabs https://www.hentai-foundry.com/pictures/user/DrGraevling
    findAndTranslate("artist", ".breadcrumbs a[href^='/user/']", {
        classes: "inline",
        ruleName: "sub-profile tab",
    });
}

function initializeTwitter () {
    watchSiteTheme(document.body, "style", (body) => (
        chooseBackgroundColorScheme($(body)).theme
    ));

    GM_addStyle(/* CSS */`
        .ex-artist-tag {
            font-family: system-ui, -apple-system, BlinkMacSystemFont,
                "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif;
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
    /** @param {Node} elem */
    const watchForChanges = (elem) => {
        if (!(elem instanceof HTMLElement)) return;
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
        // eslint-disable-next-line unicorn/no-array-for-each
        callback: ([summary]) => summary.added.forEach(watchForChanges),
    });

    // Deleted channel https://twitter.com/6o2_iii
    findAndTranslate("artist", "span.r-qvutc0", {
        predicate: ".r-135wba7.r-3s2u2q span.r-1vr29t4 > .r-qvutc0:not(:empty)",
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
        classes: "inline",
        css: /* CSS */`
            /* "in this photo", people in sidebar */
            [data-testid='UserCell'] .ex-artist-tag {
                display: block;
                margin-left: 0;
            }
        `,
        ruleName: "tweet/comment author",
    });

    // Quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
    findAndTranslate("artist", "div.r-1wvb978", {
        predicate: "[data-testid=User-Name] [tabindex]:not([role]) > div",
        toProfileUrl: (el) => `https://twitter.com/${el.textContent?.slice(1)}`,
        asyncMode: true,
        classes: "inline",
        css: /* CSS */`
            [data-testid=User-Name] [tabindex]:not([role]) {
                flex-direction: row;
            }
        `,
        ruleName: "quoted tweet author",
    });

    // User card info
    findAndTranslate("artist", "a", {
        predicate: "div.r-nsbfu8 a + div a",
        tagPosition: TAG_POSITIONS.afterParent,
        asyncMode: true,
        ruleName: "artist popup",
    });
}

function initializeArtStation () {
    /** @param {string|null} ref */
    const getArtistName = (ref) => {
        if (!ref) return "";
        if (ref.startsWith("/")) {
            const word = ref.match(/[\w-]+/i);
            if (word) return word[0];
        } else if (ref.startsWith("https://www")) {
            const word = ref.match(/artstation\.com\/([\w-]+)/i);
            if (word) return word[1];
        } else if (ref.startsWith("https://")) {
            const word = ref.match(/\/\/([\w-]+)\.artstation\.com/i);
            if (word) return word[1];
        }
        return "";
    };

    /** @param {HTMLElement} el */
    function toFullURL (el) {
        let artistName = getArtistName(el.getAttribute("href"))
             || getArtistName(window.location.href);
        if (artistName === "artwork") artistName = "";
        if (!artistName) {
            return "";
        }

        return `https://www.artstation.com/${artistName}`;
    }

    // https://www.artstation.com/jubi
    // https://www.artstation.com/jubi/*
    findAndTranslate("artist", "h1", {
        predicate: ".user-info > h1",
        toProfileUrl: toFullURL,
        asyncMode: true,
        css: /* CSS */`
            .ex-artist-tag[rulename='artist profile'] {
                margin: -8px 0 2px;
            }
        `,
        ruleName: "artist profile",
        // The artist name is removed when the profile page is a bit scrolled
        onadded: ($tag) => {
            const h1 = $tag.prev().get(0);
            const container = $tag.parent().get(0);
            new MutationObserver((_, observer) => {
                if (!container.contains(h1)) {
                    $tag.remove();
                    observer.disconnect();
                }
            }).observe(container, { childList: true });
        },
    });

    // https://www.artstation.com/artwork/0X40zG
    findAndTranslate("artist", "h3", {
        predicate: ".project-author-name > h3:has(a)",
        tagPosition: TAG_POSITIONS.afterend,
        toProfileUrl: linkInChildren,
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
        predicate: (el) => el.matches(".hover-card-name > a:first-child"),
        asyncMode: true,
        css: /* CSS */`
            .ex-artist-tag[rulename='artist popup'] {
                font-size: 12pt;
                margin-top: -10px;
            }
        `,
        ruleName: "artist popup",
    });

    // https://www.artstation.com/jubi/following
    // https://www.artstation.com/jubi/followers
    findAndTranslate("artist", "h3.user-name", {
        asyncMode: true,
        classes: "inline",
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
        css: /* CSS */`
            .ex-artist-tag[rulename='personal sites'] {
                font-size: 12pt;
                line-height: 100%;
                margin-top: -10px;
            }
            .ex-artist-tag[rulename='personal sites'] a {
                font-size: 12pt;
            }
        `,
        ruleName: "personal sites",
    });
}

function initializeSauceNAO () {
    $(".resulttitle, .resultcontentcolumn")
        .contents()
        .filter((i, el) => el.nodeType === 3) // Get text nodes
        .replaceWith(function fn () {
            return $(this)
                .text()
                .split(", ")
                .map((str) => `<span class="target">${str}</span>`)
                .join(", ");
        });

    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2F5e%2F8e%2F5e8e7a03c49906aaad157de8aeb188e4.jpg
    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2Fad%2F90%2Fad90ad1cc3407f03955f22b427d21707.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fmedibangpaint.com%2Fwp-content%2Fuploads%2F2015%2F05%2Fgallerylist-04.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fpastyle.net%2FPLFG-0001_MelangelicTone%2Fimage%2Fartwork_MelangelicTone.jpg
    findAndTranslate("artist", [
        "strong:contains('Member:')+a",
        "strong:contains('Author:')+a",
        "strong:contains('Twitter:')+a",
        "strong:contains('User ID:')+a",
    ].join(","), {
        classes: "inline",
        ruleName: "artist by link",
        toProfileUrl: (el) => {
            const a = /** @type {HTMLAnchorElement} */(el);
            if (!a.href.startsWith("https://twitter.com/")) return a.href;
            return [
                `https://twitter.com/${a.textContent?.slice(1)}`,
                `https://twitter.com/intent/user?user_id=${a.href.match(/\d+/)?.[0]}`,
            ];
        },
    });

    findAndTranslate("artistByName", ".resulttitle .target", {
        tagPosition: TAG_POSITIONS.beforebegin,
        classes: "inline",
        css: /* CSS */`
            .ex-artist-tag + .target {
                display: none;
            }
        `,
        ruleName: "artist by name",
    });

    findAndTranslate("tag", ".resultcontentcolumn .target", {
        tagPosition: TAG_POSITIONS.beforebegin,
        classes: "no-brackets",
        css: /* CSS */`
            .ex-translated-tags {
                margin: 0;
            }
            .ex-translated-tags + .target {
                display: none;
            }
        `,
        ruleName: "tags",
    });
}

function initializeMastodon () {
    watchSiteTheme(document.body, "class", (body) => (
        body.classList.contains("theme-default") ? "dark" : "light"
    ));

    GM_addStyle(/* CSS */`
        .ex-artist-tag {
            line-height: 100%;
        }
    `);

    // https://pawoo.net/@yamadorikodi
    // https://baraag.net/@casytay
    // artist name in channel header
    findAndTranslate("artist", "span", {
        predicate: ".account__header__tabs__name small span",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "artist profile",
        asyncMode: true,
    });

    // Post author, commenter
    // can include re-posted messages from other ActivityPub sites
    findAndTranslate("artist", "span.display-name__account", {
        predicate: "div.status span.display-name__account",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "post/comment author",
        asyncMode: true,
    });

    // Expanded post author
    // https://pawoo.net/@mayumani/102910946688187767
    findAndTranslate("artist", "span.display-name__account", {
        predicate: "div.detailed-status span.display-name__account",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "expanded post author",
        asyncMode: true,
    });

    // Cards of following users and followers
    // https://pawoo.net/@yamadorikodi/following
    findAndTranslate("artist", "span.display-name__account", {
        predicate: "div.account span.display-name__account",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "artist followers",
        asyncMode: true,
    });

    // Tags inside tweet
    // https://pawoo.net/@SilSinn9801/111354884652386567
    findAndTranslate("tag", ".hashtag", {
        ruleName: "tags",
        asyncMode: true,
    });

    // Tags bar
    // https://baraag.net/@casytay/111370093922321621
    findAndTranslate("tag", "a", {
        predicate: ".hashtag-bar a[href^='/tags/']",
        ruleName: "tags bar",
        asyncMode: true,
        tagPosition: TAG_POSITIONS.beforeend,
    });
}

function initializeTweetDeck () {
    watchSiteTheme(document.body, "data-nightmode", (body) => (
        body.dataset.nightmode === "true" ? "dark" : "light"
    ));

    GM_addStyle(/* CSS */`
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
    /** @param {string} userNick */
    const getPixivLink = async (userNick) => {
        // Use direct query
        const resp = await fetch(`https://api.fanbox.cc/creator.get?creatorId=${userNick}`)
            .then((r) => r.json());
        return `https://www.pixiv.net/users/${resp.body.user.userId}`;
    };
    const getPixivLinkMemoized = _.memoize(getPixivLink);

    /**
     * @param {Omit<TranslationOptions, "mode">} options
     * @param {HTMLElement} el
     */
    const addPixivTranslation = (options, el) => {
        const url = new URL(el.closest("a")?.href ?? window.location.href);
        const userNick = url.host === "www.fanbox.cc"
            ? url.pathname.match(/[\w-]+/)?.[0]
            : url.host.match(/[\w-]+/)?.[0];
        if (!userNick) return null;
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

    // Creators on the index page https://www.fanbox.cc/
    findAndTranslate("artist", "div", {
        predicate: "div[class^=Creator__Name]",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            classes: "inline",
            ruleName: "find creator index pixiv",
        }),
        ruleName: "find creator index",
        css: /* CSS */`
            div[class^=Creator__Name] {
                margin: -6px;
            }
        `,
    });

    // Find more creators https://www.fanbox.cc/creators/find
    findAndTranslate("artist", "a", {
        predicate: "a[class^=styled__UserNameText]",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            classes: "inline",
            ruleName: "find creator more pixiv",
        }),
        ruleName: "find creator more",
        classes: "inline",
    });

    // Front page - supported creators list
    findAndTranslate("artist", "div", {
        predicate: "div[class^=PlanOnlyUserInfo__UserName]",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            tagPosition: TAG_POSITIONS.beforeend,
            ruleName: "supported pixiv",
        }),
        tagPosition: TAG_POSITIONS.beforeend,
        css: /* CSS */`
            div[class^=PlanOnlyUserInfo__UserName]:has(.ex-artist-tag) {
                line-height: 20px !important;
            }
        `,
        ruleName: "supported fanbox",
    });

    // Front page - feed
    findAndTranslate("artist", "div", {
        predicate: "div[class^=PostItem__UserName]",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            classes: "inline",
            tagPosition: TAG_POSITIONS.beforeend,
            ruleName: "post pixiv",
        }),
        classes: "inline",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "post fanbox",
    });

    // https://morinohon.fanbox.cc/posts/5055514
    // post tags
    findAndTranslate("tag", "div", {
        predicate: "div[class^=Tag__Text]",
        asyncMode: true,
        classes: "inline",
        ruleName: "post tag fanbox",
        // Prevent React Router from navigation
        onadded: ($el) => $el.click((ev) => ev.stopPropagation()),
    });

    // https://morinohon.fanbox.cc/tags/ブレイブソード×ブレイズソウル
    // searched tag
    findAndTranslate("tag", "div", {
        predicate: "div[class^=TagPage__Count]",
        tagPosition: TAG_POSITIONS.beforebegin,
        toTagName: (el) => el.previousSibling?.textContent ?? null,
        asyncMode: true,
        classes: "inline",
        css: /* CSS */`
            /* fix multiline text */
            div[class^=TagPage__TagTitle] {
                display: block;
            }
            div[class^=TagPage__Count] {
                display: inline-block;
                vertical-align: middle;
            }
        `,
        ruleName: "search tag fanbox",
    });
}

function initializeMisskey () {
    // Hashtags
    // https://misskey.io/tags/ブルアカ
    // https://misskey.art/tags/ブルアカ
    // https://misskey.design/tags/ブルアカ
    findAndTranslate("tag", "a, div", {
        // eslint-disable-next-line max-len
        predicate: "a[href^='/tags/'], :is(main, ._pageContainer)>:first-child>:first-child :not(button)>div>i+div",
        asyncMode: true,
        toTagName: getNormalizedHashtagName,
        ruleName: "tags",
    });

    // Artist name in floating header
    // https://misskey.io/@ixy194
    // https://misskey.art/@Igiroitsu
    // https://misskey.design/@milcho1129
    // https://misskey.art/@ixy194@misskey.io
    // But not on note's page:
    // https://misskey.io/notes/9bxaf592x6
    // https://misskey.art/notes/9em92xdrid
    // https://misskey.design/notes/9eh5y6d2rz
    findAndTranslate("artist", ".xpJo5", {
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        css: /* CSS */`
            .ex-artist-tag[rulename='artist header'] {
                font-size: .8em;
                font-weight: 400;
            }
        `,
        ruleName: "artist header",
    });

    // Artist name in profile
    findAndTranslate("artist", "span", {
        predicate: ".username > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        ruleName: "artist profile",
    });

    // Artist name in note
    findAndTranslate("artist", "span", {
        predicate: ".x1TBL > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        classes: "inline",
        ruleName: "artist note",
    });

    // Artist name in note comment
    findAndTranslate("artist", "span", {
        predicate: ".xBLVI > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        classes: "inline",
        ruleName: "artist note comment",
    });

    // Artist name in popup
    // (hover profile picture)
    findAndTranslate("artist", "span", {
        predicate: ".x8X77 > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        ruleName: "artist popup",
    });

    // Artist name in re-notes/reactions
    // (re-notes/reactions tabs under a note)
    findAndTranslate("artist", "span", {
        predicate: ".xsb3x > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        ruleName: "artist re-note",
    });
}

function initializeFantia () {
    // Artist name on profile/work page
    // https://fantia.jp/fanclubs/15340
    // https://fantia.jp/posts/2032060
    findAndTranslate("artist", "h1.fanclub-name", {
        toProfileUrl: linkInChildren,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        asyncMode: false,
        ruleName: "artist header",
    });

    // Artist name on work cards
    // https://fantia.jp/ (投稿, 商品, コミッション tabs)
    findAndTranslate("artist", "a", {
        predicate: (el) => (
            el.matches(".module-author > a:first-of-type") && !!el.getAttribute("href")
        ),
        requiredAttributes: "href",
        tagPosition: {
            insertTag: ($container, $elem) => $container.prev().append($elem),
            findTag: ($container) => $container.prev().has(TAG_SELECTOR),
            getTagContainer: ($elem) => $elem.parent(".module-author").next(".module-author>a"),
        },
        asyncMode: true,
        css: /* CSS */`
            .module-author {
                display: flex;
                align-items: center;
            }
            .module-author .fanclub-name {
                line-height: unset !important;
            }
            .module-author .ex-artist-tag {
                font-size: 85%;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .module-author .ex-artist-tag a {
                position: relative;
                z-index: 1000;
            }
        `,
        ruleName: "artist card",
    });

    // All the tags
    // https://fantia.jp/posts/2032060
    findAndTranslate("tag", "a", {
        predicate: "a[href*='tag=']:not([target='_blank'])",
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        css: /* CSS */`
            .active > a {
                filter: brightness(1.2);
            }
            .active .ex-translated-tags {
                filter: brightness(0.7) contrast(2);
                text-shadow: 0 0 5px #fff8;
            }
        `,
        ruleName: "tags",
    });
}

function initializeSkeb () {
    // Artist name on profile page
    // https://skeb.jp/@coconeeeco
    findAndTranslate("artist", "div.title", {
        predicate: "div.hero-foot div.title:first-child",
        asyncMode: true,
        classes: "inline title is-5",
        onadded: preventSiteNavigation,
        ruleName: "artist profile page",
    });

    // Artist name on work page
    // https://skeb.jp/@coconeeeco/works/34
    findAndTranslate("artist", "div.subtitle", {
        predicate: "div.image-column + div.column div.title + div.subtitle",
        asyncMode: true,
        classes: "subtitle is-7",
        onadded: preventSiteNavigation,
        ruleName: "artist work page",
    });

    // Artists on index page
    // https://skeb.jp/
    findAndTranslate("artist", "div.user-card-screen-name", {
        asyncMode: true,
        classes: "subtitle is-7",
        onadded: preventSiteNavigation,
        ruleName: "artist index page",
    });
}

function initializeCiEn () {
    const getNormalizedUrl = (/** @type {HTMLElement} */ el) => {
        const a = /** @type {HTMLAnchorElement} */(el);
        return `https://ci-en.net/creator/${safeMatchMemoized(a.href, /\/creator\/(\d+)/, 1)}`;
    };

    // Artist name
    // In profile: https://ci-en.dlsite.com/creator/4126
    // In article: https://ci-en.dlsite.com/creator/4126/article/1035340
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-grid-account-name .e-title > a",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterend,
        classes: "inline",
        ruleName: "artist profile",
    });

    // Artist in article card by followed artists
    // https://ci-en.dlsite.com/mypage
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-card-article .c-card-content .e-title > a",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterParent,
        ruleName: "artist article card",
    });

    // Artist in article card in ranking
    // https://ci-en.dlsite.com/mypage
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-card-article-ranking .c-card-article-ranking-name .l-media-content > a",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterend,
        ruleName: "artist article ranking card",
    });

    // Artist in artist card in artist recommendations
    // https://ci-en.dlsite.com/mypage
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-card-creator .c-card-header .e-title > a",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterParent,
        ruleName: "artist creator card",
    });

    // Artist in artist card in artist ranking
    // https://ci-en.dlsite.com/mypage
    // https://ci-en.dlsite.com/ranking/creators/daily?categoryId=1
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-card-creator-archives .c-card-creator-archives-name .e-title > a",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterParent,
        ruleName: "artist creator ranking card",
    });

    // Tags in article
    // https://ci-en.dlsite.com/creator/4126/article/1035340
    findAndTranslate("tag", "a", {
        asyncMode: true,
        predicate: ".c-hashTagList .c-hashTagList-item > a",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "tag article",
    });

    // Tags in sidebar
    // https://ci-en.dlsite.com/creator/4126/article/1035340
    findAndTranslate("tag", "a", {
        asyncMode: true,
        predicate: ".c-articleFilteringList .c-articleFilteringList-item > a",
        tagPosition: TAG_POSITIONS.afterend,
        ruleName: "tag sidebar",
    });
}

function initializeBluesky () {
    const toProfileUrl = (/** @type {HTMLElement} */ el) => `https://bsky.app/profile/${(el.textContent ?? "")
        .replace(/^[\s\u202A-\u202C]*@/, "")
        .replace(/[\s\u202A-\u202C]*$/, "")}`;

    // Hashtag in post
    // https://bsky.app/profile/yitsunemelody.bsky.social/post/3l6y6kk5t6t26
    findAndTranslate("tag", "a", {
        asyncMode: true,
        predicate: "a[id^=radix]",
        ruleName: "tag post",
    });

    // Artist tag in header
    // https://bsky.app/profile/iktd13.bsky.social
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate: "div[data-testid='profileView'] > :first-child > :first-child > :first-child > :nth-child(2) > :nth-child(2) > div:nth-child(2)",
        tagPosition: TAG_POSITIONS.afterend,
        toProfileUrl,
        ruleName: "artist profile",
    });

    // Post/reply author
    // https://bsky.app
    // https://bsky.app/profile/iktd13.bsky.social
    // https://bsky.app/profile/kanikamadayo.bsky.social/post/3l6pnkjfnhq2b
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: "a[href^='/profile/'][aria-label]+a[href^='/profile/']",
        classes: "inline",
        toProfileUrl,
        ruleName: "artist post",
    });

    // Artist tag in feed
    // https://bsky.app
    // https://bsky.app/profile/iktd13.bsky.social
    findAndTranslate("artist", "div", {
        asyncMode: true,
        predicate: "main~div[style*='position: absolute'] div+a > div > :nth-child(2)",
        toProfileUrl,
        ruleName: "artist popup",
    });

    // Artist tag in thread root
    // https://bsky.app/profile/ixy.bsky.social/post/3l6up3iiokn2i
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate: "div[data-testid^='postThreadItem-by-'] > :first-child > :nth-child(2) > :nth-child(2) > div:first-child",
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        toProfileUrl,
        ruleName: "artist post thread root",
    });

    // Artist tag in search autocomplete
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate: "a[data-testid^='searchAutoCompleteResult-'] div:nth-child(2) > div:nth-child(2):not(:has(*))",
        toProfileUrl,
        ruleName: "artist search autocomplete",
    });

    // Artist tag in people search results
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate: "div[style*='display: flex'] a[href^='/profile/'][role='link'] div:nth-child(2) > div:nth-child(2):not(:has(*))",
        toProfileUrl,
        ruleName: "people search result",
    });

    // Artist tag in followers and following
    // https://bsky.app/profile/emistations.bsky.social/follows
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate: "div[style*='display: flex'] div:is([data-testid='profileFollowsScreen'], [data-testid='profileFollowersScreen']) a > :first-child > :nth-child(2) > :nth-child(2)",
        toProfileUrl,
        ruleName: "people search result",
    });
}

function initializeWeibo () {
    watchSiteTheme(document.documentElement, "data-theme", (html) => {
        switch (html.dataset.theme) {
            case "dark": return "dark";
            case "light": return "light";
            default: return "auto";
        }
    });

    const url = (/** @type {string} */ id) => (id ? `https://www.weibo.com/u/${id}` : "");

    // Profile page
    // https://www.weibo.com/u/7500749495
    findAndTranslate("artist", "div", {
        asyncMode: true,
        predicate: "div[class^='ProfileHeader_name_']",
        toProfileUrl: (el) => url(safeMatchMemoized(
            $(el).parent().parent().nextAll("a")
                .prop("href"),
            /to_uid=(\d+)/,
            1,
        )),
        classes: "inline",
        ruleName: "artist profile",
    });

    // feed post, post page
    // https://www.weibo.com/u/7500749495
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: "article header a[href^='/u/']:not([aria-label])",
        classes: "inline",
        ruleName: "artist post",
    });

    // feed re-post
    // https://www.weibo.com/u/7500749495
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: "article header a[href^='/n/']",
        toProfileUrl: (el) => url(safeMatchMemoized(
            $(el).parent().next().find("a")
                .prop("href"),
            /\d+/,
        )),
        classes: "inline",
        ruleName: "artist re-post",
        css: /* CSS */`[rulename="artist re-post"] { margin-right: 1ch }`,
    });

    // user popup
    // https://www.weibo.com/u/7500749495
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".popcard > :first-child > :first-child a[class*='PopCard_']",
        toProfileUrl: (el) => url(safeMatchMemoized(
            $(el).parents(".popcard").find("a[href^='/u/page/follow/']").prop("href"),
            /\d+/,
        )),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        css: /* CSS */`[rulename="artist popup"] { text-shadow: 0 0 5px black }`,
        ruleName: "artist popup",
    });

    // post comment
    // https://www.weibo.com/7500749495/Pg5a5oHtp
    findAndTranslate("artist", "a[usercard][to]", {
        asyncMode: true,
        predicate: "#scroller a",
        classes: "inline",
        ruleName: "post commenter",
    });

    // post tag
    // https://www.weibo.com/7500749495/Pg2WWBzUr
    findAndTranslate("tag", "a[target]", {
        asyncMode: true,
        predicate: ":is(.wbpro-feed-content, .retweet) a[href*='/weibo?q=']",
        toTagName: (el) => el.textContent?.slice(1, -1) || "",
        classes: "inline",
        ruleName: "post tag",
    });

    // recommended user on sidebar
    // https://www.weibo.com/u/7500749495
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".wbpro-side[page='profileRecom'] a + div > a:first-child",
        onadded: preventSiteNavigation,
        css: /* CSS */`[rulename="sidebar user"] { font-size: 13px }`,
        ruleName: "sidebar user",
    });
}

function initializeWeiboMobile () {
    const url = (/** @type {string} */ id) => (id ? `https://www.weibo.com/u/${id}` : "");

    // Profile page
    // https://m.weibo.cn/u/7500749495
    findAndTranslate("artist", "span.txt-shadow", {
        asyncMode: true,
        predicate: ".profile-cover .mod-fil-n span",
        toProfileUrl: () => url(safeMatchMemoized(window.location.pathname, /\d+/)),
        classes: "inline txt-shadow",
        ruleName: "artist profile",
    });

    // feed post
    // https://m.weibo.cn/u/7500749495
    findAndTranslate("artist", "h3", {
        asyncMode: true,
        predicate: "a:not([href]) > h3",
        toProfileUrl: (el) => {
            let node = el.parentElement;
            let id;
            // eslint-disable-next-line no-underscore-dangle, max-len, no-cond-assign
            while (node && !(id = /** @type {any} */ (node).__vue__?._data?.carddata?.mblog?.user?.id)) {
                node = node.parentElement;
            }
            if (!node || !id) return null;
            return url(id);
        },
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        onadded: preventSiteNavigation,
        ruleName: "feed post",
    });

    // post page
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate("artist", "h3", {
        asyncMode: true,
        predicate: "[href^='/profile/'] > h3",
        toProfileUrl: (el) => url(
            safeMatchMemoized(/** @type {HTMLAnchorElement} */ (el.parentElement).href, /\d+/),
        ),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        onadded: preventSiteNavigation,
        ruleName: "post author",
    });

    // post tag
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate("tag", "a[href][data-hide]", {
        asyncMode: true,
        predicate: "[href*='/search?']",
        toTagName: (el) => el.textContent?.slice(1, -1) || "",
        classes: "inline",
        ruleName: "post tag",
    });

    // post commenter
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate("artist", "h4", {
        asyncMode: true,
        predicate: ".comment-content .card-main h4",
        toProfileUrl: (el) => {
            let node = el.parentElement;
            let id;
            // eslint-disable-next-line no-underscore-dangle, max-len, no-cond-assign
            while (node && !(id = /** @type {any} */ (node).__vue__?._props?.item?.user?.id)) {
                node = node.parentElement;
            }
            if (!node || !id) return null;
            return url(id);
        },
        classes: "inline",
        ruleName: "post commenter",
    });
}

function initializeXiaohongshu() {
    // Tags in post
    findAndTranslate("tag", "a.tag", {
        asyncMode: true,
        predicate: ".note-text a.tag",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "tag note",
    });

    // Artist tag in post preview
    findAndTranslate("artist", "span.name", {
        asyncMode: true,
        predicate: ".note-item .author span.name",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist note card",
    });

    // Artist tag in post
    findAndTranslate("artist", "span.username", {
        asyncMode: true,
        predicate: ".note-container .author-container span.username",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist note",
    });

    // Artist tag in profile
    findAndTranslate("artist", "div.user-name", {
        asyncMode: true,
        predicate: ".user div.user-name",
        toProfileUrl: (el) => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist profile",
    });
}


function initialize () {
    GM_jQuery_setup();
    GM_addStyle(PROGRAM_CSS);
    GM_addStyle(TOOLTIP_CSS);
    if (SETTINGS.get("show_settings")) {
        GM_registerMenuCommand("Settings", showSettings, "S");
    }

    const { theme } = chooseBackgroundColorScheme($(document.body));
    $("html").addClass(`tpt-${theme}`);
    debuglog(`set ${theme} theme mode`);

    switch (window.location.host) {
        case "baraag.net":              initializeMastodon();       break;
        case "bsky.app":                initializeBluesky();        break;
        case "ci-en.net":
        case "ci-en.dlsite.com":        initializeCiEn();           break;
        case "www.deviantart.com":      initializeDeviantArt();     break;
        case "fantia.jp":               initializeFantia();         break;
        case "www.hentai-foundry.com":  initializeHentaiFoundry();  break;
        case "misskey.art":
        case "misskey.design":
        case "misskey.io":              initializeMisskey();        break;
        case "nijie.info":              initializeNijie();          break;
        case "pawoo.net":               initializeMastodon();       break;
        case "dic.pixiv.net":
        case "www.pixiv.net":           initializePixiv();          break;
        case "saucenao.com":            initializeSauceNAO();       break;
        case "seiga.nicovideo.jp":      initializeNicoSeiga();      break;
        case "skeb.jp":                 initializeSkeb();           break;
        case "www.tinami.com":          initializeTinami();         break;
        case "twitter.com":
        case "mobile.twitter.com":      initializeTwitter();        break;
        case "tweetdeck.twitter.com":   initializeTweetDeck();      break;
        case "www.weibo.com":           initializeWeibo();          break;
        case "m.weibo.cn":              initializeWeiboMobile();    break;
        case "x.com":                   initializeTwitter();        break;
        case "www.xiaohongshu.com":     initializeXiaohongshu();    break;
        default:
            if (window.location.host.endsWith("artstation.com")) {
                initializeArtStation();
            } else if (window.location.host.endsWith("fanbox.cc")) {
                initializePixivFanbox();
            } else {
                console.warn("[TPT]: Unsupported domain", window.location.host);
            }
    }

    // Check for new network requests every half-second
    setInterval(intervalNetworkHandler, REQUEST_INTERVAL);
}

//------------------------
// Program execution start
//------------------------

initialize();
