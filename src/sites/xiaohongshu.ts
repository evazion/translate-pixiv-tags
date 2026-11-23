import { css } from "../utils";
import { TAG_POSITIONS } from "./shared";

// www.xiaohongshu.com is Chinese (canonical), www.rednote.com is English mirror
export default function initializeXiaohongshu(findAndTranslate: FindAndTranslate) {
    // Artist tag in profile
    // https://www.rednote.com/user/profile/60e6d275000000000101f18f
    findAndTranslate(
        "artist",
        ".user div.user-name",
        {
            asyncMode: true,
            toProfileUrl: () => window.location.href,
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "artist profile",
    );

    // Artist tag in post preview
    // https://www.rednote.com/user/profile/60e6d275000000000101f18f
    findAndTranslate(
        "artist",
        ".note-item .author span.name",
        {
            asyncMode: true,
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "artist note card",
    );

    // Artist tag in post
    // https://www.rednote.com/discovery/item/6aa3b4de00000000110338b8?xsec_token=ABff8Vv1nM9it4-zvb9hYTtUlAqWSZBEJEDC83RNq9-OI=
    findAndTranslate(
        "artist",
        ".note-container .author-container span.username",
        {
            asyncMode: true,
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
        },
        "artist note",
    );

    // Tags in post
    findAndTranslate(
        "tag",
        ".note-text a.tag",
        {
            asyncMode: true,
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "tag note",
    );

    // Post commenter
    findAndTranslate(
        "artist",
        ".comment-item .author a.name",
        {
            asyncMode: true,
            classes: "inline",
        },
        "post commenter",
    );

    // Artist tag in user popup card
    findAndTranslate(
        "artist",
        ".tooltip-container a.avatar-info",
        {
            asyncMode: true,
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
        },
        "artist popup",
    );
}
