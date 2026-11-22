import { GM } from "$";
import { DOMAIN_USES_CSP, SETTINGS } from "./settings";
import showMessage from "./tooltips/message";
import { console, param, sleep } from "./utils";

/** transparent 1x1 image */
export const TRANSPARENT_IMAGE =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// The maximum size of a URL before using a POST request.
// The actual limit is 8154, but setting it lower accounts for the rest of the URL as well.
// Seems like Danbooru's limit is 6577 of unencoded data, so, with space for encoding, let it be 4k.
// It's preferable to use a GET request when able since GET supports caching and POST does not.
export const MAXIMUM_URI_LENGTH = 4000;

// For network error management
const MAX_NETWORK_ERRORS = 12;
const MAX_NETWORK_RETRIES = 3;
const RETRY_REQUEST_INTERVAL = 30_000; // in ms

// native base64 encoding is too new for TS
type Base64Uint8Array = Uint8Array<ArrayBuffer> & { toBase64?: () => string };

function bytesToBase64(bytes: Base64Uint8Array): string {
    if (bytes.toBase64) return bytes.toBase64();
    // convert by chunks, as too many arguments overflow the call stack
    const CHUNK_SIZE = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
    }
    return btoa(binary);
}

/**
 * Converts the image data to a data URL, which, unlike a blob URL, needs no revoking
 * @param data - the image data
 * @param responseHeaders - the response headers to take the image type from
 */
export function toDataUrl(data: ArrayBuffer, responseHeaders: string) {
    const type = /^content-type:\s*(image\/[^;\s]+)/im.exec(responseHeaders)?.[1] ?? "image/png";
    return `data:${type};base64,${bytesToBase64(new Uint8Array(data))}`;
}

/**
 * Get the image as a data URL in CORS-safe way
 * @param imageUrl - the image to load
 * @returns the data URL, or null if failed to load the image
 */
export async function getImage(imageUrl: string): Promise<string | null> {
    try {
        const resp = await GM.xmlHttpRequest({
            method: "GET",
            url: imageUrl,
            responseType: "arraybuffer",
        });
        if (resp.status >= 400) throw new Error(`${resp.status} ${resp.statusText}`);
        return toDataUrl(resp.response, resp.responseHeaders);
    } catch (error) {
        console.error("Failed to load image", imageUrl, error);
        return null;
    }
}

const networkErrors: Record<string, { error: number }> = {};

/** Checks whether the number of failed requests to the domain reached the limit */
function tooManyNetworkErrors(domain: string, logError: boolean = false) {
    const data = networkErrors[domain] ?? (networkErrors[domain] = { error: 0 });

    if (logError) {
        console.info("Total errors:", data.error);
        data.error += 1;
    }
    if (data.error < MAX_NETWORK_ERRORS) return false;
    if (logError) {
        if (data.error === MAX_NETWORK_ERRORS) {
            setTimeout(() => {
                console.info("Errors reset");
                data.error = 0;
            }, RETRY_REQUEST_INTERVAL);
        }
        console.error("Maximum number of errors exceeded", MAX_NETWORK_ERRORS, "for", domain);
    }
    return true;
}

const THROTTLE_KEY_PREFIX = "throttle:";
const throttles: Record<string, { amount: number; period: number; queue: Promise<void> }> = {};

/**
 * Waits until a request to the host is allowed by its throttle settings.
 * The log of reserved request slots is kept in the GM storage to be shared across tabs.
 */
function throttle(host: string): Promise<void> {
    const t = throttles[host];
    if (!t) return Promise.resolve();
    const key = THROTTLE_KEY_PREFIX + host;
    // chain the requests of this tab so they don't race each other
    const slot = t.queue.then(async () => {
        let slotTime: number;
        // the GM storage has no atomic operations, so if another tab
        // overwrote the log at the same time, reserve a slot again
        for (;;) {
            const now = Date.now();
            // eslint-disable-next-line no-await-in-loop
            const times = (await GM.getValue<number[]>(key, []))
                .filter((time) => time > now - t.period)
                .sort((a, b) => a - b);
            slotTime =
                times.length < t.amount
                    ? now
                    : Math.max(now, times[times.length - t.amount] + t.period);
            // a fraction of ms to make the entry unique
            slotTime += Math.random();
            times.push(slotTime);
            // eslint-disable-next-line no-await-in-loop
            await GM.setValue(key, times);
            // eslint-disable-next-line no-await-in-loop
            if ((await GM.getValue<number[]>(key, [])).includes(slotTime)) break;
        }
        const wait = slotTime - Date.now();
        if (wait > 0) {
            await sleep(wait);
        }
    });
    // don't break the chain on a storage error
    t.queue = slot.catch(() => {});
    return slot;
}

export type UrlParams = { [k: string]: string | number | boolean | string[] | UrlParams };

/** Error of a failed request, `status` is 0 when the server wasn't reached */
export type RequestError = Error & { status: number };

function requestError(message: string, status: number): RequestError {
    return Object.assign(new Error(message), { status });
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function ajax<M extends string>(
    method: M,
    url: string,
    params?: Uppercase<M> extends "GET" | "HEAD" ? UrlParams : BodyInit,
    headers?: Record<string, string>,
    /** Stops sending (but not a request already sent), rejects with the abort reason */
    signal?: AbortSignal | null,
) {
    signal?.throwIfAborted();
    const domain = new URL(url).hostname;
    if (tooManyNetworkErrors(domain)) {
        throw requestError(`${domain} had too many network errors`, 0);
    }
    let status = -1;
    let statusText = "";
    let errorMsg;
    let data: BodyInit | string | undefined;
    if (params && ["GET", "HEAD"].includes(method.toUpperCase())) {
        url = `${url}${url.includes("?") ? "&" : "?"}${param(params as UrlParams)}`;
    } else if (params) {
        data = params as BodyInit;
    }

    for (let i = 0; i < MAX_NETWORK_RETRIES; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await throttle(domain);
            // the request may be not needed anymore after waiting
            signal?.throwIfAborted();
            // eslint-disable-next-line no-await-in-loop
            const resp = await GM.xmlHttpRequest({
                url,
                method,
                responseType: "json",
                data,
                headers,
            });
            // the request resolves on any HTTP status, only network errors reject it
            if (resp.status >= 400) throw resp;
            showMessage("", domain);
            return resp.response;
        } catch (error) {
            if (signal?.aborted) throw signal.reason;
            tooManyNetworkErrors(domain, true);
            ({ status, statusText } = error as XMLHttpRequest);
            console.error(
                "Failed try #",
                i + 1,
                "\nURL:",
                url,
                "\nParameters:",
                params,
                "\nHTTP Error:",
                status,
                statusText ?? (status === undefined ? error : undefined),
            );
            errorMsg =
                !status || statusText?.startsWith("NetworkError")
                    ? `Failed to connect to ${domain}`
                    : status >= 500
                      ? `Bad response from ${domain}: ${status} ${statusText}`
                      : `Invalid response from ${domain}: ${status} ${statusText}`;
            if (SETTINGS.display_network_errors) {
                showMessage(errorMsg, domain);
            }
            // retrying a client error won't help, except timeout and rate limit
            if (status >= 400 && status < 500 && status !== 408 && status !== 429) break;
            if (i < MAX_NETWORK_RETRIES - 1) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(1000, signal);
            }
        }
    }
    const reached = status > 0 && !statusText?.startsWith("NetworkError");
    throw requestError(errorMsg!, reached ? status : 0);
}

/**
 * Whether the request may succeed if sent later:
 * on network errors, timeout, rate limit, and server errors
 */
ajax.isRetriable = (error: unknown): boolean => {
    const status = (error as Partial<RequestError> | null)?.status;
    return (
        typeof status === "number" &&
        (status === 0 || status === 408 || status === 429 || status >= 500)
    );
};

/** Checks whether a request to the URL can be made right now */
ajax.ready = (url: string): boolean => {
    if (!navigator.onLine) {
        if (SETTINGS.display_network_errors) {
            showMessage("No Internet connection", "");
        }
        return false;
    }
    return !tooManyNetworkErrors(new URL(url).hostname);
};

/**
 * Limits requests to the host to `amount` per `period` seconds across all tabs
 * @param host - the hostname
 * @param amount - max number of requests per period
 * @param period - the period in seconds
 */
ajax.setThrottle = (host: string, amount: number, period: number): void => {
    host = new URL(host).hostname;
    throttles[host] = {
        amount,
        period: period * 1000,
        queue: throttles[host]?.queue ?? Promise.resolve(),
    };
};

const IMAGE_CACHE_PREFIX = "tptImageData:";

/**
 * Get CSP-safe url to an image, caches the image in the local storage
 * @param url - original url
 * @returns - safe url, or a transparent image if failed to load the image
 */
export async function getSafeImageUrl(url: string): Promise<string> {
    if (!DOMAIN_USES_CSP) return url;

    const key = IMAGE_CACHE_PREFIX + url;
    try {
        const cached = localStorage.getItem(key);
        if (cached?.startsWith("data:image/")) return cached;
    } catch (error) {
        console.warn("Failed to read the image cache", url, error);
    }

    const image = await getImage(url);
    if (!image) return TRANSPARENT_IMAGE;
    try {
        localStorage.setItem(key, image);
    } catch (error) {
        // e.g. the storage quota is exceeded, the image works without caching anyway
        console.warn("Failed to cache image", url, error);
    }
    return image;
}
