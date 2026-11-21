import { css } from "lit";
import { TAG_POSITIONS } from "./shared";

export default function initializeSauceNAO(findAndTranslate: FindAndTranslate) {
    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fcdn.donmai.us%2Fpreview%2F5e%2F8e%2F5e8e7a03c49906aaad157de8aeb188e4.jpg
    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fcdn.donmai.us%2Fpreview%2Fad%2F90%2Fad90ad1cc3407f03955f22b427d21707.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fmedibangpaint.com%2Fwp-content%2Fuploads%2F2015%2F05%2Fgallerylist-04.jpg
    // https://saucenao.com/search.php?db=999&url=http%3A%2F%2Fpastyle.net%2FPLFG-0001_MelangelicTone%2Fimage%2Fartwork_MelangelicTone.jpg
    findAndTranslate(
        "artist",
        "a",
        {
            predicate: (el) => {
                const label = el.previousElementSibling;
                return (
                    label?.tagName === "STRONG" &&
                    ["Member:", "Author:", "Twitter:", "User ID:"].includes(
                        label.textContent?.trim(),
                    )
                );
            },
            classes: "inline",
            asyncMode: true,
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
        "artist by link",
    );

    /** Tags whose original text was removed */
    const cleanedTags = new WeakSet<HTMLElement>();

    function getFollowingText(el: HTMLElement) {
        const node = el.nextSibling;
        // if not a text node
        if (!node || node.nodeType !== 3) return null;
        return node.textContent?.trim() ? node.textContent.split(",") : null;
    }

    function cleanUpFollowingText(tag: HTMLElement) {
        let node = tag.nextSibling;
        // if not a text node
        if (!node || node.nodeType !== Node.TEXT_NODE) return;

        let text = node.textContent ?? "";
        for (const el of Array.from(tag.children)) {
            text = text.replace(el.textContent.trim(), "");
        }
        text = text.replace(/(, ){2,}/, ", ").replace(/^, |, $/, "");
        if (text[0] !== " ") text = " " + text;

        node.textContent = text;
    }

    findAndTranslate(
        "artistByName",
        ".resulttitle strong",
        {
            tagPosition: TAG_POSITIONS.afterend,
            toTagName: getFollowingText,
            onadded: cleanUpFollowingText,
            asyncMode: true,
            classes: "inline comma",
            css: css`
                .ex-artist-tag + .target {
                    display: none;
                }
                .ex-artist-tag.comma::after {
                    content: ", ";
                }
            `,
        },
        "artist by name",
    );

    findAndTranslate(
        "tag",
        ".resultcontentcolumn :not(.subtext)>strong",
        {
            tagPosition: TAG_POSITIONS.afterend,
            toTagName: getFollowingText,
            onadded: cleanUpFollowingText,
            asyncMode: true,
            classes: "no-brackets comma",
            css: css`
                .ex-translated-tags {
                    margin: 0;
                }
                .ex-translated-tags + .target {
                    display: none;
                }
                .ex-translated-tags.comma::after {
                    content: ", ";
                }
            `,
        },
        "tags strong",
    );

    findAndTranslate(
        "tag",
        ".resultcontentcolumn br",
        {
            tagPosition: TAG_POSITIONS.afterend,
            toTagName: getFollowingText,
            // remove the original text only once, the next time it would be other content
            onadded: (el) => {
                if (cleanedTags.has(el)) return;
                cleanedTags.add(el);
                el.nextSibling?.remove();
            },
            asyncMode: true,
            classes: "no-brackets",
            css: css`
                .ex-translated-tags {
                    margin: 0;
                }
                .ex-translated-tags + .target {
                    display: none;
                }
            `,
        },
        "tags br",
    );
}
