// we cannot use usual import because then the types won't be global
declare module _lit {
    interface _ {
        CSSResult: import("lit").CSSResult;
        TemplateResult: import("lit").TemplateResult;
    }
    type Renderable = _["TemplateResult"] | string | number | boolean | null | undefined;
    type CSSResult = _["CSSResult"];
}

// prevent usage of non-imported jQuery
declare const $: never;

type Renderable = _lit.Renderable | Array<_lit.Renderable> | Iterable<_lit.Renderable>;

type Theme = "dark" | "light" | "auto";
type Rating = "g" | "s" | "q" | "e";

type TagPosition = {
    /** Adds the tag  around the container */
    insertTag: ($container: JQuery, elem: JQuery | HTMLElement) => void;
    /** Finds a tag around the container */
    findTag: ($container: JQuery) => JQuery;
    /** Get the tag's container */
    getTagContainer: ($elem: JQuery) => JQuery;
};

interface TranslationOptions {
    /** Method of translating */
    mode: "tag" | "artist" | "artistByName";
    /** Just a name of rule for translations */
    ruleName: string;
    /** Watch for new entries to translate, by default - no */
    asyncMode?: boolean;
    /** Required attributes on the element */
    requiredAttributes?: string | null;
    /** Checks whether the element should be translated */
    predicate?: string | ((el: HTMLElement) => boolean) | null;
    /** Extracts the link to the profile from the element, by default - `href` from closest `<a>` */
    toProfileUrl?: (el: HTMLElement) => string | string[] | null;
    /** Extracts the tag name from the element, by default - the element's text */
    toTagName?: (el: HTMLElement) => string | null;
    /** Methods for inserting and retrieving the tag element relatively to
     * the matched element, by default it's `afterend` */
    tagPosition?: TagPosition;
    /** Extra classes to add to the tag element */
    classes?: string;
    /** General piece of CSS related to this rule, special selector`ARTIST_TAG` available */
    css?: _lit.CSSResult | null;
    /** Handler for the added tag elements */
    onadded?: ((el: HTMLElement, options: Required<TranslationOptions>) => void) | null;
}
type TranslationOptionsFull = Required<TranslationOptions>;

/**
 * Add translations to the matched elements
 * @param mode Method of translating the element
 * @param selector Simple selector of the translated element.
 *  Max example: `div.class#id[attr][attr2=val], *[attr3~="part"][attr4='val']`
 * @param [options] Extra options for translating
 */
type FindAndTranslate = <T extends TranslationOptions["mode"]>(
    mode: T,
    selector: string | HTMLElement,
    options: T extends "artist"
        ? Partial<Omit<TranslationOptions, "mode" | "toTagName">>
        : Partial<Omit<TranslationOptions, "mode" | "toProfileUrl">>,
) => void;

class Adapter {
    /** Adapter name */
    static name: string;

    static validateParams(params: string): Promise<void>;

    constructor(params: string): any;

    destroy();

    translateArtistByUrl:
        | ((url: string, options: TranslationOptionsFull) => Promise<Renderable>)
        | null;

    translateArtistByName:
        | ((name: string, options: TranslationOptionsFull) => Promise<Renderable>)
        | null;

    translateTag: ((name: string, options: TranslationOptionsFull) => Promise<Renderable>) | null;
}
