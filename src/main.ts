import { GM } from "$";
import { css } from "@lit/reactive-element";
import { addAfterRestart } from "./lifecycle";
import { customCssSheet, SETTINGS } from "./settings";
import { addCss, chooseBackgroundColorScheme, console } from "./utils";
import { findAndTranslate, createTranslators, startFindAndTranslate } from "./translate";
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
import showSettings from "./tooltips/settings";
import { cleanupCache } from "./cache";
import { execAdapters } from "./adapter-loader";

const GLOBAL_CSS = css`
    /* Adapters are expected to define --color and --icon (an image) for all tags */
    .tpt-tags {
        margin: 0 0.5em;
        display: inline-flex;
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
    .tpt-artists {
        display: inline-flex;
    }
    .tpt-artist:not(#id) {
        color: var(--color) !important;
        text-decoration: none;
        white-space: nowrap;
    }
    .tpt-artist.banned-artist::after {
        content: " (banned)";
    }
    .tpt-artist.tpt-textless.banned-artist::after {
        content: "(banned)";
    }

    :is(.tpt-tags, .tpt-artists).inline {
        margin-left: 0.5em;
    }
    :is(.tpt-tag, .tpt-artist):not(.tpt-textless) {
        flex-shrink: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        min-height: 1.3em;
    }
    :is(.tpt-tag, .tpt-artist):not(.tpt-textless) ~ :not(.tpt-textless) {
        margin-left: 0.3ch;
        flex-shrink: 10;
    }
    :is(.tpt-tag, .tpt-artist):not(.tpt-textless) ~ :not(.tpt-textless) ~ :not(.tpt-textless) {
        flex-shrink: 100;
    }
    .tpt-artist::before,
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
    .tpt-artist:not(.tpt-textless)::before {
        margin-right: 0.3ch;
    }

    .tpt-loading-data,
    .tpt-loading-data a {
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

const SITES: Record<string, (fn: FindAndTranslate) => void> = {
    "artstation.com": initializeArtStation,
    // "baraag.net": initializeMastodon,
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
    cleanupCache();

    if (SETTINGS.show_settings) {
        GM.registerMenuCommand("Settings", showSettings, "S");
    }

    const { theme } = chooseBackgroundColorScheme(document.body);
    document.documentElement.classList.add(`tpt-${theme}`);
    console.info(`Set ${theme} theme mode`);

    await execAdapters(SETTINGS.source_adapters);

    start();
}

function start() {
    addCss(GLOBAL_CSS);
    addCss(customCssSheet);

    createTranslators();

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

addAfterRestart(start);

//------------------------
// Program execution start
//------------------------

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}
