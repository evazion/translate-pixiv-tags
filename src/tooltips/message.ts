import { chooseBackgroundColorScheme } from "../utils";
import { css, html, LitElement } from "lit";
import showSettings, { settingsIcon } from "./settings";

let messages: TptMessages | null = null;

class TptMessages extends LitElement {
    static get styles() {
        return css`
            #ui-message {
                width: 100vw;
                height: 0;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                position: relative;
                z-index: 3100000;
            }
            .container {
                font-family: Verdana, Helvetica, sans-serif;
                padding: 20px;
                font-size: 12px;
                opacity: 1;
                transform: translateY(20px);
                transition: all 0.5s;
                box-shadow: 0 0 50px #f00;
            }
            .hide .container {
                opacity: 0;
                transform: translateY(-100%);
            }
            :host(.tip-light) .container {
                background-color: #fff;
                border: 1px solid #888;
                color: #222;
            }
            :host(.tip-dark) .container {
                background-color: #222;
                border: 1px solid #888;
                color: #fff;
            }
            input[type="button"] {
                margin: 0 5px;
            }

            .settings-icon svg {
                position: absolute;
                top: 5px;
                right: 5px;
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            .settings-icon path {
                fill: #888;
            }
        `;
    }

    static get properties() {
        return {
            messages: { state: true },
        };
    }

    declare messages: Record<string, string>;

    constructor() {
        super();
        this.messages = {};
    }

    setMessage(message: string, key: string) {
        if (key && "" in this.messages) {
            delete this.messages[""];
            this.messages = { [key]: message };
        } else if (key === "") {
            this.messages = { [key]: message };
        } else {
            this.messages = { ...this.messages, [key]: message };
        }
    }

    renderMessages() {
        const entires = Object.entries(this.messages);
        if (entires.length > 1) {
            return entires.map(([key, value]) => html`<div>${key}: ${value}</div>`);
        }
        if (entires.length === 0) return "";
        return entires[0][1];
    }

    render() {
        return html /* HTML */ `
            <div
                id="ui-message"
                class="${Object.values(this.messages).every((v) => !v) ? "hide" : ""}"
            >
                <div class="container">
                    Translate Pixiv Tags: ${this.renderMessages()}
                    <input
                        class="close"
                        type="button"
                        value="Close"
                    />
                    <span
                        class="settings-icon"
                        @click=${showSettings}
                    >
                        ${settingsIcon}
                    </span>
                </div>
            </div>
        `;
    }
}

customElements.define("tpt-messages", TptMessages);

/**
 * Display a message
 * @param message the message to display
 * @param key the message id
 */
export default function showMessage(message: string, key: string) {
    if (!messages) {
        const container = document.createElement("div");
        container.id = "tpt-message";
        document.body.append(container);

        messages = document.createElement("tpt-messages") as TptMessages;
        messages.className = `tip-${chooseBackgroundColorScheme(document.body).theme}`;
        container.append(messages);
    }

    messages.setMessage(message, key);
}
