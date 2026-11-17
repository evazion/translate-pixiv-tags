/**
 * Minimal jQuery-like wrapper for DOM querying, traversing and inserting.
 * Creating elements from HTML isn't supported, use lit for it.
 */

type Target = string | Element | Iterable<Element> | null | undefined;
type Insertable = Node | string;
/** Selector or element, which stops `*Until` traversal methods */
type Until = string | Element | null | undefined;
type Filter = string | Element | ((el: HTMLElement, i: number) => boolean);

type SiblingKey = "nextElementSibling" | "previousElementSibling";

/** Whether the element matches the selector, is the given element, or passes the predicate */
function matches(el: HTMLElement, filter: Filter | null | undefined, i = 0) {
    if (filter == null) return true;
    if (typeof filter === "string") return el.matches(filter);
    if (typeof filter === "function") return filter(el, i);
    return el === filter;
}

function isUntil(el: Element, until: Until) {
    if (until == null) return false;
    return typeof until === "string" ? el.matches(until) : el === until;
}

/** Set of elements, all array methods are available but return regular arrays */
export class DomSet extends Array<HTMLElement> {
    // make array methods (`map`, `filter`, etc.) return regular arrays
    static override get [Symbol.species]() {
        return Array;
    }

    /** Wraps the unique elements into a set */
    static wrap(elements: Iterable<Element | null | undefined>) {
        const set = new DomSet();
        const seen = new Set<Element>();
        for (const el of elements) {
            if (el && !seen.has(el)) {
                seen.add(el);
                set.push(el as HTMLElement);
            }
        }
        return set;
    }

    /** Collects elements from each element of the set and filters them */
    #collect(get: (el: HTMLElement) => Iterable<Element | null>, filter?: Filter | null) {
        return DomSet.wrap(this.flatMap((el) => [...get(el)])).#filter(filter);
    }

    #filter(filter?: Filter | null) {
        if (filter == null) return this;
        return DomSet.wrap(Array.prototype.filter.call(this, (el, i) => matches(el, filter, i)));
    }

    /** Walks from each element by the key until the end or the `until` element */
    #walk(
        key: SiblingKey | "parentElement",
        until: Until,
        filter: Filter | null | undefined,
        once = false,
    ) {
        return this.#collect(function* walk(el) {
            for (let cur = el[key]; cur && !isUntil(cur, until); cur = cur[key]) {
                yield cur;
                if (once) break;
            }
        }, filter);
    }

    // #region manipulation

    /** Inserts the nodes into each element, when there are several elements, inserts clones */
    #insert(method: "append" | "prepend" | "after" | "before", nodes: Insertable[]) {
        const last = this.length - 1;
        this.forEach((el, i) => {
            el[method](
                ...(i === last
                    ? nodes
                    : nodes.map((node) =>
                          typeof node === "string" ? node : node.cloneNode(true),
                      )),
            );
        });
        return this;
    }

    /** Inserts the nodes at the end of each element */
    append(...nodes: Insertable[]) {
        return this.#insert("append", nodes);
    }

    /** Inserts the nodes at the beginning of each element */
    prepend(...nodes: Insertable[]) {
        return this.#insert("prepend", nodes);
    }

    /** Inserts the nodes after each element */
    after(...nodes: Insertable[]) {
        return this.#insert("after", nodes);
    }

    /** Inserts the nodes before each element */
    before(...nodes: Insertable[]) {
        return this.#insert("before", nodes);
    }

    /** Removes the elements from DOM */
    remove() {
        for (const el of this) el.remove();
        return this;
    }

    // #endregion

    // #region traversing

    /** Children of each element, optionally filtered */
    children(filter?: Filter) {
        return this.#collect((el) => el.children, filter);
    }

    /** The closest ancestor-or-self of each element matching the selector */
    closest(selector: string) {
        return DomSet.wrap(this.map((el) => el.closest(selector)));
    }

    /**
     * Descendants of each element matching the selector.
     * Unlike jQuery, the selector isn't scoped to the element, use `:scope` when needed.
     * With a function, it's the regular `Array.prototype.find`.
     */
    override find(selector: string): DomSet;
    override find<S extends HTMLElement>(
        predicate: (value: HTMLElement, index: number, obj: HTMLElement[]) => value is S,
        thisArg?: any,
    ): S | undefined;
    override find(
        predicate: (value: HTMLElement, index: number, obj: HTMLElement[]) => unknown,
        thisArg?: any,
    ): HTMLElement | undefined;
    override find(
        selectorOrPredicate:
            | string
            | ((value: HTMLElement, index: number, obj: HTMLElement[]) => unknown),
        thisArg?: any,
    ) {
        if (typeof selectorOrPredicate !== "string") {
            return super.find(selectorOrPredicate, thisArg);
        }
        return this.#collect((el) => el.querySelectorAll(selectorOrPredicate));
    }

    /** The next sibling of each element, optionally filtered */
    next(filter?: Filter) {
        return this.#walk("nextElementSibling", null, filter, true);
    }

    /** All the following siblings of each element, optionally filtered */
    nextAll(filter?: Filter) {
        return this.#walk("nextElementSibling", null, filter);
    }

    /** The following siblings of each element up to, but not including, `until` */
    nextUntil(until?: Until, filter?: Filter) {
        return this.#walk("nextElementSibling", until, filter);
    }

    /** The parent of each element, optionally filtered */
    parent(filter?: Filter) {
        return this.#walk("parentElement", null, filter, true);
    }

    /** All the ancestors of each element, optionally filtered */
    parents(filter?: Filter) {
        return this.#walk("parentElement", null, filter);
    }

    /** The ancestors of each element up to, but not including, `until` */
    parentsUntil(until?: Until, filter?: Filter) {
        return this.#walk("parentElement", until, filter);
    }

    /** The previous sibling of each element, optionally filtered */
    prev(filter?: Filter) {
        return this.#walk("previousElementSibling", null, filter, true);
    }

    /** All the preceding siblings of each element, optionally filtered */
    prevAll(filter?: Filter) {
        return this.#walk("previousElementSibling", null, filter);
    }

    /** The preceding siblings of each element up to, but not including, `until` */
    prevUntil(until?: Until, filter?: Filter) {
        return this.#walk("previousElementSibling", until, filter);
    }

    /** Siblings of each element, excluding the element itself, optionally filtered */
    siblings(filter?: Filter) {
        return this.#collect(
            (el) => [...(el.parentElement?.children ?? [])].filter((sib) => sib !== el),
            filter,
        );
    }

    // #endregion

    // #region filtering

    /** Whether any element matches the selector, is the element, or passes the predicate */
    is(filter: Filter) {
        return this.some((el, i) => matches(el, filter, i));
    }

    /** Elements that have a descendant matching the selector or being the given node */
    has(target: string | Node) {
        return this.#filter((el) =>
            typeof target === "string"
                ? el.querySelector(target) !== null
                : el !== target && el.contains(target),
        );
    }

    /** Set with only the first element */
    first() {
        return DomSet.wrap(this.slice(0, 1));
    }

    // #endregion
}

/**
 * Micro jQuery - only traversing and DOM some manipulations
 * @param target CSS selector (queried in the document), an element, or elements
 */
export default function $(target?: Target) {
    if (target == null) return new DomSet();
    if (typeof target === "string") return DomSet.wrap(document.querySelectorAll(target));
    if (target instanceof Element) return DomSet.wrap([target]);
    return DomSet.wrap(target);
}
