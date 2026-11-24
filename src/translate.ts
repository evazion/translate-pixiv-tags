import { IQuery, MutationSummary } from "mutation-summary";
import $ from "./dom";
import { render } from "lit-html";
import { ADAPTERS, SETTINGS } from "./settings";
import { addCss, console } from "./utils";
import { TAG_POSITIONS, TAG_SELECTOR } from "./sites/shared";
import { normalizeProfileUrl } from "./normalize-url";
import simplifySelector from "./simplify-selector";
import { addCleanup } from "./lifecycle";

let translators: Adapter[];

const loggedMisses = new Set<string>();

type TranslationRequest = {
    params: string[];
    /** Per translator: item name -> its renderer */
    groups: Array<Map<string, TranslatedItem[1]>>;
    attr: string | null;
    /** Aborted when the translation isn't needed anymore, its signal is passed to translators */
    controller: AbortController;
    /** Number of the translations still waiting for the translators */
    pending: number;
};

/** Params key of the latest translation request per target and container class */
let translationsRequests = new WeakMap<HTMLElement, TranslationRequest>();

/** How often to check whether the targets of pending translations are still in the page, in ms */
const SWEEP_INTERVAL = 2000;
/** Targets of the translations waiting for the translators */
const pendingTranslations = new Map<HTMLElement, TranslationRequest>();
let sweepTimer: number | null = null;

/** Aborts the pending translations whose targets were removed from the page */
function sweepRemovedTargets() {
    for (const [target, request] of pendingTranslations) {
        if (target.isConnected) continue;
        pendingTranslations.delete(target);
        // translate the target again if it's inserted back
        if (translationsRequests.get(target) === request) translationsRequests.delete(target);
        request.controller.abort();
    }
    if (pendingTranslations.size === 0) stopSweep();
}

function stopSweep() {
    if (sweepTimer === null) return;
    clearInterval(sweepTimer);
    sweepTimer = null;
}

function trackPending(target: HTMLElement, request: TranslationRequest) {
    request.pending += 1;
    pendingTranslations.set(target, request);
    sweepTimer ??= setInterval(sweepRemovedTargets, SWEEP_INTERVAL);
}

function untrackPending(target: HTMLElement, request: TranslationRequest) {
    request.pending -= 1;
    if (request.pending > 0 || pendingTranslations.get(target) !== request) return;
    pendingTranslations.delete(target);
    if (pendingTranslations.size === 0) stopSweep();
}

/**
 * Translate a regular tag on the given element
 * @param target The element to attach translation
 * @param tagNames The tag name to translate
 * @param options Translation options
 */
async function translateTag(
    target: HTMLElement,
    tagNames: string[],
    options: TranslationOptionsFull,
) {
    // Wiki other names cannot contain spaces
    const normalizedTags = tagNames.map((tag) =>
        tag.normalize("NFKC").trim().replace(/^#/, "").replaceAll(/\s/g, "_").toLocaleLowerCase(),
    );

    try {
        await translate(
            target,
            "translateTag",
            normalizedTags,
            "tpt-tags",
            `Couldn't translate tag`,
            options,
        );
    } catch (ex) {
        console.error("Failed to translate tag", normalizedTags, "for", target, ex);
    }
}

async function translateArtistByName(
    target: HTMLElement,
    artistNames: string[],
    options: TranslationOptionsFull,
) {
    try {
        await translate(
            target,
            "translateArtistByName",
            artistNames,
            "tpt-artists",
            "Couldn't find artist",
            options,
        );
    } catch (ex) {
        console.error("Failed to translate artist", artistNames, "for", target, ex);
    }
}

async function translateArtistByUrl(
    target: HTMLElement,
    profileUrls: string[],
    options: TranslationOptionsFull,
) {
    const normalizedUrls = profileUrls.map(normalizeProfileUrl).filter(Boolean);

    try {
        await translate(
            target,
            "translateArtistByUrl",
            normalizedUrls,
            "tpt-artists",
            "Couldn't find artist by url",
            options,
        );
    } catch (ex) {
        console.error("Failed to translate artist", normalizedUrls, "for", target, ex);
    }
}

async function translate(
    target: HTMLElement,
    method: "translateTag" | "translateArtistByName" | "translateArtistByUrl",
    params: string[],
    containerClass: string,
    errorMsg: string,
    options: TranslationOptionsFull,
) {
    if (params.length === 0) return;
    if (translators.every((t) => t[method] === null)) return;

    const {
        onadded = null,
        tagPosition: {
            insertTag = TAG_POSITIONS.afterend.insertTag,
            findTag = TAG_POSITIONS.afterend.findTag,
        },
        ruleName,
    } = options;
    const { classes = "" } = options;

    const paramKey = params.join("\0");
    const attrKey =
        options.requiredAttributes
            ?.split(" ")
            .map((attr) => (attr === "#text" ? target.textContent : target.getAttribute(attr)))
            .join("\0") ?? null;

    let translationRequest = translationsRequests.get(target);
    let replacedRequest: TranslationRequest | undefined;
    if (translationRequest?.attr === attrKey) {
        // already was called with this params
        if (translationRequest.params.includes(paramKey)) {
            return;
        }
    } else {
        replacedRequest = translationRequest;
        translationRequest = {
            attr: attrKey,
            params: [paramKey],
            groups: translators.map(() => new Map()),
            controller: new AbortController(),
            pending: 0,
        };
        translationsRequests.set(target, translationRequest);
    }
    const groups = translationRequest.groups;
    const { signal } = translationRequest.controller;
    const translatorOptions: TranslatorOptions = { signal };

    trackPending(target, translationRequest);
    const waitTranslations = Promise.all(
        translators.map((t) =>
            Promise.all(params.map((param) => t[method]?.(param, translatorOptions))),
        ),
    );
    // Abort the replaced translation only after the new one is requested,
    // so the shared requests needed by both aren't dropped
    replacedRequest?.controller.abort();

    let translations;
    try {
        translations = await waitTranslations;
    } catch (error) {
        // the translation isn't needed anymore
        if (signal.aborted) return;
        throw error;
    } finally {
        untrackPending(target, translationRequest);
    }

    if (translationsRequests.get(target) !== translationRequest) {
        return;
    }

    if (translations.flat(2).filter(Boolean).length === 0) {
        // do not store misses if logging is disabled
        if (SETTINGS.debug) {
            const msg = `${errorMsg} "${params.join(", ")}", rule "${ruleName}"`;
            if (!loggedMisses.has(msg)) {
                loggedMisses.add(msg);
                console.info(msg);
            }
        }
        return;
    }

    let changed = false;
    for (let i = 0; i < translations.length; i++) {
        const subgroup = groups[i];
        for (const [name, render] of translations[i].flatMap((items) => items ?? [])) {
            if (subgroup.has(name)) continue;
            subgroup.set(name, render);
            changed = true;
        }
    }
    if (!changed) return;

    // items with the same name from different translators show the name only once
    const mergedGroups = new Map<string, Renderable[]>();
    for (const subgroup of groups) {
        for (const [name, render] of subgroup) {
            const group = mergedGroups.get(name);
            if (group) {
                group.push(render(true));
            } else {
                mergedGroups.set(name, [render(false)]);
            }
        }
    }

    const container = findTag(target) ?? document.createElement("span");
    container.className = `${containerClass} ${classes}`;
    container.dataset.rule = ruleName;
    container.innerHTML = "";

    // items within a group are spaced via CSS
    const template = new DocumentFragment();
    render(
        [...mergedGroups.values()].flatMap((group, i) => (i === 0 ? group : [", ", ...group])),
        template,
    );
    container.append(template);

    insertTag(target, container);

    onadded?.(container, options);
}

function patchCss(css: CSSStyleSheet | CSSGroupingRule | undefined, ruleName: string) {
    if (!css) return;
    for (let len = css.cssRules.length, i = 0; i < len; i++) {
        const rule = css.cssRules[i];
        // at-rules like @media have no selector, but may contain style rules
        if ("selectorText" in rule) patchSelector(rule as CSSStyleRule, ruleName);
        if ("cssRules" in rule) patchCss(rule as CSSGroupingRule, ruleName);
    }
}

function patchSelector(rule: CSSStyleRule, ruleName: string) {
    if (rule.selectorText.includes("ARTIST_TAG")) {
        rule.selectorText = rule.selectorText.replaceAll(
            "ARTIST_TAG",
            `.tpt-artists[data-rule="${ruleName}"]`,
        );
    }
    if (rule.selectorText.includes("TPT_TAG")) {
        rule.selectorText = rule.selectorText.replaceAll(
            "TPT_TAG",
            `.tpt-tags[data-rule="${ruleName}"]`,
        );
    }
}

export function createTranslators() {
    translators = SETTINGS.data_sources.flatMap((source) => {
        if (!ADAPTERS[source.adapter]) {
            console.error(`Missing ${source.adapter} adapter!`);
            return [];
        }
        let translator: Adapter;
        try {
            translator = new ADAPTERS[source.adapter](source.param);
        } catch (error) {
            // e.g. an invalid param, skip only this source
            console.error(`Failed to create ${source.adapter} adapter:`, error);
            return [];
        }
        if (!source.translateArtist) {
            translator.translateArtistByName = null;
            translator.translateArtistByUrl = null;
        }
        if (!source.translateTag) {
            translator.translateTag = null;
        }
        return translator;
    });
}

const mutationObserverQueries: Array<[IQuery, (el: Node) => void]> = [];

export const findAndTranslate: FindAndTranslate = function findAndTranslate(
    mode,
    selector,
    options,
    ruleName,
) {
    const fullOptions: TranslationOptionsFull = {
        asyncMode: false,
        requiredAttributes: null,
        predicate: null,
        toProfileUrl: (el): any => el.closest("a")?.href,
        toTagName: (el) => el.textContent,
        tagPosition: TAG_POSITIONS.afterend,
        classes: "",
        css: null,
        onadded: null,
        mode,
        ...options,
        ruleName,
    };

    const { predicate } = fullOptions;
    const canTranslate = (el: HTMLElement) =>
        (typeof selector === "string" ? el.matches(selector) : el === selector) &&
        (!predicate || predicate(el));

    const { translate, getData } = {
        artist: {
            translate: translateArtistByUrl,
            getData: fullOptions.toProfileUrl,
        },
        artistByName: {
            translate: translateArtistByName,
            getData: fullOptions.toTagName,
        },
        tag: {
            translate: translateTag,
            getData: fullOptions.toTagName,
        },
    }[mode];

    const tryToTranslate = (elem: Node) => {
        if (!(elem instanceof HTMLElement)) return;
        if (!canTranslate(elem)) return;
        const data = getData(elem);
        if (data) {
            translate(elem, Array.isArray(data) ? data : [data], fullOptions);
        }
    };

    if (fullOptions.css) {
        patchCss(fullOptions.css.styleSheet, fullOptions.ruleName);
        addCss(fullOptions.css);
    }

    $(selector).forEach(tryToTranslate);

    if (!fullOptions.asyncMode) return;

    const query: IQuery = { element: simplifySelector(selector as string) };
    if (fullOptions.requiredAttributes) query.elementAttributes = fullOptions.requiredAttributes;
    mutationObserverQueries.push([query, tryToTranslate]);
};

let mutationObserver: MutationSummary | null = null;

/**
 * Share MutationSummary (and the underling MutationObserver) between all the queries (rules)
 */
export function startFindAndTranslate() {
    if (mutationObserverQueries.length === 0) return;

    mutationObserver = new MutationSummary({
        rootNode: document.body,
        queries: mutationObserverQueries.map((arr) => arr[0]),
        callback: (summaries) => {
            for (const [i, summary] of summaries.entries()) {
                const translate = mutationObserverQueries[i][1];
                for (const elem of summary.added) translate(elem);

                if (summary.attributeChanged) {
                    for (const elements of Object.values(summary.attributeChanged)) {
                        for (const elem of elements) translate(elem);
                    }
                }
            }
        },
    });
}

addCleanup(() => {
    // abort them after the restart, so the shared requests needed again aren't dropped
    const abandoned = [...pendingTranslations.values()];
    pendingTranslations.clear();
    stopSweep();

    mutationObserverQueries.length = 0;
    mutationObserver?.disconnect();
    translators.forEach((t) => {
        try {
            t.destroy();
        } catch (ex) {
            console.error(ex);
        }
    });
    translators = [];
    $(TAG_SELECTOR).remove();
    loggedMisses.clear();
    translationsRequests = new WeakMap();

    queueMicrotask(() => {
        for (const request of abandoned) request.controller.abort();
    });
});
