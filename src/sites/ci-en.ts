import { safeMatchMemoized } from "../utils";
import { TAG_POSITIONS } from "./shared";

export default function initializeCiEn(findAndTranslate: FindAndTranslate) {
    const getNormalizedUrl = (el: HTMLElement) => {
        const a = el as HTMLAnchorElement;
        return `https://ci-en.net/creator/${safeMatchMemoized(a.href, /\/creator\/(\d+)/, 1)}`;
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
        predicate: ".c-card-article-ranking .c-card-article-ranking-name .l-media-content > a",
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
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: ".c-card-creator-archives .c-card-creator-archives-name .e-title > a",
        toProfileUrl: getNormalizedUrl,
        tagPosition: TAG_POSITIONS.afterParent,
        ruleName: "artist creator ranking card",
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
