import $ from "jquery";
import { css } from "lit";
import { TAG_POSITIONS } from "./shared";

export default function initializeSauceNAO(findAndTranslate: FindAndTranslate) {
    $(".resulttitle, .resultcontentcolumn")
        .contents()
        .filter((_i, el) => el.nodeType === 3) // Get text nodes
        .replaceWith(function fn() {
            return $(this)
                .text()
                .split(", ")
                .map((str) => `<span class="target">${str}</span>`)
                .join(", ");
        });

    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2F5e%2F8e%2F5e8e7a03c49906aaad157de8aeb188e4.jpg
    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2Fad%2F90%2Fad90ad1cc3407f03955f22b427d21707.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fmedibangpaint.com%2Fwp-content%2Fuploads%2F2015%2F05%2Fgallerylist-04.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fpastyle.net%2FPLFG-0001_MelangelicTone%2Fimage%2Fartwork_MelangelicTone.jpg
    findAndTranslate(
        "artist",
        [
            "strong:contains('Member:')+a",
            "strong:contains('Author:')+a",
            "strong:contains('Twitter:')+a",
            "strong:contains('User ID:')+a",
        ].join(","),
        {
            classes: "inline",
            ruleName: "artist by link",
            toProfileUrl: (el) => {
                const a = el as HTMLAnchorElement;
                if (
                    a.href.startsWith("https://twitter.com/") ||
                    a.href.startsWith("https://x.com/")
                ) {
                    return [
                        `https://x.com/${a.textContent?.slice(1)}`,
                        `https://x.com/i/user/${a.href.match(/\d+/)?.[0]}`,
                    ];
                }
                return a.href;
            },
        },
    );

    findAndTranslate("artistByName", ".resulttitle .target", {
        tagPosition: TAG_POSITIONS.beforebegin,
        classes: "inline",
        css: css`
            ARTIST_TAG + .target {
                display: none;
            }
        `,
        ruleName: "artist by name",
    });

    findAndTranslate("tag", ".resultcontentcolumn .target", {
        tagPosition: TAG_POSITIONS.beforebegin,
        classes: "no-brackets",
        css: css`
            .tpt-tags {
                margin: 0;
            }
            .tpt-tags + .target {
                display: none;
            }
        `,
        ruleName: "tags",
    });
}
