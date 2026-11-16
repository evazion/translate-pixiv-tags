import { isEqual } from "underscore";
import settingsIconRaw from "../resource/settings-icon.svg?raw";
import {
    adapterCodes,
    ADAPTERS,
    DataSource,
    Setting,
    SettingName,
    SETTINGS,
    SETTINGS_SCHEMA,
    customCssSheet,
} from "../settings";
import { chooseBackgroundColorScheme, console, self, validateCss } from "../utils";
import { css, html, LitElement } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { execAdapters, SourceAdapter, loadAdapter } from "../adapter-loader";

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

class TptSettings extends LitElement {
    static get styles() {
        return [
            css`
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
                    grid-template-columns: repeat(3, auto);
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem;
                    border: 1px solid gray;
                }
                .validate-msg {
                    grid-column: 2 / -1;
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
            `,
            customCssSheet,
        ];
    }

    static get properties() {
        return {
            changed: { state: true },
            changes: { state: true },
            sourceParamError: { state: true },
            adapterUrlError: { state: true },
            cssError: { state: true },
            tab: { state: true },
        };
    }

    // ensure these aren't declared as native class fields
    declare settings: typeof SETTINGS;
    declare changed: boolean;
    declare changes: Partial<typeof SETTINGS>;
    declare sourceParamError: string;
    declare adapterUrlError: string;
    declare cssError: string;
    declare tab: Tab;
    destroy: () => void;

    constructor() {
        super();

        this.settings = { ...SETTINGS };
        this.changed = false;
        this.changes = {};
        this.sourceParamError = "";
        this.adapterUrlError = "";
        this.cssError = "";
        this.tab = "general";
        this.destroy = destroy;

        document.addEventListener("keydown", closeOnEscape);

        const self = this;
        function destroy() {
            document.removeEventListener("keydown", closeOnEscape);
            self.onclose?.(new Event("close"));
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
        Object.assign(SETTINGS, this.changes);
        this.settings = { ...SETTINGS };
        this.changes = {};
        this.changed = false;
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
                            ${val === value ? "selected" : ""}
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
                            @change=${(ev: Event) => {
                                const s = { ...source };
                                s.param = (ev.currentTarget as HTMLInputElement).value;
                                this.addChange(name, list.with(i, s));
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
                            X
                        </button>
                    `,
                );
                const newSource = {
                    adapter: "Danbooru",
                    param: "",
                    translateArtist: false,
                    translateTag: false,
                };
                return html`
                    <div class="sources-list">
                        ${rows}

                        <select
                            @change=${(ev: Event) => {
                                newSource.adapter = (ev.currentTarget as HTMLSelectElement).value;
                            }}
                        >
                            ${Object.keys(ADAPTERS).map((name) => html`<option>${name}</option>`)}
                        </select>
                        <input
                            @change=${(ev: Event) => {
                                newSource.param = (ev.currentTarget as HTMLInputElement).value;
                            }}
                        />
                        <label>
                            <input
                                type="checkbox"
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
                                const adapter = ADAPTERS[newSource.adapter];
                                try {
                                    this.sourceParamError = "checking...";
                                    await adapter.validateParams(newSource.param);
                                    this.addChange(name, list.concat([newSource]));
                                    this.sourceParamError = "";
                                } catch (ex) {
                                    this.sourceParamError = (ex as Error).message;
                                }
                            }}
                        >
                            Add
                        </button>

                        <div class="validate-msg">${this.sourceParamError || null}</div>
                    </div>
                `;
            }
            case "adapters": {
                let newAdapterUrl = "";
                const list = this.changes.source_adapters ?? (value as SourceAdapter[]);
                const rows = list.map(
                    (adapter, i) => html`
                        <div>${adapter.name}@${adapter.version}:</div>
                        <div style="${adapter.codeUrl ? "" : "font-style: italic"}">
                            ${adapter.codeUrl || "built-in"}
                        </div>
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
                            X
                        </button>
                    `,
                );
                return html`
                    <div class="adapters-list">
                        ${rows}
                        <div></div>
                        <input
                            placeholder="URL of adapter"
                            @change=${(ev: Event) => {
                                newAdapterUrl = (ev.target as HTMLInputElement).value;
                            }}
                        />
                        <button
                            class="add-btn"
                            @click=${async () => {
                                try {
                                    this.adapterUrlError = "checking...";
                                    const newAdapter = await loadAdapter(
                                        newAdapterUrl,
                                        list.map((meta) => meta.name),
                                    );
                                    this.adapterUrlError = "";
                                    this.addChange(name, list.concat([newAdapter.meta]));
                                } catch (ex) {
                                    this.adapterUrlError = (ex as Error).message;
                                }
                            }}
                        >
                            Add
                        </button>

                        <div class="validate-msg">${this.adapterUrlError || null}</div>
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

customElements.define("tpt-settings", TptSettings);

export default function showSettings() {
    const container = document.createElement("div");
    container.id = "tpt-settings";
    document.body.append(container);

    const settings = document.createElement("tpt-settings");
    settings.onclose = () => {
        container.remove();
    };
    settings.className = `tip-${chooseBackgroundColorScheme(document.body).theme}`;

    container.append(settings);
}
