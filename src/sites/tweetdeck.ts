import { css } from "@lit/reactive-element";
import { addCss } from "../utils";
import { getNormalizedHashtagName, watchSiteTheme } from "./shared";

export default function initializeTweetDeck(findAndTranslate: FindAndTranslate) {
    watchSiteTheme(document.body, "data-nightmode", (body) =>
        body.dataset.nightmode === "true" ? "dark" : "light",
    );

    addCss(css`
        .tweet .tpt-artists {
            flex-grow: 100;
        }
    `);
    // https://tweetdeck.twitter.com/

    findAndTranslate(
        "tag",
        "a[rel='hashtag'] span.link-complex-target",
        {
            asyncMode: true,
            toTagName: getNormalizedHashtagName,
        },
        "tags",
    );

    // User card info
    findAndTranslate(
        "artist",
        "p.username",
        {
            asyncMode: true,
        },
        "artist info",
    );

    // Tweet authors and comments
    findAndTranslate(
        "artist",
        "a.account-link:has(.username)",
        {
            asyncMode: true,
            classes: "inline",
        },
        "tweet/comment author",
    );
}
