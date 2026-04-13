import { memoize } from "underscore";
import { css } from "lit";
import { preventSiteNavigation, TAG_POSITIONS } from "./shared";

export default function initializeFanbox(findAndTranslate: FindAndTranslate) {
    const getPixivLink = async (userNick: string) => {
        // Use direct query
        const resp = await fetch(`https://api.fanbox.cc/creator.get?creatorId=${userNick}`).then(
            (r) => r.json(),
        );
        return `https://www.pixiv.net/users/${resp.body.user.userId}`;
    };
    const getPixivLinkMemoized = memoize(getPixivLink);

    /**
     * @param {Omit<TranslationOptions, "mode">} options
     * @param {HTMLElement} el
     */
    const addPixivTranslation = (options: Omit<TranslationOptions, "mode">, el: HTMLElement) => {
        const url = new URL(el.closest("a")?.href ?? window.location.href);
        const userNick =
            url.host === "www.fanbox.cc"
                ? url.pathname.match(/[\w-]+/)?.[0]
                : url.host.match(/[\w-]+/)?.[0];
        if (!userNick) return null;
        getPixivLinkMemoized(userNick).then((pixivLink) =>
            findAndTranslate("artist", el, {
                ...options,
                toProfileUrl: () => pixivLink,
            }),
        );
        // Allow to translate artist by fanbox link
        return url.origin;
    };

    // https://agahari.fanbox.cc/
    // channel header
    findAndTranslate("artist", "a", {
        predicate: "h1 > a",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            classes: "inline",
            ruleName: "channel header pixiv",
        }),
        classes: "inline",
        ruleName: "channel header fanbox",
    });

    // Creators on the index page https://www.fanbox.cc/
    findAndTranslate("artist", "div", {
        predicate: "div[class^=Creator__Name]",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            classes: "inline",
            ruleName: "find creator index pixiv",
        }),
        ruleName: "find creator index",
        css: css`
            div[class^="Creator__Name"] {
                margin: -6px;
            }
        `,
    });

    // Find more creators https://www.fanbox.cc/creators/find
    findAndTranslate("artist", "a", {
        predicate: "a[class^=styled__UserNameText]",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            classes: "inline",
            ruleName: "find creator more pixiv",
        }),
        ruleName: "find creator more",
        classes: "inline",
    });

    // Front page - supported creators list
    findAndTranslate("artist", "div", {
        predicate: "div[class^=PlanOnlyUserInfo__UserName]",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            tagPosition: TAG_POSITIONS.beforeend,
            ruleName: "supported pixiv",
        }),
        tagPosition: TAG_POSITIONS.beforeend,
        css: css`
            div[class^="PlanOnlyUserInfo__UserName"]:has(ARTIST_TAG) {
                line-height: 20px !important;
            }
        `,
        ruleName: "supported fanbox",
    });

    // Front page - feed
    findAndTranslate("artist", "div", {
        predicate: "div[class^=PostItem__UserName]",
        asyncMode: true,
        toProfileUrl: addPixivTranslation.bind(null, {
            classes: "inline",
            tagPosition: TAG_POSITIONS.beforeend,
            ruleName: "post pixiv",
        }),
        classes: "inline",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "post fanbox",
    });

    // https://morinohon.fanbox.cc/posts/5055514
    // post tags
    findAndTranslate("tag", "div", {
        predicate: "div[class^=Tag__Text]",
        asyncMode: true,
        classes: "inline",
        ruleName: "post tag fanbox",
        onadded: preventSiteNavigation,
    });

    // https://morinohon.fanbox.cc/tags/ブレイブソード×ブレイズソウル
    // searched tag
    findAndTranslate("tag", "div", {
        predicate: "div[class^=TagPage__Count]",
        tagPosition: TAG_POSITIONS.beforebegin,
        toTagName: (el) => el.previousSibling?.textContent ?? null,
        asyncMode: true,
        classes: "inline",
        css: css`
            /* fix multiline text */
            div[class^="TagPage__TagTitle"] {
                display: block;
            }
            div[class^="TagPage__Count"] {
                display: inline-block;
                vertical-align: middle;
            }
        `,
        ruleName: "search tag fanbox",
    });
}
