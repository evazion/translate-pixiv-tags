/// <reference path="../types.d.ts" />

export { ArtistTooltipParams } from "../tooltips/artist-tooltip";

declare global {
    var adapterShared: typeof import("./shared");
    var addAdapter: (adapter: typeof Adapter) => void;
    var addCss: typeof import("../utils").addCss;
    var artistTooltip: typeof import("../tooltips/artist-tooltip").default;
    var css: typeof import("lit").css;
    var DOMAIN_USES_CSP: typeof import("../settings").DOMAIN_USES_CSP;
    var getSafeImageUrl: typeof import("../utils").getSafeImageUrl;
    var html: typeof import("lit").html;
    var ajax: typeof import("../network").ajax;
    var SETTINGS: Readonly<typeof import("../settings").SETTINGS>;
    var unsafeCSS: typeof import("lit").unsafeCSS;
}
