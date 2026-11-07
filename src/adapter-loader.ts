import { css, html, unsafeCSS } from "lit";
import { GM } from "$";
import { makeRequest } from "./network";
import { ADAPTERS } from "./settings";
import { addCss, console, getSafeImageUrl } from "./utils";

// list of adapter module's arguments, MUST BE in sync with src/adapters/adapter.d.ts
const ARGS = { addAdapter, addCss, console, css, getSafeImageUrl, html, makeRequest, unsafeCSS };

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

const isDevUrl = (url: string) => url.startsWith("http://127.0.0.1:");

export async function execAdapters(metas: SourceAdapter[]) {
    const codes: Record<string, string> = await GM.getValues<Record<string, string>>(
        metas.map((i) => `adapter_${i.name}`),
    ).then((obj) =>
        // strip prefix from the keys
        Object.fromEntries(Object.entries(obj).map(([key, code]) => [key.slice(8), code])),
    );

    const now = Date.now();
    for (const { name, codeUrl, lastUpdate } of metas) {
        if (name === "Danbooru") continue;
        const alwaysUpdateAndRun = isDevUrl(codeUrl);
        if (codes[name] && !alwaysUpdateAndRun) {
            try {
                parseAdapter(codes[name])();
            } catch (ex) {
                console.error(`An error occurred during execution of the adapter "${name}":`, ex);
            }
        }
        if (lastUpdate + ADAPTER_UPDATE_PERIOD < now || alwaysUpdateAndRun) {
            await updateAdapter(name, codeUrl, !(name in codes) || alwaysUpdateAndRun);
        }
    }
}

let selfTab: Record<string, string> = {};
async function updateAdapter(name: string, url: string, exec: boolean) {
    const lock = Math.random().toString(16).slice(2);
    const key = `updating_adapter_${name}`;
    selfTab[key] = lock;

    await GM.saveTab(selfTab);
    const tabs = await GM.getTabs();
    for (const k in tabs) {
        if (tabs[k]?.[key] && tabs[k][key] !== lock) {
            console.log(`Adapter "${name}" is already updating`);
        }
    }

    let run = false;
    try {
        const newAdapter = await loadAdapter(url, []);
        const adapters: SourceAdapter[] = await GM.getValue("source_adapters", []);
        const oldAdapter = adapters.find((a) => a.name === name);

        if (exec) {
            newAdapter.run();
            run = true;
        }

        if (newAdapter.meta.version === oldAdapter?.version && !isDevUrl(url)) {
            return;
        }
        if (newAdapter.meta.name !== name) {
            if (adapters.some((a) => a !== oldAdapter && a.name === newAdapter.meta.name)) {
                console.error(
                    `Adapter "${name}" changed name to "${newAdapter.meta.name}" which is name of another adapter.`,
                );
                return;
            }
        }

        const newAdapters = adapters.map((adapter) =>
            adapter === oldAdapter ? newAdapter.meta : adapter,
        );
        GM.setValues({
            source_adapters: newAdapters,
            [`adapter_${newAdapter.meta.name}`]: newAdapter.code,
        });
        if (newAdapter.meta.name !== name) {
            GM.deleteValue(`adapter_${name}`);
        }
    } catch (ex) {
        console.error(`Failed to update adapter "${name}":`, ex);
        if (exec && !run) {
            try {
                const code: string | undefined = await GM.getValue(`adapter_${name}`);
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
