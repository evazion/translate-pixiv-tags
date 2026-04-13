import { preventSiteNavigation } from "./shared";

export default function initializeSkeb(findAndTranslate: FindAndTranslate) {
    // Artist name on profile page
    // https://skeb.jp/@coconeeeco
    findAndTranslate("artist", "div.title", {
        predicate: "div.hero-foot div.title:first-child",
        asyncMode: true,
        classes: "inline title is-5",
        onadded: preventSiteNavigation,
        ruleName: "artist profile page",
    });

    // Artist name on work page
    // https://skeb.jp/@coconeeeco/works/34
    findAndTranslate("artist", "div.subtitle", {
        predicate: "div.image-column + div.column div.title + div.subtitle",
        asyncMode: true,
        classes: "subtitle is-7",
        onadded: preventSiteNavigation,
        ruleName: "artist work page",
    });

    // Artists on index page
    // https://skeb.jp/
    findAndTranslate("artist", "div.user-card-screen-name", {
        asyncMode: true,
        classes: "subtitle is-7",
        onadded: preventSiteNavigation,
        ruleName: "artist index page",
    });
}
