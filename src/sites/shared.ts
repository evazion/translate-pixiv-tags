import $ from "../dom";
import { console, match } from "../utils";

export const TAG_SELECTOR = ".tpt-tags, .tpt-artists";

export const TAG_POSITIONS = {
    beforebegin: {
        insertTag: (container, elem) => container.before(elem),
        findTag: (container) => $(container).prev(TAG_SELECTOR)[0] ?? null,
        getTagContainer: (elem) => $(elem).next()[0] ?? null,
    },
    afterbegin: {
        insertTag: (container, elem) => container.prepend(elem),
        findTag: (container) => $(container).children(TAG_SELECTOR)[0] ?? null,
        getTagContainer: (elem) => elem.parentElement,
    },
    beforeend: {
        insertTag: (container, elem) => container.append(elem),
        findTag: (container) => $(container).children(TAG_SELECTOR).at(-1) ?? null,
        getTagContainer: (elem) => elem.parentElement,
    },
    afterend: {
        insertTag: (container, elem) => container.after(elem),
        findTag: (container) => $(container).next(TAG_SELECTOR)[0] ?? null,
        getTagContainer: (elem) => $(elem).prev()[0] ?? null,
    },
    afterParent: {
        insertTag: (container, elem) => container.parentElement?.after(elem),
        findTag: (container) => $(container).parent().next(TAG_SELECTOR)[0] ?? null,
        getTagContainer: (elem) => $(elem).prev().find("a")[0] ?? null,
    },
} satisfies Record<string, TagPosition>;

const cleanups: Array<() => void> = [];

/**
 * Registers a function that undoes a part of the site setup on restart.
 * Not for per-tag resources: the registry keeps them alive until the restart.
 */
export function onRestart(fn: () => void) {
    cleanups.push(fn);
}

/** Runs and forgets the registered cleanup functions */
export function runRestartCleanups() {
    for (const fn of cleanups.splice(0)) fn();
}

/** Tags whose target's url is watched; `translate()` reuses the tag on re-render */
const urlWatchedTags = new WeakSet<HTMLElement>();

/**
 * Delete the tag element when the target element will change its url (`href`)
 * @param tag The tag to remove
 * @param options Translation options
 */
export function deleteOnUrlChange(tag: HTMLElement, options: TranslationOptionsFull) {
    if (urlWatchedTags.has(tag)) return;
    const container = options.tagPosition.getTagContainer(tag);
    if (!container) return;
    urlWatchedTags.add(tag);
    const watcher = new MutationObserver(() => {
        // the tag may be removed already, e.g. on restart
        if (tag.isConnected) tag.remove();
        watcher.disconnect();
    });
    watcher.observe(container, { attributeFilter: ["href"] });
}

/** When the tag is inside another <a>, prevents soft navigation by the outer link */
export const preventSiteNavigation = (el: HTMLElement) =>
    // the same listener is added only once, so it's safe to call on every re-render
    el.addEventListener("click", stopPropagation);

const stopPropagation = (ev: Event) => ev.stopPropagation();

/** Find and get link in child elements */
export function linkInChildren(el: HTMLElement): string {
    return el.querySelector("a")?.href ?? "";
}

/* https://x.com/search?q=%23ガルパン版深夜のお絵描き60分一本勝負 */
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
/** Get tag name without common prefixes or suffixes */
export const getNormalizedHashtagName = (el: HTMLElement) => {
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

/** Normalize profile url for soc.net. like Mastodon or Misskey */
export const getNormalizedDecentralizedSocNetUrl = (el: HTMLElement) => {
    const fullName = el.textContent?.trim() ?? "";

    const [, name, host = window.location.host] = match(fullName, /^@(\w+)(?:@([\w.-]+))?$/) || [];

    return name ? `https://${host}/@${name}` : null;
};

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
 * @param elem The element that contains theme info
 * @param attr The attribute name with the theme info
 * @param themeExtractor Theme getter
 */
export function watchSiteTheme(
    elem: HTMLElement,
    attr: string,
    themeExtractor: (el: HTMLElement) => Theme,
) {
    let theme: Theme;
    function updateTheme() {
        const newTheme = themeExtractor(elem);
        if (newTheme === theme) return;
        theme = newTheme;
        document.documentElement.classList.remove("tpt-dark", "tpt-light", "tpt-auto");
        document.documentElement.classList.add(`tpt-${theme}`);
        console.info(`Theme changed to ${theme}`);
    }

    const observer = new MutationObserver(updateTheme);
    observer.observe(elem, { attributeFilter: [attr] });
    onRestart(() => observer.disconnect());
    updateTheme();
}
