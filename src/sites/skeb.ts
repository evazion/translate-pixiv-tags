import { css } from "@lit/reactive-element";
import { preventSiteNavigation } from "./shared";

export default function initializeSkeb(findAndTranslate: FindAndTranslate) {
    // Artist name on profile page
    // https://skeb.jp/@coconeeeco
    findAndTranslate(
        "artist",
        "div.hero-foot div.title:first-child",
        {
            asyncMode: true,
            classes: "inline title is-5",
            onadded: preventSiteNavigation,
        },
        "artist profile page",
    );

    // Artist name on work page
    // https://skeb.jp/@coconeeeco/works/34
    findAndTranslate(
        "artist",
        "div.image-column + div.column div.title + div.subtitle",
        {
            asyncMode: true,
            classes: "subtitle is-7",
            onadded: preventSiteNavigation,
        },
        "artist work page",
    );

    // Artists on index page
    // https://skeb.jp/
    findAndTranslate(
        "artist",
        "div.user-card-screen-name",
        {
            asyncMode: true,
            classes: "subtitle is-7",
            onadded: preventSiteNavigation,
            css: css`
                div.title:has(~ ARTIST_TAG) {
                    margin: 0;
                }
                div.user-card-screen-name:has(+ ARTIST_TAG) {
                    line-height: 1.5 !important;
                    margin: 0 0 -0.35rem;
                }
            `,
        },
        "artist index page",
    );
}
