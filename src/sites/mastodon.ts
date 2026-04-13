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
    // https://baraag.net/@casytay
    // artist name in channel header
    findAndTranslate("artist", "span", {
        predicate: ".account__header__tabs__name small span",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "artist profile",
        asyncMode: true,
    });

    // Post author, commenter
    // can include re-posted messages from other ActivityPub sites
    findAndTranslate("artist", "span.display-name__account", {
        predicate: "div.status span.display-name__account",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "post/comment author",
        asyncMode: true,
    });

    // Expanded post author
    // https://pawoo.net/@mayumani/102910946688187767
    findAndTranslate("artist", "span.display-name__account", {
        predicate: "div.detailed-status span.display-name__account",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "expanded post author",
        asyncMode: true,
    });

    // Cards of following users and followers
    // https://pawoo.net/@yamadorikodi/following
    findAndTranslate("artist", "span.display-name__account", {
        predicate: "div.account span.display-name__account",
        toProfileUrl: getNormalizedDecentralizedSocNetUrl,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "artist followers",
        asyncMode: true,
    });

    // Tags inside tweet
    // https://pawoo.net/@SilSinn9801/111354884652386567
    findAndTranslate("tag", ".hashtag", {
        ruleName: "tags",
        asyncMode: true,
    });

    // Tags bar
    // https://baraag.net/@casytay/111370093922321621
    findAndTranslate("tag", "a", {
        predicate: ".hashtag-bar a[href^='/tags/']",
        ruleName: "tags bar",
        asyncMode: true,
        tagPosition: TAG_POSITIONS.beforeend,
    });
}
