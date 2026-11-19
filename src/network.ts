import { GM } from "$";
import { SETTINGS } from "./settings";
import showMessage from "./tooltips/message";
import { console, param, sleep } from "./utils";

// The maximum size of a URL before using a POST request.
// The actual limit is 8154, but setting it lower accounts for the rest of the URL as well.
// Seems like Danbooru's limit is 6577 of unencoded data, so, with space for encoding, let it be 4k.
// It's preferable to use a GET request when able since GET supports caching and POST does not.
export const MAXIMUM_URI_LENGTH = 4000;

// For network error management
const MAX_NETWORK_ERRORS = 12;
const MAX_NETWORK_RETRIES = 3;
const RETRY_REQUEST_INTERVAL = 30_000; // in ms

/** Get the image as blob-link in CORS-safe way */
export async function getImage(imageUrl: string): Promise<string> {
    const resp = await GM.xmlHttpRequest({
        method: "GET",
        url: imageUrl,
        responseType: "blob",
    });
    return URL.createObjectURL(resp.response);
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

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function ajax<M extends string>(
    method: M,
    url: string,
    params?: Uppercase<M> extends "GET" | "HEAD" ? UrlParams : BodyInit,
    headers?: Record<string, string>,
) {
    const domain = new URL(url).hostname;
    if (tooManyNetworkErrors(domain)) {
        throw new Error(`${domain} had too many network errors`);
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
                statusText,
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
                await sleep(1000);
            }
        }
    }
    throw new Error(errorMsg);
}

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
