import { until } from "lit-html/directives/until.js";
import { getImage } from "../network";
import { DOMAIN_USES_CSP } from "../settings";
import { TRANSPARENT_IMAGE } from "../resource/assets";

export {
    TRANSPARENT_IMAGE,
    FALLBACK_PREVIEW,
    FLASH_FILE,
    globeIcon,
    soundIcon,
} from "../resource/assets";

/**
 * Format time in relative form
 * @param time Timestamp
 */
export function timeToAgo(time: number | string) {
    const interval = new Date(Date.now() - new Date(time).getTime());
    if (interval.getTime() < 60_000) return "less than a minute ago";
    const ranks = [
        {
            value: interval.getUTCFullYear() - 1970,
            unit: "year",
        },
        {
            value: interval.getUTCMonth(),
            unit: "month",
        },
        {
            value: interval.getUTCDate() - 1,
            unit: "day",
        },
        {
            value: interval.getUTCHours(),
            unit: "hour",
        },
        {
            value: interval.getUTCMinutes(),
            unit: "minute",
        },
    ];
    const rank = ranks.find(({ value }) => value);
    if (rank?.value) {
        return `${rank.value} ${rank.unit}${rank.value > 1 ? "s" : ""} ago`;
    }
    return "∞ ago";
}

/**
 * Format time in MM:SS format
 * @param seconds
 */
export function formatDuration(seconds: number) {
    const sec = Math.round(seconds) || 1;

    const mm = Math.floor((sec / 60) % 60);
    const ss = String(sec % 60).padStart(2, "0");

    return `${mm}:${ss}`;
}

/**
 * Format file size in CI units
 * @param bytes
 * @see https://stackoverflow.com/questions/15900485
 */
export function formatBytes(bytes: number) {
    const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Number.parseFloat((bytes / 1024 ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * A lit directive to load image safely on domains with strict CSP
 * @param src - the resource to fetch
 * @param force - whether the resource requires CORS
 */
export function corsSrc(src: string, force?: boolean) {
    if (DOMAIN_USES_CSP || force) {
        return until(
            getImage(src).then((url) => url ?? TRANSPARENT_IMAGE),
            TRANSPARENT_IMAGE,
        );
    }
    return src;
}
