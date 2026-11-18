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
    findAndTranslate(
        "artist",
        "h1:has(>a.user-link)",
        {
            toProfileUrl: linkInChildren,
            asyncMode: true,
            css: css`
                ARTIST_TAG {
                    margin-top: -10px;
                }
            `,
        },
        "artist profile",
    );

    // Post page
    // https://www.deviantart.com/koyorin/art/Ruby-570526828
    findAndTranslate(
        "artist",
        "main>*>:nth-child(3) :nth-child(2) > a.user-link:not(:has(img))",
        {
            toProfileUrl: (el) => (el as HTMLAnchorElement).href.replace("/gallery", ""),
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
        },
        "illust artist",
    );

    // Popup card
    findAndTranslate(
        "artist",
        "body > .popper-portal a.user-link:not(:has(img))",
        {
            asyncMode: true,
            classes: "tpt-light",
        },
        "artist popup",
    );

    findAndTranslate(
        "tag",
        "a[href^='https://www.deviantart.com/tag/'] > span:first-child",
        {
            asyncMode: true,
            css: css`
                /* fix cropped long tags */
                a[href^="https://www.deviantart.com/tag/"] {
                    max-width: initial;
                }
            `,
        },
        "tags",
    );
}
