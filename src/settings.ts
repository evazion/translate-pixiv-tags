import { GM } from "$";
import { SourceAdapter } from "./adapter-loader";

export type DataSource = {
    adapter: string;
    param: string;
    translateTag: boolean;
    translateArtist: boolean;
};

type SettingT<N extends string, T> = { defValue: T; descr: string; type: N };
export type Setting =
    | SettingT<"number", number>
    | SettingT<"boolean", boolean>
    | (SettingT<"option", string> & { values: Record<string, string> })
    | SettingT<"sources", DataSource[]>
    | SettingT<"adapters", SourceAdapter[]>
    | SettingT<"string", string>;

export const SETTINGS_SCHEMA = {
    // TODO remove
    booru: {
        defValue: "https://danbooru.donmai.us",
        descr: "Danbooru subdomain for sending requests",
        type: "option",
        values: {
            "https://danbooru.donmai.us": "Danbooru",
            "https://safebooru.donmai.us": "Safebooru",
            "https://betabooru.donmai.us": "Betabooru",
            "https://donmai.moe": "Donmai.moe",
        },
    },
    cache_lifetime: {
        defValue: 60 * 5,
        descr: "The amount of time in seconds to cache data from Danbooru before querying again",
        type: "number",
    },
    preview_limit: {
        defValue: 3,
        descr: "The number of recent posts to show in artist tooltips",
        type: "number",
    },
    show_preview_rating: {
        defValue: "s",
        descr: "The upper level of rating for preview (higher ratings will be blurred)",
        type: "option",
        values: {
            g: "General",
            s: "Sensitive",
            q: "Questionable",
            e: "Explicit", // eslint-disable-line id-blacklist
        },
    },
    show_deleted: {
        defValue: true,
        descr: "Check to show deleted posts, uncheck to hide",
        type: "boolean",
    },
    show_settings: {
        defValue: true,
        descr: "Show the settings button in the script manager menu",
        type: "boolean",
    },
    debug: {
        defValue: false,
        descr: "Print debug messages in console",
        type: "boolean",
    },
    display_network_errors: {
        defValue: true,
        descr: "Display a message when a request error occurs",
        type: "boolean",
    },
    data_sources: {
        defValue: [
            {
                adapter: "Danbooru",
                get param(): string {
                    return SETTINGS.booru;
                },
                translateArtist: true,
                translateTag: true,
            } as DataSource,
        ],
        descr: "List of databases used for translating",
        type: "sources",
    },
    source_adapters: {
        defValue: [
            {
                name: "Danbooru",
                version: "build-in",
                codeUrl: "",
                lastUpdate: Number.MAX_SAFE_INTEGER,
            } as SourceAdapter,
        ],
        descr: "Available database adapters",
        type: "adapters",
    },
    custom_css: {
        defValue: "",
        descr: "Custom CSS applied to the page and the TPT's windows",
        type: "string",
    },
} satisfies Record<string, Setting>;

// use setter to prevent circular dependencies
let onChange: () => void;
export function setOnSettingChange(fn: () => void) {
    onChange = fn;
}

/** Restarts the app as if a setting has changed */
export function requestRestart() {
    onChange?.();
}

type SettingsSchema = typeof SETTINGS_SCHEMA;
export type SettingName = keyof SettingsSchema;

const settings = (await GM.getValues(
    Object.fromEntries(
        Object.entries(SETTINGS_SCHEMA).map(([key, schema]) => [key, schema.defValue]),
    ),
)) as {
    [K in keyof SettingsSchema]: SettingsSchema[K] extends SettingT<string, infer T> ? T : never;
};

/** Stylesheet with the user's custom CSS, shared by the page and all the script's windows */
export const customCssSheet = new CSSStyleSheet();
customCssSheet.replaceSync(settings.custom_css);

export const SETTINGS = new Proxy(settings, {
    set(target, prop, value) {
        GM.setValue(prop as string, value);
        if (Reflect.set(target, prop, value)) {
            // the sheet is adopted everywhere, so it applies live
            if (prop === "custom_css") {
                customCssSheet.replaceSync(value);
                // adapter and css changes should not restart app
            } else if (prop !== "source_adapters") {
                onChange?.();
            }
            return true;
        }
        return false;
    },
});

export const ADAPTERS: Record<string, typeof Adapter> = {};

/** Whether the current domain uses CSP which block direct loading of images */
export const DOMAIN_USES_CSP = [
    "baraag.net",
    "bcy.net",
    "pawoo.net",
    "twitter.com",
    "x.com",
].includes(window.location.host);

const ADAPTER_CODE_PREFIX = "adapter_";

async function getAdapterCode(name: string): Promise<string | null>;
async function getAdapterCode(names: string[]): Promise<Record<string, string>>;
async function getAdapterCode(
    names: string | string[],
): Promise<string | null | Record<string, string>> {
    if (typeof names === "string") {
        return GM.getValue(ADAPTER_CODE_PREFIX + names, null as string | null);
    }

    const codeMap = await GM.getValues<Record<string, string>>(
        names.map((name) => ADAPTER_CODE_PREFIX + name),
    );
    // strip prefix from the keys
    return Object.fromEntries(
        Object.entries(codeMap).map(([key, code]) => [key.slice(ADAPTER_CODE_PREFIX.length), code]),
    );
}

export const adapterCodes = {
    get: getAdapterCode,
    async set(name: string, code: string) {
        await GM.setValue(ADAPTER_CODE_PREFIX + name, code);
    },
    async delete(name: string) {
        await GM.deleteValue(ADAPTER_CODE_PREFIX + name);
    },
};
