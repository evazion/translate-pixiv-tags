import { SETTINGS } from "../settings";
import { chooseBackgroundColorScheme } from "../utils";
import showSettings, { settingsIcon } from "./settings";
import { tooltip } from "./shared";
import { css, CSSResult, html, LitElement, PropertyValues } from "lit";

const ARTIST_TOOLTIP_CSS = css`
    article.container {
        font-family: Verdana, Helvetica, sans-serif;
        padding: 10px;
    }

    section {
        margin-bottom: 15px;
        line-height: 12.5px;
    }

    h2 {
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 5px;
    }

    a.artist-name {
        font-size: 20px;
    }

    .post-count {
        color: #888;
        margin-left: 3px;
    }

    ul.other-names {
        margin-top: 5px;
        line-height: 24px;
        padding: 0px;
        max-height: 48px;
    }

    ul.other-names li {
        display: inline-block;
    }

    ul.other-names li a {
        background-color: rgba(128, 128, 128, 0.2);
        padding: 3px 5px;
        margin: 0 2px;
        border-radius: 3px;
        white-space: nowrap;
    }

    section.urls ul {
        padding: 0px;
        max-height: 145px;
        line-height: 1.5em;
    }

    section.urls ul ::marker {
        font-size: 10px;
    }

    section.urls ul li.artist-url-inactive a {
        color: red;
        text-decoration: underline;
        text-decoration-style: dotted;
    }
    .artist-url-icon {
        display: inline-block;
        width: 1.5em;
    }
    .artist-url-icon * {
        width: 1.5em;
        fill: currentColor;
        vertical-align: middle;
    }

    /* Thumbnail styles taken from Danbooru */
    article.post-preview {
        /*height: 184px;*/
        width: 184px;
        margin: 0 10px 10px 0;
        float: left;
        overflow: hidden;
        text-align: center;
        position: relative;
    }
    article.post-preview:nth-child(3n),
    article.post-preview:last-child {
        margin: 0 2px 10px 0;
    }

    article.post-preview a.post-link {
        margin: auto;
        border: 2px solid transparent;
        display: inline-block;
    }

    article.post-preview img {
        display: block;
    }

    article.post-preview .post-icon {
        position: absolute;
        top: 0;
        left: 0;
        color: white;
        background-color: rgba(0, 0, 0, 0.7);
        border-radius: 4px;
        font-size: 11px;
        font-family: "Arial", "Helvetica", sans-serif;
        line-height: 1em;
        padding: 2px 4px;
        margin: 2px;
        display: flex;
        align-items: center;
        gap: 0.5ch;
        z-index: 1;
    }
    article.post-preview .post-icon.right-icon {
        left: auto;
        right: 0;
    }
    article.post-preview .post-icon * {
        height: 1em;
        line-height: 1em;
        fill: currentColor;
        vertical-align: middle;
    }

    div.post-pager {
        display: flex;
        align-items: stretch;
        gap: 3px;
    }
    div.post-pager.loading {
        opacity: 0.5;
        cursor: wait;
    }
    div.post-pager.loading a {
        cursor: progress;
    }
    div.post-pager .btn {
        width: 12px;
        flex-shrink: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
    }
    div.post-pager .btn.disabled {
        opacity: 0.5;
        cursor: default;
    }
    div.post-pager.loading .btn {
        cursor: inherit;
    }
    div.post-pager .btn:last-child {
        justify-content: flex-end;
    }
    div.post-pager .btn:hover {
        background: #8884;
        border-radius: 3px;
    }

    div.post-list {
        display: grid;
        grid-template-columns: repeat(3, auto);
        grid-auto-rows: max-content;
        max-height: 422px;
        margin-right: auto;
        flex-grow: 1;
    }
    div.post-list:empty::after {
        content: "No posts here";
        text-align: center;
        grid-column: 1/4;
    }

    article.post-preview a {
        position: relative;
        display: inline-block;
        /*height: 184px;*/
        overflow: hidden;
    }

    article.post-preview img {
        margin-bottom: -2px;
    }

    article.post-preview p {
        text-align: center;
        margin: 0 0 2px 0;
        letter-spacing: -0.1px;
    }

    article.post-preview p a {
        display: inline;
    }

    article.post-preview.blur-post img {
        filter: blur(10px);
    }

    article.post-preview.blur-post:hover img {
        filter: blur(0px);
        transition: filter 1s 0.5s;
    }

    .scrollable {
        overflow-y: auto;
        overflow-x: hidden;
        /* Firefox */
        scrollbar-color: rgba(128, 128, 128, 0.4) rgba(128, 128, 128, 0.2);
        scrollbar-width: thin;
    }
    .scrollable::-webkit-scrollbar {
        width: 6px;
    }

    .scrollable::-webkit-scrollbar-track {
        background-color: rgba(128, 128, 128, 0.2);
        border-radius: 6px;
    }

    .scrollable::-webkit-scrollbar-thumb {
        background-color: rgba(128, 128, 128, 0.4);
        border-radius: 6px;
    }

    .settings-icon svg {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 16px;
        height: 16px;
        cursor: pointer;
    }
    .settings-icon path {
        fill: #888;
    }
`;

export type ArtistTooltipParams = {
    /** Displayed name */
    artistName: Renderable;
    /** Url to the artist entry page */
    artistPageUrl: string;
    /** Url to the artist posts page */
    artistPostsUrl: string;
    /** Url to edit the artist */
    artistEditUrl: string;
    /** Artist urls */
    artistUrls: Renderable;
    /** Artist posts count */
    postCount: Renderable;
    /** Other artist's names */
    otherNames: Renderable;
    /** The first page of posts */
    firstPage: number;
    /** The last page of posts */
    lastPage: number;
    /** Post previews of the first page */
    postPreviews: Renderable[];
    /** Event handler for loading another posts page */
    loadNextPage: (page: number) => Promise<Renderable[]>;
};

class TptArtistTooltipContent extends LitElement implements Partial<ArtistTooltipParams> {
    static get styles() {
        return ARTIST_TOOLTIP_CSS;
    }

    static properties = {
        page: { state: true },
        loadingPage: { state: true },

        artistName: { type: Object, property: true },
        artistEditUrl: { type: String, property: true },
        artistPageUrl: { type: String, property: true },
        artistPostsUrl: { type: String, property: true },
        artistUrls: { type: Object, property: true },
        postCount: { type: Object, property: true },
        otherNames: { type: Object, property: true },
        firstPage: { type: Number, property: true },
        lastPage: { type: Number, property: true },
        postPreviews: { type: Array, property: true },
        customCss: { type: Object, property: true },
    };

    declare artistName?: Renderable;
    declare artistEditUrl?: string;
    declare artistPageUrl?: string;
    declare artistPostsUrl?: string;
    declare artistUrls?: Renderable;
    declare postCount?: Renderable;
    declare otherNames?: Renderable;
    declare firstPage?: number;
    declare lastPage?: number;
    declare postPreviews?: Renderable[];
    declare loadNextPage?: (page: number) => Promise<Renderable[]>;
    declare customCss?: CSSResult;

    declare page: number;
    declare loadingPage: boolean;
    width: number;

    constructor() {
        super();
        this.page = -1;
        this.loadingPage = false;
        this.width = 0;
    }

    protected willUpdate(changedProperties: PropertyValues): void {
        if (!this.width) {
            this.width = Math.min(this.postPreviews!.length, SETTINGS.preview_limit, 3) * 194 - 8;
        }
        if (changedProperties.has("firstPage") && this.page < this.firstPage!) {
            this.page = this.firstPage!;
        }
        if (changedProperties.has("customCss")) {
            while (this.shadowRoot?.adoptedStyleSheets.length! > 1) {
                this.shadowRoot!.adoptedStyleSheets.pop();
            }
            if (this.customCss) {
                this.shadowRoot?.adoptedStyleSheets.push(this.customCss.styleSheet!);
            }
        }
    }

    async loadPage(page: number) {
        if (this.loadingPage || page <= this.firstPage! || page >= this.lastPage!) return;
        this.loadingPage = true;
        try {
            this.postPreviews = await this.loadNextPage!(page);
            this.page = page;
        } finally {
            this.loadingPage = false;
        }
    }

    render() {
        return html /* HTML */ `
            <article
                class="container"
                part="container"
            >
                <span
                    class="settings-icon"
                    @click=${showSettings}
                >
                    ${settingsIcon}
                </span>
                <section class="header">
                    <a
                        class="artist-name tag-category-artist"
                        href="${this.artistPageUrl}"
                        target="_blank"
                    >
                        ${this.artistName}
                    </a>
                    <span class="post-count"> ${this.postCount} </span>

                    <ul
                        class="other-names scrollable"
                        part="other-names"
                    >
                        ${this.otherNames}
                    </ul>
                </section>
                <section class="urls">
                    <h2>
                        URLs (<a
                            href="${this.artistEditUrl}"
                            target="_blank"
                            >edit</a
                        >)
                    </h2>
                    <ul
                        class="scrollable"
                        part="url-list"
                    >
                        ${this.artistUrls}
                    </ul>
                </section>
                <section class="posts">
                    <h2>
                        Posts
                        <a
                            href="${this.artistPostsUrl}"
                            target="_blank"
                        >
                            »
                        </a>
                    </h2>
                    <div class="post-pager ${this.loadingPage ? "loading" : ""}">
                        <div
                            class="btn ${this.page <= this.firstPage! ? "disabled" : ""}"
                            @click=${() => this.loadPage(this.page - 1)}
                        >
                            &lt;
                        </div>
                        <div
                            class="post-list scrollable"
                            style="width: ${this.width}px"
                            part="post-list"
                        >
                            ${this.postPreviews}
                        </div>
                        <div
                            class="btn ${this.page >= this.lastPage! ? "disabled" : ""}"
                            @click=${() => this.loadPage(this.page + 1)}
                        >
                            &gt;
                        </div>
                    </div>
                </section>
            </article>
        `;
    }
}
customElements.define("tpt-artist-tooltip", TptArtistTooltipContent);

const renderedTooltipsCache: Record<string, Promise<HTMLElement>> = {};

/**
 * Attach the artist tooltip to the tag
 * @param key Unique key (adapter + artist names)
 * @param getData Async getter of the tooltip data
 * @param css Extra CSS of the tooltip content
 */
export default function artistTooltip(
    key: string,
    getData: () => Promise<ArtistTooltipParams>,
    css: CSSResult,
) {
    return tooltip(async ({ tooltip, content, target }) => {
        if (!(key in renderedTooltipsCache)) {
            renderedTooltipsCache[key] = getData().then((data) => {
                const elem = document.createElement(
                    "tpt-artist-tooltip",
                ) as TptArtistTooltipContent;
                Object.assign(elem, data);
                elem.customCss = css;
                return elem;
            });
        }

        if (!tooltip.classList.contains("tip-dark") && !tooltip.classList.contains("tip-light")) {
            // Select theme and background color based upon the background of surrounding elements
            const { theme, adjustedColor } = chooseBackgroundColorScheme(target);
            content.classList.add(`tip-content-${theme}`);
            tooltip.classList.add(`tip-${theme}`);
            tooltip.style.setProperty("--bg", adjustedColor);
        }

        target.classList.add("loading-data");
        let tipContent = await renderedTooltipsCache[key];
        tipContent.className = content.className;
        // For correct work of CORS images must not be cloned at first displaying
        // TODO should it be fixed?
        // if (!tipContent.parentElement) tipContent = tipContent.cloneNode(true) as HTMLElement;
        content.append(tipContent);
        target.classList.remove("loading-data");
    });
}
