import { css } from "../utils";
import { memoize } from "../utils";
import { preventSiteNavigation, TAG_POSITIONS } from "./shared";

export default function initializeFanbox(findAndTranslate: FindAndTranslate) {
    const getPixivLink = memoize(async (userNick: string) => {
        // Use direct query
        const resp = await fetch(`https://api.fanbox.cc/creator.get?creatorId=${userNick}`).then(
            (r) => r.json(),
        );
        return `https://www.pixiv.net/users/${resp.body.user.userId}`;
    });

    /**
     * Translates the artist by their pixiv profile as well
     * @param ruleName Name of the rule for the pixiv translation
     * @param options Translation options for the pixiv translation
     * @param el The element with the link to the fanbox creator
     */
    const addPixivTranslation = (
        ruleName: string,
        options: Omit<TranslationOptions, "mode">,
        el: HTMLElement,
    ) => {
        const url = new URL(el.closest("a")?.href ?? window.location.href);
        const userNick =
            url.host === "www.fanbox.cc"
                ? url.pathname.match(/[\w-]+/)?.[0]
                : url.host.match(/[\w-]+/)?.[0];
        if (!userNick) return null;
        getPixivLink(userNick).then((pixivLink) =>
            findAndTranslate(
                "artist",
                el,
                {
                    ...options,
                    asyncMode: false,
                    toProfileUrl: () => pixivLink,
                },
                ruleName,
            ),
        );
        // Allow to translate artist by fanbox link
        return url.origin;
    };

    // https://agahari.fanbox.cc/
    // channel header
    findAndTranslate(
        "artist",
        "h1 > a",
        {
            asyncMode: true,
            toProfileUrl: addPixivTranslation.bind(null, "channel header pixiv", {
                classes: "inline",
            }),
            classes: "inline",
        },
        "channel header fanbox",
    );

    // Creators on the index page https://www.fanbox.cc/
    findAndTranslate(
        "artist",
        "div[class^=Creator__Name]",
        {
            asyncMode: true,
            toProfileUrl: addPixivTranslation.bind(null, "find creator index pixiv", {
                classes: "inline",
            }),
            css: css`
                div[class^="Creator__Name"] {
                    margin: -6px;
                }
            `,
        },
        "find creator index",
    );

    // Find more creators https://www.fanbox.cc/creators/find
    findAndTranslate(
        "artist",
        "a[class^=styled__UserNameText]",
        {
            asyncMode: true,
            toProfileUrl: addPixivTranslation.bind(null, "find creator more pixiv", {
                classes: "inline",
            }),
            classes: "inline",
        },
        "find creator more",
    );

    // Front page - supported creators list
    findAndTranslate(
        "artist",
        "div[class^=PlanOnlyUserInfo__UserName]",
        {
            asyncMode: true,
            toProfileUrl: addPixivTranslation.bind(null, "supported pixiv", {
                tagPosition: TAG_POSITIONS.beforeend,
            }),
            tagPosition: TAG_POSITIONS.beforeend,
            css: css`
                div[class^="PlanOnlyUserInfo__UserName"]:has(ARTIST_TAG) {
                    line-height: 20px !important;
                }
            `,
        },
        "supported fanbox",
    );

    // Front page - feed
    findAndTranslate(
        "artist",
        "div[class^=PostItem__UserName]",
        {
            asyncMode: true,
            toProfileUrl: addPixivTranslation.bind(null, "post pixiv", {
                classes: "inline",
                tagPosition: TAG_POSITIONS.beforeend,
            }),
            classes: "inline",
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "post fanbox",
    );

    // https://morinohon.fanbox.cc/posts/5055514
    // post tags
    findAndTranslate(
        "tag",
        "div[class^=Tag__Text]",
        {
            asyncMode: true,
            classes: "inline",
            onadded: preventSiteNavigation,
        },
        "post tag fanbox",
    );

    // https://morinohon.fanbox.cc/tags/ブレイブソード×ブレイズソウル
    // searched tag
    findAndTranslate(
        "tag",
        "div[class^=TagPage__Count]",
        {
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
        },
        "search tag fanbox",
    );
}
