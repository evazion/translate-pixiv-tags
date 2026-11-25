import $ from "../dom";
import { GM } from "$";
import { addCss, chooseBackgroundColorScheme, safeMatch } from "../utils";
import {
    getNormalizedHashtagName,
    linkInChildren,
    TAG_POSITIONS,
    TAG_SELECTOR,
    watchSiteTheme,
} from "./shared";
import { css } from "@lit/reactive-element";
import { addCleanup } from "../lifecycle";

// #region hook and utils

/** Twitter user IDs by lowercased screen name */
const TWITTER_USER_IDS = new Map<string, string>();
const TWITTER_DATA_EVENT = "tpt-twitter-users";

// User IDs are mostly not in the DOM, so collect them from the API responses.
// Has to be set up before Twitter sends its first requests.
async function hookTwitterApi() {
    // Runs in the page context, as the userscript can be sandboxed from the page's XHR.
    // Can't use anything from the userscript, so the found users are sent back via an event.
    const pageHook = () => {
        document.documentElement.dataset.tptHooked = "";
        const sent = new Set();
        const { open } = XMLHttpRequest.prototype;
        // @ts-ignore
        XMLHttpRequest.prototype.open = function hookedOpen(...args) {
            if (String(args[1]).includes("/graphql/")) {
                this.addEventListener("load", () => {
                    if (this.status !== 200 || typeof this.response !== "string") return;
                    const users: Record<string, string> = {};
                    // Not using a JSON.parse reviver, as other scripts may override JSON.parse without it
                    /** @param {any} value */
                    const findUsers = (value: any) => {
                        if (!value || typeof value !== "object") return;
                        const screenName = value.core?.screen_name ?? value.legacy?.screen_name;
                        if (
                            value.__typename === "User" &&
                            value.rest_id &&
                            screenName &&
                            !sent.has(value.rest_id)
                        ) {
                            users[screenName.toLowerCase()] = value.rest_id;
                            sent.add(value.rest_id);
                        }
                        for (const child of Object.values(value)) findUsers(child);
                    };
                    try {
                        findUsers(JSON.parse(this.response));
                    } catch {}
                    if (Object.keys(users).length === 0) return;
                    document.dispatchEvent(
                        new CustomEvent("tpt-twitter-users", {
                            detail: JSON.stringify(users),
                        }),
                    );
                });
            }
            // @ts-ignore
            return open.apply(this, args);
        };
    };

    document.addEventListener("tpt-twitter-users", (ev) => {
        const users: Record<string, string> = JSON.parse((ev as CustomEvent).detail);
        for (const [screenName, id] of Object.entries(users)) TWITTER_USER_IDS.set(screenName, id);
    });
    // Inject via blob link which isn't blocked by CSP
    const scriptUrl = URL.createObjectURL(
        new Blob([`(${pageHook})()`.replaceAll("TWITTER_DATA_EVENT", `"${TWITTER_DATA_EVENT}"`)]),
    );
    try {
        const elem = await GM.addElement(document.documentElement, "script", { src: scriptUrl });
        elem?.remove();
    } catch {}
    URL.revokeObjectURL(scriptUrl);
    // If the script still didn't run, hope the userscript isn't sandboxed
    if (!("tptHooked" in document.documentElement.dataset)) pageHook();
}
// Not in initializeTwitter, as Twitter's async scripts may send requests before DOMContentLoaded
if (window.location.host === "x.com") hookTwitterApi();

// Artists who changed their username are still findable by the intent URL
const withIntentUrl = (profileUrl: string, userId?: string | null) => {
    if (!profileUrl) return null;
    const screenName = safeMatch(profileUrl, /\/(\w+)$/, 1).toLowerCase();
    const id = userId || TWITTER_USER_IDS.get(screenName);
    return id ? [profileUrl, `https://x.com/i/user/${id}`] : profileUrl;
};

// User ID from the profile's schema, only if it belongs to the current page
const userIdFromSchema = (screenName: string) => {
    try {
        const { mainEntity } = JSON.parse(
            $("script[data-testid='UserProfileSchema-test']")[0]?.textContent ?? "",
        );
        if (mainEntity?.additionalName?.toLowerCase() === screenName.toLowerCase()) {
            return String(mainEntity.identifier);
        }
    } catch {}
    return null;
};

// User ID from the follow button of a user cell or a hover card
const userIdFromFollowButton = (el: HTMLElement) =>
    safeMatch(
        $(el)
            .closest("[data-testid='UserCell'], [data-testid='HoverCard']")
            .find("[data-testid$='-follow'], [data-testid$='-unfollow']")[0]?.dataset.testid ?? "",
        /^\d+/,
    );

const URLfromLocation = () => {
    const screenName = safeMatch(window.location.pathname, /\w+/);
    return withIntentUrl(`https://x.com/${screenName}`, userIdFromSchema(screenName));
};

// #endregion

export default function initializeTwitter(findAndTranslate: FindAndTranslate) {
    watchSiteTheme(document.body, "style", (body) => chooseBackgroundColorScheme(body).theme);

    addCss(css`
        .tpt-artists {
            font-family:
                system-ui,
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                Ubuntu,
                "Helvetica Neue",
                sans-serif;
        }
    `);

    // Tags https://x.com/mugosatomi/status/1173231575959363584
    findAndTranslate(
        "tag",
        "a[href^='/hashtag/']",
        {
            asyncMode: true,
            toTagName: getNormalizedHashtagName,
        },
        "tags",
    );

    // Floating name of a channel https://x.com/mugosatomi
    const channelNameSelector = "div[data-testid='primaryColumn']>div>:first-child h2>div>div>div";

    // #region floating channel

    const translateChannelName = (elem: HTMLElement) => {
        $(elem).nextAll(TAG_SELECTOR).remove();
        const channel = () => safeMatch(window.location.pathname, /\w+/);
        const currentChannel = channel();
        findAndTranslate(
            "artist",
            elem,
            {
                requiredAttributes: "#text",
                toProfileUrl: URLfromLocation,
                classes: "inline",
                // The response may arrive after switching to another channel
                onadded: (tag) => {
                    if (channel() !== currentChannel) tag.remove();
                },
            },
            "channel header",
        );
    };
    // On switching to a channel from another channel, Twitter updates only text nodes
    // so, for correct work, it's required to watch for
    // the channel name regardless whether it was translated
    // The per-element watchers stop themselves after restart, so they aren't kept alive till then
    let disposed = false;
    addCleanup(() => (disposed = true), true);
    /** Channel names already watched, Twitter may insert the same element again */
    const watchedChannelNames = new WeakSet<HTMLElement>();
    const watchForChanges = (elem: HTMLElement) => {
        if (watchedChannelNames.has(elem) || elem.matches(TAG_SELECTOR)) return;
        watchedChannelNames.add(elem);
        translateChannelName(elem);
        const watcher = new MutationObserver(() => {
            if (disposed) {
                watcher.disconnect();
                return;
            }
            translateChannelName(elem);
        });
        watcher.observe(elem, { characterData: true, subtree: true });
    };
    /**
     * Finds channel names in the inserted subtree. The name is always `h2>div>div>div`,
     * so check only the headers instead of matching every inserted element.
     */
    const findChannelNames = (node: Node) => {
        if (!(node instanceof HTMLElement)) return;
        // the node is either inside a header or may contain headers
        const header = node.closest("h2");
        const headers = header ? [header] : node.getElementsByTagName("h2");
        for (const h2 of headers) {
            for (const elem of h2.querySelectorAll<HTMLElement>(":scope>div>div>div")) {
                if (elem.matches(channelNameSelector)) watchForChanges(elem);
            }
        }
    };
    $(channelNameSelector).forEach(watchForChanges);
    const channelNameWatcher = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) findChannelNames(node);
        }
    });
    channelNameWatcher.observe(document.body, { childList: true, subtree: true });
    addCleanup(() => channelNameWatcher.disconnect(), true);
    // The profile schema is added to <head> after the channel name is rendered,
    // so translate the channel name again once the schema is available
    let lastSchema = "";
    const schemaWatcher = new MutationObserver(() => {
        const schema = $("script[data-testid='UserProfileSchema-test']")[0]?.textContent ?? "";
        if (schema === lastSchema) return;
        lastSchema = schema;
        if (!schema) return;
        $(channelNameSelector)
            .filter((elem) => !elem.matches(TAG_SELECTOR))
            .forEach(translateChannelName);
    });
    schemaWatcher.observe(document.head, { childList: true, subtree: true, characterData: true });
    addCleanup(() => schemaWatcher.disconnect(), true);

    // #endregion

    findAndTranslate(
        "artist",
        // desktop, mobile
        "main>div>button:first-child+div span>div, h1.text-headline1",
        {
            toProfileUrl: URLfromLocation,
            classes: "inline",
            asyncMode: true,
        },
        "channel header new",
    );

    // Deleted channel https://x.com/6o2_iii
    findAndTranslate(
        "artist",
        // old, new desktop, new mobile
        `[data-testid="emptyState"] div.r-1vr29t4 > span.r-qvutc0:not(:empty), main:not(:has(section, h1)) [data-top-chrome] h2, h2.text-title2:has(+p)`,
        {
            toProfileUrl: URLfromLocation,
            classes: "inline",
            asyncMode: true,
        },
        "delete artist profile",
    );

    // Tweet, expanded tweet, comment authors, "in this photo", people in sidebar
    // https://x.com/mugosatomi/status/1173231575959363584
    // https://x.com/Merryweatherey/status/1029008151411023872/media_tags
    findAndTranslate(
        "artist",
        "div.r-1wbh5a2.r-18u37iz:has(>div>a.r-1wbh5a2[tabindex]), span:has(>a>span.text-secondary)",
        {
            toProfileUrl: (el) => withIntentUrl(linkInChildren(el), userIdFromFollowButton(el)),
            asyncMode: true,
            // classes: "inline",
            css: css`
                div > ARTIST_TAG {
                    margin-left: 0.5em;
                }
                /* "in this photo", people in sidebar */
                [data-testid="UserCell"] ARTIST_TAG {
                    display: block;
                    margin-left: 0;
                }
                /* prevent overlaying twitter handle and pub.time with the tag */
                div:has(> ARTIST_TAG) {
                    flex-shrink: 0;
                }
            `,
        },
        "tweet/comment author",
    );

    // Quoted tweets https://x.com/Murata_Range/status/1108340994557140997
    findAndTranslate(
        "artist",
        "[data-testid=User-Name] [tabindex]:not([role]) > div.r-1wvb978",
        {
            toProfileUrl: (el) => withIntentUrl(`https://x.com/${el.textContent?.slice(1)}`),
            asyncMode: true,
            classes: "inline",
            css: css`
                [data-testid="User-Name"] [tabindex]:not([role]) {
                    flex-direction: row;
                }
            `,
        },
        "quoted tweet author",
    );

    // User card info
    findAndTranslate(
        "artist",
        "div.r-nsbfu8 a + div a",
        {
            toProfileUrl: (el) =>
                withIntentUrl((el as HTMLAnchorElement).href, userIdFromFollowButton(el)),
            tagPosition: TAG_POSITIONS.afterParent,
            asyncMode: true,
        },
        "artist popup",
    );
}
