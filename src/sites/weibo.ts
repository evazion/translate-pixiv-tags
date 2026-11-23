import $ from "../dom";
import { css } from "../utils";
import { safeMatch } from "../utils";
import { preventSiteNavigation, TAG_POSITIONS, watchSiteTheme } from "./shared";

export default function initializeWeibo(findAndTranslate: FindAndTranslate) {
    watchSiteTheme(document.documentElement, "data-theme", (html) => {
        switch (html.dataset.theme) {
            case "dark":
                return "dark";
            case "light":
                return "light";
            default:
                return "auto";
        }
    });

    const url = (id: string) => (id ? `https://www.weibo.com/u/${id}` : "");

    // Profile page
    // https://www.weibo.com/u/7500749495
    findAndTranslate(
        "artist",
        "div[iconclickable='false'] + div>div>div:not(:has(*))",
        {
            asyncMode: true,
            toProfileUrl: (el) =>
                url(
                    safeMatch(
                        ($(el).parent().parent().nextAll("a")[0] as HTMLAnchorElement | undefined)
                            ?.href,
                        /to_uid=(\d+)/,
                        1,
                    ),
                ),
            classes: "inline",
        },
        "artist profile",
    );

    // feed post, post page
    // https://www.weibo.com/u/7500749495
    findAndTranslate(
        "artist",
        "article header a[usercard][href*='/u/']:not([aria-label])",
        {
            asyncMode: true,
            classes: "inline",
        },
        "artist post",
    );

    // feed re-post
    // https://www.weibo.com/u/7500749495
    findAndTranslate(
        "artist",
        "article header a[href*='/n/']",
        {
            asyncMode: true,
            toProfileUrl: (el) =>
                url(
                    safeMatch(
                        ($(el).parent().next().find("a")[0] as HTMLAnchorElement | undefined)?.href,
                        /\d+/,
                    ),
                ),
            classes: "inline",
            css: css`
                ARTIST_TAG {
                    margin-right: 1ch;
                }
            `,
        },
        "artist re-post",
    );

    // user popup
    // https://www.weibo.com/u/7500749495
    findAndTranslate(
        "artist",
        ".popcard > :first-child > :first-child a:first-child + a:not(:has(*))",
        {
            asyncMode: true,
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
            css: css`
                ARTIST_TAG {
                    text-shadow: 0 0 5px black;
                }
            `,
        },
        "artist popup",
    );

    // post comment
    // https://www.weibo.com/7500749495/Pg5a5oHtp
    findAndTranslate(
        "artist",
        "#scroller a[usercard]",
        {
            asyncMode: true,
            classes: "inline",
        },
        "post commenter",
    );

    // post tag
    // https://www.weibo.com/7500749495/Pg2WWBzUr
    findAndTranslate(
        "tag",
        ":is(.wbpro-feed-content, .retweet) a[target][href*='/weibo?q=']",
        {
            asyncMode: true,
            toTagName: (el) => el.textContent?.slice(1, -1) || "",
            classes: "inline",
        },
        "post tag",
    );

    // recommended user on sidebar
    // https://www.weibo.com/u/7500749495
    findAndTranslate(
        "artist",
        ".wbpro-side[page='profileRecom'] a + div > a:first-child",
        {
            asyncMode: true,
            onadded: preventSiteNavigation,
            css: css`
                ARTIST_TAG {
                    font-size: 13px;
                    display: block;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `,
        },
        "sidebar user",
    );
}
