import $ from "jquery";
import { css } from "lit";
import { safeMatchMemoized } from "../utils";
import {
    deleteOnUrlChange,
    preventSiteNavigation,
    TAG_POSITIONS,
    TAG_SELECTOR,
    watchSiteTheme,
} from "./shared";

export default function initializePixiv(findAndTranslate: FindAndTranslate) {
    watchSiteTheme(document.documentElement, "data-theme", (html) => {
        switch (html.dataset.theme) {
            case "dark":
                return "dark";
            case "default":
                return "light";
            default:
                return "auto";
        }
    });

    // To remove something like `50000users入り`, e.g. here https://www.pixiv.net/en/artworks/68318104
    const getNormalizedTagName = (el: HTMLElement) =>
        el.textContent?.replace(/\d+users入り$/, "") ?? null;

    findAndTranslate(
        "tag",
        [
            // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=123456
            ".work-tags-container .tag",
            // https://www.pixiv.net/tags.php
            // https://www.pixiv.net/novel/tags.php
            ".tag-list li .tag-value",
        ].join(", "),
        {
            toTagName: getNormalizedTagName,
            css: css`
                /* Display popular tags as vertical list */
                .tag-list.slash-separated li {
                    display: block;
                }
                .tag-list.slash-separated li + li:before {
                    content: none;
                }
            `,
            ruleName: "simple tags",
        },
    );

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
        css: css`
            /* Prevent adding # to translated tags */
            span.tpt-tags a::before {
                content: none;
            }
            /* Hide Pixiv's translated tags */
            .tpt-tags + span .gtm-new-work-romaji-tag-event-click,
            .tpt-tags + span .gtm-new-work-translate-tag-event-click {
                display: none;
            }
        `,
        ruleName: "artwork tags",
    });

    // Main tag on search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    findAndTranslate("tag", "div", {
        // eslint-disable-next-line max-len
        predicate: `[data-ga4-label="keyword_details"] [data-line-limit][title]`,
        asyncMode: true,
        tagPosition: TAG_POSITIONS.beforeend,
        css: css`
            ARTIST_TAG {
                font-size: 20px;
                font-weight: bold;
                align-self: center;
                div:has(> div > &) + div {
                    display: none;
                }
            }
        `,
        ruleName: "search tag",
    });

    // Tags in box:
    // Search page: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    // The index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    // Artist profile: https://www.pixiv.net/en/users/104471/illustrations
    findAndTranslate("tag", "div", {
        predicate: ":is(a,button):is([color],[data-ga4-label=colorful_tag])>div",
        tagPosition: TAG_POSITIONS.afterbegin,
        toTagName: (el) => el.lastElementChild?.textContent ?? null,
        asyncMode: true,
        classes: "no-brackets tpt-light",
        css: css`
            /* Hide Pixiv's translated tags */
            .tpt-tags + :not(:last-child) {
                display: none;
            }
            .tpt-tags ~ div:last-child {
                font-weight: normal;
                font-size: 10px;
            }
            :is(a, button):is([color], [data-ga4-label="colorful_tag"]) {
                text-shadow: 0 0 5px #0003;
                & > div:not(#id) {
                    max-width: initial;
                }
                & > div > .tpt-tags a:not(#id) {
                    font-weight: bold;
                    text-shadow: 0 0 5px #fff4;
                    /* make colors more dark */
                    color: hsl(from var(--color) h s min(l, 25%)) !important;
                }
            }
        `,
        // Fix bad contrast of tag color over colored bg
        onadded: (tag) => {
            preventSiteNavigation(tag);
            // TODO generalize
            const $tag = $(tag);
            const [category] = $tag.find("a,button").prop("className").match(/\d/) ?? [];
            const hue = [230, 5, 0, 300, 110, 50][category];
            $tag.closest("section,ul")
                .find("a:is([color],[data-ga4-label=colorful_tag]):not([style])")
                .css("background-color", () => `hsl(${Math.random() * 40 + 150}, 35%, 65%)`);
            $tag.closest("a,button").css(
                "background-color",
                `hsl(${hue + Math.random() * 40 - 20}, 35%, 65%)`,
            );
        },
        ruleName: "related tag",
    });

    // Popular tags on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("tag", "div", {
        predicate: "a[data-ga4-label=trend_tag_thumbnail]>div>div>div>div:first-child",
        tagPosition: TAG_POSITIONS.beforebegin,
        asyncMode: true,
        classes: "no-brackets dark-shadow",
        css: css`
            ARTIST_TAG {
                text-shadow:
                    0 0 3px #000b,
                    0 0 1px #0008;
                & + div {
                    display: none;
                }
            }
        `,
        onadded: preventSiteNavigation,
        ruleName: "trending tag",
    });

    // Ranking of artists on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("artist", "a", {
        predicate:
            "[data-ga4-label=ranking_link]+div>div>div:first-child>div:last-child>div>a:last-child",
        requiredAttributes: "href",
        tagPosition: TAG_POSITIONS.afterend,
        asyncMode: true,
        classes: "inline pointer-events-auto",
        css: css`
            ARTIST_TAG {
                text-shadow: 0 0 3px #000;
            }
        `,
        ruleName: "ranking artist of day",
        onadded: deleteOnUrlChange,
    });

    // Illust author aside https://www.pixiv.net/en/artworks/66475847
    // Illust author below https://www.pixiv.net/en/artworks/66475847
    findAndTranslate("artist", "a", {
        predicate: "main+aside>section>h2>div>div>a, main>section h2>div>div>a",
        requiredAttributes: "href",
        tagPosition: {
            insertTag: ($container, elem) => $container.closest("h2").prepend(elem),
            findTag: ($container) => $container.closest("h2").find(TAG_SELECTOR),
            getTagContainer: ($elem) => $elem.parent().find("div>div>a"),
        },
        asyncMode: true,
        onadded: deleteOnUrlChange,
        css: css`
            /* Locate artist tag without triggering native tooltip */
            main > section h2:not(#id),
            main + aside > section > h2:not(#id) {
                display: flex;
                flex-direction: column-reverse;
                align-items: flex-start;
            }
            main > section h2 > ARTIST_TAG + :not(ARTIST_TAG),
            main + aside > section > h2 > ARTIST_TAG + :not(ARTIST_TAG) {
                pointer-events: none;
            }
            main > section h2 > ARTIST_TAG + div > a,
            main > section h2 > ARTIST_TAG + div > div > *,
            main + aside > section > h2 > ARTIST_TAG + div > div > *,
            main + aside > section > h2 > ARTIST_TAG + div > a {
                pointer-events: all;
            }
            main > section h2 > ARTIST_TAG + div > ::after,
            main + aside > section > h2 > ARTIST_TAG + div > ::after {
                content: "";
                height: 18px;
            }
            main > section h2 > ARTIST_TAG + ARTIST_TAG + div > ::after,
            main + aside > section > h2 > ARTIST_TAG + ARTIST_TAG + div > ::after {
                height: 30px;
            }
            main > section h2 ARTIST_TAG,
            main + aside > section > h2 ARTIST_TAG {
                margin-left: 50px;
                height: 0;
                position: relative;
                top: -24px;
            }
            main > section h2 ARTIST_TAG + ARTIST_TAG,
            main + aside > section > h2 ARTIST_TAG + ARTIST_TAG {
                top: -38px;
            }
            main section h2 + button {
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
        predicate: `:is([data-ga4-label="thumbnail"]>div, section :is(ul>*>div,ul>*>div>div))>div:last-child>div[aria-haspopup]>a:last-child`,
        tagPosition: TAG_POSITIONS.afterParent,
        asyncMode: true,
        css: css`
            ARTIST_TAG {
                margin-left: 6px;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                /* Fix artist tag overflowing */
                div:has(> &) {
                    flex-direction: column;
                    align-items: flex-start;
                }
            }
        `,
        ruleName: "artist below illust thumb",
    });

    // Artist profile pages: https://www.pixiv.net/en/users/29310, https://www.pixiv.net/en/users/104471/illustrations
    const normalizePageUrl = () =>
        `https://www.pixiv.net/en/users/${safeMatchMemoized(window.location.pathname, /\d+/)}`;
    findAndTranslate("artist", "h1", {
        predicate: () => !!safeMatchMemoized(window.location.pathname, /^(\/en)?\/users\/\d+/),
        toProfileUrl: normalizePageUrl,
        asyncMode: true,
        css: css`
            /**
             * Locate the artist tag between the artist name and
             * followers count because there can be "premium" and
             * "accepting requests" labels to the right of the artist name
             */
            #__next div:has(> h1 + ARTIST_TAG):not(:has(p)) {
                display: grid;
                grid-gap: 4px;
                grid-auto-rows: 16px;
                grid-template-columns: auto auto 1fr;
                justify-items: start;
                ARTIST_TAG {
                    grid-row-start: 2;
                }
            }
            form div:has(> h1 + ARTIST_TAG) {
                flex-direction: column;
                h1 {
                    display: contents;
                    > :last-child {
                        order: 1;
                    }
                }
                ARTIST_TAG {
                    translate: 0 -10px;
                }
                button {
                    order: -1;
                    align-self: flex-end;
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
    findAndTranslate("artist", `a[data-ga4-label="user_name_link"]`, {
        asyncMode: true,
        predicate: `ol a+a`,
        tagPosition: TAG_POSITIONS.afterParent,
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

    // The main "posts" on the index page feed:
    // https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("artist", "a", {
        predicate: "[data-ga4-label=home_recommend]>div>div>div>[aria-haspopup]>div>a+div>a",
        tagPosition: TAG_POSITIONS.afterend,
        asyncMode: true,
        ruleName: "index feed",
        css: css`
            ARTIST_TAG {
                line-height: 0;
                div:has(> &) {
                    -webkit-line-clamp: 2;
                }
            }
        `,
    });

    // Sidebar of recommended artists on the index page:
    // https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate("artist", "a", {
        predicate: "section>div>div>.sticky [aria-haspopup]>a:first-child+div>a:first-child",
        tagPosition: TAG_POSITIONS.afterend,
        asyncMode: true,
        ruleName: "recommended artist sidebar",
        css: css`
            ARTIST_TAG {
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
}
