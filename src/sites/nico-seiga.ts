import { css } from "../utils";
import { TAG_POSITIONS } from "./shared";

export default function initializeNicoSeiga(findAndTranslate: FindAndTranslate) {
    // http://seiga.nicovideo.jp/tag/艦これ
    findAndTranslate(
        "tag",
        "h1:has(.icon_tag_big)",
        {
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "tag search",
    );

    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate(
        "tag",
        ".tag > a, a.tag",
        {
            tagPosition: TAG_POSITIONS.beforeend,
            asyncMode: true,
            css: css`
                /* When authorized */
                .illust_tag .tag {
                    background: #ebebeb;
                    height: auto;
                    margin: 0 10px 5px 0;
                }
            `,
        },
        "illust tags",
    );

    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate(
        "artist",
        ".user_info h1 a",
        {
            classes: "inline",
            css: css`
                .im_head_bar .inner .user ul .user_link ARTIST_TAG a {
                    display: inline-block;
                    border: none;
                    background: none;
                    padding: 0;
                }
            `,
        },
        "illust artist",
    );

    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate(
        "artist",
        "div.lg_txt_illust:has(strong)",
        {
            classes: "inline",
            tagPosition: TAG_POSITIONS.beforeend,
            toProfileUrl: () =>
                document.querySelector<HTMLAnchorElement>("a:has(.pankuzu_suffix)")?.href ?? null,
        },
        "illust artist anon",
    );

    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate(
        "artist",
        ".user_link > a .user_name",
        {
            tagPosition: TAG_POSITIONS.beforeend,
        },
        "artist profile",
    );
}
