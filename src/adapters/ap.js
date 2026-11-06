/* eslint-disable class-methods-use-this */
// @tpt-adapter
// @name Anime-Pictures
// @version 1.0.1

/* eslint-disable no-undef */

/**
 * @import { TemplateResult } from "lit"
 * @import {} from "./adapter"
 */

console.log("ap");

const AP_SITE = "https://anime-pictures.net";
const AP_API = "https://api.anime-pictures.net";

const TAGS_CSS = css`
    :root,
    .tpt-light,
    .tpt-auto {
        --tpt-ap-artist: darkorange;
        --tpt-ap-cat-gen: #555;
        --tpt-ap-cat-copy: #008000;
        --tpt-ap-cat-char: #069;
    }
    .tpt-dark {
        --tpt-ap-artist: darkorange;
        --tpt-ap-cat-gen: #e9e9e9;
        --tpt-ap-cat-copy: #008000;
        --tpt-ap-cat-char: #069;
    }
    @media (prefers-color-scheme: dark) {
        .tpt-auto {
            --tpt-ap-artist: darkorange;
            --tpt-ap-cat-gen: #e9e9e9;
            --tpt-ap-cat-copy: #008000;
            --tpt-ap-cat-char: #069;
        }
    }

    .tpt-artist .ap {
        --color: var(--tpt-ap-artist);
    }
    .tpt-tag.ap.category-gen {
        --color: var(--tpt-ap-cat-gen);
    }
    .tpt-tag.ap.category-copy {
        --color: var(--tpt-ap-cat-copy);
    }
    .tpt-tag.ap.category-char {
        --color: var(--tpt-ap-cat-char);
    }
    .tpt-tag.ap.category-artist {
        --color: var(--tpt-ap-artist);
    }
`;

const TAG_TYPE = {
    unknown: 0,
    character: 1,
    reference: 2,
    productCopyright: 3,
    author: 4,
    gameCopyright: 5,
    otherCopyright: 6,
    object: 7,
};

const TAG_CSS_TYPE = {
    0: "gen",
    1: "char",
    2: "gen",
    3: "copy",
    4: "artist",
    5: "copy",
    6: "copy",
    7: "gen",
};

/**
 * @typedef {object} APTag
 * @prop {number} id
 * @prop {string} tag
 * @prop {string|null} tag_ru
 * @prop {string|null} tag_jp
 * @prop {0|1|2|3|4|5|6|7} type
 * @prop {string} description_en
 * @prop {string} description_ru
 * @prop {string} description_jp
 * @prop {number|null} alias
 * @prop {number|null} parent
 */

/** @param {APTag} tag */
function dealiasTag(tag) {
    if (!tag.alias) return tag;
    return makeRequest("GET", `${AP_API}/api/v3/tags/${tag.alias}`, {}).then(
        (data) => /** @type {APTag} */ (data.tag),
    );
}

/**
 * @param {string} name
 * @param {number} [type]
 */
async function findTagByName(name, type) {
    /** @type {{ tags: APTag[] }} */
    const { tags } = await makeRequest(
        "GET",
        `${AP_API}/api/v3/tags`,
        type ? { "tag:smart": name, type } : { "tag:smart": name },
    );
    return Promise.all(tags.map(dealiasTag));
}

/**
 * @param {string} descr
 * @param {number} [type]
 */
async function findTagByDescription(descr, type) {
    /** @type {{ tags: APTag[] }} */
    const { tags } = await makeRequest(
        "GET",
        `${AP_API}/api/v3/tags`,
        type ? { "description:smart_like": descr, type } : { "description:smart_like": descr },
    );
    return Promise.all(tags.map(dealiasTag));
}

/**
 * Whether the description contains the url
 * @param {string} descr
 * @param {string} url protocol-less url
 */
function containsUrl(descr, url) {
    return descr
        .toLowerCase()
        .replace("link:", "")
        .replaceAll(/\[\/?s]/gi, "")
        .split(/\n|\r/)
        .map((line) => line.trim().replace(/^https?/, ""))
        .includes(url);
}

/**
 * @type {Record<string, TemplateResult[]>}
 */
const renderedTagsCache = {};
/**
 * @type {Record<string, TemplateResult>}
 */
const renderedArtistsCache = {};

let running = false;

/**
 * @implements {Adapter}
 */
class AnimePictureAdapter {
    static name = "Anime-Pictures";

    /**
     * @param {string} param
     */
    static async validateParams(param) {
        if (param) {
            throw new Error("The parameter must be empty");
        }
    }

    constructor() {
        if (running) {
            throw new Error("No multi-instance support!");
        }
        running = true;

        addCss(TAGS_CSS);

        getSafeImageUrl(`${AP_SITE}/favicon.ico`).then((url) => {
            addCss(css`
                .tpt-artist .ap::before {
                    background-image: url("${unsafeCSS(url)}");
                }
            `);
        });
    }

    destroy() {
        running = false;
    }
    /**
     * @param {string} rawUrl
     * @returns {Promise<Renderable>}
     */

    async translateArtistByUrl(rawUrl) {
        // FIXME some links are still HTTP
        const url = rawUrl.replace("https://x.com/", "https://twitter.com/").replace(/^https?/, "");

        const artists = await findTagByDescription(url, TAG_TYPE.author);
        return (
            artists
                // api does search by plain includes, so do a proper check
                .filter((tag) => containsUrl(tag.description_en, url))
                .map((artist) => this.renderArtist(artist))
        );
    }

    /**
     * @param {string} name
     * @returns {Promise<Renderable>}
     */
    async translateArtistByName(name) {
        const artists = await findTagByName(name, TAG_TYPE.author);
        return artists.map((artist) => this.renderArtist(artist));
    }

    /**
     * @param {APTag} artist
     * @returns {TemplateResult}
     */
    renderArtist(artist) {
        const cacheKey = artist.id;
        if (cacheKey in renderedArtistsCache) {
            return renderedArtistsCache[cacheKey];
        }

        const elem = html`
            <a
                class="ap"
                href="${AP_SITE}/posts?search_tag=${artist.tag}"
                target="_blank"
            >
                ${artist.tag}
            </a>
        `;

        renderedArtistsCache[cacheKey] = elem;

        return elem;
    }

    /**
     * @param {string} rawName
     * @returns {Promise<Renderable>}
     */
    async translateTag(rawName) {
        const name = rawName.replaceAll("_", " ");
        const cacheKey = name;
        if (cacheKey in renderedTagsCache) {
            return renderedTagsCache[cacheKey];
        }

        const tags = await findTagByName(name, TAG_TYPE.author);

        const elements = tags.map(
            (tag) => html`
                <a
                    class="tpt-tag ap category-${TAG_CSS_TYPE[tag.type]}"
                    href="${AP_SITE}/posts?tags=${encodeURIComponent(tag.tag)}"
                    target="_blank"
                >
                    ${tag.tag}
                </a>
            `,
        );
        renderedTagsCache[cacheKey] = elements;
        return elements;
    }
}

addAdapter(AnimePictureAdapter);
