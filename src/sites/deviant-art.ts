import { css } from "lit";
import { addCss } from "../utils";
import { deleteOnUrlChange, linkInChildren, TAG_POSITIONS, watchSiteTheme } from "./shared";

export default function initializeDeviantArt(findAndTranslate: FindAndTranslate) {
    watchSiteTheme(document.body, "class", (body) =>
        body.classList.contains("theme-dark") ? "dark" : "light",
    );

    addCss(css`
        .tpt-artist {
            font-weight: bold;
        }
    `);

    // Profile page
    // https://www.deviantart.com/adsouto
    findAndTranslate("artist", "h1", {
        toProfileUrl: linkInChildren,
        predicate: "h1:has(>a.user-link)",
        asyncMode: true,
        css: css`
            ARTIST_TAG {
                margin-top: -10px;
            }
        `,
        ruleName: "artist profile",
    });

    // Post page
    // https://www.deviantart.com/koyorin/art/Ruby-570526828
    findAndTranslate("artist", "a.user-link", {
        toProfileUrl: (el) => (el as HTMLAnchorElement).href.replace("/gallery", ""),
        predicate: "main>*>:nth-child(3) :nth-child(2) > a.user-link:not(:has(img))",
        requiredAttributes: "href",
        tagPosition: TAG_POSITIONS.afterParent,
        asyncMode: true,
        onadded: deleteOnUrlChange,
        classes: "inline",
        css: css`
            ARTIST_TAG {
                margin-left: -0.5em;
                & + button {
                    margin-left: 1em;
                }
            }
        `,
        ruleName: "illust artist",
    });

    // Popup card
    findAndTranslate("artist", "a.user-link", {
        predicate: "body > .popper-portal a.user-link:not(:has(img))",
        asyncMode: true,
        classes: "tpt-light",
        ruleName: "artist popup",
    });

    findAndTranslate("tag", "span", {
        predicate: "a[href^='https://www.deviantart.com/tag/'] > span:first-child",
        asyncMode: true,
        css: css`
            /* fix cropped long tags */
            a[href^="https://www.deviantart.com/tag/"] {
                max-width: initial;
            }
        `,
        ruleName: "tags",
    });
}
