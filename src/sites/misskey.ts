import { css } from "lit";
import { getNormalizedDecentralizedSocNetUrl, getNormalizedHashtagName } from "./shared";

export default function initializeMisskey(findAndTranslate: FindAndTranslate) {
    // Hashtags
    // https://misskey.io/tags/ブルアカ
    // https://misskey.art/tags/ブルアカ
    // https://misskey.design/tags/ブルアカ
    findAndTranslate("tag", "a, div", {
        // eslint-disable-next-line max-len
        predicate:
            "a[href^='/tags/'], :is(main, ._pageContainer)>:first-child>:first-child :not(button)>div>i+div",
        asyncMode: true,
        toTagName: getNormalizedHashtagName,
        ruleName: "tags",
    });

    // Artist name in floating header
    // https://misskey.io/@ixy194
    // https://misskey.art/@Igiroitsu
    // https://misskey.design/@milcho1129
    // https://misskey.art/@ixy194@misskey.io
    // But not on note's page:
    // https://misskey.io/notes/9bxaf592x6
    // https://misskey.art/notes/9em92xdrid
    // https://misskey.design/notes/9eh5y6d2rz
    findAndTranslate("artist", ".xpJo5", {
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        css: css`
            ARTIST_TAG {
                font-size: 0.8em;
                font-weight: 400;
            }
        `,
        ruleName: "artist header",
    });

    // Artist name in profile
    findAndTranslate("artist", "span", {
        predicate: ".username > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        ruleName: "artist profile",
    });

    // Artist name in note
    findAndTranslate("artist", "span", {
        predicate: ".x1TBL > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        classes: "inline",
        ruleName: "artist note",
    });

    // Artist name in note comment
    findAndTranslate("artist", "span", {
        predicate: ".xBLVI > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        classes: "inline",
        ruleName: "artist note comment",
    });

    // Artist name in popup
    // (hover profile picture)
    findAndTranslate("artist", "span", {
        predicate: ".x8X77 > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        ruleName: "artist popup",
    });

    // Artist name in re-notes/reactions
    // (re-notes/reactions tabs under a note)
    findAndTranslate("artist", "span", {
        predicate: ".xsb3x > span:first-child",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        asyncMode: true,
        ruleName: "artist re-note",
    });
}
