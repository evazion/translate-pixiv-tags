import { defineConfig } from "vite";
import minifyHTML from "@lit-labs/rollup-plugin-minify-html-literals";
import { defaultStrategy } from "@lit-labs/rollup-plugin-minify-html-literals/lib/strategy.js";
import { transform } from "lightningcss";
import monkey from "vite-plugin-monkey";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => ({
    resolve: {
        alias: {
            // The minifier inlines the ~40KB suffix list string into each of its 3 usages,
            // the prebuilt minified version doesn't have this issue.
            "tldts-icann": "tldts-icann/dist/index.esm.min.js",
        },
    },
    build: {
        minify: mode === "production",
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
        minifyHTML({
            failOnError: true,
            options: {
                // the default clean-css breaks nesting https://github.com/lit/lit/issues/5207
                strategy: {
                    ...defaultStrategy,
                    minifyCSS(code: string) {
                        const result = transform({
                            filename: "inline.css",
                            code: new TextEncoder().encode(code),
                            minify: true,
                        });
                        return new TextDecoder().decode(result.code);
                    },
                },
            },
        }),
        monkey({
            entry: "src/main.ts",
            build: {
                fileName: "tpt.user.js",
                metaFileName: true,
            },
            userscript: {
                name: "translate-pixiv-tags",
                author: "evazion, 7nik, BrokenEagle, hdk5",
                // must be stable in dev: the header hash is used as the monkeyWindow key,
                // and the pre-bundled client with the key baked in is cached as immutable
                version:
                    command === "build"
                        ? new Date().toISOString().replaceAll(/[^\d]/g, "")
                        : "dev+hmr",
                description:
                    "Translates tags and look ups artist on Pixiv, Twitter/X, ArtStation, Deviant Art, Fanbox, and others sites using Danbooru or other sites.",
                homepageURL: "https://github.com/evazion/translate-pixiv-tags",
                supportURL: "https://github.com/evazion/translate-pixiv-tags/issues",
                // prevent updating the dev script into prod one
                updateURL:
                    mode === "production"
                        ? "https://github.com/evazion/translate-pixiv-tags/releases/latest/download/tpt.meta.js"
                        : undefined,
                downloadURL:
                    mode === "production"
                        ? "https://github.com/evazion/translate-pixiv-tags/releases/latest/download/tpt.user.js"
                        : undefined,
                noframes: true,
                "run-at": "document-start",
                match: [
                    "*://*.artstation.com/*",
                    // "*://baraag.net/*",
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
                    "*://www.rednote.com/*",
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
