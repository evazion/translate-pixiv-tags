import { safeMatch } from "../utils";
import { preventSiteNavigation, TAG_POSITIONS } from "./shared";

export default function initializeWeiboMobile(findAndTranslate: FindAndTranslate) {
    const url = (id: string) => (id ? `https://www.weibo.com/u/${id}` : "");

    // Profile page
    // https://m.weibo.cn/u/7500749495
    findAndTranslate(
        "artist",
        ".profile-cover .mod-fil-n span.txt-shadow:first-child",
        {
            asyncMode: true,
            toProfileUrl: () => url(safeMatch(window.location.pathname, /\d+/)),
            classes: "inline txt-shadow",
        },
        "artist profile",
    );

    // feed post
    // https://m.weibo.cn/u/7500749495
    findAndTranslate(
        "artist",
        "a:not([href]) > h3",
        {
            asyncMode: true,
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
        },
        "feed post",
    );

    // post page
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate(
        "artist",
        "[href^='/profile/'] > h3",
        {
            asyncMode: true,
            toProfileUrl: (el) => url(safeMatch((el.parentElement as HTMLAnchorElement).href, /\d+/)),
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
            onadded: preventSiteNavigation,
        },
        "post author",
    );

    // post tag
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate(
        "tag",
        "a[href][data-hide][href*='/search?']",
        {
            asyncMode: true,
            toTagName: (el) => el.textContent?.slice(1, -1) || "",
            classes: "inline",
        },
        "post tag",
    );

    // post commenter
    // https://m.weibo.cn/detail/5138330935886987
    findAndTranslate(
        "artist",
        ".comment-content .card-main h4",
        {
            asyncMode: true,
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
        },
        "post commenter",
    );
}
