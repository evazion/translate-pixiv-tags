import $ from "jquery";
import { memoize, noop } from "underscore";
import { SETTINGS, DOMAIN_USES_CSP } from "./settings";
import { GM } from "$";
import { CSSResult } from "lit";

const konsole = globalThis.console;
/** Branded version of the console */
export const console: Console = {
    ...konsole,
    log: SETTINGS.debug ? konsole.log.bind(konsole, "[TPT]:") : noop,
    warn: konsole.warn.bind(konsole, "[TPT]:"),
    error: konsole.error.bind(konsole, "[TPT]:"),
};

export function memoizeKey(...args: object[]) {
    const paramHash = Object.fromEntries(args.entries());
    return $.param(paramHash);
}

export const matchMemoized: (string: string, regex: RegExp) => RegExpMatchArray | null = memoize(
    (string, regex) => string.match(regex),
    memoizeKey,
);

/** For safe ways to use regexp in a single line of code */
export function safeMatchMemoized(
    string: string,
    regex: RegExp,
    group: number = 0,
    defaultValue: string = "",
) {
    const match = matchMemoized(string ?? "", regex);
    if (match) {
        return match[group];
    }
    return defaultValue;
}

export function capitalize(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

export function naturalCompare(s1: string, s2: string) {
    const parts1 = s1.split(/(\d+)/);
    const parts2 = s2.split(/(\d+)/);
    const length = Math.min(parts1.length, parts2.length);

    for (let i = 0; i < length; i++) {
        const elem1 = Number.parseInt(parts1[i], 10) || parts1[i];
        const elem2 = Number.parseInt(parts2[i], 10) || parts2[i];

        // eslint-disable-next-line no-continue
        if (elem1 === elem2) continue;

        if (typeof elem1 === "number" && typeof elem2 === "number") {
            return elem1 - elem2;
        }

        return elem1.toString().localeCompare(elem2.toString());
    }

    return parts1.length - parts2.length;
}

function getStyle<T extends keyof CSSStyleDeclaration>(element: Element, prop: T) {
    return window.getComputedStyle(element)[prop];
}

/** Get a color similar to the background under the element and theme type */
export function chooseBackgroundColorScheme(element: Element): {
    theme: Theme;
    adjustedColor: string;
} {
    const TRANSPARENT_COLOR = "rgba(0, 0, 0, 0)";
    // Halfway between white/black in the RGB scheme
    const MIDDLE_LUMINOSITY = 128;

    // Mix background color with parents'
    let colorChannels = [0, 0, 0, 0];
    let current: Element | null = element;
    while (current && colorChannels[3] !== 1) {
        const color = getStyle(current, "backgroundColor");
        current = current.parentElement;
        if (color === TRANSPARENT_COLOR) continue;
        const channels = color.match(/\d+(\.\d+)?/g);
        if (!channels) continue;
        const [r1, g1, b1, al1 = 1] = colorChannels;
        const [r2, g2, b2, al2 = 1] = channels.map(Number);
        colorChannels = [
            r1 * al1 * (1 - al2) + r2 * al2,
            g1 * al1 * (1 - al2) + g2 * al2,
            b1 * al1 * (1 - al2) + b2 * al2,
            al1 * (1 - al2) + al2,
        ];
    }
    colorChannels.length = 3; // Drop alpha channel

    const medianLuminosity = (Math.max(...colorChannels) + Math.min(...colorChannels)) / 2;
    const adjustedChannels = colorChannels.map((color) => {
        const colorScale = (color - MIDDLE_LUMINOSITY) / MIDDLE_LUMINOSITY; // To range [-1..+1]
        return Math.round(
            Math.abs(colorScale) ** 0.7 * // "Move" value away from 0 which equal to 128
                Math.sign(colorScale) * // Get original sign back
                MIDDLE_LUMINOSITY +
                MIDDLE_LUMINOSITY, // Get back to the RGB range [0..255]
        );
    });
    const adjustedColor = `rgb(${adjustedChannels.join(", ")})`;
    const theme = medianLuminosity < MIDDLE_LUMINOSITY ? "dark" : "light";

    return {
        theme,
        adjustedColor,
    };
}

const makeStyleSheetMemoized: (css: string) => CSSStyleSheet = memoize((css) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    return sheet;
});

/**
 * Universal method to add a content as Shadow DOM
 * @param $target Container for the Shadow DOM
 * @param $content The Shadow DOM content
 * @param css The Shadow DOM CSS
 */
export function attachShadow($target: JQuery, $content: JQuery, css: string) {
    // Return if the target already have shadow
    if ($target.prop("shadowRoot")) return;

    if (typeof document.body.attachShadow === "function") {
        const shadowRoot = $target.get(0)!.attachShadow({ mode: "open" });
        $(shadowRoot).append($content);
        if ("adoptedStyleSheets" in shadowRoot) {
            try {
                shadowRoot.adoptedStyleSheets = [makeStyleSheetMemoized(css)];
                return;
            } catch {
                /* empty */
            }
        }
        GM.addElement(shadowRoot as any, "style", { textContent: css });
    } else {
        $target.empty().append($content, `<style>${css}</style>`);
    }
}

/**
 * Run the handler only when it is triggered for the current element
 */
export function self<E extends Event>(fn: (ev?: E) => any): (ev: E) => void {
    return (ev) => {
        if (ev.currentTarget === ev.target) fn(ev);
    };
}

let sheets: CSSStyleSheet[] = [];

/**
 * Add removable CSS to the page
 * @param css - result of lit's `css`
 */
export function addCss(css: CSSResult | string) {
    let sheet;
    if (typeof css === "string") {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
    } else if (!css.styleSheet) {
        console.error("no sheet", css);
        return;
    } else {
        sheet = css.styleSheet;
    }
    if (sheets.includes(sheet)) return;
    document.adoptedStyleSheets.push(sheet);
    sheets.push(sheet);
}

/**
 * Removes all the CSS added to the page
 */
export function removeAllCss() {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (sheet) => !sheets.includes(sheet),
    );
    sheets = [];
}

/**
 * Get CSP-safe url to an image
 * @param url - original url
 * @returns - safe url
 */
export async function getSafeImageUrl(url: string) {
    if (!DOMAIN_USES_CSP) return url;

    const key = `tptImageCache:${url}`;

    if (key in localStorage) {
        const str = localStorage[key];
        let buffer: Uint8Array<any>;
        if ("fromBase64" in Uint8Array) {
            // too new for TS
            buffer = (Uint8Array.fromBase64 as any)(str);
        } else {
            const len = str.length;
            buffer = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                buffer[i] = str.fromCharAt(i);
            }
        }
        return URL.createObjectURL(new Blob([buffer]));
    }

    const res = await GM.xmlHttpRequest({
        url,
        responseType: "arraybuffer",
    });

    localStorage[key] = btoa(String.fromCharCode.apply(null, new Uint8Array(res.response) as any));
    return URL.createObjectURL(new Blob([res.response]));
}
