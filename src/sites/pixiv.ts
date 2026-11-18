import $ from "../dom";
import { css } from "lit";
import { safeMatch } from "../utils";
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
        },
        "simple tags",
    );

    // https://dic.pixiv.net/a/東方
    findAndTranslate(
        "tag",
        "#article-content-header #article-name",
        {
            tagPosition: TAG_POSITIONS.beforeend,
            toTagName: getNormalizedTagName,
            classes: "tpt-light",
        },
        "wiki tag",
    );

    // Tags on work pages: https://www.pixiv.net/en/artworks/66475847
    findAndTranslate(
        "tag",
        "figcaption li > span > span:first-child",
        {
            toTagName: getNormalizedTagName,
            asyncMode: true,
            css: css`
                /* Prevent adding # to translated tags */
                TPT_TAG a::before {
                    content: none;
                }
                /* Hide Pixiv's translated tags */
                TPT_TAG + span .gtm-new-work-romaji-tag-event-click,
                TPT_TAG + span .gtm-new-work-translate-tag-event-click {
                    display: none;
                }
            `,
        },
        "artwork tags",
    );

    // Main tag on search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    findAndTranslate(
        "tag",
        `[data-ga4-label="keyword_details"] div[data-line-limit][title]`,
        {
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
        },
        "search tag",
    );

    // Tags in box:
    // Search page: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    // The index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    // Artist profile: https://www.pixiv.net/en/users/104471/illustrations
    findAndTranslate(
        "tag",
        ":is(a,button):is([color],[data-ga4-label=colorful_tag])>div",
        {
            tagPosition: TAG_POSITIONS.afterbegin,
            toTagName: (el) => el.lastElementChild?.textContent ?? null,
            asyncMode: true,
            classes: "no-brackets tpt-light",
            css: css`
                /* Hide Pixiv's translated tags */
                TPT_TAG + :not(:last-child) {
                    display: none;
                }
                TPT_TAG ~ div:last-child {
                    font-weight: normal;
                    font-size: 10px;
                }
                :is(a, button):is([color], [data-ga4-label="colorful_tag"]) {
                    text-shadow: 0 0 5px #0003;
                    & > div:not(#id) {
                        max-width: initial;
                    }
                    & > div > TPT_TAG a:not(#id) {
                        font-weight: bold;
                        text-shadow: 0 0 5px #fff4;
                        /* make colors more dark */
                        color: hsl(from var(--color) h s min(l, 30)) !important;
                    }
                }
            `,
            // Fix bad contrast of tag color over colored bg
            onadded: (tag) => {
                preventSiteNavigation(tag);
                // TODO generalize
                const $tag = $(tag);
                const [category = 2] = $tag.find("a,button")[0]?.className.match(/\d/) ?? [];
                const hue = [230, 5, 0, 300, 110, 50][+category];
                const color = `hsl(${hue + Math.random() * 40 - 20}, 35%, 65%)`;
                for (const el of $tag.closest("a,button")) el.style.backgroundColor = color;
            },
        },
        "related tag",
    );

    // Popular tags on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate(
        "tag",
        "a[data-ga4-label=trend_tag_thumbnail]>div>div>div>div:first-child",
        {
            tagPosition: TAG_POSITIONS.beforebegin,
            asyncMode: true,
            classes: "no-brackets dark-shadow",
            css: css`
                TPT_TAG {
                    text-shadow:
                        0 0 3px #000b,
                        0 0 1px #0008;
                    a {
                        /* make colors more light */
                        color: hsl(from var(--color) h s max(l, 45)) !important;
                    }
                    & + div {
                        display: none;
                    }
                }
            `,
            onadded: preventSiteNavigation,
        },
        "trending tag",
    );

    // Ranking of artists on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate(
        "artist",
        "[data-ga4-label=ranking_link]+div>div>div:first-child>div:last-child>div>a:last-child",
        {
            requiredAttributes: "href",
            tagPosition: TAG_POSITIONS.afterend,
            asyncMode: true,
            classes: "inline pointer-events-auto",
            css: css`
                ARTIST_TAG {
                    text-shadow: 0 0 3px #000;
                }
            `,
            onadded: deleteOnUrlChange,
        },
        "ranking artist of day",
    );

    // Illust author aside https://www.pixiv.net/en/artworks/66475847
    // Illust author below https://www.pixiv.net/en/artworks/66475847
    findAndTranslate(
        "artist",
        "main+aside>section>h2>div>div>a, main>section h2>div>div>a",
        {
            requiredAttributes: "href",
            tagPosition: {
                insertTag: (container, elem) => container.closest("h2")?.prepend(elem),
                findTag: (container) =>
                    container.closest("h2")?.querySelector<HTMLElement>(TAG_SELECTOR) ?? null,
                getTagContainer: (elem) =>
                    elem.parentElement?.querySelector<HTMLElement>(":scope div>div>a") ?? null,
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
        },
        "illust artist",
    );

    // Related work's artists https://www.pixiv.net/en/artworks/66475847
    // New search pages: https://www.pixiv.net/en/tags/%E6%9D%B1%E6%96%B9project/artworks
    // Bookmarks: https://www.pixiv.net/en/users/29310/bookmarks/artworks
    // Thumbs on the index page: https://www.pixiv.net/ https://www.pixiv.net/en/
    // Posts of followed artists: https://www.pixiv.net/bookmark_new_illust.php
    // Posts discovery: https://www.pixiv.net/discovery?mode=safe
    findAndTranslate(
        "artist",
        `:is([data-ga4-label="thumbnail"]>div, :is(section, [data-gtm-recommend-zone="discovery"]) :is(ul>*>div,ul>*>div>div))>div:last-child>div[aria-haspopup]>a:last-child`,
        {
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
        },
        "artist below illust thumb",
    );

    // Artist profile pages: https://www.pixiv.net/en/users/29310, https://www.pixiv.net/en/users/104471/illustrations
    const normalizePageUrl = () =>
        `https://www.pixiv.net/users/${safeMatch(window.location.pathname, /\d+/)}`;
    findAndTranslate(
        "artist",
        "h1",
        {
            predicate: () => !!safeMatch(window.location.pathname, /^(\/en)?\/users\/\d+/),
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
        },
        "artist profile",
    );

    // Deleted artist profile: https://www.pixiv.net/en/users/1843825
    // findAndTranslate(
    //     "artist",
    //     "#root>div>div>div>h1",
    //     {
    //         asyncMode: true,
    //         // Trigger only on profile page
    //         toProfileUrl: () => (safeMatchMemoized(window.location.pathname, /^\/(en\/)?users/)
    //             ? normalizePageUrl()
    //             : ""),
    //         tagPosition: TAG_POSITIONS.beforebegin,
    //     },
    //     "deleted artist profile",
    // );

    // Ranking pages: https://www.pixiv.net/ranking.php?mode=original
    // User discovery: https://www.pixiv.net/discovery/users
    findAndTranslate(
        "artist",
        `ol a+a[data-ga4-label="user_name_link"], ul a+div>div>a[data-ga4-label="user_name_link"]`,
        {
            asyncMode: true,
            classes: "inline",
            tagPosition: TAG_POSITIONS.afterParent,
        },
        "ranking artist",
    );

    // Artist info modern popup
    findAndTranslate(
        "artist",
        "div[open] a+a[class][data-gtm-value]",
        {
            asyncMode: true,
        },
        "artist info modern popup",
    );

    // Artist info old popup
    findAndTranslate(
        "artist",
        "a.user-name",
        {
            classes: "inline",
            asyncMode: true,
        },
        "artist info old popup",
    );

    // The main "posts" on the index page feed:
    // https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate(
        "artist",
        "[data-ga4-label=home_recommend]>div>div>div>[aria-haspopup]>div>a+div>a",
        {
            asyncMode: true,
            css: css`
                ARTIST_TAG {
                    line-height: 0;
                    div:has(> &) {
                        -webkit-line-clamp: 2;
                    }
                }
            `,
        },
        "index feed",
    );

    // Sidebar of recommended artists on the index page:
    // https://www.pixiv.net/ https://www.pixiv.net/en/
    findAndTranslate(
        "artist",
        "section>div>div>.sticky [aria-haspopup]>a:first-child+div>a:first-child",
        {
            asyncMode: true,
            css: css`
                ARTIST_TAG {
                    line-height: 0;
                }
            `,
        },
        "recommended artist sidebar",
    );

    // Winners of a contest
    // https://www.pixiv.net/contest/touhoulostword
    findAndTranslate(
        "artist",
        ".user-info>a>span.user-name",
        {
            classes: "inline",
            css: css`
                .user-view-popup:has(ARTIST_TAG) {
                    display: grid;
                    grid-template-columns: 30px 1fr;
                    > :first-child {
                        grid-row: 1/3;
                    }
                    > :nth-child(2) {
                        grid-column-start: 2;
                        line-height: 15px;
                    }
                    > :last-child {
                        grid-column-start: 2;
                        line-height: 15px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        color: black;
                    }
                }
            `,
        },
        "contest winner",
    );

    // Participants of a contest
    // https://www.pixiv.net/contest/touhoulostword
    findAndTranslate(
        "artist",
        "._user-icon-container>a",
        {
            classes: "inline",
            asyncMode: true,
        },
        "contest participant",
    );
}
