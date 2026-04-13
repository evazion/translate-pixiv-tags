import { TAG_POSITIONS } from "./shared";

export default function initializeBluesky(findAndTranslate: FindAndTranslate) {
    const toProfileUrl = (el: HTMLElement) =>
        `https://bsky.app/profile/${(el.textContent ?? "")
            .replace(/^[\s\u202A-\u202C]*@/, "")
            .replace(/[\s\u202A-\u202C]*$/, "")}`;

    // Hashtag in post
    // https://bsky.app/profile/yitsunemelody.bsky.social/post/3l6y6kk5t6t26
    findAndTranslate("tag", "a", {
        asyncMode: true,
        predicate: "a[id^=radix]",
        ruleName: "tag post",
    });

    // Artist tag in header
    // https://bsky.app/profile/iktd13.bsky.social
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate:
            "div[data-testid='profileView'] > :first-child > :first-child > :first-child > :nth-child(2) > :nth-child(2) > div:nth-child(2)",
        toProfileUrl,
        ruleName: "artist profile",
    });

    // Post/reply author
    // https://bsky.app
    // https://bsky.app/profile/iktd13.bsky.social
    // https://bsky.app/profile/kanikamadayo.bsky.social/post/3l6pnkjfnhq2b
    findAndTranslate("artist", "a", {
        asyncMode: true,
        predicate: "a[href^='/profile/'][aria-label]+a[href^='/profile/']",
        classes: "inline",
        toProfileUrl,
        ruleName: "artist post",
    });

    // Artist tag in feed
    // https://bsky.app
    // https://bsky.app/profile/iktd13.bsky.social
    findAndTranslate("artist", "div", {
        asyncMode: true,
        predicate: "main~div[style*='position: absolute'] div+a > div > :nth-child(2)",
        toProfileUrl,
        ruleName: "artist popup",
    });

    // Artist tag in thread root
    // https://bsky.app/profile/ixy.bsky.social/post/3l6up3iiokn2i
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate:
            "div[data-testid^='postThreadItem-by-'] > :first-child > a > :first-child > :first-child > :first-child > :last-child",
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        toProfileUrl,
        ruleName: "artist post thread root",
    });

    // Artist tag in search autocomplete
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate:
            "a[data-testid^='searchAutoCompleteResult-'] div:nth-child(2) > div:nth-child(2):not(:has(*))",
        toProfileUrl,
        ruleName: "artist search autocomplete",
    });

    // Artist tag in people search results
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate:
            "div[style*='display: flex'] a[href^='/profile/'][role='link'] div:nth-child(2) > div:nth-child(2):not(:has(*))",
        toProfileUrl,
        ruleName: "people search result",
    });

    // Artist tag in followers and following
    // https://bsky.app/profile/emistations.bsky.social/follows
    findAndTranslate("artist", "div", {
        asyncMode: true,
        // eslint-disable-next-line max-len
        predicate:
            "div[style*='display: flex'] div:is([data-testid='profileFollowsScreen'], [data-testid='profileFollowersScreen']) a > :first-child > :nth-child(2) > :nth-child(2)",
        toProfileUrl,
        ruleName: "people search result",
    });
}
