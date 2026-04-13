import { css } from "lit";
import { linkInChildren, TAG_POSITIONS, TAG_SELECTOR } from "./shared";

export default function initializeFantia(findAndTranslate: FindAndTranslate) {
    // Artist name on profile/work page
    // https://fantia.jp/fanclubs/15340
    // https://fantia.jp/posts/2032060
    findAndTranslate("artist", "h1.fanclub-name", {
        toProfileUrl: linkInChildren,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        asyncMode: false,
        ruleName: "artist header",
    });

    // Artist name on work cards
    // https://fantia.jp/ (投稿, 商品, コミッション tabs)
    findAndTranslate("artist", "a", {
        predicate: (el) =>
            el.matches(".module-author > a:first-of-type") && !!el.getAttribute("href"),
        requiredAttributes: "href",
        tagPosition: {
            insertTag: ($container, elem) => $container.prev().append(elem),
            findTag: ($container) => $container.prev().has(TAG_SELECTOR),
            getTagContainer: ($elem) => $elem.parent(".module-author").next(".module-author>a"),
        },
        asyncMode: true,
        css: css`
            .module-author {
                display: flex;
                align-items: center;
                .fanclub-name {
                    line-height: unset !important;
                }
                ARTIST_TAG {
                    font-size: 85%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    a {
                        position: relative;
                        z-index: 1000;
                    }
                }
            }
        `,
        ruleName: "artist card",
    });

    // All the tags
    // https://fantia.jp/posts/2032060
    findAndTranslate("tag", "a", {
        predicate: "a[href*='tag=']:not([target='_blank'])",
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        css: css`
            .active > a {
                filter: brightness(1.2);
            }
            .active .tpt-tags {
                filter: brightness(0.7) contrast(2);
                text-shadow: 0 0 5px #fff8;
            }
        `,
        ruleName: "tags",
    });
}
