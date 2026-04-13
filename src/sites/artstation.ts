import { css } from "lit";
import { linkInChildren, TAG_POSITIONS } from "./shared";

export default function initializeArtStation(findAndTranslate: FindAndTranslate) {
    const getArtistName = (ref: string | null) => {
        if (!ref) return "";
        if (ref.startsWith("/")) {
            const word = ref.match(/[\w-]+/i);
            if (word) return word[0];
        } else if (ref.startsWith("https://www")) {
            const word = ref.match(/artstation\.com\/([\w-]+)/i);
            if (word) return word[1];
        } else if (ref.startsWith("https://")) {
            const word = ref.match(/\/\/([\w-]+)\.artstation\.com/i);
            if (word) return word[1];
        }
        return "";
    };

    function toFullURL(el: HTMLElement) {
        let artistName =
            getArtistName(el.getAttribute("href")) || getArtistName(window.location.href);
        if (artistName === "artwork") artistName = "";
        if (!artistName) {
            return "";
        }

        return `https://www.artstation.com/${artistName}`;
    }

    // https://www.artstation.com/jubi
    // https://www.artstation.com/jubi/*
    findAndTranslate("artist", "h1", {
        predicate: ".user-info > h1",
        toProfileUrl: toFullURL,
        asyncMode: true,
        css: css`
            ARTIST_TAG {
                margin: -8px 0 2px;
            }
        `,
        ruleName: "artist profile",
        // The artist name is removed when the profile page is a bit scrolled
        onadded: (tag) => {
            const h1 = tag.previousElementSibling!;
            const container = tag.parentElement!;
            new MutationObserver((_, observer) => {
                if (!container.contains(h1)) {
                    tag.remove();
                    observer.disconnect();
                }
            }).observe(container, { childList: true });
        },
    });

    // https://www.artstation.com/artwork/0X40zG
    findAndTranslate("artist", "h3", {
        predicate: ".project-author-name > h3:has(a)",
        toProfileUrl: linkInChildren,
        asyncMode: true,
        ruleName: "illust artist",
    });

    findAndTranslate("tag", ".label-tag", {
        tagPosition: TAG_POSITIONS.beforeend,
        asyncMode: true,
        ruleName: "tags",
    });

    // Hover card
    findAndTranslate("artist", "a", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".hover-card-name > a:first-child"),
        asyncMode: true,
        css: css`
            ARTIST_TAG {
                font-size: 12pt;
                margin-top: -10px;
            }
        `,
        ruleName: "artist popup",
    });

    // https://www.artstation.com/jubi/following
    // https://www.artstation.com/jubi/followers
    findAndTranslate("artist", "h3.user-name", {
        asyncMode: true,
        classes: "inline",
        ruleName: "artist followers",
    });

    // Default personal websites:
    // https://jubi.artstation.com/
    // https://anninosart.artstation.com/
    // Customized personal websites:
    // https://inawong.artstation.com/
    // https://kastep.artstation.com/
    // https://tinadraw.artstation.com/
    // https://dylan-kowalski.artstation.com/
    findAndTranslate("artist", ".site-title a", {
        toProfileUrl: toFullURL,
        css: css`
            ARTIST_TAG {
                font-size: 12pt;
                line-height: 100%;
                margin-top: -10px;
                a {
                    font-size: 12pt;
                }
            }
        `,
        ruleName: "personal sites",
    });
}
