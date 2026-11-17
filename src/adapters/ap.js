// @tpt-adapter
// @name Anime-Pictures
// @version 26.11.12

/* eslint-disable no-undef, class-methods-use-this */

/**
 * @import { TemplateResult } from "lit"
 * @import { ArtistTooltipParams } from "./adapter"
 */

const AP_SITE = "https://anime-pictures.net";
const AP_API = "https://api.anime-pictures.net";
const AP_IMAGES = `https://opreviews.anime-pictures.net`;

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

const POST_STATUS = {
    new: 0,
    public: 1,
    banned: 2,
    pre: 3,
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

/**
 * Reduced type
 * @typedef {object} APPost
 * @prop {number} id
 * @prop {string} md5
 * @prop {number} width
 * @prop {number} height
 * @prop {0|1|2|3} erotics - g/s/q/e
 * @prop {0|1|2|3|4} status
 * @prop {number} size - filesize
 * @prop {string} ext - file extension with dot
 * @prop {string} pubtime
 */

// #region tooltip

const ARTIST_TOOLTIP_CSS = css`
    :host(*) {
        color: #000;
    }
    a:link,
    a:visited,
    a:hover {
        color: #676767;
        text-decoration: none;
    }
    a:hover {
        text-decoration: underline;
    }
    a.tag-category-artist,
    a.tag-category-artist:hover {
        color: darkorange;
    }
    :host(.tip-content-dark) {
        color: #ddd;
    }
    :host(.tip-content-dark) a:link,
    :host(.tip-content-dark) a:visited,
    :host(.tip-content-dark) a:hover {
        color: darkorange;
        text-decoration: none;
    }
    :host(.tip-content-dark) a.tag-category-artist,
    :host(.tip-content-dark) a.tag-category-artist:hover {
        color: darkorange;
    }
    .erotic-1 {
        color: #f0f;
    }
    .erotic-2 {
        color: #f90;
    }
    .erotic-3 {
        color: red;
    }
`;

/**
 * Builds artist tooltip content
 * @param {APTag} artist The artist data
 * @returns {Promise<ArtistTooltipParams>}
 */
async function buildArtistTooltip(artist) {
    const encodedName = encodeURIComponent(artist.tag).replaceAll("%20", " ");
    const {
        posts,
        posts_count: postsCount,
        max_pages: lastPage,
    } = await makeRequest("GET", `${AP_API}/api/v3/posts`, {
        page: 0,
        search_tag: artist.tag,
        posts_per_page: SETTINGS.preview_limit,
    });

    const otherNames = [artist.tag_ru, artist.tag_jp]
        .filter((name) => name !== null)
        .sort()
        .map(
            (otherName) => html`
                <li>
                    <a
                        href="${AP_SITE}/posts?page=0&search_tag=${encodeURIComponent(otherName)}"
                        target="_blank"
                    >
                        ${otherName}
                    </a>
                </li>
            `,
        );

    return {
        artistName: artist.tag,
        artistPageUrl: `${AP_SITE}/posts?search_tag=${encodedName}`,
        artistEditUrl: `${AP_SITE}/tags?search_text=${encodedName}`,
        artistPostsUrl: `${AP_SITE}/posts?search_tag=${encodedName}`,
        artistUrls: buildArtistUrls(artist),
        postCount: postsCount,
        otherNames,
        firstPage: 0,
        lastPage,
        postPreviews: posts.map(buildPostPreview),
        loadNextPage: (page) => loadNextPage(artist.tag, page),
    };
}

/**
 * Format artist urls
 * @param {APTag} artist The artist data
 */
function buildArtistUrls(artist) {
    return artist.description_en
        .split(/\n|\r/)
        .filter(Boolean)
        .map((line) => {
            const regexp = /(?:\[url=)?(https?:\/\/[^\s\]]*[^\s"(),.;<>\]{}])(?:](.*?)\[\/url])?/gi;
            /** @type {Renderable[]} */
            const items = [];

            /** @type {RegExpExecArray|null} */
            let match;
            let start = 0;
            // eslint-disable-next-line no-cond-assign
            while ((match = regexp.exec(line))) {
                items.push(
                    // bare text
                    line.slice(start, match.index),
                    html`
                        <a
                            href="${match[1]}"
                            target="_blank"
                            >${match[2] ?? match[1]}</a
                        >
                    `,
                );
                start = regexp.lastIndex;
            }

            return html`<div class="artist-url-active">${items}</div>`;
        });
}

/**
 * Load a neighbor page of posts
 * @param {string} tag - the tag to browse
 * @param {number} page - the browsed page
 */
async function loadNextPage(tag, page) {
    const { posts } = await makeRequest("GET", `${AP_API}/api/v3/posts`, {
        page,
        search_tag: tag,
        posts_per_page: SETTINGS.preview_limit,
    });
    return posts.map(buildPostPreview);
}

/**
 * @param {APPost} post
 * @param {"sp"|"cp"|"bp"} size
 */
function genPreviewUrlAvif(post, size) {
    const folder = post.md5.slice(0, 3);
    return `${AP_IMAGES}/${folder}/${post.md5}_${size}.avif`;
}

/**
 * Extract the post preview info
 * @param {APPost} post The post data
 */
function getPostPreview(post) {
    const scale = 180 / Math.max(post.width, post.height);

    return {
        url: genPreviewUrlAvif(post, "cp"),
        width: post.width * scale,
        height: post.height * scale,
    };
}

/**
 * Build the post preview
 * @param {APPost} post The post data
 */
function buildPostPreview(post) {
    const erotic = ["no erotic", "light erotic", "erotic", "hard erotic"][post.erotics];
    const maxErotic = /** @type {number!} */ (
        {
            g: 0,
            s: 1,
            q: 2,
            e: 3, // eslint-disable-line id-blacklist
        }[SETTINGS.show_preview_rating]
    );
    let previewClass = "post-preview";
    if (post.status === POST_STATUS.new) previewClass += " post-status-pending";
    if (post.status === POST_STATUS.banned) previewClass += " post-status-banned";
    if (post.erotics > maxErotic) {
        previewClass += " blur-post";
    }

    const preview = getPostPreview(post);

    return html`
        <article
            itemscope
            itemtype="http://schema.org/ImageObject"
            class="${previewClass}"
        >
            <a
                class="post-link"
                href="${AP_SITE}/posts/${post.id}"
                target="_blank"
            >
                <img
                    width="${preview.width}"
                    height="${preview.height}"
                    src="${adapterShared.corsSrc(preview.url, true)}"
                    crossorigin="anonymous"
                    referrerpolicy="origin"
                    part="post-preview rating-${"gsqe"[post.erotics]}"
                />
            </a>
            <p>${adapterShared.formatBytes(post.size)} ${post.ext}, ${post.width}x${post.height}</p>
            <p><span class="erotic-${post.erotics}">${erotic}</span></p>
            <p>${adapterShared.timeToAgo(post.pubtime)}</p>
        </article>
    `;
}

// #endregion
// #region adapter

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
 * @type {Record<string, TranslationResult>}
 */
const renderedTagsCache = {};
/**
 * @type {Record<string, TranslatedItem>}
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
                .ap {
                    --icon: url("${unsafeCSS(url)}");
                }
            `);
        });
    }

    destroy() {
        running = false;
    }

    /**
     * @param {string} rawUrl
     * @returns {Promise<TranslationResult>}
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
     * @returns {Promise<TranslationResult>}
     */
    async translateArtistByName(name) {
        const artists = await findTagByName(name, TAG_TYPE.author);
        return artists.map((artist) => this.renderArtist(artist));
    }

    /**
     * @param {APTag} artist
     * @returns {TranslatedItem}
     */
    renderArtist(artist) {
        const cacheKey = artist.id;
        if (cacheKey in renderedArtistsCache) {
            return renderedArtistsCache[cacheKey];
        }

        /** @param {boolean} textless */
        const render = (textless) => html`
            <a
                class="ap ${textless ? "tpt-textless" : ""}"
                href="${AP_SITE}/posts?search_tag=${artist.tag}"
                target="_blank"
                ${artistTooltip(
                    `AP:${artist.tag}`,
                    () => buildArtistTooltip(artist),
                    ARTIST_TOOLTIP_CSS,
                )}
                >${textless ? "" : artist.tag}</a
            >
        `;

        // eslint-disable-next-line no-return-assign
        return (renderedArtistsCache[cacheKey] = [artist.tag, render]);
    }

    /**
     * @param {string} rawName
     * @returns {Promise<TranslationResult>}
     */
    async translateTag(rawName) {
        const name = rawName.replaceAll("_", " ");
        const cacheKey = name;
        if (cacheKey in renderedTagsCache) {
            return renderedTagsCache[cacheKey];
        }

        const tags = await findTagByName(name);

        /** @type {TranslationResult} */
        const elements = tags.map((tag) => [
            tag.tag,
            (textless) => html`
                <a
                    class="tpt-tag ap category-${TAG_CSS_TYPE[tag.type]} ${textless
                        ? "tpt-textless"
                        : ""}"
                    href="${AP_SITE}/posts?search_tag=${encodeURIComponent(tag.tag)}"
                    target="_blank"
                    >${textless ? "" : tag.tag}</a
                >
            `,
        ]);
        renderedTagsCache[cacheKey] = elements;
        return elements;
    }
}

addAdapter(AnimePictureAdapter);
