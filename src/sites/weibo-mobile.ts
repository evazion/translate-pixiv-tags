import { safeMatchMemoized } from "../utils";
import { preventSiteNavigation, TAG_POSITIONS } from "./shared";

export default function initializeWeiboMobile(findAndTranslate: FindAndTranslate) {
    const url = (id: string) => (id ? `https://www.weibo.com/u/${id}` : "");

    // Profile page
    // https://m.weibo.cn/u/7500749495
    findAndTranslate("artist", "span.txt-shadow", {
        asyncMode: true,
        predicate: ".profile-cover .mod-fil-n span",
        toProfileUrl: () => url(safeMatchMemoized(window.location.pathname, /\d+/)),
        classes: "inline txt-shadow",
        ruleName: "artist profile",
    });

    // feed post
    // https://m.weibo.cn/u/7500749495
    findAndTranslate("artist", "h3", {
        asyncMode: true,
        predicate: "a:not([href]) > h3",
        toProfileUrl: (el) => {
            let node = el.parentElement;
            let id;
            // eslint-disable-next-line no-underscore-dangle, max-len, no-cond-assign
            while (node && !(id = (node as any).__vue__?._data?.carddata?.mblog?.user?.id)) {
                node = node.parentElement;
            }
            if (!node || !id) return null;
            return url(id);
        },
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        onadded: preventSiteNavigation,
        ruleName: "feed post",
    });

    // post page
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate("artist", "h3", {
        asyncMode: true,
        predicate: "[href^='/profile/'] > h3",
        toProfileUrl: (el) =>
            url(safeMatchMemoized((el.parentElement as HTMLAnchorElement).href, /\d+/)),
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        onadded: preventSiteNavigation,
        ruleName: "post author",
    });

    // post tag
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate("tag", "a[href][data-hide]", {
        asyncMode: true,
        predicate: "[href*='/search?']",
        toTagName: (el) => el.textContent?.slice(1, -1) || "",
        classes: "inline",
        ruleName: "post tag",
    });

    // post commenter
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate("artist", "h4", {
        asyncMode: true,
        predicate: ".comment-content .card-main h4",
        toProfileUrl: (el) => {
            let node = el.parentElement;
            let id;
            // eslint-disable-next-line no-underscore-dangle, max-len, no-cond-assign
            while (node && !(id = (node as any).__vue__?._props?.item?.user?.id)) {
                node = node.parentElement;
            }
            if (!node || !id) return null;
            return url(id);
        },
        classes: "inline",
        ruleName: "post commenter",
    });
}
