// ==UserScript==
// @name         Translate Pixiv Tags
// @author       evazion
// @version      20190920002046
// @description  Translates tags on Pixiv, Nijie, NicoSeiga, Tinami, and BCY to Danbooru tags.
// @homepageURL  https://github.com/evazion/translate-pixiv-tags
// @supportURL   https://github.com/evazion/translate-pixiv-tags/issues
// @updateURL    https://github.com/evazion/translate-pixiv-tags/raw/stable/translate-pixiv-tags.user.js
// @downloadURL  https://github.com/evazion/translate-pixiv-tags/raw/stable/translate-pixiv-tags.user.js
// @match        *://www.pixiv.net/*
// @match        *://dic.pixiv.net/*
// @match        *://nijie.info/*
// @match        *://seiga.nicovideo.jp/*
// @match        *://www.tinami.com/*
// @match        *://bcy.net/*
// @match        *://*.deviantart.com/*
// @match        *://*.hentai-foundry.com/*
// @match        *://twitter.com/*
// @match        *://tweetdeck.twitter.com/*
// @match        *://*.artstation.com/*
// @match        *://saucenao.com/*
// @match        *://pawoo.net/*
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://raw.githubusercontent.com/rafaelw/mutation-summary/421110f84178aa9e4098b38df83f727e5aea3d97/src/mutation-summary.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.9.1/underscore.js
// @require      https://github.com/evazion/translate-pixiv-tags/raw/lib-20190830/lib/jquery-gm-shim.js
// @resource     jquery_qtip_css https://cdnjs.cloudflare.com/ajax/libs/qtip2/3.0.3/jquery.qtip.min.css
// @resource     danbooru_icon https://github.com/evazion/translate-pixiv-tags/raw/resource-20190903/resource/danbooru-icon.ico
// @resource     settings_icon https://github.com/evazion/translate-pixiv-tags/raw/resource-20190903/resource/settings-icon.svg
// @connect      donmai.us
// @noframes
// ==/UserScript==

const SETTINGS = {
    list: [
        {
            name: "booru",
            defValue: "https://danbooru.donmai.us",
            descr: "Danbooru subdomain for sending requests",
            type: "list",
            values: {
                "https://danbooru.donmai.us":   "Danbooru",
                "https://kagamihara.donmai.us": "Kagamihara",
                "https://saitou.donmai.us":     "Saitou",
                "https://shima.donmai.us":      "Shima",
            },
        }, {
            name: "cache_lifetime",
            defValue: 60*5,
            descr: "The amount of time in seconds to cache data from Danbooru before querying again",
            type: "number",
        }, {
            name: "preview_limit",
            defValue: 3,
            descr: "The number of recent posts to show in artist tooltips",
            type: "number",
        }, {
            name: "show_preview_rating",
            defValue: "s",
            descr: "The upper level of rating for preview (higher ratings will be blurred)",
            type: "list",
            values: {
                "s": "Safe",
                "q": "Questionable",
                "e": "Explicit",
            }
        }
    ],
    isValid: function(name, value) {
        const setting = this.list.find(s => s.name===name);
        if (!setting) {
            console.error("No setting "+name);
            return false;
        }
        switch (setting.type) {
            case "number": return Number.isInteger(value) && value>0;
            case "list": return setting.values.hasOwnProperty(value);
            default:
                console.error("Unsupported type "+setting.type);
                return false;
        }
    },
    get: function(name) {
        const setting = this.list.find(s => s.name===name);
        if (!setting) {
            console.error("no setting "+name);
            return null;
        }
        const value = GM_getValue(name);
        if (typeof value === "undefined" || !this.isValid(name, value)) {
            GM_setValue(name, setting.defValue);
            return setting.defValue;
        }
        return value;
    },
    set: function(name, value) {
        const setting = this.list.find(s => s.name===name);
        if (!setting) {
            console.error("no setting "+name);
            return null;
        }
        if (this.isValid(name, value)) {
            GM_setValue(name, value);
            return true;
        } else {
            console.warn(`Invalid value ${value} for ${name}`);
            return false;
        }
    }
};

// Which domain to send requests to
const BOORU = SETTINGS.get("booru");
// How long (in seconds) to cache translated tag lookups.
const CACHE_LIFETIME = SETTINGS.get("cache_lifetime");
// Number of recent posts to show in artist tooltips.
const ARTIST_POST_PREVIEW_LIMIT = SETTINGS.get("preview_limit");
// The upper level of rating to show preview. Higher ratings will be blurred.
const SHOW_PREVIEW_RATING = SETTINGS.get("show_preview_rating");

//Values needed from Danbooru API calls using the "only" parameter
const POST_FIELDS = "id,is_pending,is_flagged,is_deleted,parent_id,has_visible_children,tag_string,image_width,image_height,preview_file_url,source,file_size,rating,created_at";
const POST_COUNT_FIELDS = "post_count";
const TAG_FIELDS = "name,category";
const WIKI_FIELDS = "title,category_name";
const ARTIST_FIELDS = "id,name,is_banned,other_names,urls";

// Settings for artist tooltips.
const ARTIST_QTIP_SETTINGS = {
    style: {
        classes: "ex-artist-tooltip",
    },
    position: {
        my: "top center",
        at: "bottom center",
    },
    show: {
        delay: 500,
        solo: true,
    },
    hide: {
        delay: 250,
        fixed: true,
    },
};

//Domains where images outside of whitelist are blocked
const CORS_IMAGE_DOMAINS = [
    'twitter.com'
];

//Memory storage for already rendered artist tooltips
const rendered_qtips = {};

//For network rate and error management
const MAX_PENDING_NETWORK_REQUESTS = 40;
const MIN_PENDING_NETWORK_REQUESTS = 5;
const MAX_NETWORK_ERRORS = 25;
const MAX_NETWORK_RETRIES = 3;

const PROGRAM_CSS = `
.ex-translated-tags {
    margin: 0 0.5em;
}
.ex-translated-tags * {
    display: inline !important;
    float: none !important;
    background: none !important;
    margin: 0 !important;
    padding: 0 !important;
    text-decoration: none !important;
    white-space: nowrap;
}
.ex-translated-tags::before {
    content: "(";
    white-space: nowrap;
}
.ex-translated-tags::after {
    content: ")";
    white-space: nowrap;
}
/* dirt hack for DevianArt: add :not(#id) to rapidly increase rule specificity */
.ex-translated-tag-category-5:not(#id) {
    color: #F80 !important;
}
.ex-translated-tag-category-4:not(#id) {
    color: #0A0 !important;
}
.ex-translated-tag-category-3:not(#id) {
    color: #A0A !important;
}
.ex-translated-tag-category-1:not(#id) {
    color: #A00 !important;
}
.ex-translated-tag-category-0:not(#id) {
    color: #0073ff !important;
}

.ex-artist-tag {
    white-space: nowrap;
}
.ex-artist-tag.inline {
    display: inline-block;
    margin-left: 0.5em;
}
.ex-artist-tag a:not(#id) {
    color: #A00 !important;
    margin-left: 0.3ch;
    text-decoration: none;
}
.ex-artist-tag::before {
    content: "";
    display: inline-block;
    background-image: url(${GM_getResourceURL('danbooru_icon')});
    background-repeat: no-repeat;
    background-size: 0.8em;
    width: 0.8em;
    height: 0.8em;
    vertical-align: middle;
}
.ex-banned-artist-tag a::after {
    content: " (banned)";
}

#ex-qtips {
    position: fixed;
    width: 100vw;
    height: 100vh;
    top: 0;
    pointer-events: none;
    z-index: 15000;
}
#ex-qtips > * {
    pointer-events: all;
}

.ex-artist-tooltip.qtip {
    max-width: 538px !important;
    background-color: white;
}
.ex-artist-tooltip.qtip-dark {
    background-color: black;
}
.ex-artist-tooltip .qtip-content {
    width: 520px !important;
}
`;

// tag function for template literals to remove newlines and leading spaces
function noIndents(strings, ...values) {
    // remove all spaces before/after a tag and leave one in other cases
    strings = strings.map(s => s.replace(/(>)?\n *(<)?/g, (s, lt, gt) => lt&&gt ? lt+gt : lt||gt ? (lt||gt) : " "));
    let res = new Array(values.length*2+1);
    for (let i = 0; i < values.length; i++) {
        res[i*2] = strings[i];
        res[i*2+1] = values[i];
    }
    res[res.length-1] = strings[strings.length-1];
    return res.join("");
}

function getImage(image_url) {
    return GM.xmlHttpRequest({
            method: "GET",
            url: image_url,
            responseType: 'blob',
        })
        .then(resp => resp.response);
}

function rateLimitedLog(level, ...messageData) {
    //Assumes that only simple arguments will be passed in
    let key = messageData.join(',');
    rateLimitedLog[key] = rateLimitedLog[key] || {log: true};
    if (rateLimitedLog[key].log) {
        console[level](...messageData);
        rateLimitedLog[key].log = false;
        //Have only one message with the same parameters per second
        setTimeout(()=>{rateLimitedLog[key].log = true;}, 1000);
    }
}

function checkNetworkErrors(domain,hasError) {
    checkNetworkErrors[domain] = checkNetworkErrors[domain] || {error: 0};
    if (hasError) {
        console.log("Total errors:", ++checkNetworkErrors[domain].error);
    }
    if (checkNetworkErrors[domain].error >= MAX_NETWORK_ERRORS) {
        rateLimitedLog("error", "Maximun number of errors exceeded", MAX_NETWORK_ERRORS, "for", domain);
        return false;
    }
    return true;
}

async function getJSONRateLimited(url, params) {
    const sleepHalfSecond = resolve => setTimeout(resolve, 500);
    let domain = new URL(url).hostname;
    getJSONRateLimited[domain] = getJSONRateLimited[domain] || {pending: 0, current_max: MAX_PENDING_NETWORK_REQUESTS};
    //Wait until the number of pending network requests is below the max threshold
    while (getJSONRateLimited[domain].pending >= getJSONRateLimited[domain].current_max) {
        //Bail if the maximum number of network errors has been exceeded
        if (!(checkNetworkErrors(domain, false))) {
            return [];
        }
        rateLimitedLog("warn", "Exceeded maximum pending requests", getJSONRateLimited[domain].current_max, "for", domain);
        await new Promise(sleepHalfSecond);
    }
    for (let i = 0; i < MAX_NETWORK_RETRIES; i++) {
        getJSONRateLimited[domain].pending++;
        try {
            var resp = await $.getJSON(url, params).always(()=>{getJSONRateLimited[domain].pending--;});
        } catch (e) {
            //Backing off maximum to adjust to current network conditions
            getJSONRateLimited[domain].current_max = Math.max(getJSONRateLimited[domain].current_max - 1, MIN_PENDING_NETWORK_REQUESTS);
            console.error("Failed try #", i + 1, "\nURL:", url, "\nParameters:", params, "\nHTTP Error:", e.status);
            if (!checkNetworkErrors(domain, true)) {
                return [];
            }
            await new Promise(sleepHalfSecond);
            continue;
        }
        return resp;
    }
    return [];
}

const getJSONMemoized = _.memoize(
    (url, params) => getJSONRateLimited(url, params),
    (url, params) => url + $.param(params)
);

function get(url, params, cache = CACHE_LIFETIME, base_url = BOORU) {
    if (cache > 0) {
        params = { ...params, expires_in: cache};
    }
    return getJSONMemoized(`${base_url}${url}.json`, params)
        .catch(xhr => {
            console.error(xhr.status, xhr);
            return [];
        });
}

async function translateTag(target, tagName, options) {
    const normalizedTag = tagName.trim().normalize("NFKC").replace(/\d+users入り$/, "").replace(/^#/, "");

    /* tags like "5000users入り$" become empty after normalization; don't search for empty tags. */
    if (normalizedTag.length === 0) {
        return [];
    }

    let tags = [];

    const wikiPages = await get("/wiki_pages", {search: {other_names_match: normalizedTag, is_deleted: false}, only: WIKI_FIELDS});
    if (wikiPages.length) {
        tags = wikiPages.map(wikiPage => new Object({
            name: wikiPage.title,
            prettyName: wikiPage.title.replace(/_/g, " "),
            category: wikiPage.category_name,
        }));
    } else if (normalizedTag.match(/^[\x20-\x24\x26-\x29\x2B\x2D-\x7F]+$/)) { // ASCII characters except percent, asterics, and comma
        tags = await get("/tags", {search: {name: normalizedTag}, only: TAG_FIELDS});
        tags = tags.map(tag => new Object({
            name: tag.name,
            prettyName: tag.name.replace(/_/g, " "),
            category: tag.category,
        }));
    }
    addDanbooruTags($(target), tags, options);
}

function addDanbooruTags($target, tags, options = {}) {
    if (tags.length === 0) {
        return;
    }
    let { classes = "",
          onadded = null, // ($tag)=>{},
          tagPosition: {
            searchAt = "nextAll",
            insertAt = "insertAfter"
          } = {}
    } = options;

    const $tagsContainer = $(noIndents`
        <span class="ex-translated-tags ${classes}">
            ${tags.map(tag => noIndents`
                <a class="ex-translated-tag-category-${tag.category}"
                   href="${BOORU}/posts?tags=${encodeURIComponent(tag.name)}"
                   target="_blank">
                        ${_.escape(tag.prettyName)}
                </a>`)
            .join(", ")}
        </span>`);
    $tagsContainer[insertAt]($target);
    if (onadded) onadded($tagsContainer);
}

async function translateArtistByURL(element, profileUrl, options) {
    if (!profileUrl) return;

    const artists = await get("/artists", {search: {url_matches: profileUrl, is_active: true}, only: ARTIST_FIELDS});
    const pUrl = new URL(profileUrl.replace(/\/$/,"").toLowerCase());
    artists
        // fix of #18: for some unsupported domains, Danbooru returns false-positive results
        .filter(({urls}) => urls
            .flatMap(({url, normalized_url}) => [url, normalized_url])
            .map(url => new URL(url.replace(/\/$/,"").toLowerCase()))
            .some(aUrl => (pUrl.host==aUrl.host && pUrl.pathname==aUrl.pathname && pUrl.search==aUrl.search)))
        .map(artist => addDanbooruArtist($(element), artist, options));
}

async function translateArtistByName(element, artistName, options) {
    if (!artistName) return;

    const artists = await get("/artists", {search: {name: artistName.replace(/ /g, "_"), is_active: true}, only: ARTIST_FIELDS});
    artists.map(artist => addDanbooruArtist($(element), artist, options));
}

function addDanbooruArtist($target, artist, options = {}) {
    let { classes = "",
          onadded = null, // ($tag)=>{},
          tagPosition: {
            searchAt = "nextAll",
            insertAt = "insertAfter"
          } = {}
    } = options;

    classes += artist.is_banned ? " ex-artist-tag ex-banned-artist-tag" : " ex-artist-tag";
    artist.prettyName = artist.name.replace(/_/g, " ");
    artist.escapedName = _.escape(artist.prettyName);
    artist.encodedName = encodeURIComponent(artist.name);

    const qtip_settings = Object.assign(ARTIST_QTIP_SETTINGS, {
        content: { text: (event, qtip) => buildArtistTooltip(artist, qtip) }
    });

    let duplicates = $target[searchAt](".ex-artist-tag")
                        .filter((i,el) => el.innerText.trim() == artist.escapedName);
    if (duplicates.length) {
        // if qtip was removed then add it back
        if (!$.data(duplicates.find("a")[0]).qtip) {
            $(duplicates).find("a").qtip(qtip_settings);
        }
        return;
    }

    let $tag = $(noIndents`
        <div class="${classes}">
            <a href="${BOORU}/artists/${artist.id}" target="_blank">
                ${artist.escapedName}
            </a>
        </div>`);
    $tag[insertAt]($target);
    $tag.find("a").qtip(qtip_settings).end();
    if (onadded) onadded($tag);
}

async function attachShadow(target, callback) {
    if (target.shadowRoot) {
        return;
    } else if (!_.isFunction(document.body.attachShadow)) {
        const element = await callback();
        $(target).html(element);
    } else {
        const shadowRoot = target.attachShadow({ mode: "open" });
        const element = await callback();
        $(shadowRoot).append(element);
    }
}

function chooseBackgroundColorScheme($element) {
    const TRANSPARENT_COLOR = "rgba(0, 0, 0, 0)";
    //Halfway between white/black in the RGB scheme
    const MIDDLE_LUMINOSITY = 128;

    // Get background colors of all parent elements with a nontransparent background color
    let background_colors = $element.parents()
        .map((i,el) => $(el).css("background-color"))
        .get()
        .filter(color => color !== TRANSPARENT_COLOR);
    // calculate summary color and get RGB channels
    let color_array = background_colors
        .map(color => color.match(/(\d+(\.\d+)?)+/g))
        .reverse()
        .reduce(([r1,g1,b1],[r2,g2,b2,al=1]) => [r1*(1-al)+r2*al, g1*(1-al)+g2*al, b1*(1-al)+b2*al])
        .slice(0, 3); // Ignore alpha
    let median_luminosity = (Math.max(...color_array) + Math.min(...color_array)) / 2;
    let qtip_class = (median_luminosity < MIDDLE_LUMINOSITY ? "qtip-dark" : "qtip-light");
    let adjusted_array = color_array.map((color) => {
        let color_scale = (color - MIDDLE_LUMINOSITY) / MIDDLE_LUMINOSITY;
        let adjusted_color = ((Math.abs(color_scale)**0.7) // Exponentiation to reduce the scale
                             * Math.sign(color_scale)      // Get original sign back
                             * MIDDLE_LUMINOSITY)          // Get original amplitude back
                             + MIDDLE_LUMINOSITY;          // Get back to the RGB color range
        return Math.round(adjusted_color);
    });
    let adjusted_color = `rgb(${adjusted_array.join(", ")})`;
    return [qtip_class, adjusted_color];
}

async function buildArtistTooltip(artist, qtip) {
    attachShadow(qtip.elements.content.get(0), async () => {
        if (!(artist.name in rendered_qtips)) {
            const posts = get(`/posts`, {tags: `status:any ${artist.name}`, limit: ARTIST_POST_PREVIEW_LIMIT, only: POST_FIELDS});
            const tags = get(`/tags`, {search: {name: artist.name}, only: POST_COUNT_FIELDS});

            rendered_qtips[artist.name] = buildArtistTooltipContent(artist, await tags, await posts);
            return rendered_qtips[artist.name];
        }
        return rendered_qtips[artist.name].clone()
            .find(".settings-icon").click(showSettings).end();
    })
    .then(() => qtip.reposition(null, false));
    if (!qtip.elements.tooltip.hasClass("qtip-dark") && !qtip.elements.tooltip.hasClass("qtip-light")) {
        // select theme and background color based upon the background of surrounding elements
        let [qtip_class, adjusted_color] = chooseBackgroundColorScheme(qtip.elements.target);
        qtip.elements.tooltip.addClass(qtip_class);
        qtip.elements.tooltip.css("background-color", adjusted_color);
    }
}

function buildArtistTooltipContent(artist, [tag = {post_count:0}], posts = []) {
    let $content = $(noIndents`
        <style>
            :host {
                --preview_has_children_color: #0F0;
                --preview_has_parent_color: #CC0;
                --preview_deleted_color: #000;
                --preview_pending_color: #00F;
                --preview_flagged_color: #F00;
            }

            article.container {
                font-family: Verdana, Helvetica, sans-serif;
                padding: 10px;
            }

            section {
                margin-bottom: 15px;
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
                display: inline;
            }

            ul.other-names li a {
                background-color: rgba(128,128,128,0.2);
                padding: 3px;
                margin: 0 2px;
                border-radius: 3px;
                white-space: nowrap;
            }

            section.urls ul {
                list-style: disc inside;
                padding: 0px;
                max-height: 145px;
            }

            section.urls ul li.artist-url-inactive a {
                color: red;
                text-decoration: underline;
                text-decoration-style: dotted;
            }


            /* Basic styles taken from Danbooru */
            a:link, a:visited {
                color: #0073FF;
                text-decoration: none;
            }

            a:hover {
                color: #80B9FF;
            }

            a.tag-category-artist {
                color: #A00;
            }

            a.tag-category-artist:hover {
                color: #B66;
            }



            /* Thumbnail styles taken from Danbooru */
            article.post-preview {
                /*height: 154px;*/
                width: 154px;
                margin: 0 10px 10px 0;
                float: left;
                overflow: hidden;
                text-align: center;
                position: relative;
            }

            article.post-preview a {
                margin: auto;
                border: 2px solid transparent;
                display: inline-block;
            }

            article.post-preview.post-status-has-children a {
                border-color: var(--preview_has_children_color);
            }

            article.post-preview.post-status-has-parent a {
                border-color: var(--preview_has_parent_color);
            }

            article.post-preview.post-status-has-children.post-status-has-parent a {
                border-color: var(--preview_has_children_color) var(--preview_has_parent_color) var(--preview_has_parent_color) var(--preview_has_children_color);
            }

            article.post-preview.post-status-deleted a {
                border-color: var(--preview_deleted_color);
            }

            article.post-preview.post-status-has-children.post-status-deleted a {
                border-color: var(--preview_has_children_color) var(--preview_deleted_color) var(--preview_deleted_color) var(--preview_has_children_color);
            }

            article.post-preview.post-status-has-parent.post-status-deleted a {
                border-color: var(--preview_has_parent_color) var(--preview_deleted_color) var(--preview_deleted_color) var(--preview_has_parent_color);
            }

            article.post-preview.post-status-has-children.post-status-has-parent.post-status-deleted a {
                border-color: var(--preview_has_children_color) var(--preview_deleted_color) var(--preview_deleted_color) var(--preview_has_parent_color);
            }

            article.post-preview.post-status-pending a,
            article.post-preview.post-status-flagged a {
                border-color: var(--preview_pending_color);
            }

            article.post-preview.post-status-has-children.post-status-pending a,
            article.post-preview.post-status-has-children.post-status-flagged a {
                border-color: var(--preview_has_children_color) var(--preview_pending_color) var(--preview_pending_color) var(--preview_has_children_color);
            }

            article.post-preview.post-status-has-parent.post-status-pending a,
            article.post-preview.post-status-has-parent.post-status-flagged a {
                border-color: var(--preview_has_parent_color) var(--preview_pending_color) var(--preview_pending_color) var(--preview_has_parent_color);
            }

            article.post-preview.post-status-has-children.post-status-has-parent.post-status-pending a,
            article.post-preview.post-status-has-children.post-status-has-parent.post-status-flagged a {
                border-color: var(--preview_has_children_color) var(--preview_pending_color) var(--preview_pending_color) var(--preview_has_parent_color);
            }

            article.post-preview[data-tags~=animated]:before {
                content: "►";
                position: absolute;
                width: 20px;
                height: 20px;
                color: white;
                background-color: rgba(0,0,0,0.5);
                margin: 2px;
                text-align: center;
            }

            article.post-preview[data-has-sound=true]:before {
                content: "♪";
                position: absolute;
                width: 20px;
                height: 20px;
                color: white;
                background-color: rgba(0,0,0,0.5);
                margin: 2px;
                text-align: center;
            }


            div.post-list {
                display: flex;
                flex-wrap: wrap;
                max-height: 420px;
                align-items: flex-end;
            }

            article.post-preview a {
                display: inline-block;
                /*height: 154px;*/
                overflow: hidden;
            }

            article.post-preview img {
                margin-bottom: -2px;
            }

            article.post-preview p {
                text-align: center;
                margin: 0 0 2px 0;
            }

            article.post-preview.blur-post img {
                filter: blur(10px);
            }

            article.post-preview.blur-post:hover img {
                filter: blur(0px);
                transition: filter 1s 0.5s;
            }

            .scrollable {
                overflow: auto;
            }
            .scrollable::-webkit-scrollbar {
                width: 6px;
            }

            .scrollable::-webkit-scrollbar-track {
                background-color: rgba(128,128,128,0.2);
                border-radius: 6px;
            }

            .scrollable::-webkit-scrollbar-thumb {
                background-color: rgba(128,128,128,0.4);
                border-radius: 6px;
            }

            .settings-icon {
                position:absolute;
                top: 10px;
                right: 10px;
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            .settings-icon path {
                fill: #888;
            }
        </style>

        <article class="container" part="container">
            ${GM_getResourceText('settings_icon')}
            <section class="header">
                <a class="artist-name tag-category-artist"
                   href="${BOORU}/artists/${artist.id}"
                   target="_blank>
                    ${_.escape(artist.prettyName)}
                </a>
                <span class="post-count">${tag.post_count}</span>

                <ul class="other-names scrollable" part="other-names">
                    ${artist.other_names.filter(String).sort().map(other_name => `
                        <li>
                            <a href="${BOORU}/artists?search[name]=${encodeURIComponent(other_name)}"
                               target="_blank">
                                ${_.escape(other_name.replace(/_/g, " "))}
                            </a>
                        </li>`
                    ).join("")}
                </ul>
            </section>
            <section class="urls">
                <h2>
                    URLs
                    (<a href="${BOORU}/artists/${artist.id}/edit" target="_blank">edit</a>)
                </h2>
                <ul class="scrollable" part="url-list">
                    ${buildArtistUrlsHtml(artist)}
                </ul>
            </section>
            <section class="posts">
                <h2>
                    Posts
                    <a href="${BOORU}/posts?tags=${artist.encodedName}" target="_blank">»</a>
                </h2>
                <div class="post-list scrollable" part="post-list"></div>
            </section>
        </article>
    `);
    $content.find(".post-list").append(posts.map(buildPostPreview));
    $content.find(".settings-icon").click(showSettings);
    return $content;
}

function buildArtistUrlsHtml(artist) {
    const domainSorter = artist_url => new URL(artist_url.normalized_url).host.match(/[^.]*\.[^.]*$/)[0];
    const artist_urls = _(artist.urls).chain()
                                      .uniq('normalized_url')
                                      .sortBy('normalized_url')
                                      .sortBy(domainSorter)
                                      .sortBy(artist_url => !artist_url.is_active);

    const html = artist_urls.map(artist_url => {
        const normalized_url = artist_url.normalized_url.replace(/\/$/, "");
        const urlClass = artist_url.is_active ? "artist-url-active" : "artist-url-inactive";

        return noIndents`
            <li class="${urlClass}">
                <a href="${normalized_url}" target="_blank">
                    ${_.escape(normalized_url)}
                </a>
            </li>`;
    }).join("");

    return html;
}

function timeToAgo(time) {
    const interval = new Date(Date.now() - new Date(time));
    if (interval < 60000) return "less than a minute ago";
    const values = [{
        value: interval.getUTCFullYear()-1970,
        unit: "year",
    }, {
        value: interval.getUTCMonth(),
        unit: "month",
    }, {
        value: interval.getUTCDate()-1,
        unit: "day",
    }, {
        value: interval.getUTCHours(),
        unit: "hour",
    }, {
        value: interval.getUTCMinutes(),
        unit: "minute",
    }];
    for (let {value, unit} of values) {
        if (value) return `${value} ${(value>1 ? unit+"s" : unit)} ago`;
    }
    return "∞ ago";
}
// based on https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function buildPostPreview(post) {
    const RATINGS = {s:0, q:1, e:2};
    let [width, height] = [150, 150];
    let preview_file_url = `${BOORU}/images/download-preview.png`;

    let preview_class = "post-preview";
    preview_class += post.is_pending           ? " post-status-pending"      : "";
    preview_class += post.is_flagged           ? " post-status-flagged"      : "";
    preview_class += post.is_deleted           ? " post-status-deleted"      : "";
    preview_class += post.parent_id            ? " post-status-has-parent"   : "";
    preview_class += post.has_visible_children ? " post-status-has-children" : "";
    if (RATINGS[post.rating] > RATINGS[SHOW_PREVIEW_RATING]) {
        preview_class += " blur-post";
    }

    const data_attributes = `
      data-id="${post.id}"
      data-has-sound="${!!post.tag_string.match(/(video_with_sound|flash_with_sound)/)}"
      data-tags="${_.escape(post.tag_string)}"
    `;

    let scale = Math.min(150 / post.image_width, 150 / post.image_height);
    scale = Math.min(1, scale);

    let $preview;
    if (post.preview_file_url) {
        width = Math.round(post.image_width * scale);
        height = Math.round(post.image_height * scale);
        if (CORS_IMAGE_DOMAINS.includes(location.host)) {
            // temporaly set transparent 1x1 image
            preview_file_url = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            getImage(post.preview_file_url).then((blob) => {
                let image_blob = blob.slice(0, blob.size, "image/jpeg");
                let blob_url = window.URL.createObjectURL(image_blob);
                $preview.find("img").prop("src", blob_url);
            });
        } else {
            preview_file_url = post.preview_file_url;
        }
    }

    const domain = post.source.match(/^https?:\/\//)
                    ? new URL(post.source).hostname.split(".").slice(-2).join(".")
                    : "NON-WEB";
    const img_size = [post.file_size, post.image_width, post.image_height].every(_.isFinite)
                    ? `${formatBytes(post.file_size)} (${post.image_width}x${post.image_height})`
                    : "";

    $preview = $(noIndents`
        <article itemscope
                 itemtype="http://schema.org/ImageObject"
                 class="${preview_class}"
                 ${data_attributes} >
            <a href="${BOORU}/posts/${post.id}" target="_blank">
                <img width="${width}"
                     height="${height}"
                     src="${preview_file_url}"
                     title="${_.escape(post.tag_string)}"
                     part="post-preview rating-${post.rating}">
            </a>
            <p>${img_size}</p>
            <p style="letter-spacing: -0.1px;">${domain}, rating:${post.rating.toUpperCase()}</p>
            <p>${timeToAgo(post.created_at)}</p>
        </article>
    `);
    return $preview;
}

function showSettings() {
    function settingToInput(setting) {
        const value = SETTINGS.get(setting.name);
        switch (setting.type) {
            case "number":
                return noIndents`
                    <input type="number"
                           min="0"
                           value="${value}"
                           name="${setting.name}" />`;
            case "list":
                return noIndents`
                    <select name="${setting.name}">
                        ${Object
                            .entries(setting.values)
                            .map(([val,descr]) =>
                                noIndents`
                                <option value="${val}" ${val==value?"selected":""}>
                                    ${descr}
                                </option>`)
                            .join("")}
                    </select>`;
            default:
                console.error("Unsupported type "+setting.type);
                return "";
        }
    }
    function closeSettings() {
        $shadowContainer.remove();
        $(document).off("keydown", closeSettingsOnEscape);
    }
    function closeSettingsOnEscape(ev) {
        if (ev.key==="Escape" && !ev.altKey && !ev.ctrlKey && !ev.shiftKey) {
            closeSettings();
            return false;
        }
    }

    const $settings = $(
        noIndents`
        <style>
            #ui-settings {
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.25);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 16000;
            }
            #ui-settings.qtip-dark {
                background: rgba(0,0,0,0.75);
            }
            .container {
                padding: 20px;
                display: grid;
                grid-template-columns: 300px 1fr;
                grid-gap: 10px;
                font-size: 12px;
            }
            .qtip-light .container {
                background-color: #fff;
                color: #222;
            }
            .qtip-dark .container {
                background-color: #222;
                color: #fff;
            }
            .container div:nth-of-type(even) {
                display: flex;
                flex-direction: column-reverse;
            }
            .container h2 {
                grid-column: span 2;
                margin: auto;
            }
            input[type="button"] {
                margin: 0 5px;
            }
        </style>
        <div id="ui-settings">
            <div class="container">
                <h2>Translate Pixiv Tags settings</h2>
                ${SETTINGS.list
                    .map(setting => noIndents`
                        <div>${setting.descr}:</div>
                        <div>${settingToInput(setting)}</div>`)
                    .join("")
                }
                <h2>
                    <input class="cancel" type="button" value="Cancel" />
                    <input class="refresh-page"
                           type="button"
                           value="Refresh page to apply changes"
                           disabled />
                </h2>
            </div>
        </div>
    `);
    let $shadowContainer = $("<div>").appendTo("#ex-qtips");
    $settings.click((ev) => {
        if ($(ev.target).is("#ui-settings")) closeSettings();
    });
    $settings.find("input[type='number'], select").change((ev) => {
        $settings.find(".refresh-page").removeAttr("disabled");
    });
    $settings.find(".refresh-page").click((ev) => {
        $settings.find("input[type='number'], select").each((i, el) => {
            let $input = $(el);
            let value = $input.is("input[type='number']") ? +$input.val() : $input.val();
            SETTINGS.set($input.prop("name"), value);
        });
        closeSettings();
        window.location.reload();
    });
    $settings.find(".cancel").click(closeSettings);
    $(document).keydown(closeSettingsOnEscape);
    let [className, bgcolor] = chooseBackgroundColorScheme($("#ex-qtips"));
    $settings.addClass(className);
    attachShadow($shadowContainer[0], () => $settings);
}

function findAndTranslate(mode, selector, options = {}) {
    options = Object.assign({
        asyncMode: false,
        requiredAttributes: null,
        predicate: null, // (el) => true,
        toProfileUrl: (el) => $(el).closest("a").prop("href"),
        toTagName: (el) => el.innerText,
        tagPosition: "afterend", // beforebegin, afterbegin, beforeend, afterend
        classes: "",
        onadded: null, // ($tag) => {},
    }, options);

    if (typeof options.predicate === "string") {
        const predicateSelector = options.predicate;
        options.predicate = (el) => $(el).is(predicateSelector);
    }
    options.tagPosition = {
        beforebegin: {searchAt:"prevAll", insertAt:"insertBefore"},
        afterbegin:  {searchAt:"find",    insertAt:"prependTo"},
        beforeend:   {searchAt:"find",    insertAt:"appendTo"},
        afterend:    {searchAt:"nextAll", insertAt:"insertAfter"},
    }[options.tagPosition] || {searchAt:"nextAll", insertAt:"insertAfter"};

    const tryToTranslate = (elem) => {
        if (!options.predicate || options.predicate(elem)) {
            switch (mode) {
                case "artist":
                    translateArtistByURL(elem, options.toProfileUrl(elem), options);
                    break;
                case "artistByName":
                    translateArtistByName(elem, options.toTagName(elem), options);
                    break;
                case "tag":
                    translateTag(elem, options.toTagName(elem), options);
                    break;
                default:
                    console.error("Unsupported mode "+mode);
            }
        }
    };

    $(selector).each((i, elem) => tryToTranslate(elem));

    if (!options.asyncMode) return;

    const query = { element: selector };
    if (options.requiredAttributes) query.elementAttributes = options.requiredAttributes;
    new MutationSummary({
        queries: [query],
        callback: ([summary]) => {
            let elems = summary.added;
            if (summary.attributeChanged) {
                elems = elems.concat(Object.values(summary.attributeChanged).flat(1));
            }
            elems.forEach(tryToTranslate);
        }
    });
}

function initializePixiv() {
    GM_addStyle(`
        /* Fix https://www.pixiv.net/tags.php to display tags as vertical list. */
        .tag-list.slash-separated li {
            display: block;
        }
        .tag-list.slash-separated li + li:before {
            content: none;
        }
        /* Hide Pixiv's translated tags  */
        .ex-translated-tags + span .gtm-new-work-romaji-tag-event-click,
        .ex-translated-tags + span .gtm-new-work-translate-tag-event-click {
            display: none;
        }
        /* Remove hashtags from translated tags */
        a.tag-value::before,
        span.ex-translated-tags a::before,
        figcaption li > span:first-child > a::before {
            content: "";
        }
        /* On the artist profile page, render the danbooru artist tag between the artist's name and follower count. */
        ._3_qyP5m {
            display: grid;
            grid-auto-rows: 16px;
            grid-template-columns: auto 1fr;
            justify-items: start;
        }
        ._3_qyP5m a[href^="/premium"] {
            grid-area: 1 / 2;
        }
        ._3_qyP5m .ex-artist-tag {
            grid-area: span 1 / span 2;
        }
        /* Illust page: fix locate artist tag to not trigger native tooltip */
        main+aside>section>h2 {
            position: relative;
        }
        h2>div>div {
            margin-bottom: 16px;
        }
        main+aside>section>h2 .ex-artist-tag {
            position: absolute;
            bottom: 0;
            left: 47px;
        }
        /* Illust page: fix artist tag overflowing in related works */
        aside li>div>div:last-child {
            flex-direction: column;
            align-items: flex-start;
        }
        aside li .ex-artist-tag {
            margin-left: 2px;
            margin-top: -6px;
        }
    `);

    findAndTranslate("tag", [
        // https://www.pixiv.net/bookmark_add.php?type=illust&illust_id=123456
        ".tag-cloud .tag",
        // https://www.pixiv.net/tags.php
        // https://www.pixiv.net/novel/tags.php
        ".tag-list li .tag-value",
        // https://www.pixiv.net/tags.php?tag=touhou
        ".tags-portal-header .title a",
        // https://www.pixiv.net/search.php?s_mode=s_tag&word=touhou
        "#wrapper div.layout-body h1.column-title a",
    ].join(", "));

    // https://dic.pixiv.net/a/東方
    findAndTranslate("tag", "#content_title #article-name", {tagPosition: "beforeend"});

    // tags on work pages: https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    findAndTranslate("tag", 'span', {
        predicate: "figcaption li > span:first-child",
        asyncMode: true
    });

    // illust author https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    findAndTranslate("artist", "h2", {
        predicate: "main+aside>section>h2",
        toProfileUrl: el => $(el).find("a").prop("href"),
        tagPosition: "beforeend",
        asyncMode: true,
        onadded: ($tag) => {
            const $container = $tag.prev();
            new MutationSummary({
                rootNode: $container.find("div:not(:has(*))")[0],
                queries: [{ characterData: true }],
                callback: () => {
                    $container.siblings(".ex-artist-tag").remove();
                    findAndTranslate("artist", $container, {
                        toProfileUrl: el => $(el).find("a").prop("href"),
                    });
                }
            });
        }
    });

    // related work's artists https://www.pixiv.net/member_illust.php?mode=medium&illust_id=66475847
    findAndTranslate("artist", "div", {
        predicate: "aside li>div>div:last-child>div:first-child",
        toProfileUrl: el => $(el).find("a").prop("href"),
        asyncMode: true
    });

    // artist profile pages: https://www.pixiv.net/member.php?id=29310, https://www.pixiv.net/member_illust.php?id=104471&type=illust
    let normalizePageUrl = () => `https://www.pixiv.net/member.php?id=${new URL(window.location.href).searchParams.get("id")}`;
    findAndTranslate("artist", ".VyO6wL2", {
        toProfileUrl: normalizePageUrl,
        asyncMode: true
    });

    // search pages: https://www.pixiv.net/bookmark_new_illust.php
    let toProfileUrl = (e => $(e).prop("href").replace(/member_illust/, "member").replace(/&ref=.*$/, ""));
    findAndTranslate("artist", ".ui-profile-popup", {
        predicate: "figcaption._3HwPt89 > ul > li > a.ui-profile-popup",
        toProfileUrl: toProfileUrl,
        asyncMode: true
    });

    // ranking pages: https://www.pixiv.net/ranking.php?mode=original
    findAndTranslate("artist", ".user-container.ui-profile-popup", {
        toProfileUrl: toProfileUrl,
        asyncMode: true
    });
}

function initializeNijie() {
    GM_addStyle(`
        .ex-translated-tags {
            font-family: Verdana, Helvetica, sans-serif;
        }
        /* Fix tag lists in http://nijie.info/view.php?id=203787 pages. */
        #dojin_left #view-tag .tag {
            white-space: nowrap;
            border: 0;
        }
    `);

    // http://nijie.info/view.php?id=233339
    findAndTranslate("artist", "#pro .user_icon .name, .popup_member > a");

    // http://nijie.info/view.php?id=208491
    findAndTranslate("tag", ".tag .tag_name a:first-child", {
        tagPosition: "beforeend"
    });
    // https://nijie.info/dic/seiten/d/東方
    findAndTranslate("tag", "#seiten_dic h1#dic_title", {
        tagPosition: "beforeend"
    });
}

function initializeTinami() {
    GM_addStyle(`
        .ex-translated-tags {
            font-family: Verdana, Helvetica, sans-serif;
            float: none !important;
            display: inline !important;
        }
    `);

    // http://www.tinami.com/view/979474
    findAndTranslate("tag", ".tag > span > a:nth-child(2)");

    // triggers on http://www.tinami.com/creator/profile/10262
    findAndTranslate("artist", "div.cre_name h1", {
        toProfileUrl: el => window.location.href,
        tagPosition: "beforeend",
        classes: "inline"
    });

    // triggers on http://www.tinami.com/view/934323
    findAndTranslate("artist", 'p:has(>a[href^="/creator/profile/"])', {
        toProfileUrl: el => $(el).find("a").prop("href")
    });
}

function initializeNicoSeiga() {
    GM_addStyle(`
        /* Fix tags in http://seiga.nicovideo.jp/seiga/im7626097 */
        .illust_tag .tag {
            background: #ebebeb;
            height: auto;
            margin: 0 10px 5px 0;
        }
        /* Fix artist tag in http://seiga.nicovideo.jp/seiga/im6950870 */
        .im_head_bar .inner .user ul .user_link .ex-artist-tag a {
            display: inline-block;
            border: none;
            background: none;
            padding: 0;
        }
    `);

    // http://seiga.nicovideo.jp/tag/艦これ
    findAndTranslate("tag", "h1:has(.icon_tag_big)", {
        tagPosition: "beforeend"
    });
    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate("tag", "a", {
        predicate: ".tag > a",
        tagPosition: "beforeend",
        asyncMode: true
    });
    // http://seiga.nicovideo.jp/user/illust/14767435
    findAndTranslate("artist", ".user_info h1 a", {
        classes: "inline"
    });
    // http://seiga.nicovideo.jp/seiga/im7741859
    findAndTranslate("artist", ".user_link > a .user_name", {
        tagPosition: "beforeend"
    });
}

function initializeBCY() {
    $("body").attr("id", "ex-bcy");

    // prfile page https://bcy.net/u/3935930
    findAndTranslate("artist", "div:has(>a.uname)", {
        toProfileUrl: el => $(el).find("a").prop("href")
    });

    // illust pages https://bcy.net/item/detail/6643704430988361988
    findAndTranslate("artist", ".js-userTpl .user-name a", {
        toProfileUrl: el => el.href.replace(/\?.*$/,"")
    });

    // search pages https://bcy.net/tags/name/看板娘
    findAndTranslate("artist", "a.title-txt", {
        toProfileUrl: el => el.href.replace(/\?.*$/,""),
        tagPosition: "beforeend",
        classes: "inline",
        asyncMode: true
    });

    // search pages https://bcy.net/tags/name/看板娘
    findAndTranslate("tag", ".circle-desc-name, .tag", {
        tagPosition: "beforeend",
        asyncMode: true
    });

    // illust pages https://bcy.net/item/detail/6561698116674781447
    findAndTranslate("tag", ".dm-tag-a", {tagPosition: "beforeend"});
}

function initializeDeviantArt() {
    // https://www.deviantart.com/koyorin
    // https://www.deviantart.com/koyorin/art/Ruby-570526828
    findAndTranslate("artist", ".gruserbadge .username, .dev-title-container .author .username", {
        classes: "inline"
    });

    findAndTranslate("tag", ".dev-about-tags-cc .discoverytag");
}

function initializeHentaiFoundry() {
    $("body").attr("id", "ex-hentaifoundry");

    // posts on https://www.hentai-foundry.com/user/Calm/profile
    findAndTranslate("artist", ".galleryViewTable .thumb_square > a:nth-child(4)", {
        classes: "inline"
    });
    // profile tab https://www.hentai-foundry.com/user/DrGraevling/profile
    findAndTranslate("artist", ".breadcrumbs a:contains('Users') + span", {
        toProfileUrl: el => window.location.href,
        tagPosition: "beforeend",
        classes: "inline"
    });
    // orher tabs https://www.hentai-foundry.com/pictures/user/DrGraevling
    findAndTranslate("artist", ".breadcrumbs a[href^='/user/']", {
        classes: "inline"
    });
}

function initializeTwitter() {
    GM_addStyle(`
        .ex-artist-tag {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif;
        }
        /* Old design: on post page locate the artist tag below author's @name. */
        .permalink-header {
            display: grid;
            grid-template-columns: 1fr auto auto;
            height: auto;
        }
        .permalink-header .ex-artist-tag {
            grid-row: 2;
            margin-left: 0;
        }
        /* Fix position of artist tag in an expanded tweet */
        .r-18u37iz.r-thb0q2.r-wgs6xk .r-zl2h9q {
            display: grid;
            grid-template-columns: auto 32px;
        }
        .r-18u37iz.r-thb0q2.r-wgs6xk .r-zl2h9q .ex-artist-tag {
            grid-area: 2/1;
            margin: 0;
        }
    `);

    // old dedsign
    if ($("body > div#doc").length) {
        findAndTranslate("tag", ".twitter-hashtag", {
            asyncMode: true
        });

        // header card
        findAndTranslate("artist", ".ProfileHeaderCard-screennameLink", {
            asyncMode: true
        });
        // popuping user card info
        findAndTranslate("artist", ".ProfileCard-screennameLink", {
            asyncMode: true
        });
        // tweet authors and comments
        findAndTranslate("artist", "a.js-user-profile-link", {
            predicate: ":not(.js-retweet-text) > a",
            classes: "inline",
            asyncMode: true
        });
        // quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
        findAndTranslate("artist", ".username", {
            predicate: "div.js-user-profile-link .username",
            toProfileUrl: e => "https://twitter.com/" + $(e).find("b").text(),
            asyncMode: true,
            classes: "inline"
        });

        return;
    }

    // new design
    // tags https://twitter.com/mugosatomi/status/1173231575959363584
    findAndTranslate("tag", "a.r-1n1174f", {
        predicate: "a.r-1n1174f[href^='/hashtag/']",
        asyncMode: true,
    });
    // floating name of a channel https://twitter.com/mugosatomi
    const URLfromLocation = () => "https://twitter.com"+(window.location.pathname.match(/\/\w+/)||[])[0];
    findAndTranslate("artist", "div.css-1dbjc4n.r-xoduu5.r-18u37iz.r-dnmrzs", {
        predicate: "h2>div>div>div",
        toProfileUrl: URLfromLocation,
        asyncMode: true,
        classes: "inline",
        onadded: ($tag) => {
            const $container = $tag.prev();
            new MutationSummary({
                rootNode: $container.find("span>span")[0],
                queries: [{ characterData: true }],
                callback: () => {
                    $container.siblings(".ex-artist-tag").remove();
                    findAndTranslate("artist", $container, {
                        toProfileUrl: URLfromLocation,
                        classes: "inline",
                    });
                }
            });
        }
    });
    // tweet, expanded tweet and comment authors
    // https://twitter.com/mugosatomi/status/1173231575959363584
    findAndTranslate("artist", "div.r-1wbh5a2.r-dnmrzs", {
        predicate: "div[data-testid='primaryColumn'] article div:has(>a.r-1wbh5a2)",
        toProfileUrl: el => $(el).find("a").prop("href"),
        classes: "inline",
        asyncMode: true,
    });
    // quoted tweets https://twitter.com/Murata_Range/status/1108340994557140997
    findAndTranslate("artist", "div.r-1wbh5a2.r-1udh08x", {
        toProfileUrl: el => "https://twitter.com/"+$(el).find(".r-1f6r7vd").text().substr(1),
        classes: "inline",
        asyncMode: true
    });
    // user card info
    findAndTranslate("artist", "a", {
        predicate: "div.r-1g94qm0 > a",
        tagPosition: "beforeend",
        asyncMode: true,
    });
}

function initializeArtStation() {
    GM_addStyle(`
        .qtip-content {
            box-sizing: initial;
        }
        .artist-name-and-headline .ex-artist-tag {
            font-size: 12pt;
            line-height: 150%;
        }
        .hover-card .ex-artist-tag {
            font-size: 12pt;
            margin-top: -10px;
        }
        a.user .ex-artist-tag {
            line-height: 100%;
        }
        .site-title .ex-artist-tag {
            font-size: 12pt;
            line-height: 100%;
            margin-top: -10px;
        }
        .site-title .ex-artist-tag a {
            font-size: 12pt;
        }
    `);

    function toFullURL(url) {
        if (url && typeof url !== "string") {
            url = (url[0] || url).getAttribute("href");
        }

        const getArtistName = (ref) => {
            if (!ref) {
                return "";
            } else if (ref.startsWith("/")) {
                let word = ref.match(/[a-z0-9_-]+/i);
                if (word) return word[0];
            } else if (ref.startsWith("https://www")) {
                let word = ref.match(/artstation\.com\/([a-z0-9_-]+)/i);
                if (word) return word[1];
            } else if (ref.startsWith("https://")) {
                let word = ref.match(/\/\/([a-z0-9_-]+)\.artstation\.com/i);
                if (word) return word[1];
            }
            return "";
        };

        let artistName = getArtistName(url) || getArtistName(window.location.href);
        if (artistName === "artwork") artistName = "";
        if (!artistName) {
            return "";
        }

        return "https://www.artstation.com/" + artistName;
    }

    function hasValidHref(el) {
        let href = el.getAttribute("href");
        return href && (href.startsWith("http") || href.startsWith("/")&&href.length>1);
    }

    // https://www.artstation.com/jubi
    // https://www.artstation.com/jubi/*
    findAndTranslate("artist", "h1.artist-name", {
        toProfileUrl: toFullURL,
        asyncMode: true
    });
    // https://www.artstation.com/artwork/0X40zG
    findAndTranslate("artist", "a[hover-card]", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".name > a") && hasValidHref(el),
        toProfileUrl: toFullURL,
        asyncMode: true,
    });
    findAndTranslate("tag", ".label-tag", {
        tagPosition: "beforeend",
        asyncMode: true
    });
    // hover card
    findAndTranslate("artist", "a", {
        requiredAttributes: "href",
        predicate: (el) => el.matches(".hover-card-name > a") && hasValidHref(el),
        asyncMode: true,
    });
    // https://www.artstation.com/jubi/following
    // https://www.artstation.com/jubi/followers
    findAndTranslate("artist", ".users-grid-name", {
        toProfileUrl: el => toFullURL($(el).find("a")),
        asyncMode: true
    });

    // default personal websites:
    // https://jubi.artstation.com/
    // https://anninosart.artstation.com/
    // customized personal websites:
    // https://inawong.artstation.com/
    // https://kastep.artstation.com/
    // https://tinadraw.artstation.com/
    // https://dylan-kowalski.artstation.com/
    findAndTranslate("artist", ".site-title a", {
        toProfileUrl: toFullURL
    });
}

function initializeSauceNAO() {
    GM_addStyle(`
        .ex-translated-tags {
            margin: 0;
        }
        .ex-translated-tags::before, .ex-translated-tags::after {
            content: none;
        }
        .ex-translated-tags + .target, .ex-artist-tag + .target {
            display: none;
        }
    `);

    $(".resulttitle, .resultcontentcolumn")
        .contents()
        .filter(function(){return this.nodeType==3;}) // get text nodes
        .wrap("<span class=target>");
    $(".target:contains(', ')").replaceWith((i, html) => html
        .split(", ")
        .map(s => `<span class="target">${s}</span>`)
        .join(", ")
    );

    // http://saucenao.com/search.php?db=999&url=https%3A%2F%2Fraikou4.donmai.us%2Fpreview%2F5e%2F8e%2F5e8e7a03c49906aaad157de8aeb188e4.jpg
    findAndTranslate("artist", "strong:contains('Member: ')+a, strong:contains('Author: ')+a", {
        classes: "inline"
    });
    findAndTranslate("artistByName", ".resulttitle .target", {
        tagPosition: "beforebegin",
        classes: "inline"
    });
    findAndTranslate("tag", ".resultcontentcolumn .target", {
        tagPosition: "beforebegin"
    });
}

function initializePawoo() {
    GM_addStyle(`
        .ex-artist-tag {
            line-height: 100%;
        }
        /* Active Users sidebar */
        .account__avatar-wrapper {
            display: flex;
            height: 100%;
            align-items: center;
        }
        /* fix newline in arist tag in cards of following users and followers */
        .ex-artist-tag a {
            display: inline !important;
        }
    `);

    // https://pawoo.net/@yamadorikodi
    // artist name in his card info
    findAndTranslate("artist", ".name small", {
        toProfileUrl: () => "https://pawoo.net" + window.location.pathname.match(/\/[^\/]+/)[0],
        tagPosition: "afterbegin"
    });
    // post author, commentor
    findAndTranslate("artist", "a.status__display-name span span", {
        classes: "inline"
    });
    // users in sidebar
    findAndTranslate("artist", "a.account__display-name span span");
    // cards of following users and followers
    findAndTranslate("artist", ".account-grid-card .name a");
    // tags https://pawoo.net/@SilSinn9801
    findAndTranslate("tag", ".hashtag");
}

function initializeTweetDeck() {
    findAndTranslate("tag", "span.link-complex-target", {
        predicate: "a[rel='hashtag'] span.link-complex-target",
        asyncMode: true
    });
    // user card info
    findAndTranslate("artist", "p.username", {
        asyncMode: true
    });
    // tweet authors and comments
    findAndTranslate("artist", "a.account-link", {
        predicate: "a:has(.username)",
        asyncMode: true
    });
}

function initializePixivFanbox() {
    // https://www.pixiv.net/fanbox/creator/310631
    // channel header
    findAndTranslate("artist", "a.sc-1upaq18-16", {
        classes: "inline a.sc-1upaq18-16",
        asyncMode: true
    });
    // post author
    findAndTranslate("artist", "div.sc-7161tb-4", {
        toProfileUrl: el => ($(el).closest("a").prop("href")||"").replace(/\/post\/\d+/,""),
        tagPosition: "beforeend",
        classes: "inline",
        asyncMode: true
    });
}

function initializeQtipContainer() {
    // Container and viewport for qTips
    $(`<div id="ex-qtips"></div>`).appendTo("body");
    ARTIST_QTIP_SETTINGS.position.viewport =
    ARTIST_QTIP_SETTINGS.position.container = $("#ex-qtips");
}

function initialize() {
    initializeQtipContainer();
    GM_jQuery_setup();
    GM_addStyle(PROGRAM_CSS);
    GM_addStyle(GM_getResourceText('jquery_qtip_css'));
    GM_registerMenuCommand("Settings", showSettings, "S");

    switch (location.host) {
        case "www.pixiv.net":
            if (location.pathname.startsWith("/fanbox")) {
                initializePixivFanbox();
            } else {
                initializePixiv();
            }
            break;
        case "dic.pixiv.net":          initializePixiv();         break;
        case "nijie.info":             initializeNijie();         break;
        case "seiga.nicovideo.jp":     initializeNicoSeiga();     break;
        case "www.tinami.com":         initializeTinami();        break;
        case "bcy.net":                initializeBCY();           break;
        case "www.hentai-foundry.com": initializeHentaiFoundry(); break;
        case "twitter.com":            initializeTwitter();       break;
        case "tweetdeck.twitter.com":  initializeTweetDeck();     break;
        case "saucenao.com":           initializeSauceNAO();      break;
        case "pawoo.net":              initializePawoo();         break;
        case "www.deviantart.com":     initializeDeviantArt();    break;
        case "www.artstation.com":     initializeArtStation();    break;
        default:
            if (location.host.match(/artstation\.com/)) {
                initializeArtStation();
            }
    }
}

/****Program execution start****/

initialize();
