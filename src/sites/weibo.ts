import $ from "jquery";
import { css } from "lit";
import { safeMatchMemoized } from "../utils";
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
    findAndTranslate("artist", "div", {
        asyncMode: true,
        predicate: "div[class^='ProfileHeader_name_']",
        toProfileUrl: (el) =>
            url(
                safeMatchMemoized(
                    $(el).parent().parent().nextAll("a").prop("href"),
                    /to_uid=(\d+)/,
                    1,
                ),
            ),
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
        toProfileUrl: (el) =>
            url(safeMatchMemoized($(el).parent().next().find("a").prop("href"), /\d+/)),
        classes: "inline",
        ruleName: "artist re-post",
        css: css`
            ARTIST_TAG {
                margin-right: 1ch;
            }
        `,
    });

    // user popup
    // https://www.weibo.com/u/7500749495
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".popcard > :first-child > :first-child a[class*='PopCard_']",
        toProfileUrl: (el) =>
            url(
                safeMatchMemoized(
                    $(el).parents(".popcard").find("a[href^='/u/page/follow/']").prop("href"),
                    /\d+/,
                ),
            ),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        css: css`
            ARTIST_TAG {
                text-shadow: 0 0 5px black;
            }
        `,
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
        css: css`
            ARTIST_TAG {
                font-size: 13px;
            }
        `,
        ruleName: "sidebar user",
    });
}
