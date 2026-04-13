import { TAG_POSITIONS } from "./shared";

export default function initializeXiaohongshu(findAndTranslate: FindAndTranslate) {
    // Tags in post
    findAndTranslate("tag", "a.tag", {
        asyncMode: true,
        predicate: ".note-text a.tag",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "tag note",
    });

    // Artist tag in post preview
    findAndTranslate("artist", "span.name", {
        asyncMode: true,
        predicate: ".note-item .author span.name",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist note card",
    });

    // Artist tag in post
    findAndTranslate("artist", "span.username", {
        asyncMode: true,
        predicate: ".note-container .author-container span.username",
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist note",
    });

    // Artist tag in profile
    findAndTranslate("artist", "div.user-name", {
        asyncMode: true,
        predicate: ".user div.user-name",
        toProfileUrl: () => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        ruleName: "artist profile",
    });
}
