export type SettingT<N extends string, T> = {
    name: string,
    defValue: T,
    descr: string,
    type: N,
}
export type Setting = SettingT<"number", number>
    | SettingT<"boolean", boolean>
    | SettingT<"list", string> & { values: { [P in string]: string } }

export type SettingType<S extends Setting> = S["type"] extends "boolean" ? boolean
    : S["type"] extends "number" ? number
    : S extends { values: { [P in string]: string } } ? keyof S["values"] : never;

export type GetSetting<S extends Setting, N extends string> = Extract<S, { name: N }>;
export type GetSettingType<S extends Setting, N extends string> = SettingType<GetSetting<S, N>>;

export type Rating = "g"|"s"|"q"|"e"
export type TagPosition = {
    insertTag: ($container: JQuery, $elem: JQuery) => void,
    findTag: ($container: JQuery) => JQuery,
    getTagContainer: ($elem: JQuery) => JQuery,
}
export type TooltipConstructor = (
    elem: HTMLElement,
    contentProvider: (tip: TooltipInstance) => void
) => void
export type TooltipInstance = {
    tooltip: HTMLElement,
    content: HTMLElement,
    target: HTMLElement
}
export interface UrlParams {
    [k: string]: string|number|boolean|string[]|UrlParams
}
export type RequestType = "wiki"|"artist"|"tag"|"alias"|"url"|"post";
export type RequestParams<T extends RequestType> = T extends "post" ? {tag:string,page:number} : string;
export type RequestDefinition<In, Out> = {
    /** api endpoint */
    url: string,
    /** fields to request */
    fields: string,
    /** convert data to request params */
    params: (data: In[]) => UrlParams,
    /** check whether the data is for the passed request */
    matches: (data: Out, item: In) => boolean,
    /** filter items in the responses */
    filter?: (items: Out[]) => Out[],
    /** limit of items in the response */
    limit?: number,
}
export type ResponseWiki = {
    title: string,
    other_names: string[],
    tag: { category: number },
}
export type ResponseArtist = {
    id: number,
    name: string,
    is_banned: boolean,
    other_names: string[],
    urls: Array<{
        url: string,
        is_active: boolean,
    }>,
}
export type ResponseTag = {
    name: string,
    post_count: number,
    category: number,
}
export type ResponseTagAlias = {
    antecedent_name: string,
    consequent_tag: {
        name: string,
        category: number,
        post_count: number,
    },
}
export type ResponseUrl = ResponseArtist & { is_deleted: boolean }
export type MediaAssetVariant = {
    type: string,
    url: string,
    width: number,
    height: number,
    file_ext: string,
}
export type MediaAsset = {
    id: number,
    file_ext: string,
    file_size: number,
    duration: number|null,
    image_width: number,
    image_height: number,
    variants: MediaAssetVariant[],
}
export type ResponsePosts = {
    id: number,
    created_at: string,
    source: string,
    rating: Rating,
    parent_id: number|null,
    is_pending: boolean,
    is_flagged: boolean,
    is_deleted: boolean,
    has_visible_children: boolean,
    tag_string_general: string,
    tag_string_character: string,
    tag_string_copyright: string,
    tag_string_artist: string,
    tag_string_meta: string,
    media_asset: MediaAsset,
}
export type RequestResponse<T extends RequestType> =
    T extends "wiki" ? ResponseWiki :
    T extends "artist" ? ResponseArtist :
    T extends "tag" ? ResponseTag :
    T extends "alias" ? ResponseTagAlias :
    T extends "url" ? ResponseUrl :
    T extends "post" ? ResponsePosts :
    never
export type RequestDefinitions = {
    [K in RequestType]: RequestDefinition<RequestParams<K>, RequestResponse<K>>
}

export interface TranslationOptions {
    /** method of translating */
    mode: "tag" | "artist" | "artistByName",
    /** just a name of rule for translations */
    ruleName: string,
    /** watch for new entries to translate, by default - no */
    asyncMode?: boolean,
    /** required attributes on the element, by default - nothing */
    requiredAttributes?: string | null,
    /** checks whether the element is translatable */
    predicate?: string | ((el:HTMLElement) => boolean) | null,
    /** extracts the link to the profile from the element, by default - `href` from closest `<a>` */
    toProfileUrl?: (el:HTMLElement) => string | string[] | null,
    /** extracts the tag name from the element, by default - the element's text */
    toTagName?: (el:HTMLElement) => string | null,
    /** methods for inserting and retrieving the tag element relatively to the matched element, by default `afterend` */
    tagPosition?: TagPosition,
    /** extra classes to add to the tag element */
    classes?: string,
    /** handler for the added tag elements */
    onadded?: (($el:JQuery, options: Required<TranslationOptions>) => void) | null,
}