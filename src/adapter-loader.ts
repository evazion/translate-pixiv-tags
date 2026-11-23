import { html } from "lit-html";
import { GM } from "$";
import { DEV } from "esm-env";
import { ajax, getSafeImageUrl } from "./network";
import { ADAPTERS, adapterCodes, SETTINGS } from "./settings";
import { addCss, console, css, memoize, sleep, unsafeCSS } from "./utils";
import artistTooltip from "./tooltips/artist-tooltip";
import * as adapterShared from "./adapters/shared";
import { cache } from "./cache";

// lit caches templates by the strings array identity, so cache processed arrays too
const trimmedTemplates = new WeakMap<TemplateStringsArray, TemplateStringsArray>();

/** Removes line breaks with indents: around tags completely, otherwise replaces them with a space */
function removeIndents(str: string) {
    return str.replace(/(>)?\n\s*(<)?/g, (_, gt?: string, lt?: string) =>
        gt || lt ? (gt ?? "") + (lt ?? "") : " ",
    );
}

function trimStrings(strings: readonly string[]) {
    const result = strings.map(removeIndents);
    result[0] = result[0].trimStart();
    result[result.length - 1] = result.at(-1)!.trimEnd();
    return result;
}

/** Lit's `html` that trims whitespaces on the template ends and removes indents */
const trimmedHtml: typeof html = (strings, ...values) => {
    let trimmed = trimmedTemplates.get(strings);
    if (!trimmed) {
        const result = trimStrings(strings);
        trimmed = Object.freeze(
            Object.assign(result, {
                raw: Object.freeze(trimStrings(strings.raw)),
            }),
        );
        trimmedTemplates.set(strings, trimmed);
    }
    return html(trimmed, ...values);
};

// list of adapter module's arguments, MUST BE in sync with src/adapters/adapter.d.ts
const ARGS = {
    adapterShared,
    addAdapter,
    addCss,
    ajax,
    artistTooltip,
    cache,
    console,
    css,
    getSafeImageUrl,
    html: trimmedHtml,
    memoize,
    SETTINGS: new Proxy(SETTINGS, {
        set() {
            // forbid changing settings
            return false;
        },
    }),
    sleep,
    unsafeCSS,
};

const ADAPTER_UPDATE_PERIOD = 24 * 60 * 60 * 1000; // 1 day

function addAdapter(adapter: any) {
    if (
        typeof adapter?.name !== "string" ||
        typeof adapter?.prototype?.constructor !== "function"
    ) {
        throw new Error("Doesn't look to be an adapter", { cause: adapter });
    }
    if (adapter.name in ADAPTERS) {
        throw new Error(`Adapter ${adapter.name} is already added`);
    }
    // suppose the rest is correct
    ADAPTERS[adapter.name] = adapter;
}

export async function loadAdapter(url: string, otherNames: string[]) {
    // ensure it's a valid URL
    new URL(url);

    const resp = await GM.xmlHttpRequest({
        url,
        responseType: "text",
    });

    if (resp.status >= 400) {
        throw new Error(`Bad response status ${resp.status}: ${resp.statusText}.`);
    }

    const code = resp.response;

    if (!code?.trim()) throw new Error(`Empty response.`);

    const jsDocReg = /\/\/\s+@([\w-]+)([^\n]*)?/g;

    let meta: Record<string, string | undefined> = {};
    let match;
    while ((match = jsDocReg.exec(code)) != null) {
        meta[match[1]] = match[2]?.trim();
    }

    if (!("tpt-adapter" in meta) || !meta.name || !meta.version) {
        throw new Error(`This doesn't look like an TPT adapter.`);
    }

    if (otherNames.includes(meta.name)) {
        throw new Error(`Adapter "${meta.name}" is already added.`);
    }

    // ensure it is a JS code, this just parses it, without execution
    const run = parseAdapter(code);

    return {
        code,
        run,
        meta: {
            name: meta.name,
            version: meta.version,
            codeUrl: url,
            lastUpdate: Date.now(),
        },
    };
}

function parseAdapter(code: string) {
    return new Function(...Object.keys(ARGS), code).bind(null, ...Object.values(ARGS));
}

export type SourceAdapter = {
    name: string;
    version: string;
    codeUrl: string;
    lastUpdate: number;
};

export async function execAdapters(adapters: SourceAdapter[]) {
    const codes = await adapterCodes.get(adapters.map((m) => m.name));

    const now = Date.now();
    for (const adapter of adapters) {
        if (adapter.name === "Danbooru") continue;
        // in development, always run the latest code of the adapters from the local adapter server
        let hasRun = DEV && adapter.codeUrl.startsWith("http://127.0.0.1:");
        if (codes[adapter.name] && !hasRun) {
            try {
                parseAdapter(codes[adapter.name])();
                hasRun = true;
            } catch (ex) {
                console.error(
                    `An error occurred during execution of the adapter "${adapter.name}":`,
                    ex,
                );
            }
        }
        if (!hasRun) {
            await updateAdapter(adapter, true);
        } else if (adapter.lastUpdate + ADAPTER_UPDATE_PERIOD < now) {
            updateAdapter(adapter, false);
        }
    }
}

let selfTab: Record<string, string> = {};
async function updateAdapter(oldAdapter: SourceAdapter, exec: boolean) {
    const name = oldAdapter.name;
    const lock = Math.random().toString(16).slice(2);
    const key = `updating_adapter_${name}`;
    selfTab[key] = lock;

    await GM.saveTab(selfTab);
    const tabs = await GM.getTabs();
    for (const k in tabs) {
        if (tabs[k]?.[key] && tabs[k][key] !== lock) {
            console.warn(`Adapter "${name}" is already updating`);
        }
    }

    let hasRun = false;
    try {
        const { code, run, meta: newAdapter } = await loadAdapter(oldAdapter.codeUrl, []);

        if (exec) {
            run();
            hasRun = true;
        }

        const adapters = SETTINGS.source_adapters;
        if (newAdapter.name !== name) {
            if (adapters.some((a) => a !== oldAdapter && a.name === newAdapter.name)) {
                console.error(
                    `Adapter "${name}" changed name to "${newAdapter.name}" which is name of another adapter.`,
                );
                return;
            }
        }

        // at least need to bump `lastUpdate`
        SETTINGS.source_adapters = adapters.map((adapter) =>
            adapter === oldAdapter ? newAdapter : adapter,
        );
        // `exec` means there is no stored code yet, e.g. the adapter was just added
        if (exec || newAdapter.version !== oldAdapter.version) {
            adapterCodes.set(newAdapter.name, code);
        }
        if (newAdapter.name !== name) {
            adapterCodes.delete(name);
        }
    } catch (ex) {
        console.error(`Failed to update adapter "${name}":`, ex);
        if (exec && !hasRun) {
            try {
                const code = await adapterCodes.get(name);
                if (code) {
                    parseAdapter(code)();
                }
            } catch (ex) {
                console.error(`An error occurred during execution of the adapter "${name}":`, ex);
            }
        }
    } finally {
        delete selfTab[key];
        GM.saveTab(selfTab);
    }
}
