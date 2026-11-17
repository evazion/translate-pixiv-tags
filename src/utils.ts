import { memoize } from "underscore";
import { SETTINGS, DOMAIN_USES_CSP, customCssSheet } from "./settings";
import { GM } from "$";
import { CSSResult } from "lit";

const konsole = globalThis.console;
/** Branded version of the console */
export const console: Console = {
    ...konsole,
    log: (...args) => SETTINGS.debug && konsole.log("[TPT]:", ...args),
    info: (...args) => SETTINGS.debug && konsole.info("[TPT]:", ...args),
    warn: konsole.warn.bind(konsole, "[TPT]:"),
    error: konsole.error.bind(konsole, "[TPT]:"),
};

/**
 * Serializes params into a query string the same way as `jQuery.param`:
 * nested objects and arrays use the bracket notation, e.g. `search[name]=x&ids[]=1`
 */
export function param(params: object): string {
    const parts: string[] = [];
    const add = (key: string, value: unknown) => {
        if (Array.isArray(value)) {
            for (const [i, item] of value.entries()) {
                if (key.endsWith("[]")) {
                    add(key, String(item));
                } else {
                    add(`${key}[${typeof item === "object" && item !== null ? i : ""}]`, item);
                }
            }
        } else if (Object.prototype.toString.call(value) === "[object Object]") {
            for (const [k, v] of Object.entries(value as object)) add(`${key}[${k}]`, v);
        } else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value ?? ""))}`);
        }
    };
    for (const [key, value] of Object.entries(params)) add(key, value);
    return parts.join("&");
}

export function memoizeKey(...args: object[]) {
    const paramHash = Object.fromEntries(args.entries());
    return param(paramHash);
}

/** Memoized matching the RegExp */
export const match: (string: string, regex: RegExp) => RegExpMatchArray | null = memoize(
    (string, regex) => string.match(regex),
    memoizeKey,
);

/**
 * Memoized matching the RegExp that returns matched group or fallback
 * @param string - text to match
 * @param regex - the RegExp
 * @param group - which group return, default - 0 (entire match)
 * @param fallbackValue - value to return when no match or no group, default `""`
 * @returns
 */
export function safeMatch(
    string: string | null | undefined,
    regex: RegExp,
    group: number = 0,
    fallbackValue: string = "",
) {
    const matches = match(string ?? "", regex);
    if (matches) {
        return matches[group] ?? fallbackValue;
    }
    return fallbackValue;
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
export function addCss(css: CSSResult | CSSStyleSheet | string) {
    let sheet;
    if (css instanceof CSSStyleSheet) {
        sheet = css;
    } else if (typeof css === "string") {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
    } else if (!css.styleSheet) {
        console.error("no sheet", css);
        return;
    } else {
        sheet = css.styleSheet;
    }
    if (sheets.includes(sheet)) return;
    const adopted = document.adoptedStyleSheets;
    // keep the custom CSS last so it overrides the script's CSS
    const customIndex = adopted.indexOf(customCssSheet);
    if (sheet !== customCssSheet && customIndex >= 0) {
        document.adoptedStyleSheets = adopted.toSpliced(customIndex, 0, sheet);
    } else {
        adopted.push(sheet);
    }
    sheets.push(sheet);
}

/**
 * Validates CSS: checks that brackets, quotes and comments are closed
 * and every top-level rule is parsed by the browser
 * @param css - the CSS to check
 * @returns error message or empty string if CSS is valid
 */
export function validateCss(css: string): string {
    const chunks: string[] = [];
    let depth = 0;
    let start = 0;
    let quote = "";
    for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = "";
            else if (ch === "\n") return `Unclosed string at line ${lineOf(css, i)}`;
        } else if (ch === "/" && css[i + 1] === "*") {
            const end = css.indexOf("*/", i + 2);
            if (end < 0) return `Unclosed comment at line ${lineOf(css, i)}`;
            i = end + 1;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === "{") {
            depth++;
        } else if (ch === "}") {
            if (--depth < 0) return `Unexpected "}" at line ${lineOf(css, i)}`;
            if (depth === 0) {
                chunks.push(css.slice(start, i + 1));
                start = i + 1;
            }
        } else if (ch === ";" && depth === 0) {
            // statement at-rules like @import
            chunks.push(css.slice(start, i + 1));
            start = i + 1;
        }
    }
    if (quote) return "Unclosed string";
    if (depth > 0) return 'Missing "}"';
    if (
        css
            .slice(start)
            .replace(/\/\*[^]*?\*\//g, "")
            .trim()
    ) {
        return "Unfinished rule at the end";
    }

    const sheet = new CSSStyleSheet();
    for (const chunk of chunks) {
        sheet.replaceSync(chunk);
        if (sheet.cssRules.length === 0 && chunk.replace(/\/\*[^]*?\*\//g, "").trim()) {
            const rule = chunk
                .replace(/\/\*[^]*?\*\//g, "")
                .trim()
                .split("{")[0]
                .trim();
            return `Invalid rule: ${rule.length > 50 ? `${rule.slice(0, 50)}…` : rule}`;
        }
    }
    return "";
}

function lineOf(text: string, index: number) {
    return text.slice(0, index).split("\n").length;
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
            // @ts-ignore
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
