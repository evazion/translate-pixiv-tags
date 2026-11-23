import { css } from "../utils";
import { TAG_POSITIONS } from "./shared";

export default function initializeBluesky(findAndTranslate: FindAndTranslate) {
    const toProfileUrl = (el: HTMLElement) =>
        `https://bsky.app/profile/${(el.textContent ?? "")
            .replace(/^[\s\u202A-\u202C]*@/, "")
            .replace(/[\s\u202A-\u202C]*$/, "")}`;

    // Hashtag in post
    // https://bsky.app/profile/yitsunemelody.bsky.social/post/3l6y6kk5t6t26
    findAndTranslate(
        "tag",
        "a[id^=radix]",
        {
            asyncMode: true,
        },
        "tag post",
    );

    // Artist tag in header
    // https://bsky.app/profile/iktd13.bsky.social
    findAndTranslate(
        "artist",
        "div[data-testid='profileView'] > :first-child > :first-child > :first-child > :nth-child(2) > :nth-child(2) > div:nth-child(2)",
        {
            asyncMode: true,
            toProfileUrl,
        },
        "artist profile",
    );

    // Post/reply author
    // https://bsky.app
    // https://bsky.app/profile/iktd13.bsky.social
    // https://bsky.app/profile/kanikamadayo.bsky.social/post/3l6pnkjfnhq2b
    findAndTranslate(
        "artist",
        "a[href^='/profile/'][aria-label]+a[href^='/profile/']",
        {
            asyncMode: true,
            classes: "inline",
            toProfileUrl,
            css: css`
                /* allow for profile name get cropped */
                a:first-child:has(~ ARTIST_TAG) {
                    flex-shrink: 1 !important;
                }
            `,
        },
        "artist post",
    );

    // Artist tag in feed
    // https://bsky.app
    // https://bsky.app/profile/iktd13.bsky.social
    findAndTranslate(
        "artist",
        "main~div[style*='position: absolute'] div+a > div > div:nth-child(2)",
        {
            asyncMode: true,
            toProfileUrl,
        },
        "artist popup",
    );

    // Artist tag in thread root
    // https://bsky.app/profile/ixy.bsky.social/post/3l6up3iiokn2i
    findAndTranslate(
        "artist",
        "div[data-testid^='postThreadItem-by-'] > :first-child > a > :first-child > :first-child > :first-child > div:last-child",
        {
            asyncMode: true,
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
            toProfileUrl,
        },
        "artist post thread root",
    );

    // Artist tag in search autocomplete
    findAndTranslate(
        "artist",
        "a[data-testid^='searchAutoCompleteResult-'] div:nth-child(2) > div:nth-child(2):not(:has(*))",
        {
            asyncMode: true,
            toProfileUrl,
        },
        "artist search autocomplete",
    );

    // Artist tag in people search results
    findAndTranslate(
        "artist",
        "div[style*='display: flex'] a[href^='/profile/'][role='link'] div:nth-child(2) > div:nth-child(2):not(:has(*))",
        {
            asyncMode: true,
            toProfileUrl,
        },
        "people search result",
    );

    // Artist tag in followers and following
    // https://bsky.app/profile/emistations.bsky.social/follows
    findAndTranslate(
        "artist",
        "div[style*='display: flex'] div:is([data-testid='profileFollowsScreen'], [data-testid='profileFollowersScreen']) a > :first-child > :nth-child(2) > div:nth-child(2)",
        {
            asyncMode: true,
            toProfileUrl,
        },
        "people search result",
    );
}
