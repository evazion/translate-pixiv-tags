import { isEqual } from "underscore";
import settingsIconRaw from "../resource/settings-icon.svg?raw";
import { ADAPTERS, DataSource, Setting, SettingName, SETTINGS, SETTINGS_SCHEMA } from "../settings";
import { chooseBackgroundColorScheme, console, self } from "../utils";
import { css, html, LitElement } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { execAdapters, SourceAdapter, validateAdapter } from "../adapter-loader";

export const settingsIcon = unsafeSVG(settingsIconRaw);

class TptSettings extends LitElement {
    static get styles() {
        return css`
            #ui-settings {
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.25);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                z-index: 3100000;
            }
            :host(.tip-dark) #ui-settings {
                background: rgba(0, 0, 0, 0.75);
            }
            .container {
                font-family: Verdana, Helvetica, sans-serif;
                padding: 20px;
                display: grid;
                grid-template-columns: 300px 1fr;
                align-items: center;
                grid-gap: 10px;
                font-size: 12px;

                div:nth-of-type(even) {
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
        `;
    }

    static get properties() {
        return {
            changed: { state: true },
            sourceParamError: { state: true },
            adapterUrlError: { state: true },
        };
    }

    // ensure these aren't declared as native class fields
    declare settings: typeof SETTINGS;
    declare changed: boolean;
    declare changes: Partial<typeof SETTINGS>;
    declare sourceParamError: string;
    declare adapterUrlError: string;
    destroy: () => void;

    constructor() {
        super();

        this.settings = { ...SETTINGS };
        this.changed = false;
        this.changes = {};
        this.sourceParamError = "";
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
        if (name in this.changes && isEqual(this.settings[name], newValue)) {
            delete this.changes[name];
        } else {
            this.changes[name] = newValue;
        }
        this.changed = Object.keys(this.changes).length > 0;
    }

    async applyChanges() {
        if (this.changes.source_adapters) {
            const newAdapters = this.changes.source_adapters.filter((adapter) =>
                SETTINGS.source_adapters.every((a) => a.name !== adapter.name),
            );
            await execAdapters(newAdapters);
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
                return html /* HTML */ `
                    <input
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
                    ([val, descr]) => html /* HTML */ `
                        <option
                            value="${val}"
                            ${val === value ? "selected" : ""}
                        >
                            ${descr}
                        </option>
                    `,
                );

                return html /* HTML */ `
                    <select
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
                return html /* HTML */ `
                    <input
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
                            value="${source.param}"
                            @change=${(ev: Event) => {
                                const s = { ...source };
                                s.adapter = (ev.currentTarget as HTMLInputElement).value;
                                this.addChange(name, list.with(i, s));
                            }}
                        />
                        <label>
                            <input
                                type="checkbox"
                                ?checked="${source.translateArtist}"
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
                                ?checked="${source.translateTag}"
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
                    translateArtist: true,
                    translateTag: true,
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
                        <div>${adapter.name}:</div>
                        <div style="${adapter.codeUrl ? "" : "font-style: italic"}">
                            ${adapter.codeUrl || "built-in"}
                        </div>
                        <button
                            @click=${() => {
                                this.addChange(name, list.toSpliced(i, 1));
                                const sources = this.settings.data_sources.filter(
                                    (s) => s.adapter !== adapter.name,
                                );
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
                                    const newAdapter = await validateAdapter(
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
            default:
                // @ts-expect-error - we should never happen here
                console.error(`Unsupported type ${setting.type}`);
                return "";
        }
    }

    protected render() {
        return html /* HTML */ `
            <div
                id="ui-settings"
                @click=${self(this.destroy)}
            >
                <div class="container">
                    <h2>Translate Pixiv Tags settings</h2>
                    ${(Object.entries(SETTINGS_SCHEMA) as [SettingName, Setting][]).map(
                        ([name, setting]) =>
                            name === "booru"
                                ? null
                                : html /* HTML */ `
                                      <div>${setting.descr}:</div>
                                      <div>${this.settingToInput(setting, name)}</div>
                                  `,
                    )}
                    <h2>
                        <input
                            class="cancel"
                            type="button"
                            value="${this.changed ? "Cancel" : "Close"}"
                            @click=${this.destroy}
                        />
                        <input
                            class="refresh-page"
                            type="button"
                            value="Apply changes"
                            ?disabled=${!this.changed}
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
