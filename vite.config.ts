import { defineConfig } from "vite";
import minifyHTML from "@lit-labs/rollup-plugin-minify-html-literals";
import monkey from "vite-plugin-monkey";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    build: {
        minify: mode === "production",
        terserOptions: {
            mangle: {
                // do not minify top-level variable names
                toplevel: false,
            },
        },
    },
    plugins: [
        minifyHTML({
            failOnError: true,
        }),
        monkey({
            entry: "src/main.ts",
            build: {
                fileName: "tpt.user.js",
                metaFileName: true,
                autoGrant: false,
            },
            userscript: {
                name: "Translate Pixiv Tags",
                author: "evazion, 7nik, BrokenEagle, hdk5",
                description:
                    "Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, and BCY to Danbooru tags.",
                homepageURL: "https://github.com/evazion/translate-pixiv-tags",
                supportURL: "https://github.com/evazion/translate-pixiv-tags/issues",
                updateURL:
                    "https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.meta.js",
                downloadURL:
                    "https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.user.js",
                noframes: true,
                match: [
                    "*://*.artstation.com/*",
                    "*://baraag.net/*",
                    "*://bsky.app/*",
                    "*://ci-en.net/*",
                    "*://ci-en.dlsite.com/*",
                    "*://*.deviantart.com/*",
                    "*://*.fanbox.cc/*",
                    "*://fantia.jp/*",
                    "*://*.hentai-foundry.com/*",
                    "*://misskey.art/*",
                    "*://misskey.design/*",
                    "*://misskey.io/*",
                    "*://nijie.info/*",
                    "*://pawoo.net/*",
                    "*://dic.pixiv.net/*",
                    "*://www.pixiv.net/*",
                    "*://saucenao.com/*",
                    "*://seiga.nicovideo.jp/*",
                    "*://skeb.jp/*",
                    "*://www.tinami.com/*",
                    // "*://twitter.com/*",
                    // "*://mobile.twitter.com/*",
                    // "*://tweetdeck.twitter.com/*",
                    "*://m.weibo.cn/*",
                    "*://www.weibo.com/*",
                    "*://x.com/*",
                    "*://www.xiaohongshu.com/*",
                ],
                connect: ["donmai.us", "raw.githubusercontent.com", "icons.duckduckgo.com"],
            },
        }),
    ],
}));
