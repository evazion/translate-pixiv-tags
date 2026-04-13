import { GM } from "$";
import $ from "jquery";
import { SETTINGS } from "./settings";
import showMessage from "./tooltips/message";

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
export function tooManyNetworkErrors(domain: string, logError: boolean = false) {
    const data = networkErrors[domain] ?? (networkErrors[domain] = { error: 0 });

    if (logError) {
        console.log("[TPT]: Total errors:", data.error);
        data.error += 1;
    }
    if (data.error < MAX_NETWORK_ERRORS) return false;
    if (logError) {
        if (data.error === MAX_NETWORK_ERRORS) {
            setTimeout(() => {
                console.log("[TPT]: Errors reset");
                data.error = 0;
            }, RETRY_REQUEST_INTERVAL);
        }
        console.error(
            "[TPT]: Maximum number of errors exceeded",
            MAX_NETWORK_ERRORS,
            "for",
            domain,
        );
    }
    return true;
}

export type UrlParams = { [k: string]: string | number | boolean | string[] | UrlParams };

/**
 * @param method
 * @param url
 * @param data
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function makeRequest(method: string, url: string, data: UrlParams) {
    const domain = new URL(url).hostname;
    const sleep = () =>
        new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    if (tooManyNetworkErrors(domain)) {
        throw new Error(`${domain} had too many network errors`);
    }
    let status = -1;
    let statusText = "";
    let errorMsg;

    for (let i = 0; i < MAX_NETWORK_RETRIES; i++) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const resp = await GM.xmlHttpRequest({
                url,
                method,
                responseType: "json",
                data: $.param(data),
            });
            showMessage("", domain);
            return resp.response;
        } catch (error) {
            tooManyNetworkErrors(domain, true);
            ({ status, statusText } = error as XMLHttpRequest);
            console.error(
                "[TPT]: Failed try #",
                i + 1,
                "\nURL:",
                url,
                "\nParameters:",
                data,
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
            // eslint-disable-next-line no-await-in-loop
            await sleep();
        }
    }
    throw new Error(errorMsg);
}
