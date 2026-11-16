import { css } from "lit";
import { TAG_POSITIONS } from "./shared";

// www.xiaohongshu.com is Chinese (canonical), www.rednote.com is English mirror
export default function initializeXiaohongshu(findAndTranslate: FindAndTranslate) {
    // Artist tag in profile
    // https://www.rednote.com/user/profile/60e6d275000000000101f18f
    findAndTranslate("artist", "div.user-name", {
        asyncMode: true,
        predicate: ".user div.user-name",
        toProfileUrl: () => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist profile",
    });

    // Artist tag in post preview
    // https://www.rednote.com/user/profile/60e6d275000000000101f18f
    findAndTranslate("artist", "span.name", {
        asyncMode: true,
        predicate: ".note-item .author span.name",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist note card",
    });

    // Artist tag in post
    // https://www.rednote.com/discovery/item/6aa3b4de00000000110338b8?xsec_token=ABff8Vv1nM9it4-zvb9hYTtUlAqWSZBEJEDC83RNq9-OI=
    findAndTranslate("artist", "span.username", {
        asyncMode: true,
        predicate: ".note-container .author-container span.username",
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "artist note",
    });

    // Tags in post
    findAndTranslate("tag", "a.tag", {
        asyncMode: true,
        predicate: ".note-text a.tag",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "tag note",
    });

    // Post commenter
    findAndTranslate("artist", "a.name", {
        asyncMode: true,
        predicate: ".comment-item .author a",
        classes: "inline",
        ruleName: "post commenter",
    });

    // Artist tag in user popup card
    findAndTranslate("artist", "a.avatar-info", {
        asyncMode: true,
        predicate: ".tooltip-container a",
        // tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist popup",
        css: css`
            .avatar-click-wrapper:has(ARTIST_TAG) {
                display: grid !important;
                grid-template-columns: auto 1fr;
                gap: 0 1ch;
                > a.avatar-info {
                    display: contents;
                    > :first-child {
                        grid-row: 1/3;
                    }
                    > :last-child {
                        grid-column: 2;
                    }
                }
                ARTIST_TAG {
                    grid-column: 2;
                }
            }
        `,
    });
}
