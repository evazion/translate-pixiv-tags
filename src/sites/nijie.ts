import { TAG_POSITIONS } from "./shared";
import { addCss } from "../utils";
import { css } from "@lit/reactive-element";

export default function initializeNijie(findAndTranslate: FindAndTranslate) {
    addCss(css`
        .tpt-tags {
            font-family: Verdana, Helvetica, sans-serif;
        }
    `);

    // http://nijie.info/view.php?id=208491
    findAndTranslate(
        "artist",
        "#pro .user_icon .name, .popup_member > a, #login_illust_detail a",
        {
            classes: "inline",
        },
        "artist",
    );

    // https://nijie.info/view.php?id=325606
    findAndTranslate(
        "artist",
        "#dojin_left > .right > :first-child > a",
        {
            classes: "inline",
        },
        "dojin artist",
    );

    // http://nijie.info/view.php?id=208491
    findAndTranslate(
        "tag",
        ".tag .tag_name a:first-child",
        {
            tagPosition: TAG_POSITIONS.beforeend,
            css: css`
                #dojin_left #view-tag .tag {
                    white-space: nowrap;
                    border: 0;
                }
            `,
        },
        "illust tags",
    );

    // https://nijie.info/dic/seiten/d/東方
    findAndTranslate(
        "tag",
        "#seiten_dic h1#dic_title",
        {
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "tag page",
    );
}
