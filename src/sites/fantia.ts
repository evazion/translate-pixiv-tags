import { css } from "../utils";
import { linkInChildren, TAG_POSITIONS } from "./shared";

export default function initializeFantia(findAndTranslate: FindAndTranslate) {
    // Artist name on profile/work page
    // https://fantia.jp/fanclubs/15340
    // https://fantia.jp/posts/2032060
    findAndTranslate(
        "artist",
        "h1.fanclub-name",
        {
            toProfileUrl: linkInChildren,
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
            asyncMode: false,
        },
        "artist header",
    );

    // Artist tiles (logged in only?)
    // https://fantia.jp/
    findAndTranslate(
        "artist",
        ".module.fanclub > a.link-block",
        {
            asyncMode: true,
            tagPosition: TAG_POSITIONS.afterParent,
            css: css`
                ARTIST_TAG {
                    display: block;
                    overflow: hidden;
                    text-overflow: hidden;
                    font-size: 80%;
                }
                .module.fanclub:not(:has(+ ARTIST_TAG)) {
                    margin-bottom: 1.6rem;
                }
            `,
        },
        "artist tile",
    );

    // Artist name on work cards
    // https://fantia.jp/ (投稿, 商品, コミッション tabs)
    findAndTranslate(
        "artist",
        ".module-author > a:first-of-type",
        {
            requiredAttributes: "href",
            tagPosition: TAG_POSITIONS.beforebegin,
            asyncMode: true,
            css: css`
                .module-author {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    align-items: center;
                    &::before {
                        content: none;
                    }
                    .left {
                        grid-row: 1/3;
                    }
                    .right {
                        grid-row: 1;
                        width: 100%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        .fanclub-name {
                            line-height: unset !important;
                        }
                    }
                    ARTIST_TAG {
                        grid-column: 2;
                        font-size: 85%;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        margin-left: 1ch;
                        a {
                            position: relative;
                            z-index: 1000;
                        }
                    }
                }
            `,
        },
        "artist new posts",
    );

    // All the tags
    // https://fantia.jp/posts/2032060
    findAndTranslate(
        "tag",
        "a[href*='tag=']:not([target='_blank'])",
        {
            tagPosition: TAG_POSITIONS.beforeend,
            asyncMode: true,
            css: css`
                .active > a {
                    filter: brightness(1.2);
                }
                .active TPT_TAG {
                    filter: brightness(0.7) contrast(2);
                    text-shadow: 0 0 5px #fff8;
                }
            `,
        },
        "tags",
    );
}
