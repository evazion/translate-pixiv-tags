/// <reference path="../types.d.ts" />

export { ArtistTooltipParams } from "../tooltips/artist-tooltip";
export { UrlParams } from "../network";

declare global {
    var adapterShared: typeof import("./shared");
    var addAdapter: (adapter: typeof Adapter) => void;
    var addCss: typeof import("../utils").addCss;
    var ajax: typeof import("../network").ajax;
    var artistTooltip: typeof import("../tooltips/artist-tooltip").default;
    var cache: typeof import("../cache").cache;
    var css: typeof import("lit").css;
    var DOMAIN_USES_CSP: typeof import("../settings").DOMAIN_USES_CSP;
    var getSafeImageUrl: typeof import("../utils").getSafeImageUrl;
    var html: typeof import("lit").html;
    var memoize: typeof import("../utils").memoize;
    var SETTINGS: Readonly<typeof import("../settings").SETTINGS>;
    var unsafeCSS: typeof import("lit").unsafeCSS;
}
