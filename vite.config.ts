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
        {
            // The minifier turns escapes like `\t` inside string/template/regex literals into
            // raw characters. Trailing whitespace can then be trimmed by an editor or userscript
            // manager, which silently changes the literal (e.g. breaks lit's attribute parsing).
            // In the minified output raw tabs and trailing spaces only occur inside literals,
            // so escaping them back is safe.
            name: "escape-raw-whitespace",
            apply: "build",
            enforce: "post",
            generateBundle: {
                order: "post",
                handler(_options, bundle) {
                    for (const chunk of Object.values(bundle)) {
                        if (chunk.type !== "chunk") continue;
                        chunk.code = chunk.code
                            .replaceAll("\t", "\\t")
                            .replace(/ +(?=\r?\n)/g, (m) => "\\x20".repeat(m.length));
                    }
                },
            },
        },
        // breaks nesting https://github.com/lit/lit/issues/5207
        // minifyHTML({
        //     failOnError: true,
        // }),
        monkey({
            entry: "src/main.ts",
            build: {
                fileName: "tpt.user.js",
                metaFileName: true,
            },
            userscript: {
                name: "TPT",
                author: "evazion, 7nik, BrokenEagle, hdk5",
                description:
                    "Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, and BCY to Danbooru tags.",
                homepageURL: "https://github.com/evazion/translate-pixiv-tags",
                supportURL: "https://github.com/evazion/translate-pixiv-tags/issues",
                // updateURL:
                //     "https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.meta.js",
                // downloadURL:
                //     "https://github.com/evazion/translate-pixiv-tags/raw/master/translate-pixiv-tags.user.js",
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
                connect: ["donmai.us", "raw.githubusercontent.com", "icons.duckduckgo.com", "*"],
            },
        }),
    ],
}));
