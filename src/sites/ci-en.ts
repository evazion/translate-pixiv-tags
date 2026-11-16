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
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-grid-account-name .e-title > a",
        toProfileUrl: getNormalizedUrl,
        classes: "inline",
        ruleName: "artist profile",
    });

    // TODO check /mypage
    // Artist in article card by followed artists
    // https://ci-en.dlsite.com/mypage
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-card-article .c-card-content .e-title > a",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterParent,
        ruleName: "artist article card",
    });

    // Artist in article card in ranking
    // https://ci-en.dlsite.com/mypage
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".flex > a + a.text-on-surface-link",
        classes: "text-body-xs",
        toProfileUrl: getNormalizedUrl,
        ruleName: "artist article ranking card",
    });

    // Artist in artist card in artist recommendations
    // https://ci-en.dlsite.com/mypage
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-card-creator .c-card-header .e-title > a",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterParent,
        ruleName: "artist creator card",
    });

    // Artist in artist card in artist ranking
    // https://ci-en.dlsite.com/mypage
    // https://ci-en.dlsite.com/ranking/creators/daily?categoryId=1
    findAndTranslate("artist", "a.text-on-surface-link", {
        asyncMode: true,
        predicate: ".grid a.text-on-surface-link",
        classes: "text-title-xs",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterParent,
        ruleName: "artist creator ranking card",
    });

    // Tags in artist card in artist ranking
    // https://ci-en.dlsite.com/ranking/creators/daily?categoryId=1
    findAndTranslate("tag", "span", {
        asyncMode: true,
        predicate: "a > i.mgc_hashtag_line + span",
        onadded: preventSiteNavigation,
        ruleName: "tag creator ranking card",
    });

    // Tags in article
    // https://ci-en.dlsite.com/creator/4126/article/1035340
    findAndTranslate("tag", "a", {
        asyncMode: true,
        predicate: ".c-hashTagList .c-hashTagList-item > a",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "tag article",
    });

    // Tags in sidebar
    // https://ci-en.dlsite.com/creator/4126/article/1035340
    findAndTranslate("tag", "a", {
        asyncMode: true,
        predicate: ".c-articleFilteringList .c-articleFilteringList-item > a",
        ruleName: "tag sidebar",
    });
}
