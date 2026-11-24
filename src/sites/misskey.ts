import { css } from "@lit/reactive-element";
import { getNormalizedDecentralizedSocNetUrl, getNormalizedHashtagName } from "./shared";

export default function initializeMisskey(findAndTranslate: FindAndTranslate) {
    // Hashtags
    // https://misskey.io/tags/ブルアカ
    // https://misskey.art/tags/ブルアカ
    // https://misskey.design/tags/ブルアカ
    findAndTranslate(
        "tag",
        "a[href^='/tags/'], :is(main, ._pageContainer)>:first-child>:first-child :not(button)>div>i+div",
        {
            asyncMode: true,
            toTagName: getNormalizedHashtagName,
        },
        "tags",
    );

    // Artist name in floating header
    // https://misskey.io/@ixy194
    // https://misskey.art/@Igiroitsu
    // https://misskey.design/@milcho1129
    // https://misskey.art/@ixy194@misskey.io
    // But not on note's page:
    // https://misskey.io/notes/9bxaf592x6
    // https://misskey.art/notes/9em92xdrid
    // https://misskey.design/notes/9eh5y6d2rz
    findAndTranslate(
        "artist",
        ".xpJo5",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            asyncMode: true,
            css: css`
                ARTIST_TAG {
                    font-size: 0.8em;
                    font-weight: 400;
                }
            `,
        },
        "artist header",
    );

    // Artist name in profile
    findAndTranslate(
        "artist",
        ".username > span:first-child",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            asyncMode: true,
        },
        "artist profile",
    );

    // Artist name in note
    findAndTranslate(
        "artist",
        ".x1TBL > span:first-child",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            asyncMode: true,
            classes: "inline",
        },
        "artist note",
    );

    // Artist name in note comment
    findAndTranslate(
        "artist",
        ".xBLVI > span:first-child",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            asyncMode: true,
            classes: "inline",
        },
        "artist note comment",
    );

    // Artist name in popup
    // (hover profile picture)
    findAndTranslate(
        "artist",
        ".x8X77 > span:first-child",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            asyncMode: true,
        },
        "artist popup",
    );

    // Artist name in re-notes/reactions
    // (re-notes/reactions tabs under a note)
    findAndTranslate(
        "artist",
        ".xsb3x > span:first-child",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            asyncMode: true,
        },
        "artist re-note",
    );
}
