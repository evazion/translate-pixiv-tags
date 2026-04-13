// https://gist.github.com/monperrus/999065
// This is a shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest.
// This allows us to use $.getJSON instead of using GM_xmlhttpRequest directly.
//
// This is necessary because some sites (e.g. Twitter, DeviantArt) have a
// Content Security Policy that blocks us from making cross-origin requests to
// Danbooru. Tampermonkey allows us to bypass the CSP, but only if we use GM_xmlhttpRequest.
//

import { GM } from "$";
import $ from "jquery";

// This implements only essential parts of XMLHttpRequest
class GM_XHR {
    type: "GET" | "HEAD" | "POST" = "GET";
    url: string | URL = ".";
    async: boolean | null = null;
    username: string | null = null;
    password: string | null = null;
    status = 0;
    statusText = "";
    readyState = 0;
    headers: Record<string, string> = {};
    responseHeaders = "";
    responseText = "";
    responseType: XMLHttpRequestResponseType = "text";
    xmlhttpRequest: typeof GM.xmlHttpRequest;

    onabort: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
    onerror: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
    onload: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
    onloadend: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
    onloadstart: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
    onprogress: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
    ontimeout: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null = null;
    onreadystatechange: ((this: XMLHttpRequest, ev: Event) => any) | null = null;

    constructor(xmlhttpRequest: typeof GM.xmlHttpRequest) {
        this.xmlhttpRequest = xmlhttpRequest;
    }
    abort() {
        this.readyState = 0;
    }

    getAllResponseHeaders() {
        if (this.readyState != 4) return "";
        return this.responseHeaders;
    }

    getResponseHeader(name: string) {
        const regexp = new RegExp(`^${name}: (.*)$`, "im");
        const match = regexp.exec(this.responseHeaders);
        if (match) {
            return match[1];
        }
        return null;
    }

    open(
        type: "GET" | "HEAD" | "POST",
        url: string | URL,
        async?: boolean,
        username?: string | null,
        password?: string | null,
    ) {
        this.type = type;
        this.url = url;
        this.async = async || null;
        this.username = username || null;
        this.password = password || null;
        this.readyState = 1;
    }

    setRequestHeader(name: string, value: string) {
        this.headers[name] = value;
    }

    onresponse<
        E extends
            | "onabort"
            | "onerror"
            | "onload"
            | "onloadstart"
            | "onprogress"
            | "onreadystatechange"
            | "ontimeout",
    >(handler: E): Tampermonkey.Request[E] {
        const xhr = this;

        return function (resp?: Tampermonkey.ResponseBase) {
            if (resp) {
                xhr.readyState = resp.readyState;
                xhr.responseHeaders = resp.responseHeaders;
                xhr.responseText = resp.responseText;
                xhr.status = resp.status;
                xhr.statusText = resp.statusText;
            }

            const evt = new ProgressEvent(handler);

            if (xhr[handler]) {
                xhr[handler].call(xhr as any, evt);
            } else {
                (xhr as any).onreadystatechange?.(evt);
            }
        };
    }

    send(body?: string | null) {
        const tlsDomain = new URL(this.url).hostname.split(".").slice(-2).join(".");
        this.xmlhttpRequest({
            fetch: true, // TM only - better `onerror` work
            timeout: 15_000, // to prevent hanging requests
            method: this.type || undefined,
            url: this.url.toString(),
            headers: this.headers,
            data: body || undefined,
            responseType:
                this.responseType === "document" || this.responseType === "text"
                    ? undefined
                    : this.responseType || undefined,
            onload: this.onresponse("onload"),
            onerror: this.onresponse("onerror"),
            ontimeout: this.onresponse("onerror") as () => void,
            cookiePartition: {
                topLevelSite: `https://${tlsDomain}`,
            },
        });
    }
}

export default function GMjQuerySetup() {
    // https://www.greasespot.net/2017/09/greasemonkey-4-for-script-authors.html
    // In Greasemonkey 4+ / Tampermonkey 4.5+, use GM.xmlHttpRequest. In earlier
    // versions, use GM_xmlhttpRequest.
    $.ajaxSetup({ xhr: () => new GM_XHR(GM.xmlHttpRequest) as any });
}
