import { render, type CSSResult } from "lit";

export type ChangedProperties = Map<PropertyKey, unknown>;

/**
 * Lit-like component rendered into the shadow root of a regular element.
 * Custom elements can't be defined from userscripts and web extensions,
 * as `customElements` is available only in the page's main world.
 */
export abstract class ShadowComponent {
    /** The element to insert into the page */
    readonly host: HTMLElement;
    readonly renderRoot: ShadowRoot;
    #values = new Map<PropertyKey, unknown>();
    #changed: ChangedProperties = new Map();
    #updatePending = false;

    /**
     * @param styles - the styles of the shadow root
     * @param tagName - the tag name of the host element
     */
    constructor(styles: Array<CSSResult | CSSStyleSheet>, tagName = "div") {
        this.host = document.createElement(tagName);
        this.renderRoot = this.host.attachShadow({ mode: "open" });
        // modify the array instead of replacing it, as an array from
        // the userscript's world may be rejected by the page's world
        for (const style of styles) {
            const sheet = style instanceof CSSStyleSheet ? style : style.styleSheet;
            if (sheet) this.renderRoot.adoptedStyleSheets.push(sheet);
        }
        this.requestUpdate();
    }

    /**
     * Makes the properties reactive: changing them re-renders the component.
     * Has to be called before assigning the properties,
     * and the properties must be declared with `declare` to not be redefined as class fields.
     */
    protected reactive(...names: string[]) {
        for (const name of names) {
            Object.defineProperty(this, name, {
                get: () => this.#values.get(name),
                set: (value: unknown) => {
                    const oldValue = this.#values.get(name);
                    if (Object.is(oldValue, value)) return;
                    this.#values.set(name, value);
                    this.requestUpdate(name, oldValue);
                },
                enumerable: true,
                configurable: true,
            });
        }
    }

    /** Schedules rendering, the changes made within the same tick are rendered at once */
    requestUpdate(name?: PropertyKey, oldValue?: unknown) {
        if (name !== undefined && !this.#changed.has(name)) this.#changed.set(name, oldValue);
        if (this.#updatePending) return;
        this.#updatePending = true;
        queueMicrotask(() => this.#update());
    }

    #update() {
        const changed = this.#changed;
        this.#changed = new Map();
        // the changes made in `willUpdate` are rendered now, not in the next update
        this.willUpdate(changed);
        this.#changed = new Map();
        this.#updatePending = false;
        render(this.render(), this.renderRoot, { host: this });
    }

    /** Called before rendering, changes of the properties made here are rendered at once */
    protected willUpdate(_changedProperties: ChangedProperties) {}

    protected abstract render(): unknown;
}
