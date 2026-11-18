import { safeMatch } from "../utils";
import { preventSiteNavigation, TAG_POSITIONS } from "./shared";

export default function initializeCiEn(findAndTranslate: FindAndTranslate) {
    const getNormalizedUrl = (el: HTMLElement) => {
        const a = el as HTMLAnchorElement;
        return `https://ci-en.net/creator/${safeMatch(a.href, /\/creator\/(\d+)/, 1)}`;
    };

    // Artist name
    // In profile: https://ci-en.dlsite.com/creator/4126
    // In article: https://ci-en.dlsite.com/creator/4126/article/1035340
    findAndTranslate(
        "artist",
        ".c-grid-account-name .e-title > a",
        {
            asyncMode: true,
            toProfileUrl: getNormalizedUrl,
            classes: "inline",
        },
        "artist profile",
    );

    // TODO check /mypage
    // Artist in article card by followed artists
    // https://ci-en.dlsite.com/mypage
    findAndTranslate(
        "artist",
        ".c-card-article .c-card-content .e-title > a",
        {
            asyncMode: true,
            toProfileUrl: getNormalizedUrl,
            tagPosition: TAG_POSITIONS.afterParent,
        },
        "artist article card",
    );

    // Artist in article card in ranking
    // https://ci-en.dlsite.com/mypage
    findAndTranslate(
        "artist",
        ".flex > a + a.text-on-surface-link",
        {
            asyncMode: true,
            classes: "text-body-xs",
            toProfileUrl: getNormalizedUrl,
        },
        "artist article ranking card",
    );

    // Artist in artist card in artist recommendations
    // https://ci-en.dlsite.com/mypage
    findAndTranslate(
        "artist",
        ".c-card-creator .c-card-header .e-title > a",
        {
            asyncMode: true,
            toProfileUrl: getNormalizedUrl,
            tagPosition: TAG_POSITIONS.afterParent,
        },
        "artist creator card",
    );

    // Artist in artist card in artist ranking
    // https://ci-en.dlsite.com/mypage
    // https://ci-en.dlsite.com/ranking/creators/daily?categoryId=1
    findAndTranslate(
        "artist",
        ".grid a.text-on-surface-link",
        {
            asyncMode: true,
            classes: "text-title-xs",
            toProfileUrl: getNormalizedUrl,
            tagPosition: TAG_POSITIONS.afterParent,
        },
        "artist creator ranking card",
    );

    // Tags in artist card in artist ranking
    // https://ci-en.dlsite.com/ranking/creators/daily?categoryId=1
    findAndTranslate(
        "tag",
        "a > i.mgc_hashtag_line + span",
        {
            asyncMode: true,
            onadded: preventSiteNavigation,
        },
        "tag creator ranking card",
    );

    // Tags in article
    // https://ci-en.dlsite.com/creator/4126/article/1035340
    findAndTranslate(
        "tag",
        ".c-hashTagList .c-hashTagList-item > a",
        {
            asyncMode: true,
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "tag article",
    );

    // Tags in sidebar
    // https://ci-en.dlsite.com/creator/4126/article/1035340
    findAndTranslate(
        "tag",
        ".c-articleFilteringList .c-articleFilteringList-item > a",
        {
            asyncMode: true,
        },
        "tag sidebar",
    );
}
