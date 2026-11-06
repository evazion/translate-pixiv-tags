export {};

declare global {
    var addAdapter: (adapter: typeof Adapter) => void;
    var addCss: typeof import("../utils").addCss;
    var css: typeof import("lit").css;
    var getSafeImageUrl: typeof import("../utils").getSafeImageUrl;
    var html: typeof import("lit").html;
    var makeRequest: typeof import("../network").makeRequest;
    var unsafeCSS: typeof import("lit").unsafeCSS;
}
