import { TAG_POSITIONS } from "./shared";

export default function initializeHentaiFoundry(findAndTranslate: FindAndTranslate) {
    // Posts on https://www.hentai-foundry.com/user/DrGraevling/profile
    findAndTranslate("artist", ".galleryViewTable .thumb_square > a:nth-child(4)", {
        classes: "inline",
        ruleName: "thumb artist",
    });

    // Profile tab https://www.hentai-foundry.com/user/DrGraevling/profile
    findAndTranslate("artist", ".breadcrumbs a:contains('Users') + span", {
        toProfileUrl: () => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "main profile tab",
    });

    // Other tabs https://www.hentai-foundry.com/pictures/user/DrGraevling
    findAndTranslate("artist", ".breadcrumbs a[href^='/user/']", {
        classes: "inline",
        ruleName: "sub-profile tab",
    });
}
