import { isEqual } from "underscore";
import settingsIconRaw from "../resource/settings-icon.svg?raw";
import {
    DataSource,
    Setting,
    SettingName,
    SETTINGS,
    SETTINGS_SCHEMA,
    SourceAdapter,
} from "../settings";
import { chooseBackgroundColorScheme, self } from "../utils";
import { css, html, LitElement } from "lit";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

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
                grid-gap: 10px;
                font-size: 12px;
            }
            :host(.tip-light) .container {
                background-color: #fff;
                color: #222;
            }
            :host(.tip-dark) .container {
                background-color: #222;
                color: #fff;
            }
            .container div:nth-of-type(even) {
                display: flex;
                flex-direction: column-reverse;
            }
            .container h2 {
                grid-column: span 2;
                margin: auto;
            }
            input[type="button"] {
                margin: 0 5px;
            }
            .sources-list {
                display: grid;
                grid-template-columns: repeat(auto, 7);
                .add-btn {
                    grid-column: span 3;
                }
            }
            .adapters-list {
                display: grid;
                grid-template-columns: repeat(auto, 3);
            }
        `;
    }

    static get properties() {
        return {
            changed: { state: true },
        };
    }

    settings: typeof SETTINGS;
    changed: boolean;
    changes: { [K in SettingName]?: any };
    destroy: () => void;

    constructor() {
        super();

        this.settings = { ...SETTINGS };
        this.changed = false;
        this.changes = {};
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

    connectedCallback(): void {
        console.log("settings connected");
    }

    disconnectedCallback(): void {
        console.log("settings disconnected");
    }

    addChange(name: SettingName, newValue: any) {
        if (name in this.changes && isEqual(this.settings[name], newValue)) {
            // @ts-ignore
            delete this.changes;
        } else {
            this.changes[name] = newValue;
        }
        this.changed = Object.keys(this.changes).length > 0;
    }

    applyChanges() {
        Object.assign(SETTINGS, this.changes);
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
                const options = Object.entries(setting.values)
                    .map(
                        ([val, descr]) => html /* HTML */ `
                            <option
                                value="${val}"
                                ${val === value ? "selected" : ""}
                            >
                                ${descr}
                            </option>
                        `,
                    )
                    .join("");

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
                        ${value ? "checked" : ""}
                        name="${name}"
                        @change=${(ev: Event) => {
                            const newValue = (ev.currentTarget as HTMLInputElement).checked;
                            this.addChange(name, newValue);
                        }}
                    />
                `;
            case "sources": {
                const list = value as DataSource[];
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
                                this.addChange(name, list.toSpliced(i, 1).with(i - 1, list[i]));
                            }}
                            ?disabled=${i <= 1 || i >= list.length - 1}
                        >
                            ↑
                        </button>
                        <button
                            @click=${() => {
                                this.addChange(name, list.toSpliced(i, 1).with(i - 1, list[i]));
                            }}
                            ?disabled=${i <= 0 || i >= list.length - 2}
                        >
                            ↓
                        </button>
                        <button
                            @click=${() => {
                                this.addChange(name, list.toSpliced(i, 1));
                            }}
                        >
                            ╳
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
                    <h3>${setting.descr}</h3>
                    <div class="sources-list">
                        ${rows}
                        <select
                            @change=${(ev: Event) => {
                                newSource.adapter = (ev.currentTarget as HTMLSelectElement).value;
                            }}
                        >
                            ${this.settings.source_adapters.map(
                                ({ name }) => html` <option>${name}</option> `,
                            )}
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
                            @click=${() => {
                                // TODO validate newSource.param
                                this.addChange(name, list.concat([newSource]));
                            }}
                        >
                            Add
                        </button>
                    </div>
                `;
            }
            case "adapters": {
                let newAdapterUrl = "";
                const list = value as SourceAdapter[];
                const rows = list.map(
                    (adapter, i) => html`
                        <div>${adapter.name}</div>
                        <div>${adapter.codeUrl}</div>
                        <button
                            @click=${() => {
                                this.addChange(name, list.toSpliced(i, 1));
                                const sources = this.settings.data_sources.filter(
                                    (s) => s.adapter !== adapter.name,
                                );
                                this.addChange("data_sources", sources);
                            }}
                        >
                            ╳
                        </button>
                    `,
                );
                return html`
                    <h3>${setting.descr}</h3>
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
                            @click=${() => {
                                // TODO
                                // const newAdapter = await loadAdapterMeta();
                                // this.addChange(name, list.concat([newAdapter]));
                            }}
                        >
                            Add
                        </button>
                    </div>
                `;
            }
            default:
                // @ts-expect-error - here `type` is `never`
                console.error(`[TPT]: Unsupported type ${setting.type}`);
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
                    ${Object.entries(SETTINGS_SCHEMA)
                        .map(
                            ([name, setting]) => html /* HTML */ `
                                <div>${setting.descr}:</div>
                                <div>${this.settingToInput(setting, name as SettingName)}</div>
                            `,
                        )
                        .join("")}
                    <h2>
                        <input
                            class="cancel"
                            type="button"
                            value="Cancel"
                            @click=${this.destroy}
                        />
                        <input
                            class="refresh-page"
                            type="button"
                            value="Refresh page to apply changes"
                            ?disabled=${!this.changed}
                            @click=${() => {
                                this.applyChanges();
                                this.destroy();
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
