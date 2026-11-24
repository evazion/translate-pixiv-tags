import globeRaw from "@fortawesome/fontawesome-free/svgs/solid/globe.svg?raw";
import soundRaw from "@fortawesome/fontawesome-free/svgs/solid/volume-high.svg?raw";
import settingsIconRaw from "./settings-icon.svg?raw";
import { unsafeSVG } from "lit-html/directives/unsafe-svg.js";

export const globeIcon = unsafeSVG(globeRaw);
export const soundIcon = unsafeSVG(soundRaw);
export const settingsIcon = unsafeSVG(settingsIconRaw);

/** data-uri of transparent 1x1 image */
export const TRANSPARENT_IMAGE =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
/** data-uri of danbooru's fallback image with "Download" text */
export const FALLBACK_PREVIEW = `data:image/svg+xml,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 75 75"%3e%3cdefs%3e%3clinearGradient id="a" gradientTransform="rotate(90)"%3e%3cstop offset="0%25" stop-color="white"/%3e%3cstop offset="100%25" stop-color="%23dedede"/%3e%3c/linearGradient%3e%3c/defs%3e%3cpath fill="url(%23a)" stroke="%23929292" d="M0 0h75v75H0z"/%3e%3ctext x="12" y="42" font-family="sans-serif" font-size="10" font-weight="900"%3eDownload%3c/text%3e%3c/svg%3e`;
/** data-uri of flash file icon */
export const FLASH_FILE = `data:image/svg+xml,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720"%3e%3cpath d="M130 10s-22 0-24 30v645s0 25 30 25h450s28 0 28-34V172L472 10Z"/%3e%3cpath d="M135 38v437h450V192H468s-17 0-17-16V38Z" fill="white"/%3e%3cpath d="M257 355c72 11 56-173 166-164v39c-82-8-46 160-166 168Z"/%3e%3cpath d="M336 313h64v-42h-50Z"/%3e%3ctext x="125" y="645" font-family="sans-serif" font-size="152" font-weight="700" fill="white"%3eFLASH%3c/text%3e%3c/svg%3e`;
