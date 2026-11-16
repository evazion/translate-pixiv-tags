import { css } from "lit";
import { linkInChildren, TAG_POSITIONS } from "./shared";
import { addCss } from "../utils";

export default function initializeTinami(findAndTranslate: FindAndTranslate) {
    addCss(css`
        .tpt-tags {
            font-family: Verdana, Helvetica, sans-serif;
            float: none !important;
            display: inline !important;
        }
    `);
    // http://www.tinami.com/view/1165789
    findAndTranslate("tag", ".tag > span > a:nth-child(2)", {
        ruleName: "illust tags",
    });

    // Triggers on http://www.tinami.com/creator/profile/10262
    findAndTranslate("artist", "div.cre_name h1", {
        toProfileUrl: () => window.location.href,
        tagPosition: TAG_POSITIONS.beforeend,
        classes: "inline",
        ruleName: "artist profile",
    });

    // Triggers on http://www.tinami.com/view/934323
    findAndTranslate("artist", "p:has(>a[href^='/creator/profile/'])", {
        toProfileUrl: linkInChildren,
        ruleName: "illust artist",
    });
}
