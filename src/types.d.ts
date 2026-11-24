// we cannot use usual import because then the types won't be global
declare namespace _lit {
    type CSSResult = import("@lit/reactive-element").CSSResult;
    type TemplateResult = import("lit-html").TemplateResult;
    type Renderable = TemplateResult | string | number | boolean | null | undefined;
}

/** The result returned by `css` or `unsafeCSS` */
type CSSResult = _lit.CSSResult;
type Renderable = _lit.Renderable;
type RenderableChunk = _lit.Renderable | Array<_lit.Renderable> | Iterable<_lit.Renderable>;

type Theme = "dark" | "light" | "auto";
type Rating = "g" | "s" | "q" | "e";

type TagPosition = {
    /** Adds the tag  around the container */
    insertTag: (container: HTMLElement, elem: HTMLElement) => void;
    /** Finds a tag around the container */
    findTag: (container: HTMLElement) => HTMLElement | null;
    /** Get the tag's container */
    getTagContainer: (elem: HTMLElement) => HTMLElement | null;
};

interface TranslationOptions {
    /** Method of translating */
    mode: "tag" | "artist" | "artistByName";
    /** Watch for new entries to translate, by default - no */
    asyncMode?: boolean;
    /** Required attributes on the element, also used know when the element starts to refer another artist */
    requiredAttributes?: string | null;
    /** Checks whether the element, matching the selector, should be translated */
    predicate?: ((el: HTMLElement) => boolean) | null;
    /** Extracts the link to the profile from the element, by default - `href` from closest `<a>` */
    toProfileUrl?: (el: HTMLElement) => string | string[] | null;
    /** Extracts the tag name from the element, by default - the element's text */
    toTagName?: (el: HTMLElement) => string | string[] | null;
    /** Methods for inserting and retrieving the tag element relatively to
     * the matched element, by default it's `afterend` */
    tagPosition?: TagPosition;
    /** Extra classes to add to the tag element */
    classes?: string;
    /** CSS related to this rule, special selectors `ARTIST_TAG` and `TPT_TAG` will match only this rule's tags */
    css?: CSSResult | null;
    /** Handler for the added tag elements */
    onadded?: ((el: HTMLElement, options: TranslationOptionsFull) => void) | null;
}
type TranslationOptionsFull = Required<TranslationOptions> & {
    /** Name of rule, also used to unequally select the tag */
    ruleName: string;
};

/** Options passed to the translators (adapters) */
type TranslatorOptions = {
    /**
     * Aborted when the translation isn't needed anymore:
     * the target was removed from the page or its translation was replaced by a newer one.
     * Translators should stop (re)sending requests needed only for this translation.
     */
    signal: AbortSignal;
};

/**
 * Add translations to the matched elements
 * @param mode Method of translating the element
 * @param selector CSS selector or the element to translate.
 *  In `asyncMode`, new elements are watched by a simplified version of the selector
 *  (see `simplifySelector`) and then checked against the full selector.
 * @param options Extra options for translating
 * @param ruleName Just a name of rule for translations
 */
type FindAndTranslate = <M extends TranslationOptions["mode"], S extends string | HTMLElement>(
    mode: M,
    selector: S,
    options: M extends "artist"
        ? Omit<TranslationOptions, "mode" | "toTagName"> &
              (S extends HTMLElement ? { asyncMode?: false } : { asyncMode?: boolean })
        : Omit<TranslationOptions, "mode" | "toProfileUrl"> &
              (S extends HTMLElement ? { asyncMode?: false } : { asyncMode?: boolean }),
    ruleName: string,
) => void;

/** Item name and its renderer, which omits the text when `textless` is true */
type TranslatedItem = [string, (textless: boolean) => Renderable];
type TranslationResult = TranslatedItem[];

class Adapter {
    /** Adapter name */
    static name: string;

    static validateParams(params: string): Promise<void>;

    constructor(params: string): any;

    destroy();

    translateArtistByUrl:
        | ((url: string, options: TranslatorOptions) => Promise<TranslationResult>)
        | null;

    translateArtistByName:
        | ((name: string, options: TranslatorOptions) => Promise<TranslationResult>)
        | null;

    translateTag: ((name: string, options: TranslatorOptions) => Promise<TranslationResult>) | null;
}
