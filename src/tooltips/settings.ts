import settingsIconRaw from "../resource/settings-icon.svg?raw";
import {
    adapterCodes,
    ADAPTERS,
    DataSource,
    requestRestart,
    Setting,
    SettingName,
    SETTINGS,
    SETTINGS_SCHEMA,
    customCssSheet,
} from "../settings";
import { chooseBackgroundColorScheme, console, isEqual, self, validateCss } from "../utils";
import { html } from "lit-html";
import { ShadowComponent } from "./component";
import { unsafeSVG } from "lit-html/directives/unsafe-svg.js";
import { live } from "lit-html/directives/live.js";
import { execAdapters, SourceAdapter, loadAdapter } from "../adapter-loader";
import { css } from "@lit/reactive-element";

export const settingsIcon = unsafeSVG(settingsIconRaw);

const TABS = {
    general: "General settings",
    sources: "Data sources",
    css: "Custom CSS",
};
type Tab = keyof typeof TABS;

function getSettingTab(setting: SettingName): Tab {
    switch (setting) {
        case "data_sources":
        case "source_adapters":
            return "sources";
        case "custom_css":
            return "css";
        default:
            return "general";
    }
}

/** Initial values of the row for adding a data source */
function emptySource(): DataSource {
    return {
        adapter: "Danbooru",
        param: "",
        translateArtist: false,
        translateTag: false,
    };
}

const SETTINGS_CSS = css`
    #tpt-settings {
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        z-index: 3100000;
    }
    :host(.tip-dark) #tpt-settings {
        background: rgba(0, 0, 0, 0.75);
    }
    .container {
        font-family: Verdana, Helvetica, sans-serif;
        padding: 20px;
        display: grid;
        grid-template-columns: 1fr 300px;
        align-items: center;
        grid-gap: 10px;
        font-size: 12px;
        min-width: min(760px, 90vw);

        > div {
            display: flex;
            flex-direction: column-reverse;
        }
        :host(.tip-light) & {
            background-color: #fff;
            color: #222;
        }
        :host(.tip-dark) & {
            background-color: #222;
            color: #fff;
        }
        h2,
        div:has(div),
        div:has(+ div > div) {
            grid-column: span 2;
            margin: auto;
        }
        div:has(+ div > div) {
            font-weight: bold;
            font-size: 125%;
        }
    }
    input[type="button"] {
        margin: 0 5px;
    }
    nav {
        grid-column: span 2;
        display: flex;
        justify-content: center;
        gap: 2px;
        border-bottom: 1px solid gray;
        button {
            padding: 6px 14px;
            border: 1px solid transparent;
            border-bottom: none;
            border-radius: 4px 4px 0 0;
            background: none;
            color: inherit;
            font: inherit;
            cursor: pointer;
            margin-bottom: -1px;
            opacity: 0.7;
            &:hover {
                opacity: 1;
            }
            &.active {
                border-color: gray;
                opacity: 1;
                font-weight: bold;
                :host(.tip-light) & {
                    background-color: #fff;
                }
                :host(.tip-dark) & {
                    background-color: #222;
                }
            }
        }
    }
    .sources-list {
        display: grid;
        grid-template-columns: repeat(7, auto);
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.5rem 0;
        border: 1px solid gray;
        .add-btn {
            grid-column: span 3;
        }
    }
    .adapters-list {
        display: grid;
        grid-template-columns: repeat(4, auto);
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border: 1px solid gray;
        input {
            grid-column: span 2;
        }
    }
    .validate-msg {
        grid-column: 1 / -1;
    }
    .css-editor {
        width: min(700px, 80vw);
        textarea {
            width: 100%;
            min-height: 16em;
            box-sizing: border-box;
            font-family: monospace;
            resize: vertical;
        }
        .validate-msg {
            color: red;
        }
    }
`;

class TptSettings extends ShadowComponent {
    // ensure these aren't declared as native class fields
    declare settings: typeof SETTINGS;
    declare changed: boolean;
    declare changes: Partial<typeof SETTINGS>;
    declare sourceParamError: string;
    declare adapterMsg: string;
    declare cssError: string;
    declare tab: Tab;
    destroy: () => void;
    /** Called when the settings are closed */
    onclose: (() => void) | null = null;
    /** Downloaded adapter updates to apply on saving, by adapter name */
    pendingAdapterUpdates = new Map<string, Awaited<ReturnType<typeof loadAdapter>>>();
    /** Values of the row for adding a data source, kept between renders */
    newSource: DataSource = emptySource();
    /** Value of the input for adding an adapter, kept between renders */
    newAdapterUrl = "";

    constructor() {
        super([SETTINGS_CSS, customCssSheet]);
        this.reactive("changed", "changes", "sourceParamError", "adapterMsg", "cssError", "tab");

        this.settings = { ...SETTINGS };
        this.changed = false;
        this.changes = {};
        this.sourceParamError = "";
        this.adapterMsg = "";
        this.cssError = "";
        this.tab = "general";
        this.destroy = destroy;

        document.addEventListener("keydown", closeOnEscape);

        const self = this;
        function destroy() {
            document.removeEventListener("keydown", closeOnEscape);
            self.onclose?.();
        }

        function closeOnEscape(ev: KeyboardEvent) {
            if (ev.key === "Escape" && !ev.altKey && !ev.ctrlKey && !ev.shiftKey) {
                ev.preventDefault();
                destroy();
            }
        }
    }

    addChange(name: SettingName, newValue: any) {
        const changes = { ...this.changes };
        if (isEqual(this.settings[name], newValue)) {
            delete changes[name];
        } else {
            changes[name] = newValue;
        }
        this.changes = changes;
        this.changed = Object.keys(changes).length > 0;
    }

    async applyChanges() {
        if (this.changes.custom_css !== undefined) {
            this.cssError = validateCss(this.changes.custom_css);
            if (this.cssError) return;
        }
        if (this.changes.source_adapters) {
            const addedAdapters = this.changes.source_adapters.filter((adapter) =>
                SETTINGS.source_adapters.every((a) => a.name !== adapter.name),
            );
            await execAdapters(addedAdapters);
            const removedAdapters = SETTINGS.source_adapters.filter((adapter) =>
                this.changes.source_adapters!.every((a) => a.name !== adapter.name),
            );
            for (const adapter of removedAdapters) {
                await adapterCodes.delete(adapter.name);
            }
        }
        const updatedAdapters = this.applyAdapterUpdates();
        Object.assign(SETTINGS, this.changes);
        if (updatedAdapters) {
            // the translators have to be recreated from the updated adapters
            requestRestart();
        }
        this.settings = { ...SETTINGS };
        this.changes = {};
        this.changed = false;
    }

    /**
     * Replaces the adapters in ADAPTERS with the downloaded updates
     * @returns Whether any adapter was updated
     */
    applyAdapterUpdates() {
        let updated = false;
        const list = this.changes.source_adapters;
        for (const [name, { code, run, meta }] of this.pendingAdapterUpdates) {
            const index = list?.findIndex((a) => a.name === name && a.version === meta.version);
            if (index === undefined || index < 0) continue;

            const oldAdapter = ADAPTERS[name];
            delete ADAPTERS[name];
            try {
                run();
                if (!ADAPTERS[name]) {
                    throw new Error("The adapter wasn't registered");
                }
                adapterCodes.set(name, code);
            } catch (ex) {
                console.error(`Failed to apply update of adapter "${name}":`, ex);
                ADAPTERS[name] = oldAdapter;
                // keep the old version
                const oldMeta = this.settings.source_adapters.find((a) => a.name === name);
                if (oldMeta) list![index] = oldMeta;
                continue;
            }
            updated = true;
        }
        this.pendingAdapterUpdates.clear();
        return updated;
    }

    async checkAdapterUpdate(adapter: SourceAdapter, list: SourceAdapter[], i: number) {
        try {
            this.adapterMsg = `Checking update of "${adapter.name}"...`;
            const update = await loadAdapter(
                adapter.codeUrl,
                list.filter((a) => a !== adapter).map((a) => a.name),
            );
            if (update.meta.name !== adapter.name) {
                throw new Error(
                    `The adapter changed its name to "${update.meta.name}", re-add it instead.`,
                );
            }
            if (update.meta.version === adapter.version) {
                this.adapterMsg = `"${adapter.name}" is already the latest version ${adapter.version}.`;
                return;
            }
            this.pendingAdapterUpdates.set(adapter.name, update);
            this.addChange("source_adapters", list.with(i, update.meta));
            this.adapterMsg = `"${adapter.name}" will be updated to ${update.meta.version} on applying the changes.`;
        } catch (ex) {
            this.adapterMsg = `Failed to check update of "${adapter.name}": ${(ex as Error).message}`;
        }
    }

    settingToInput(setting: Setting, name: SettingName) {
        const value = this.settings[name];
        switch (setting.type) {
            case "number":
                return html`
                    <input
                        id="tpt-s-${name}"
                        type="number"
                        min="0"
                        value="${value}"
                        name="${name}"
                        @input=${(ev: Event) => {
                            const value = (ev.currentTarget as HTMLInputElement).valueAsNumber;
                            this.addChange(name, isNaN(value) ? setting.defValue : value);
                        }}
                    />
                `;
            case "option": {
                const options = Object.entries(setting.values).map(
                    ([val, descr]) => html`
                        <option
                            value="${val}"
                            ?selected=${val === value}
                        >
                            ${descr}
                        </option>
                    `,
                );

                return html`
                    <select
                        id="tpt-s-${name}"
                        name="${name}"
                        @change=${(ev: Event) => {
                            const newValue = (ev.currentTarget as HTMLSelectElement).value;
                            this.addChange(name, newValue);
                        }}
                    >
                        ${options}
                    </select>
                `;
            }
            case "boolean":
                return html`
                    <input
                        id="tpt-s-${name}"
                        type="checkbox"
                        ?checked="${value}"
                        name="${name}"
                        @change=${(ev: Event) => {
                            const newValue = (ev.currentTarget as HTMLInputElement).checked;
                            this.addChange(name, newValue);
                        }}
                    />
                `;
            case "sources": {
                const list = this.changes.data_sources ?? (value as DataSource[]);
                const rows = list.map(
                    (source, i) => html`
                        <div>${source.adapter}</div>
                        <input
                            placeholder="https://example.com/"
                            .value=${source.param}
                            @change=${async (ev: Event) => {
                                const param = (ev.currentTarget as HTMLInputElement).value;
                                // an invalid param would break creating the translator
                                try {
                                    this.sourceParamError = "checking...";
                                    await ADAPTERS[source.adapter]?.validateParams(param);
                                } catch (ex) {
                                    this.sourceParamError = `${source.adapter} #${i + 1}: ${(ex as Error).message}`;
                                    return;
                                }
                                this.sourceParamError = "";
                                // the list could change during the validation
                                const current =
                                    this.changes.data_sources ?? this.settings.data_sources;
                                const index = current.indexOf(source);
                                if (index < 0) return;
                                this.addChange(name, current.with(index, { ...source, param }));
                            }}
                        />
                        <label>
                            <input
                                type="checkbox"
                                .checked=${source.translateArtist}
                                @change=${(ev: Event) => {
                                    const s = { ...source };
                                    s.translateArtist = (
                                        ev.currentTarget as HTMLInputElement
                                    ).checked;
                                    this.addChange(name, list.with(i, s));
                                }}
                            />
                            translate artists
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                .checked=${source.translateTag}
                                @change=${(ev: Event) => {
                                    const s = { ...source };
                                    s.translateTag = (ev.currentTarget as HTMLInputElement).checked;
                                    this.addChange(name, list.with(i, s));
                                }}
                            />
                            translate tags
                        </label>
                        <button
                            @click=${() => {
                                this.addChange(
                                    name,
                                    list.toSpliced(i - 1, 2, list[i], list[i - 1]),
                                );
                            }}
                            ?disabled=${i <= 0}
                        >
                            🠉
                        </button>
                        <button
                            @click=${() => {
                                this.addChange(name, list.toSpliced(i, 2, list[i + 1], list[i]));
                            }}
                            ?disabled=${i >= list.length - 1}
                        >
                            🠟
                        </button>
                        <button
                            @click=${() => {
                                this.addChange(name, list.toSpliced(i, 1));
                            }}
                        >
                            ✕
                        </button>
                    `,
                );
                const { newSource } = this;
                return html`
                    <div class="sources-list">
                        ${rows}

                        <select
                            .value=${live(newSource.adapter)}
                            @change=${(ev: Event) => {
                                newSource.adapter = (ev.currentTarget as HTMLSelectElement).value;
                            }}
                        >
                            ${Object.keys(ADAPTERS).map(
                                (adapterName) => html`
                                    <option ?selected=${adapterName === newSource.adapter}>
                                        ${adapterName}
                                    </option>
                                `,
                            )}
                        </select>
                        <input
                            .value=${live(newSource.param)}
                            @change=${(ev: Event) => {
                                newSource.param = (ev.currentTarget as HTMLInputElement).value;
                            }}
                        />
                        <label>
                            <input
                                type="checkbox"
                                .checked=${live(newSource.translateArtist)}
                                @change=${(ev: Event) => {
                                    newSource.translateArtist = (
                                        ev.currentTarget as HTMLInputElement
                                    ).checked;
                                }}
                            />
                            translate artists
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                .checked=${live(newSource.translateTag)}
                                @change=${(ev: Event) => {
                                    newSource.translateTag = (
                                        ev.currentTarget as HTMLInputElement
                                    ).checked;
                                }}
                            />
                            translate tags
                        </label>
                        <button
                            class="add-btn"
                            @click=${async () => {
                                // copy, as the inputs keep changing the original object
                                const source = { ...newSource };
                                try {
                                    this.sourceParamError = "checking...";
                                    await ADAPTERS[source.adapter].validateParams(source.param);
                                } catch (ex) {
                                    this.sourceParamError = (ex as Error).message;
                                    return;
                                }
                                this.sourceParamError = "";
                                // the list could change during the validation
                                const current =
                                    this.changes.data_sources ?? this.settings.data_sources;
                                this.addChange(name, current.concat([source]));
                                // clear the row, the inputs follow via live()
                                this.newSource = emptySource();
                            }}
                        >
                            Add
                        </button>

                        <div class="validate-msg">${this.sourceParamError || null}</div>
                    </div>
                `;
            }
            case "adapters": {
                const list = this.changes.source_adapters ?? (value as SourceAdapter[]);
                const rows = list.map(
                    (adapter, i) => html`
                        <div>${adapter.name}@${adapter.version}:</div>
                        <div style="${adapter.codeUrl ? "" : "font-style: italic"}">
                            ${adapter.codeUrl || "built-in"}
                        </div>
                        <button
                            @click=${() => this.checkAdapterUpdate(adapter, list, i)}
                            ?disabled="${!adapter.codeUrl}"
                            title="Check for updates"
                        >
                            ⟳
                        </button>
                        <button
                            @click=${() => {
                                this.addChange(name, list.toSpliced(i, 1));
                                const sources = (
                                    this.changes.data_sources ?? this.settings.data_sources
                                ).filter((s) => s.adapter !== adapter.name);
                                this.addChange("data_sources", sources);
                            }}
                            ?disabled="${!adapter.codeUrl}"
                        >
                            ✕
                        </button>
                    `,
                );
                return html`
                    <div class="adapters-list">
                        ${rows}
                        <div></div>
                        <input
                            placeholder="URL of adapter"
                            .value=${live(this.newAdapterUrl)}
                            @change=${(ev: Event) => {
                                this.newAdapterUrl = (ev.target as HTMLInputElement).value;
                            }}
                        />
                        <button
                            class="add-btn"
                            @click=${async () => {
                                let newAdapter;
                                try {
                                    this.adapterMsg = "checking...";
                                    newAdapter = await loadAdapter(
                                        this.newAdapterUrl,
                                        list.map((meta) => meta.name),
                                    );
                                } catch (ex) {
                                    this.adapterMsg = (ex as Error).message;
                                    return;
                                }
                                this.adapterMsg = "";
                                // the list could change during the loading
                                const current =
                                    this.changes.source_adapters ?? this.settings.source_adapters;
                                if (current.some((meta) => meta.name === newAdapter.meta.name)) {
                                    this.adapterMsg = `Adapter "${newAdapter.meta.name}" is already added.`;
                                    return;
                                }
                                this.addChange(name, current.concat([newAdapter.meta]));
                                // clear the input, it follows via live()
                                this.newAdapterUrl = "";
                            }}
                        >
                            Add
                        </button>

                        <div class="validate-msg">${this.adapterMsg || null}</div>
                    </div>
                `;
            }
            case "string":
                return html`
                    <div class="css-editor">
                        <textarea
                            spellcheck="false"
                            placeholder="/* e.g. .tpt-tags { font-weight: bold; } */"
                            .value=${this.changes.custom_css ?? value}
                            @input=${(ev: Event) => {
                                const newValue = (ev.currentTarget as HTMLTextAreaElement).value;
                                this.cssError = validateCss(newValue);
                                this.addChange(name, newValue);
                            }}
                        ></textarea>
                        <div class="validate-msg">${this.cssError || null}</div>
                    </div>
                `;
            default:
                // @ts-expect-error - we should never happen here
                console.error(`Unsupported type ${setting.type}`);
                return "";
        }
    }

    protected render() {
        return html`
            <div
                id="tpt-settings"
                @click=${self(this.destroy)}
            >
                <div class="container">
                    <h2>Translate Pixiv Tags settings</h2>
                    <nav>
                        ${(Object.entries(TABS) as [Tab, string][]).map(
                            ([tab, title]) => html`
                                <button
                                    type="button"
                                    class="${tab === this.tab ? "active" : ""}"
                                    @click=${() => {
                                        this.tab = tab;
                                    }}
                                >
                                    ${title}${tab === "css" && this.cssError ? " ⚠" : ""}
                                </button>
                            `,
                        )}
                    </nav>
                    ${(Object.entries(SETTINGS_SCHEMA) as [SettingName, Setting][]).map(
                        ([name, setting]) =>
                            name === "booru" || getSettingTab(name) !== this.tab
                                ? null
                                : html`
                                      <label for="tpt-s-${name}">${setting.descr}:</label>
                                      <div>${this.settingToInput(setting, name)}</div>
                                  `,
                    )}
                    <h2>
                        <input
                            class="cancel"
                            type="button"
                            value="${this.changed ? "Cancel" : "Close"}"
                            @click=${() => this.destroy()}
                        />
                        <input
                            class="refresh-page"
                            type="button"
                            value="Apply changes"
                            ?disabled=${!this.changed || !!this.cssError}
                            @click=${() => {
                                this.applyChanges();
                            }}
                        />
                    </h2>
                </div>
            </div>
        `;
    }
}

export default function showSettings() {
    const container = document.createElement("div");
    container.id = "tpt-settings";
    document.body.append(container);

    const settings = new TptSettings();
    settings.onclose = () => {
        container.remove();
    };
    settings.host.className = `tip-${chooseBackgroundColorScheme(document.body).theme}`;

    container.append(settings.host);
}
