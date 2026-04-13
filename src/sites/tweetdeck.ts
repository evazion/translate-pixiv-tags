import { css } from "lit";
import { addCss } from "../utils";
import { getNormalizedHashtagName, watchSiteTheme } from "./shared";

export default function initializeTweetDeck(findAndTranslate: FindAndTranslate) {
    watchSiteTheme(document.body, "data-nightmode", (body) =>
        body.dataset.nightmode === "true" ? "dark" : "light",
    );

    addCss(css`
        .tweet .tpt-artist {
            flex-grow: 100;
        }
    `);
    // https://tweetdeck.twitter.com/

    findAndTranslate("tag", "span.link-complex-target", {
        predicate: "a[rel='hashtag'] span.link-complex-target",
        asyncMode: true,
        toTagName: getNormalizedHashtagName,
        ruleName: "tags",
    });

    // User card info
    findAndTranslate("artist", "p.username", {
        asyncMode: true,
        ruleName: "artist info",
    });

    // Tweet authors and comments
    findAndTranslate("artist", "a.account-link", {
        predicate: "a:has(.username)",
        asyncMode: true,
        classes: "inline",
        ruleName: "tweet/comment author",
    });
}
