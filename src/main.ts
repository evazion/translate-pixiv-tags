import { IQuery, MutationSummary } from "mutation-summary";
import $ from "jquery";
import { css, render } from "lit";
import { GM } from "$";
import { SETTINGS } from "./settings";
import { addCss, chooseBackgroundColorScheme, debuglog, removeAllCss } from "./utils";
import { TAG_POSITIONS, TAG_SELECTOR } from "./sites/shared";
import initializeMastodon from "./sites/mastodon";
import initializeBluesky from "./sites/bsky";
import initializeCiEn from "./sites/ci-en";
import initializeDeviantArt from "./sites/deviant-art";
import initializeFantia from "./sites/fantia";
import initializeHentaiFoundry from "./sites/hentai-foundary";
import initializeMisskey from "./sites/misskey";
import initializeNijie from "./sites/nijie";
import initializePixiv from "./sites/pixiv";
import initializeSauceNAO from "./sites/saucenao";
import initializeNicoSeiga from "./sites/nico-seiga";
import initializeSkeb from "./sites/skeb";
import initializeTinami from "./sites/tinami";
import initializeTwitter from "./sites/twitter";
// import initializeTweetDeck from "./sites/tweetdeck";
import initializeWeibo from "./sites/weibo";
import initializeWeiboMobile from "./sites/weibo-mobile";
import initializeXiaohongshu from "./sites/xiaohongshu";
import initializeArtStation from "./sites/artstation";
import initializeFanbox from "./sites/fanbox";
import DanbooruAdapter from "./adapters/booru";
import { normalizeProfileUrl } from "./normalize-url";
import showSettings from "./tooltips/settings";
import { getSiteDisplayDomain } from "./artist-urls";

const PROGRAM_CSS = css`
    /* Adapters are expected to define --color for all tags and the icon for artist tag */
    .tpt-tags {
        margin: 0 0.5em;
    }
    .tpt-tags * {
        display: inline !important;
        float: none !important;
        background: none !important;
        margin: 0 !important;
        padding: 0 !important;
        text-decoration: none !important;
        white-space: nowrap;
    }
    .tpt-tags::before {
        content: "(";
        white-space: nowrap;
    }
    .tpt-tags::after {
        content: ")";
        white-space: nowrap;
    }
    .tpt-tags.no-brackets::before,
    .tpt-tags.no-brackets::after {
        content: none;
    }

    /* dirt hack for DevianArt: add :not(#id) to rapidly increase rule specificity */
    .tpt-tag:not(#id) {
        color: var(--color) !important;
    }
    .tpt-artist {
        white-space: nowrap;
    }
    .tpt-artist.inline {
        display: inline-block;
        margin-left: 0.5em;
    }
    .tpt-artist a:not(#id) {
        color: var(--color) !important;
        text-decoration: none;
    }
    .tpt-artist a::before {
        content: "";
        display: inline-block;
        background-repeat: no-repeat;
        background-size: 0.8em;
        width: 0.8em;
        height: 0.8em;
        margin-right: 0.3ch;
        vertical-align: middle;
    }
    .tpt-artist a.banned-artist::after {
        content: " (banned)";
    }

    .loading-data,
    .loading-data a {
        cursor: wait;
    }

    #tpt-settings,
    #tpt-message {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 3000001;
    }
    #tpt-tips {
        pointer-events: none;
    }
    #tpt-tips > * {
        pointer-events: all;
        z-index: 3000000;
    }

    .tpt-tip {
        position: absolute;
        --bc: #e2e2e2;
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
    .tpt-tip.tip-dark {
        --bc: #303030;
        color: #f3f3f3;
    }
    .tpt-tip .arrow {
        position: absolute;
        bottom: -8px;
        border-left: 3px solid transparent;
        border-right: 3px solid transparent;
        border-top: 8px solid var(--bg);
        filter: drop-shadow(1px 1px var(--bc)) drop-shadow(-1px 1px var(--bc));
    }
    .tpt-tip[data-placement="bottom"] .arrow {
        bottom: auto;
        top: -8px;
        border-top: none;
        border-bottom: 8px solid var(--bg);
        filter: drop-shadow(1px -1px var(--bc)) drop-shadow(-1px -1px var(--bc));
    }
`;

const adapters: Record<string, typeof Adapter> = {
    Danbooru: DanbooruAdapter,
};

let translators: Adapter[];

const loggedMisses = new Set<string>();

/**
 * Translate a regular tag on the given element
 * @param target The element to attach translation
 * @param tagName The tag name to translate
 * @param options Translation options
 */
async function translateTag(target: HTMLElement, tagName: string, options: TranslationOptionsFull) {
    if (!tagName) return;

    const normalizedTag = tagName.normalize("NFKC").replace(/^#/, "").trim().replaceAll(/\s/g, "_"); // Wiki other names cannot contain spaces

    /* Don't search for empty tags. */
    if (normalizedTag.length === 0) {
        return;
    }

    translate(target, "translateTag", normalizedTag, "tpt-tags", `Couldn't translate tag`, options);
}

async function translateArtistByName(
    target: HTMLElement,
    artistName: string,
    options: TranslationOptionsFull,
) {
    if (!artistName) return;

    translate(
        target,
        "translateArtistByName",
        artistName,
        "tpt-artist",
        "Couldn't find artist",
        options,
    );
}

async function translateArtistByUrl(
    target: HTMLElement,
    profileUrl: string,
    options: TranslationOptionsFull,
) {
    if (!profileUrl) return;

    const normalizedUrl = normalizeProfileUrl(profileUrl);
    if (!normalizedUrl) return;

    translate(
        target,
        "translateArtistByUrl",
        normalizedUrl,
        "tpt-artist",
        "Couldn't find artist by url",
        options,
    );
}

async function translate(
    target: HTMLElement,
    method: "translateTag" | "translateArtistByName" | "translateArtistByUrl",
    param: string,
    containerClass: string,
    errorMsg: string,
    options: TranslationOptionsFull,
) {
    const {
        onadded = null,
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
            findTag = TAG_POSITIONS.afterend.findTag,
        },
        ruleName,
    } = options;
    const { classes = "" } = options;

    const key = encodeURI(param);

    const $target = $(target);
    const $duplicates = findTag($target).filter(`[data-original="${key}"]`);
    if ($duplicates.length > 0) return;

    const tags = await Promise.all(translators.map((t) => t[method](param, options))).then((arr) =>
        arr.flat(),
    );

    if (tags.length === 0) {
        const msg = `${errorMsg} "${param}", rule "${ruleName}"`;
        if (!loggedMisses.has(msg)) {
            loggedMisses.add(msg);
            debuglog(msg);
        }
        return;
    }

    const template = document.createElement("template");
    render(tags, template);

    // "merge" tags with the same text
    const groups = new Map<String, Element[]>();
    for (const tag of Array.from(template.children)) {
        const name = tag.textContent;
        const group = groups.get(name);
        if (group) {
            tag.textContent = "";
            group.push(tag);
        } else {
            groups.set(name, [tag]);
        }
    }

    const container = document.createElement("div");
    container.className = `${containerClass} ${classes}`;
    container.dataset.original = key;
    container.dataset.rule = ruleName;
    container.append(...[...groups.values()].flat());

    insertTag($target, container);

    if (onadded) onadded(container, options);
}

const mutationObserverQueries: Array<[IQuery, (el: Node) => void]> = [];

const findAndTranslate: FindAndTranslate = function findAndTranslate(mode, selector, options) {
    const fullOptions: TranslationOptionsFull = {
        asyncMode: false,
        requiredAttributes: null,
        predicate: null,
        toProfileUrl: (el): any => el.closest("a")?.href,
        toTagName: (el) => el.textContent,
        tagPosition: TAG_POSITIONS.afterend,
        classes: "",
        css: null,
        onadded: null,
        ruleName: "<not provided>",
        mode,
        ...options,
    };

    const canTranslate =
        typeof fullOptions.predicate === "string"
            ? (el: HTMLElement) => el.matches(fullOptions.predicate as string)
            : (fullOptions.predicate ?? (() => true));

    const { translate, getData } = {
        artist: {
            translate: translateArtistByUrl,
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

    const tryToTranslate = (elem: Node) => {
        if (!(elem instanceof HTMLElement)) return;
        if (!canTranslate(elem)) return;
        const data = getData(elem);
        if (Array.isArray(data)) {
            for (const item of data) translate(elem, item, fullOptions);
        } else if (data) {
            translate(elem, data, fullOptions);
        }
    };

    if (fullOptions.css) {
        const artistTag = `.tpt-artist[data-rule="${fullOptions.ruleName}"]`;
        // set internal prop used for lazy stylesheet creation
        (fullOptions.css as any)._strings = fullOptions.css.cssText.replaceAll(
            "ARTIST_TAG",
            artistTag,
        );
        addCss(fullOptions.css);
    }

    // TS is stupid here
    $(selector as string).each((_i, elem) => tryToTranslate(elem));

    if (!fullOptions.asyncMode) return;

    const query: IQuery = { element: selector as string };
    if (fullOptions.requiredAttributes) query.elementAttributes = fullOptions.requiredAttributes;
    mutationObserverQueries.push([query, tryToTranslate]);
};

let mutationObserver: MutationSummary | null = null;

/**
 * Share MutationSummary (and the underling MutationObserver) between all the queries (rules)
 */
function startFindAndTranslate() {
    if (mutationObserverQueries.length === 0) return;
    mutationObserver = new MutationSummary({
        rootNode: document.body,
        queries: mutationObserverQueries.map((arr) => arr[0]),
        callback: (summaries) => {
            for (const [i, summary] of summaries.entries()) {
                const translate = mutationObserverQueries[i][1];
                for (const elem of summary.added) translate(elem);

                if (summary.attributeChanged) {
                    for (const elements of Object.values(summary.attributeChanged)) {
                        for (const elem of elements) translate(elem);
                    }
                }
            }
        },
    });
}

const SITES: Record<string, (fn: FindAndTranslate) => void> = {
    "artstation.com": initializeArtStation,
    "baraag.net": initializeMastodon,
    "bsky.app": initializeBluesky,
    "ci-en.net": initializeCiEn,
    "ci-en.dlsite.com": initializeCiEn,
    "www.deviantart.com": initializeDeviantArt,
    "fanbox.cc": initializeFanbox,
    "fantia.jp": initializeFantia,
    "www.hentai-foundry.com": initializeHentaiFoundry,
    "misskey.art": initializeMisskey,
    "misskey.design": initializeMisskey,
    "misskey.io": initializeMisskey,
    "nijie.info": initializeNijie,
    "pawoo.net": initializeMastodon,
    "dic.pixiv.net": initializePixiv,
    "www.pixiv.net": initializePixiv,
    "saucenao.com": initializeSauceNAO,
    "seiga.nicovideo.jp": initializeNicoSeiga,
    "skeb.jp": initializeSkeb,
    "www.tinami.com": initializeTinami,
    // "twitter.com": initializeTwitter,
    // "mobile.twitter.com": initializeTwitter,
    // "tweetdeck.twitter.com": initializeTweetDeck,
    "www.weibo.com": initializeWeibo,
    "m.weibo.cn": initializeWeiboMobile,
    "x.com": initializeTwitter,
    "www.xiaohongshu.com": initializeXiaohongshu,
};
// const SITES2: Record<string, (fn: FindAndTranslate) => void> = {
//     ".artstation.com": initializeArtStation,
//     ".fanbox.cc": initializeFanbox,
// };

function initialize() {
    if (SETTINGS.show_settings) {
        GM.registerMenuCommand("Settings", showSettings, "S");
    }

    const { theme } = chooseBackgroundColorScheme(document.body);
    document.documentElement.classList.add(`tpt-${theme}`);
    debuglog(`set ${theme} theme mode`);
}

function start() {
    addCss(PROGRAM_CSS);

    translators = SETTINGS.data_sources.map((source) => {
        const translator = new adapters[source.adapter](source.param);
        if (!source.translateArtist) {
            translator.translateArtistByName = () => Promise.resolve([]);
            translator.translateArtistByUrl = () => Promise.resolve([]);
        }
        if (!source.translateTag) {
            translator.translateTag = () => Promise.resolve([]);
        }
        return translator;
    });

    const domain = getSiteDisplayDomain(window.location.host);
    if (domain in SITES) {
        SITES[domain](findAndTranslate);
    } else {
        // for (const tld in SITES2) {
        //     if (host.endsWith(tld)) {
        //         SITES2[tld](findAndTranslate);
        //         break;
        //     }
        // }
        console.warn("[TPT]: Unsupported domain", window.location.host);
    }
    startFindAndTranslate();
}

export function restart() {
    mutationObserverQueries.length = 0;
    mutationObserver?.disconnect();
    $(TAG_SELECTOR).remove();
    removeAllCss();

    start();
}

//------------------------
// Program execution start
//------------------------

initialize();
start();
