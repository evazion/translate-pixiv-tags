import $ from "jquery";
import { css } from "lit";
import { MutationSummary } from "mutation-summary";
import { addCss, chooseBackgroundColorScheme, safeMatchMemoized } from "../utils";
import {
    getNormalizedHashtagName,
    linkInChildren,
    TAG_POSITIONS,
    TAG_SELECTOR,
    watchSiteTheme,
} from "./shared";

export default function initializeTwitter(findAndTranslate: FindAndTranslate) {
    watchSiteTheme(document.body, "style", (body) => chooseBackgroundColorScheme(body).theme);

    addCss(css`
        .tpt-artist {
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
    findAndTranslate("tag", "a[role='link']", {
        predicate: "a[href^='/hashtag/']",
        asyncMode: true,
        toTagName: getNormalizedHashtagName,
        ruleName: "tags",
    });

    // Floating name of a channel https://x.com/mugosatomi
    const URLfromLocation = () =>
        `https://x.com${safeMatchMemoized(window.location.pathname, /\/\w+/)}`;
    const channelNameSelector = "div[data-testid='primaryColumn']>div>:first-child h2>div>div>div";
    // On switching to a channel from another channel, Twitter updates only text nodes
    // so, for correct work, it's required to watch for
    // the channel name regardless whether it was translated
    const watchForChanges = (elem: Node) => {
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
    $(channelNameSelector).each((_i, elem) => watchForChanges(elem));
    new MutationSummary({
        queries: [{ element: "div" }],
        // eslint-disable-next-line unicorn/no-array-for-each
        callback: ([summary]) => summary.added.forEach(watchForChanges),
    });

    // Deleted channel https://x.com/6o2_iii
    findAndTranslate("artist", "span.r-qvutc0", {
        predicate: `[data-testid="emptyState"] div.r-1vr29t4 > .r-qvutc0:not(:empty)`,
        toProfileUrl: URLfromLocation,
        classes: "inline",
        asyncMode: true,
        ruleName: "delete artist profile",
    });

    // Tweet, expanded tweet, comment authors, "in this photo", people in sidebar
    // https://x.com/mugosatomi/status/1173231575959363584
    // https://x.com/Merryweatherey/status/1029008151411023872/media_tags
    findAndTranslate("artist", "div.r-1wbh5a2.r-18u37iz", {
        predicate: `div:has(>div>a.r-1wbh5a2[tabindex])`,
        toProfileUrl: linkInChildren,
        asyncMode: true,
        classes: "inline",
        css: css`
            /* "in this photo", people in sidebar */
            [data-testid="UserCell"] ARTIST_TAG {
                display: block;
                margin-left: 0;
            }
        `,
        ruleName: "tweet/comment author",
    });

    // Quoted tweets https://x.com/Murata_Range/status/1108340994557140997
    findAndTranslate("artist", "div.r-1wvb978", {
        predicate: "[data-testid=User-Name] [tabindex]:not([role]) > div",
        toProfileUrl: (el) => `https://x.com/${el.textContent?.slice(1)}`,
        asyncMode: true,
        classes: "inline",
        css: css`
            [data-testid="User-Name"] [tabindex]:not([role]) {
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
