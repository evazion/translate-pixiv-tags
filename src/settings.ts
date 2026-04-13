import { GM } from "$";

export type DataSource = {
    adapter: string;
    param: string;
    translateTag: boolean;
    translateArtist: boolean;
};

export type SourceAdapter = {
    name: string;
    codeUrl: string;
    lastUpdate: number;
};

type SettingT<N extends string, T> = { defValue: T; descr: string; type: N };
export type Setting =
    | SettingT<"number", number>
    | SettingT<"boolean", boolean>
    | (SettingT<"option", string> & { values: Record<string, string> })
    | SettingT<"sources", DataSource[]>
    | SettingT<"adapters", SourceAdapter[]>;

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
            },
        ],
        descr: "List of databases used for translating",
        type: "sources",
    },
    source_adapters: {
        defValue: [
            {
                name: "Danbooru",
                codeUrl: "",
                lastUpdate: Number.MAX_SAFE_INTEGER,
            },
        ],
        descr: "Available database adapters",
        type: "adapters",
    },
} satisfies Record<string, Setting>;

type SettingsSchema = typeof SETTINGS_SCHEMA;
export type SettingName = keyof SettingsSchema;

const settings = (await GM.getValues(
    Object.fromEntries(
        Object.entries(SETTINGS_SCHEMA).map(([key, schema]) => [key, schema.defValue]),
    ),
)) as {
    [K in keyof SettingsSchema]: SettingsSchema[K] extends SettingT<string, infer T> ? T : never;
};

export const SETTINGS = new Proxy(settings, {
    set(target, prop, value) {
        GM.setValue(prop as string, value);
        return Reflect.set(target, prop, value);
    },
});

/** Whether the current domain uses CSP which block direct loading of images */
export const DOMAIN_USES_CSP = [
    "baraag.net",
    "bcy.net",
    "pawoo.net",
    "twitter.com",
    "x.com",
].includes(window.location.host);
