import { css } from "lit";
import { getNormalizedDecentralizedSocNetUrl, TAG_POSITIONS, watchSiteTheme } from "./shared";
import { addCss } from "../utils";

export default function initializeMastodon(findAndTranslate: FindAndTranslate) {
    watchSiteTheme(document.body, "class", (body) =>
        body.classList.contains("theme-default") ? "dark" : "light",
    );

    addCss(css`
        .tpt-artist {
            line-height: 100%;
        }
    `);

    // https://pawoo.net/@yamadorikodi
    // artist name in channel header
    findAndTranslate(
        "artist",
        ".account__header__tabs__name small span",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
            asyncMode: true,
        },
        "artist profile",
    );

    // https://baraag.net/@casytay
    // artist name in channel header
    findAndTranslate(
        "artist",
        "div._comp_account_header__name",
        {
            toProfileUrl: (el) =>
                getNormalizedDecentralizedSocNetUrl(el.nextElementSibling as HTMLElement),
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
            asyncMode: true,
            css: css`
                ARTIST_TAG {
                    font-size: 22px;
                }
            `,
        },
        "artist profile",
    );

    // Post author, commenter
    // can include re-posted messages from other ActivityPub sites
    findAndTranslate(
        "artist",
        "div.status span.display-name__account",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
            asyncMode: true,
        },
        "post/comment author",
    );

    // Expanded post author
    // https://pawoo.net/@mayumani/102910946688187767
    findAndTranslate(
        "artist",
        "div.detailed-status span.display-name__account",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            tagPosition: TAG_POSITIONS.beforeend,
            classes: "inline",
            asyncMode: true,
        },
        "expanded post author",
    );

    // Cards of following users and followers
    // https://pawoo.net/@yamadorikodi/following
    findAndTranslate(
        "artist",
        "div.account span.display-name__account, article span._comp_account_list_item__handle",
        {
            toProfileUrl: getNormalizedDecentralizedSocNetUrl,
            classes: "inline",
            asyncMode: true,
        },
        "artist followers",
    );

    // Tags inside tweet
    // https://pawoo.net/@SilSinn9801/111354884652386567
    findAndTranslate(
        "tag",
        ".hashtag",
        {
            asyncMode: true,
        },
        "tags",
    );

    // Tags bar
    // https://baraag.net/@casytay/111370093922321621
    findAndTranslate(
        "tag",
        ".hashtag-bar a[href^='/tags/']",
        {
            asyncMode: true,
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "tags bar",
    );

    // Hover card
    findAndTranslate(
        "artist",
        "#hover-card span.display-name__account",
        {
            asyncMode: true,
        },
        "hover card",
    );
}
