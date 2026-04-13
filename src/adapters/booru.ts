import $ from "jquery";
import { chain, memoize } from "underscore";
import { css, html, TemplateResult, unsafeCSS } from "lit";
import { until } from "lit/directives/until.js";
import {
    getImage,
    makeRequest,
    MAXIMUM_URI_LENGTH,
    tooManyNetworkErrors,
    type UrlParams,
} from "../network";
import { SETTINGS, DOMAIN_USES_CSP } from "../settings";
import { addCss, debuglog, memoizeKey, naturalCompare, getSafeImageUrl } from "../utils";
import { normalizeSourceUrl } from "../normalize-url";
import {
    FLASH_FILE,
    formatBytes,
    formatDuration,
    globeIcon,
    FALLBACK_PREVIEW,
    soundIcon,
    timeToAgo,
    TRANSPARENT_IMAGE,
} from "./shared";
import {
    getSiteDisplayDomain,
    getSiteIconUrl,
    getSiteName,
    getSitePriority,
    isSecondaryUrl,
} from "../artist-urls";
import artistTooltip, { type ArtistTooltipParams } from "../tooltips/artist-tooltip";
import showMessage from "../tooltips/message";

const CACHE_PARAM = { expires_in: SETTINGS.cache_lifetime };
// Setting this to the maximum since batches could return more than the amount being queried
const API_LIMIT = 1000;
const REQUEST_INTERVAL = 500; // in ms

const TAGS_CSS = css`
    :root,
    .tpt-light,
    .tpt-auto {
        --tpt-danbooru-artist: #c00004;
        --tpt-danbooru-cat-0: #0075fa;
        --tpt-danbooru-cat-1: #c20003;
        --tpt-danbooru-cat-3: #a500a8;
        --tpt-danbooru-cat-4: #00ad2b;
        --tpt-danbooru-cat-5: #ff9500;
    }
    .tpt-dark {
        --tpt-danbooru-artist: #ff8a8b;
        --tpt-danbooru-cat-0: #009be6;
        --tpt-danbooru-cat-1: #ff8a8b;
        --tpt-danbooru-cat-3: #c797ff;
        --tpt-danbooru-cat-4: #35c64a;
        --tpt-danbooru-cat-5: #ead084;
    }
    @media (prefers-color-scheme: dark) {
        .tpt-auto {
            --tpt-danbooru-artist: #ff8a8b;
            --tpt-danbooru-cat-0: #009be6;
            --tpt-danbooru-cat-1: #ff8a8b;
            --tpt-danbooru-cat-3: #c797ff;
            --tpt-danbooru-cat-4: #35c64a;
            --tpt-danbooru-cat-5: #ead084;
        }
    }

    .tpt-artist .danbooru {
        --color: var(--tpt-danbooru-artist);
    }
    .tpt-tag.danbooru.category-5 {
        --color: var(--tpt-danbooru-cat-5);
    }
    .tpt-tag.danbooru.category-4 {
        --color: var(--tpt-danbooru-cat-4);
    }
    .tpt-tag.danbooru.category-3 {
        --color: var(--tpt-danbooru-cat-3);
    }
    .tpt-tag.danbooru.category-1 {
        --color: var(--tpt-danbooru-cat-1);
    }
    .tpt-tag.danbooru.category-0 {
        --color: var(--tpt-danbooru-cat-0);
    }
`;

// #region network

type Single<T extends object | object[]> = T extends object[] ? T[number] : T;

type RequestName = "wiki" | "artist" | "tag" | "alias" | "url" | "post" | "count";
interface RequestDefinition<Resp extends Record<string, any>> {
    url: string;
    fields: string;
    params: (requests: string[]) => UrlParams;
    matches: (response: Single<Resp>, request: string) => boolean;
    filter?: (responses: Resp) => Resp;
    limit?: number;
}
interface ResponseWiki {
    title: string;
    other_names: string[];
    tag: { category: number };
}
interface ResponseArtist {
    id: number;
    name: string;
    is_banned: boolean;
    other_names: string[];
    urls: Array<{ url: string; is_active: boolean }>;
}
interface ResponseTag {
    name: string;
    post_count: number;
    category: number;
}
interface ResponseTagAlias {
    antecedent_name: string;
    consequent_tag: { name: string; category: number; post_count: number };
}
type ResponseUrl = ResponseArtist & { is_deleted: boolean };
interface MediaAssetVariant {
    type: string;
    url: string;
    width: number;
    height: number;
    file_ext: string;
}
interface MediaAsset {
    id: number;
    file_ext: string;
    file_size: number;
    duration: number | null;
    image_width: number;
    image_height: number;
    variants: MediaAssetVariant[];
}
interface ResponsePosts {
    id: number;
    created_at: string;
    source: string;
    rating: Rating;
    parent_id: number | null;
    is_pending: boolean;
    is_flagged: boolean;
    is_deleted: boolean;
    is_banned: boolean;
    has_visible_children: boolean;
    tag_string_general: string;
    tag_string_character: string;
    tag_string_copyright: string;
    tag_string_artist: string;
    tag_string_meta: string;
    media_asset: MediaAsset;
}
type ResponseCount = { counts: { posts: number } };
type ResponseEntity<N extends RequestName> = N extends "wiki"
    ? ResponseWiki
    : N extends "artist"
      ? ResponseArtist
      : N extends "tag"
        ? ResponseTag
        : N extends "alias"
          ? ResponseTagAlias
          : N extends "url"
            ? ResponseUrl
            : N extends "post"
              ? ResponsePosts
              : N extends "count"
                ? ResponseCount
                : never;
type DBResponse<N extends RequestName> = N extends "count" ? ResponseCount : ResponseEntity<N>[];
interface RequestPromise<N extends RequestName> {
    type: N;
    item: string;
    promise: JQuery.Deferred<DBResponse<N>, any, any>;
}

const QUEUED_NETWORK_REQUESTS: RequestPromise<RequestName>[] = [];

const REQUEST_DATA_MATCHERS = {
    /** Case-insensitive comparing strings */
    string: (data: string, item: string) => data.toLowerCase() === item.toLowerCase(),
    /** Case-insensitive looking in array of strings */
    array: (data: string[], item: string) =>
        data.map((it) => it.toLowerCase()).includes(item.toLowerCase()),
    /** Case-insensitive looking in string-array */
    string_list: (data: string, item: string) =>
        data.toLowerCase().split(" ").includes(item.toLowerCase()),
};

const NETWORK_REQUEST_DICT: { [N in RequestName]: RequestDefinition<DBResponse<N>> } = {
    wiki: {
        url: "/wiki_pages",
        fields: "title,other_names,tag[category]",
        params(otherNamesList) {
            return {
                search: {
                    other_names_include_any_lower_array: otherNamesList,
                    is_deleted: false,
                },
                only: this.fields,
            };
        },
        matches(data, item) {
            return REQUEST_DATA_MATCHERS.array(data.other_names, item);
        },
    },
    artist: {
        url: "/artists",
        fields: "id,name,is_banned,other_names,urls[url,is_active]",
        params(nameList) {
            return {
                search: {
                    name_lower_comma: nameList.join(","),
                    is_active: true,
                },
                only: this.fields,
            };
        },
        matches(data, item) {
            return REQUEST_DATA_MATCHERS.string(data.name, item);
        },
    },
    tag: {
        url: "/tags",
        fields: "name,category,post_count",
        params(nameList) {
            return {
                search: {
                    name_lower_comma: nameList.join(","),
                },
                only: this.fields,
            };
        },
        filter: (items) => items.filter((item) => item.post_count > 0),
        matches(data, item) {
            return REQUEST_DATA_MATCHERS.string(data.name, item);
        },
    },
    alias: {
        url: "/tag_aliases",
        fields: "antecedent_name,consequent_tag[name,category,post_count]",
        params(nameList) {
            return {
                search: {
                    antecedent_name_lower_comma: nameList.join(","),
                },
                only: this.fields,
            };
        },
        matches(data, item) {
            return REQUEST_DATA_MATCHERS.string(data.antecedent_name, item);
        },
    },
    url: {
        url: "/artists",
        fields: "id,name,is_deleted,is_banned,other_names,urls[url,is_active]",
        params(urlList) {
            return {
                search: {
                    url_matches: urlList,
                },
                only: this.fields,
            };
        },
        filter: (artists) => artists.filter((artist) => !artist.is_deleted),
        matches(data, item) {
            return REQUEST_DATA_MATCHERS.array(
                data.urls.map((url) => url.url),
                item,
            );
        },
    },
    // This can only be used as a single use and not as part a group
    post: {
        url: "/posts",
        fields: [
            "created_at",
            "has_visible_children",
            "id",
            "is_flagged",
            "is_pending",
            "is_deleted",
            "is_banned",
            "parent_id",
            "media_asset[id,file_ext,file_size,image_width,image_height,duration,variants]",
            "rating",
            "source",
            "tag_string_general",
            "tag_string_character",
            "tag_string_copyright",
            "tag_string_artist",
            "tag_string_meta",
        ].join(","),
        params(tagList) {
            const [tag, page] = tagList[0].split(" ");
            return {
                // As this is called immediately and as a single use, only pass the first tag
                tags: `${SETTINGS.show_deleted ? "status:any" : "-status:deleted"} ${tag}`,
                page,
                only: this.fields,
            };
        },
        matches(data, item) {
            return REQUEST_DATA_MATCHERS.string_list(data.tag_string_artist, item.split(" ")[0]);
        },
        limit: SETTINGS.preview_limit,
    },
    count: {
        url: "/counts/posts",
        fields: "",
        params: (tags) => ({ tags: tags.join(" ") }),
        matches: () => true,
    },
};

function queueNetworkRequest<T extends RequestName>(
    type: T,
    item: string,
): RequestPromise<T>["promise"] {
    const request = {
        type,
        item,
        promise: $.Deferred(),
    };
    QUEUED_NETWORK_REQUESTS.push(request);
    return request.promise;
}

const queueNetworkRequestMemoized: typeof queueNetworkRequest = memoize(
    queueNetworkRequest,
    memoizeKey,
);

function intervalNetworkHandler(booru: string) {
    if (QUEUED_NETWORK_REQUESTS.length === 0) return;
    if (!navigator.onLine) {
        if (SETTINGS.display_network_errors) {
            showMessage("No Internet connection", "");
        }
        return;
    }
    if (tooManyNetworkErrors(new URL(booru).hostname)) return;

    const types = Object.keys(NETWORK_REQUEST_DICT) as RequestName[];
    for (const type of types) {
        const requests = QUEUED_NETWORK_REQUESTS.filter((request) => request.type === type);
        if (requests.length <= 0) continue; // eslint-disable-line no-continue

        const requestTools = NETWORK_REQUEST_DICT[type] as RequestDefinition<
            DBResponse<typeof type>
        >;
        const url = `${booru}${requestTools.url}.json`;
        const limitParam = { limit: requestTools.limit ?? API_LIMIT };
        if (type === "count") {
            for (const request of requests) {
                const typeParam = requestTools.params([request.item]);
                const params = Object.assign(typeParam, limitParam, CACHE_PARAM);
                getLong(url, params, [request], requestTools).catch(() => {
                    // in case of error return the request to the queue
                    QUEUED_NETWORK_REQUESTS.push(request);
                });
            }
        } else {
            const typeParam = requestTools.params(requests.map((request) => request.item));
            const params = Object.assign(typeParam, limitParam, CACHE_PARAM);
            getLong(url, params, requests, requestTools).catch(() => {
                // in case of error return requests to the queue
                QUEUED_NETWORK_REQUESTS.push(...requests);
            });
        }
    }
    // Clear the queue once all network requests have been sent
    QUEUED_NETWORK_REQUESTS.length = 0;
}

async function getLong<T extends RequestName>(
    url: string,
    params: UrlParams,
    requests: RequestPromise<T>[],
    tools: RequestDefinition<DBResponse<T>>,
) {
    // Default to GET requests
    let method = "get";
    let finalParams = params;
    if ($.param(params).length > MAXIMUM_URI_LENGTH) {
        // Use POST requests only when needed
        finalParams = Object.assign(finalParams, { _method: "get" });
        method = "post";
    }

    let resp: DBResponse<T> = await makeRequest(method, url, finalParams);
    // Do any necessary filtering after the network request completes
    if (tools.filter) resp = tools.filter(resp);

    if (!Array.isArray(resp)) {
        for (const request of requests) {
            request.promise.resolve(resp);
        }
        return;
    }

    const unusedResp: Set<ResponseEntity<RequestName>> = new Set(resp);
    for (const request of requests) {
        const found = resp.filter((data) => {
            if (tools.matches(data as any, request.item)) {
                unusedResp.delete(data);
                return true;
            }
            return false;
        }) as DBResponse<T>;
        // Fulfill the promise which returns the results to the function that queued it
        request.promise.resolve(found);
    }
    if (unusedResp.size > 0) {
        debuglog("Unused results found:", [...unusedResp.values()]);
    }
}

// #endregion

// #region tooltip

const ARTIST_TOOLTIP_CSS = css`
    :host {
        --preview_has_children_color: #35c64a;
        --preview_has_parent_color: #ccaa00;
        --preview_deleted_color: #1e1e2c;
        --preview_pending_color: #0075f8;
        --preview_banned_color: #ed2426;
    }
    :host(.tip-content-dark) {
        --preview_has_children_color: #35c64a;
        --preview_has_parent_color: #fd9200;
        --preview_deleted_color: #ababbc;
        --preview_pending_color: #009be6;
        --preview_banned_color: #ed2426;
    }

    /* Basic styles taken from Danbooru */
    a:link,
    a:visited {
        color: #0075f8;
        text-decoration: none;
    }
    a:hover {
        color: #8caaff;
    }
    a.tag-category-artist {
        color: #c00004;
    }
    a.tag-category-artist:hover {
        color: #ed2426;
    }
    :host(.tip-content-dark) a:link,
    :host(.tip-content-dark) a:visited {
        color: #009be6;
    }
    :host(.tip-content-dark) a:hover {
        color: #4bb4ff;
    }
    :host(.tip-content-dark) a.tag-category-artist {
        color: #ff8a8b;
    }
    :host(.tip-content-dark) a.tag-category-artist:hover {
        color: #ffc3c3;
    }

    article.post-preview.post-status-has-children a {
        border-color: var(--preview_has_children_color);
    }

    article.post-preview.post-status-has-parent a {
        border-color: var(--preview_has_parent_color);
    }

    article.post-preview.post-status-has-children.post-status-has-parent a {
        border-color: var(--preview_has_children_color) var(--preview_has_parent_color)
            var(--preview_has_parent_color) var(--preview_has_children_color);
    }

    article.post-preview.post-status-deleted a {
        border-color: var(--preview_deleted_color);
    }

    article.post-preview.post-status-has-children.post-status-deleted a {
        border-color: var(--preview_has_children_color) var(--preview_deleted_color)
            var(--preview_deleted_color) var(--preview_has_children_color);
    }

    article.post-preview.post-status-has-parent.post-status-deleted a {
        border-color: var(--preview_has_parent_color) var(--preview_deleted_color)
            var(--preview_deleted_color) var(--preview_has_parent_color);
    }

    article.post-preview.post-status-has-children.post-status-has-parent.post-status-deleted a {
        border-color: var(--preview_has_children_color) var(--preview_deleted_color)
            var(--preview_deleted_color) var(--preview_has_parent_color);
    }

    article.post-preview.post-status-pending a,
    article.post-preview.post-status-flagged a {
        border-color: var(--preview_pending_color);
    }

    article.post-preview.post-status-has-children.post-status-pending a,
    article.post-preview.post-status-has-children.post-status-flagged a {
        border-color: var(--preview_has_children_color) var(--preview_pending_color)
            var(--preview_pending_color) var(--preview_has_children_color);
    }

    article.post-preview.post-status-has-parent.post-status-pending a,
    article.post-preview.post-status-has-parent.post-status-flagged a {
        border-color: var(--preview_has_parent_color) var(--preview_pending_color)
            var(--preview_pending_color) var(--preview_has_parent_color);
    }

    article.post-preview.post-status-has-children.post-status-has-parent.post-status-pending a,
    article.post-preview.post-status-has-children.post-status-has-parent.post-status-flagged a {
        border-color: var(--preview_has_children_color) var(--preview_pending_color)
            var(--preview_pending_color) var(--preview_has_parent_color);
    }

    article.post-preview.post-status-banned a {
        border-color: var(--preview_banned_color);
    }

    article.post-preview.post-status-has-children.post-status-banned a {
        border-color: var(--preview_has_children_color) var(--preview_banned_color)
            var(--preview_banned_color) var(--preview_has_children_color);
    }

    article.post-preview.post-status-has-parent.post-status-banned a {
        border-color: var(--preview_has_parent_color) var(--preview_banned_color)
            var(--preview_banned_color) var(--preview_has_parent_color);
    }

    article.post-preview.post-status-has-children.post-status-has-parent.post-status-banned a {
        border-color: var(--preview_has_children_color) var(--preview_banned_color)
            var(--preview_banned_color) var(--preview_has_parent_color);
    }

    article.post-preview img {
        display: block;
    }

    article.post-preview .post-icon .animation-icon {
        font-weight: bold;
    }
    article.post-preview .post-icon .ai-generated {
        color: red;
        font-weight: bold;
        margin-bottom: -1px;
    }
    article.post-preview .post-icon .ai-assisted {
        color: orange;
        margin-bottom: -1px;
        margin-left: -1px;
    }
`;

/**
 * Format artist urls
 * @param artist The artist data
 */
function buildArtistUrls(artist: TranslatedArtist) {
    const artistUrls = chain(artist.urls)
        .uniq("url")
        .map((artistUrl) => ({ ...artistUrl, siteName: getSiteName(artistUrl.url) }))
        // @ts-expect-error - incorrect definition in library
        .sort((u1, u2) => naturalCompare(u1.url, u2.url))
        .sortBy((artistUrl) => isSecondaryUrl(artistUrl.url))
        .sortBy((artistUrl) => getSiteDisplayDomain(artistUrl.url))
        .sortBy((artistUrl) => getSitePriority(artistUrl.siteName))
        .sortBy((artistUrl) => !artistUrl.is_active)
        .value();

    return artistUrls.map((artistUrl) => {
        const normalizedUrl = artistUrl.url.replace(/\/$/, "");
        const urlClass = artistUrl.is_active ? "artist-url-active" : "artist-url-inactive";
        const icon = getSiteIconUrl(artistUrl.siteName, artistUrl.url)?.then((url) =>
            url ? html`<img src="${url}" />` : globeIcon,
        );

        return html /* HTML */ `
            <li class="${urlClass}">
                <a
                    href="${normalizedUrl}"
                    target="_blank"
                >
                    <span class="artist-url-icon"> ${until(icon)} </span>
                    ${normalizedUrl}
                </a>
            </li>
        `;
    });
}

/**
 * Format the post tags
 * @param post The post data
 */
function formatTagString(post: ResponsePosts) {
    return chain([
        post.tag_string_artist,
        post.tag_string_copyright,
        post.tag_string_character,
        post.tag_string_meta,
        post.tag_string_general,
    ])
        .compact()
        .join("\n")
        .value();
}

/**
 * Format the post image info
 * @param post The post data
 */
function formatImageInfo(post: ResponsePosts, booru: string) {
    if (
        ![
            post.media_asset.file_size,
            post.media_asset.image_width,
            post.media_asset.image_height,
        ].every(Number.isFinite)
    ) {
        return "";
    }
    return html`
        ${formatBytes(post.media_asset.file_size)}.${post.media_asset.file_ext},
        <a href="${booru}/media_assets/${post.media_asset.id}">
            ${post.media_asset.image_width}x${post.media_asset.image_height}
        </a>
    `;
}

/**
 * Extract the post preview info
 * @param {ResponsePosts} post The post data
 */
function getPostPreview(post: ResponsePosts) {
    const hiDpi = window.devicePixelRatio > 1;
    const size = hiDpi ? "360x360" : "180x180";
    const scale = hiDpi ? 0.5 : 1;
    const previewAsset = post.media_asset.variants?.find((variant) => variant.type === size);

    const info = previewAsset
        ? {
              url: previewAsset.url,
              safeUrl: null as Promise<string> | null,
              width: previewAsset.width * scale,
              height: previewAsset.height * scale,
          }
        : {
              url: post.media_asset.file_ext === "swf" ? FLASH_FILE : FALLBACK_PREVIEW,
              safeUrl: null as Promise<string> | null,
              width: 180,
              height: 180,
          };

    if (DOMAIN_USES_CSP) {
        info.safeUrl = getImage(info.url);
        info.url = TRANSPARENT_IMAGE;
    }
    return info;
}

/**
 * Get icons for a post
 * @param post The post data
 */
function buildPostIcons(post: ResponsePosts) {
    const hasSound = /\bsound\b/.test(post.tag_string_meta);
    const animationIcon = post.media_asset.duration
        ? html /* HTML */ `
              <div
                  class="post-icon animation-icon"
                  title="Animated post ${hasSound ? "with a sound" : ""}"
              >
                  <span class="post-duration"> ${formatDuration(post.media_asset.duration)} </span>
                  ${hasSound ? soundIcon : ""}
              </div>
          `
        : "";

    const aiIcon = /\bai-generated\b/.test(post.tag_string_meta)
        ? html /* HTML */ `
              <div
                  class="post-icon right-icon"
                  title="AI generated image"
              >
                  <span class="ai-generated">AI</span>
              </div>
          `
        : /\bai-assisted\b/.test(post.tag_string_meta)
          ? html /* HTML */ `
                <div
                    class="post-icon right-icon"
                    title="AI assisted image"
                >
                    <span class="ai-assisted">+AI</span>
                </div>
            `
          : "";
    return [animationIcon, aiIcon];
}

/**
 * Build the post preview
 * @param post The post data
 */
function buildPostPreview(post: ResponsePosts, booru: string) {
    const RATINGS: Record<string, number> = {
        g: 0,
        s: 1,
        q: 2,
        e: 3, // eslint-disable-line id-blacklist
    };

    let previewClass = "post-preview";
    if (post.is_pending) previewClass += " post-status-pending";
    if (post.is_flagged) previewClass += " post-status-flagged";
    if (post.is_deleted) previewClass += " post-status-deleted";
    if (post.is_banned) previewClass += " post-status-banned";
    if (post.parent_id) previewClass += " post-status-has-parent";
    if (post.has_visible_children) previewClass += " post-status-has-children";
    if (RATINGS[post.rating] > RATINGS[SETTINGS.show_preview_rating]) {
        previewClass += " blur-post";
    }

    const preview = getPostPreview(post);

    const sourceUrl = /^https?:\/\//.test(post.source) ? normalizeSourceUrl(post.source) : null;
    const domain = sourceUrl
        ? html`
              <a
                  href="${sourceUrl}"
                  target="_blank"
                  >${getSiteDisplayDomain(sourceUrl)}</a
              >
          `
        : html`<span title="${post.source}">NON-WEB</span>`;

    const element = html /* HTML */ `
        <article
            itemscope
            itemtype="http://schema.org/ImageObject"
            class="${previewClass}"
            data-id="${post.id}"
            data-tags="${formatTagString(post)}"
        >
            <a
                class="post-link"
                href="${booru}/posts/${post.id}"
                target="_blank"
            >
                ${buildPostIcons(post)}
                <img
                    width="${preview.width}"
                    height="${preview.height}"
                    src="${until(preview.safeUrl ?? preview.url, preview.url)}"
                    title="${formatTagString(post)}"
                    referrerpolicy="origin"
                    part="post-preview rating-${post.rating}"
                />
            </a>
            <p>${formatImageInfo(post, booru)}</p>
            <p>${domain}, rating:${post.rating.toUpperCase()}</p>
            <p>${timeToAgo(post.created_at)}</p>
        </article>
    `;

    return element;
}

/**
 * Load a neighbor page of posts
 * @param booru The data source domain
 * @param tag The encoded tag for searching
 * @param page The page number to load
 */
async function loadNextPage(booru: string, tag: string, page: number) {
    const waitPosts = queueNetworkRequestMemoized("post", `${tag} ${page}`);
    // Process the queue immediately
    intervalNetworkHandler(booru);
    const posts = await waitPosts;
    return posts.map((post) => buildPostPreview(post, booru));
}

// #endregion

type TranslatedTag = { name: string; prettyName: string; category: number };

type TranslatedArtist = ResponseArtist & {
    prettyName: string;
    encodedName: string;
};

const renderedTagsCache: Record<string, TemplateResult[]> = {};
const renderedArtistsCache: Record<string, TemplateResult> = {};
let id = 1;

export default class DanbooruAdapter implements Adapter {
    static name: "Danbooru";
    booru: string;
    id: number;

    constructor(booru: string) {
        this.booru = booru;
        this.id = id++;

        addCss(TAGS_CSS);

        getSafeImageUrl(`${booru}/favicon.ico`).then((url) => {
            addCss(css`
                .tpt-artist .danbooru.db${this.id}::before {
                    background-image: url("${unsafeCSS(url)}");
                }
            `);
        });

        // Check for new network requests every half-second
        setInterval(intervalNetworkHandler, REQUEST_INTERVAL, booru);
    }

    renderArtist(rawArtist: ResponseArtist) {
        const cacheKey = this.booru + rawArtist.id;
        if (cacheKey in renderedArtistsCache) {
            return renderedArtistsCache[cacheKey];
        }

        const artist = {
            ...rawArtist,
            prettyName: rawArtist.name.replaceAll("_", " "),
            encodedName: encodeURIComponent(rawArtist.name),
        };

        const elem = html /* HTML */ `
            <a
                class="danbooru db${this.id} ${artist.is_banned ? "banned-artist" : ""}"
                href="${this.booru}/artists/${artist.id}"
                target="_blank"
                ${artistTooltip(
                    `Danbooru:${this.booru}:${artist.name}`,
                    () => this.buildArtistTooltip(artist),
                    ARTIST_TOOLTIP_CSS,
                )}
            >
                ${artist.prettyName}
            </a>
        `;

        renderedArtistsCache[cacheKey] = elem;

        return elem;
    }

    async translateArtistByName(name: string) {
        const artists = await queueNetworkRequestMemoized("artist", name.replaceAll(" ", "_"));

        return artists.map((artist) => this.renderArtist(artist));
    }

    async translateArtistByUrl(url: string) {
        const artists = await queueNetworkRequestMemoized("url", url);

        let filteredArtists = artists;
        if (artists.length > 1) {
            const urlLower = url.toLowerCase();
            filteredArtists = artists.filter((artist) =>
                artist.urls.some(
                    (urlObj) => urlLower === urlObj.url.toLowerCase() && urlObj.is_active,
                ),
            );

            if (filteredArtists.length === 0) {
                filteredArtists = artists;
            }
        }

        return filteredArtists.map((artist) => this.renderArtist(artist));
    }

    async translateTag(tagName: string) {
        const cacheKey = this.booru + tagName;
        if (cacheKey in renderedTagsCache) {
            return Promise.resolve(renderedTagsCache[cacheKey]);
        }

        const wikiPages = await queueNetworkRequestMemoized("wiki", tagName);

        let tags: TranslatedTag[] = [];
        if (wikiPages.length > 0) {
            tags = wikiPages
                // Ignore wiki pages of non-tags
                .filter(({ tag }) => tag)
                .map(({ title, tag }) => ({
                    name: title,
                    prettyName: title.replaceAll("_", " "),
                    category: tag.category,
                }));
            // if `tagName` consists of only ASCII characters except percent, asterisks, and comma
        } else if (/^[\u0020-\u0024\u0026-\u0029+\u002D-\u007F]+$/.test(tagName)) {
            // The server is already converting the values to
            // lowercase on its end so no need to do it here
            let rawTags = await queueNetworkRequestMemoized("tag", tagName);
            if (rawTags.length === 0) {
                const aliases = await queueNetworkRequestMemoized("alias", tagName);
                rawTags = aliases.map((alias) => alias.consequent_tag);
            }
            tags = rawTags.map((tag) => ({
                name: tag.name,
                prettyName: tag.name.replaceAll("_", " "),
                category: tag.category,
            }));
        }

        const elements = tags.map(
            (tag) => html /* HTML */ `
                <a
                    class="tpt-tag danbooru category-${tag.category}"
                    href="${this.booru}/posts?tags=${encodeURIComponent(tag.name)}"
                    target="_blank"
                >
                    ${tag.prettyName}
                </a>
            `,
        );
        renderedTagsCache[cacheKey] = elements;
        return elements;
    }

    async buildArtistTooltip(artist: TranslatedArtist): Promise<ArtistTooltipParams> {
        const status = SETTINGS.show_deleted ? "status:any" : "-status:deleted";
        const rating = ["https://safebooru.donmai.us", "https://donmai.moe/"].includes(this.booru)
            ? "rating:g"
            : "";

        const waitPosts = queueNetworkRequestMemoized("post", `${artist.name} 1`);
        const waitTotalPostCount = queueNetworkRequestMemoized(
            "count",
            `${artist.name} status:any`,
        );
        const waitVisiblePostCount = artist.is_banned
            ? Promise.resolve({ counts: { posts: 0 } })
            : queueNetworkRequestMemoized("count", `${artist.name} ${status} ${rating}`.trim());

        // Process the queue immediately
        intervalNetworkHandler(this.booru);
        const [
            { counts: { posts: visiblePostsCount } } = { counts: { posts: 0 } },
            { counts: { posts: totalPostsCount } } = { counts: { posts: 0 } },
            posts,
        ] = await Promise.all([waitVisiblePostCount, waitTotalPostCount, waitPosts]);
        const totalPostsCountText =
            totalPostsCount === visiblePostsCount ? "" : `(${totalPostsCount})`;

        const otherNames = artist.other_names
            .filter(String)
            .sort()
            .map(
                (otherName) => html /* HTML */ `
                    <li>
                        <a
                            href="${this.booru}/artists?search[name]=${encodeURIComponent(
                                otherName,
                            )}"
                            target="_blank"
                        >
                            ${otherName.replaceAll("_", " ")}
                        </a>
                    </li>
                `,
            );

        const lastPage = Math.ceil(visiblePostsCount / SETTINGS.preview_limit);

        return {
            artistName: artist.prettyName,
            artistPageUrl: `${this.booru}/artists/${artist.id}`,
            artistEditUrl: `${this.booru}/artists/${artist.id}/edit`,
            artistPostsUrl: `${this.booru}/posts?tags=${artist.encodedName}+${status}`,
            artistUrls: buildArtistUrls(artist),
            postCount: `${visiblePostsCount} ${totalPostsCountText}`,
            otherNames,
            firstPage: 1,
            lastPage,
            postPreviews: posts.map((post) => buildPostPreview(post, this.booru)),
            loadNextPage: (page) => loadNextPage(this.booru, artist.name, page),
        };
    }
}
