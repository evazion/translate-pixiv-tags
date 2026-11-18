import { IQuery, MutationSummary } from "mutation-summary";
import $ from "./dom";
import { css, render } from "lit";
import { GM } from "$";
import { ADAPTERS, customCssSheet, setOnSettingChange, SETTINGS } from "./settings";
import { addCss, chooseBackgroundColorScheme, console, removeAllCss } from "./utils";
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
import { normalizeProfileUrl } from "./normalize-url";
import showSettings from "./tooltips/settings";
import DanbooruAdapter from "./adapters/booru";
import { execAdapters } from "./adapter-loader";
import simplifySelector from "./simplify-selector";

const GLOBAL_CSS = css`
    /* Adapters are expected to define --color and --icon (an image) for all tags */
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
    /* repeated items of a group, rendered without text and without a separator */
    .tpt-textless:not(#id) {
        margin-left: 0.3ch !important;
    }
    .tpt-artist a::before,
    .tpt-tag.tpt-textless::before {
        content: "";
        display: inline-block;
        background-image: var(--icon);
        background-repeat: no-repeat;
        background-size: 0.8em;
        width: 0.8em;
        height: 0.8em;
        vertical-align: middle;
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
    .tpt-artist a:not(.tpt-textless)::before {
        margin-right: 0.3ch;
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

// define here to prevent circular dependency
ADAPTERS.Danbooru = DanbooruAdapter;

let translators: Adapter[];

const loggedMisses = new Set<string>();

/** Params key of the latest translation request per target and container class */
let translationsRequests = new WeakMap<
    HTMLElement,
    {
        params: string[];
        /** Per translator: item name -> its renderer */
        groups: Array<Map<string, TranslatedItem[1]>>;
        attr: string | null;
    }
>();

/**
 * Translate a regular tag on the given element
 * @param target The element to attach translation
 * @param tagNames The tag name to translate
 * @param options Translation options
 */
async function translateTag(
    target: HTMLElement,
    tagNames: string[],
    options: TranslationOptionsFull,
) {
    // Wiki other names cannot contain spaces
    const normalizedTags = tagNames.map((tag) =>
        tag.normalize("NFKC").trim().replace(/^#/, "").replaceAll(/\s/g, "_").toLocaleLowerCase(),
    );

    translate(
        target,
        "translateTag",
        normalizedTags,
        "tpt-tags",
        `Couldn't translate tag`,
        options,
    );
}

async function translateArtistByName(
    target: HTMLElement,
    artistNames: string[],
    options: TranslationOptionsFull,
) {
    translate(
        target,
        "translateArtistByName",
        artistNames,
        "tpt-artist",
        "Couldn't find artist",
        options,
    );
}

async function translateArtistByUrl(
    target: HTMLElement,
    profileUrls: string[],
    options: TranslationOptionsFull,
) {
    const normalizedUrls = profileUrls.map(normalizeProfileUrl).filter(Boolean);

    translate(
        target,
        "translateArtistByUrl",
        normalizedUrls,
        "tpt-artist",
        "Couldn't find artist by url",
        options,
    );
}

async function translate(
    target: HTMLElement,
    method: "translateTag" | "translateArtistByName" | "translateArtistByUrl",
    params: string[],
    containerClass: string,
    errorMsg: string,
    options: TranslationOptionsFull,
) {
    if (params.length === 0) return;
    if (translators.every((t) => t[method] === null)) return;

    const {
        onadded = null,
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
            findTag = TAG_POSITIONS.afterend.findTag,
        },
        ruleName,
    } = options;
    const { classes = "" } = options;

    const paramKey = params.join("\0");
    const attrKey =
        options.requiredAttributes
            ?.split(" ")
            .map((attr) => (attr === "#text" ? target.textContent : target.getAttribute(attr)))
            .join("\0") ?? null;

    let translationRequest = translationsRequests.get(target);
    if (translationRequest?.attr === attrKey) {
        // already was called with this params
        if (translationRequest.params.includes(paramKey)) {
            return;
        }
    } else {
        translationRequest = {
            attr: attrKey,
            params: [paramKey],
            groups: translators.map(() => new Map()),
        };
        translationsRequests.set(target, translationRequest);
    }
    const groups = translationRequest.groups;

    const translations = await Promise.all(
        translators.map((t) => Promise.all(params.map((param) => t[method]?.(param, options)))),
    );

    if (translationsRequests.get(target) !== translationRequest) {
        return;
    }

    if (translations.flat(2).filter(Boolean).length === 0) {
        const msg = `${errorMsg} "${params}", rule "${ruleName}"`;
        if (!loggedMisses.has(msg)) {
            loggedMisses.add(msg);
            console.info(msg);
        }
        return;
    }

    let changed = false;
    for (let i = 0; i < translations.length; i++) {
        const subgroup = groups[i];
        for (const [name, render] of translations[i].flatMap((items) => items ?? [])) {
            if (subgroup.has(name)) continue;
            subgroup.set(name, render);
            changed = true;
        }
    }
    if (!changed) return;

    // items with the same name from different translators show the name only once
    const mergedGroups = new Map<string, Renderable[]>();
    for (const subgroup of groups) {
        for (const [name, render] of subgroup) {
            const group = mergedGroups.get(name);
            if (group) {
                group.push(render(true));
            } else {
                mergedGroups.set(name, [render(false)]);
            }
        }
    }

    const container = findTag(target) ?? document.createElement("span");
    container.className = `${containerClass} ${classes}`;
    container.dataset.rule = ruleName;
    container.innerHTML = "";

    // items within a group are spaced via CSS
    const template = new DocumentFragment();
    render(
        [...mergedGroups.values()].flatMap((group, i) => (i === 0 ? group : [", ", ...group])),
        template,
    );
    container.append(template);

    insertTag(target, container);

    onadded?.(container, options);
}

function patchCss(css: CSSStyleSheet | CSSStyleRule | undefined, ruleName: string) {
    if (!css) return;
    for (let len = css.cssRules.length, i = 0; i < len; i++) {
        const rule = css.cssRules[i] as CSSStyleRule;
        if (rule.selectorText.includes("ARTIST_TAG")) {
            rule.selectorText = rule.selectorText.replaceAll(
                "ARTIST_TAG",
                `.tpt-artist[data-rule="${ruleName}"]`,
            );
        }
        if (rule.selectorText.includes("TPT_TAG")) {
            rule.selectorText = rule.selectorText.replaceAll(
                "TPT_TAG",
                `.tpt-tags[data-rule="${ruleName}"]`,
            );
        }
        patchCss(rule, ruleName);
    }
}

const mutationObserverQueries: Array<[IQuery, (el: Node) => void]> = [];

const findAndTranslate: FindAndTranslate = function findAndTranslate(
    mode,
    selector,
    options,
    ruleName,
) {
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
        mode,
        ...options,
        ruleName,
    };

    const { predicate } = fullOptions;
    const canTranslate = (el: HTMLElement) =>
        el.matches(selector as string) && (!predicate || predicate(el));

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
        if (data) {
            translate(elem, Array.isArray(data) ? data : [data], fullOptions);
        }
    };

    if (fullOptions.css) {
        patchCss(fullOptions.css.styleSheet, fullOptions.ruleName);
        addCss(fullOptions.css);
    }

    $(selector).forEach(tryToTranslate);

    if (!fullOptions.asyncMode) return;

    const query: IQuery = { element: simplifySelector(selector as string) };
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
    "www.rednote.com": initializeXiaohongshu,
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

async function initialize() {
    let restartScheduled = false;
    setOnSettingChange(() => {
        if (restartScheduled) return;
        Promise.resolve().then(() => {
            restartScheduled = false;
            restart();
        });
        restartScheduled = true;
    });

    await execAdapters(SETTINGS.source_adapters);

    if (SETTINGS.show_settings) {
        GM.registerMenuCommand("Settings", showSettings, "S");
    }

    const { theme } = chooseBackgroundColorScheme(document.body);
    document.documentElement.classList.add(`tpt-${theme}`);
    console.info(`Set ${theme} theme mode`);

    start();
}

function start() {
    addCss(GLOBAL_CSS);
    addCss(customCssSheet);

    translators = SETTINGS.data_sources.map((source) => {
        if (!ADAPTERS[source.adapter]) {
            console.error(`Missing ${source.adapter} adapter!`);
            return {} as Adapter;
        }
        const translator = new ADAPTERS[source.adapter](source.param);
        if (!source.translateArtist) {
            translator.translateArtistByName = null;
            translator.translateArtistByUrl = null;
        }
        if (!source.translateTag) {
            translator.translateTag = null;
        }
        return translator;
    });

    let domain = window.location.host;
    if (!(domain in SITES)) {
        // drop subdomains, for now it is enough
        domain = domain.split(".").slice(-2).join(".");
    }
    if (domain in SITES) {
        SITES[domain](findAndTranslate);
    } else {
        console.warn(`Unsupported domain ${domain} (${window.location.host})`);
    }
    startFindAndTranslate();
}

function restart() {
    mutationObserverQueries.length = 0;
    mutationObserver?.disconnect();
    translators.forEach((t) => t.destroy());
    $(TAG_SELECTOR).remove();
    removeAllCss();
    loggedMisses.clear();
    translationsRequests = new WeakMap();

    start();
}

//------------------------
// Program execution start
//------------------------

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}
