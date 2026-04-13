import { parse } from "psl";
import { safeMatchMemoized } from "./utils";

/** Checks whether the url is normalized and optionally normalizes */
interface UrlNormalizer {
    /** For marking all link as invalid */
    valid?: false;
    /** RegExp of a valid path */
    path?: RegExp;
    /** RegExp of a valid params */
    params?: RegExp;
    /** A function to convert url to a valid format */
    normalize?: (url: URL) => string;
}

/** Converts URLs to the same format used by the URL column on Danbooru */
function normalizeUrl(
    targetUrl: string,
    normalizers: Record<string, UrlNormalizer>,
    depth: number = 0,
): { url: string; error: string } {
    if (depth > 10) {
        return {
            url: targetUrl,
            error: `Recursive URL normalization: ${targetUrl}`,
        };
    }
    const url = new URL(targetUrl);
    if (url.protocol !== "https:") url.protocol = "https:";
    let host = url.hostname;
    if (!(host in normalizers)) {
        host = ".".concat(host.split(".").slice(-2).join("."));
    }
    if (!(host in normalizers)) {
        return {
            url: targetUrl,
            error: `Unsupported domain: ${host}`,
        };
    }

    const { valid, path, params, normalize } = normalizers[host];
    if (
        valid === false ||
        (path && !path.test(url.pathname)) ||
        (params && !params.test(url.search))
    ) {
        if (!normalize) {
            return {
                url: targetUrl,
                error: `Normalization isn't implemented: ${targetUrl}`,
            };
        }
        // Normalize and validate the url without infinite loop
        const normalizedUrl = normalize(url);
        if (normalizedUrl === targetUrl) {
            return {
                url: normalizedUrl,
                error: `URL normalized to itself: ${targetUrl}`.trim(),
            };
        }
        return normalizeUrl(normalizedUrl, normalizers, depth + 1);
    }
    let normalizedUrl = url.toString();
    if (normalizedUrl.endsWith("/")) normalizedUrl = normalizedUrl.slice(0, -1);
    return {
        url: normalizedUrl,
        error: "",
    };
}

// #region profile url

const NORMALIZE_PROFILE_URL: Record<string, UrlNormalizer> = {
    ".artstation.com": {
        path: /^\/[\w-]+$/,
        normalize(url) {
            const username = safeMatchMemoized(url.hostname, /([\w-]+)\.artstation\.com/, 1);
            return `https://www.artstation.com/${username}`;
        },
    },
    "baraag.net": {
        path: /^\/@[\w-]+$/,
    },
    "bcy.net": {
        path: /^\/u\/\d+$/,
    },
    "bsky.app": {},
    "ci-en.net": {
        path: /^\/creator\/\d+$/,
    },
    ".deviantart.com": {
        path: /^\/[\w-]+$/,
        normalize(url) {
            const username = safeMatchMemoized(url.hostname, /([\w-]+)\.deviantart\.com/, 1);
            return `https://www.deviantart.com/${username}`;
        },
    },
    ".fanbox.cc": { path: /^\/$/ },
    "fantia.jp": {
        path: /^\/(\w+|fanclubs\/\d+)$/,
    },
    "www.hentai-foundry.com": {
        path: /^\/user\/[\w-]+$/,
        normalize(url) {
            const username = safeMatchMemoized(url.pathname, /\/user\/([\w-]+)(\/profile)?/, 1);
            return `https://www.hentai-foundry.com/user/${username}`;
        },
    },
    "medibang.com": {},
    "misskey.art": {
        path: /^\/@\w+$/,
    },
    "misskey.design": {
        path: /^\/@\w+$/,
    },
    "misskey.io": {
        path: /^\/@\w+$/,
    },
    "seiga.nicovideo.jp": {
        path: /^\/user\/illust\/\d+$/,
    },
    "www.nicovideo.jp": {
        path: /^\/user\/\d+$/,
    },
    "nijie.info": {
        path: /^\/members\.php$/,
        params: /id=\d+/,
    },
    "pawoo.net": {
        path: /^\/@[\w-]+$/,
    },
    "www.pixiv.net": {
        path: /^\/users\/\d+$/,
        normalize(url) {
            const userId =
                url.pathname === "/member.php"
                    ? safeMatchMemoized(url.search, /id=(\d+)/, 1)
                    : safeMatchMemoized(url.pathname, /(?:\/en)?\/users\/(\d+)/, 1);
            return `https://www.pixiv.net/users/${userId}`;
        },
    },
    "skeb.jp": {
        path: /^\/@\w+$/,
    },
    "www.tinami.com": {
        path: /^\/creator\/profile\/\d+$/,
    },
    "twitter.com": {
        valid: false,
        normalize(url) {
            return `https://x.com${url.pathname}`;
        },
    },
    "mobile.twitter.com": {
        valid: false,
        normalize(url) {
            return `https://x.com${url.pathname}`;
        },
    },
    "www.weibo.com": {
        path: /^\/([pu]\/\d+)|(n\/)/,
    },
    ".weibo.com": {
        valid: false,
        normalize(url) {
            return `https://www.weibo.com${url.pathname}`;
        },
    },
    "x.com": {
        path: /^\/[\w-]+|\/i\/user\/\d+$/,
    },
    "www.xiaohongshu.com": {
        valid: false,
        normalize(url) {
            return `https://www.xiaohongshu.com${url.pathname}`;
        },
    },
};

/** Converts URLs to the same format used by the URL column on Danbooru */
export function normalizeProfileUrl(profileUrl: string): string {
    const { url, error } = normalizeUrl(profileUrl.toLowerCase(), NORMALIZE_PROFILE_URL);
    if (error) {
        console.error("[TPT]:", error);
    }
    return url;
}

// #endregion

// #region ruby-case

type RCCond = string | RegExp | [string[]] | [string | string[] | RegExp, string];
type RCKey<C extends RCCond> = C extends Readonly<[any, string]> ? C[1] : never;
type RCProp<C extends RCCond> =
    C extends Readonly<[any, string]>
        ? C[0] extends `*`
            ? string[]
            : C[0] extends RegExp
              ? RegExpMatchArray
              : string
        : never;
type RCMatch<C extends RCCond[]> = Readonly<{
    [K in C[number] as RCKey<K>]: RCProp<K>;
}>;

// eslint-disable-next-line sonarjs/cognitive-complexity
function rubyArrayCase<const C extends RCCond[], R extends Record<string, any>>(
    checks: C,
): (array: string[]) => R | null;
function rubyArrayCase<const C extends RCCond[], R extends Record<string, any>>(
    checks: C,
    res: (m: RCMatch<C>) => R,
): (array: string[]) => R | null;
function rubyArrayCase<const C extends RCCond[], R extends Record<string, any>>(
    checks: C,
    check: (m: RCMatch<C>) => boolean,
    convert: (m: RCMatch<C>) => R,
): (array: string[]) => R | null;
function rubyArrayCase<const C extends RCCond[], R extends Record<string, any>>(
    checks: C,
    fn1?: ((m: RCMatch<C>) => R) | ((m: RCMatch<C>) => boolean),
    fn2?: (m: RCMatch<C>) => R,
): (array: string[]) => R | null {
    const afterCheck = fn2 ? fn1 : null;
    const convert = fn2 ?? fn1;
    return (array) => {
        const matches: any = {};
        let i = 0;
        // eslint-disable-next-line no-labels, no-restricted-syntax
        mainLoop: for (let j = 0; j < checks.length; j++) {
            const check = checks[j];
            const [pattern, prop] = Array.isArray(check) ? check : [check];
            if (i >= array.length && check !== "**") {
                return null;
            }
            if (pattern instanceof RegExp) {
                const match = pattern.exec(array[i]);
                if (!match) return null;
                if (prop) matches[prop] = match;
            } else if (Array.isArray(pattern)) {
                if (pattern.includes(array[i])) {
                    if (prop) matches[prop] = array[i];
                } else {
                    return null;
                }
            } else {
                switch (pattern) {
                    case "**": {
                        const restChecks = checks.slice(j + 1);
                        for (let ii = array.length; ii > i; ii--) {
                            const res = rubyArrayCase(restChecks)(array.slice(ii));
                            if (res) {
                                if (prop) matches[prop] = array.slice(ii);
                                Object.assign(matches, res);
                                i = array.length - 1;
                                // eslint-disable-next-line no-labels
                                break mainLoop;
                            }
                        }
                        if (prop) matches[prop] = [];
                        break;
                    }
                    case "_":
                        if (prop) matches[prop] = array[i];
                        break;
                    case array[i]:
                        if (prop) matches[prop] = array[i];
                        break;
                    default:
                        return null;
                }
            }
            i += 1;
        }
        if (i < array.length - 1) return null;
        if (afterCheck && !afterCheck(matches)) return null;
        return convert ? convert(matches) : matches;
    };
}

// https://stackoverflow.com/questions/65750673/collapsing-a-discriminated-union-derive-an-umbrella-type-with-all-possible-key
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;
type Indexable<T> = T & { [str: string]: undefined };
type UndefinedValues<T> = {
    [K in keyof T]: undefined;
};
type AllUnionKeys<T> = keyof UnionToIntersection<UndefinedValues<T>>;
type CollapseUnion<T> = {
    [K in AllUnionKeys<T> & string]: Indexable<T>[K];
};

/** Ruby-like implementation of case-in for arrays */
function rubyArraySwitch<C extends Array<(arr: string[]) => any>>(
    array: string[],
    ...cases: C
): Partial<CollapseUnion<Exclude<ReturnType<C[number]>, null>>> {
    for (const rubyCase of cases) {
        const res = rubyCase(array);
        if (res !== null) return res;
    }
    // @ts-ignore
    return {};
}

/** Split url into parts */
function splitUrl(url: URL) {
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const parsed = parse(url.hostname);
    if ("error" in parsed) throw new Error(parsed.error.message + "");
    return {
        subdomain: parsed.subdomain ?? "",
        domain: parsed.domain ?? "",
        pathSegments,
    };
}

/** Based on `page_url` methods in https://github.com/danbooru/danbooru/tree/master/app/logical/source/url */
const SOURCE_NORMALIZER = {
    deviantArt(url) {
        const { subdomain, domain, pathSegments } = splitUrl(url);
        const { id, filename } = rubyArraySwitch(
            [domain, ...pathSegments],
            rubyArrayCase(["deviantart.net", "**", ["_", "filename"]]),
            rubyArrayCase(["deviantart.com", "download", ["_", "id"], "**"]),
            rubyArrayCase(["deviantart.com", [["deviation", "view"]], ["_", "id"]]),
            rubyArrayCase(
                ["deviantart.com", ["_", "user"], "art", [/^(?:([\w-]+)-)?(\d+)$/i, "reg"]],
                (m) => ({ ...m, id: m.reg[2] }),
            ),
            rubyArrayCase(
                ["deviantart.com", "art", [/^([\w-]+)-(\d+)$/i, "reg"]],
                () => subdomain !== "www",
                (m) => ({ ...m, id: m.reg[2] }),
            ),
            rubyArrayCase(
                ["deviantart.com", [["view.php", "view-full.php"]]],
                () => !!url.searchParams.get("id")?.match(/^\d+$/),
                () => ({ id: url.searchParams.get("id") }),
            ),
        );

        let workId = id ?? 0;
        if (filename) {
            const name = filename.replace(/\.\w+$/, "");
            const regexps = [
                /^.+_by_.+[_-]d([\da-z]+)(?:-\w+)?$/i,
                /^[\da-f]{32}-d([\da-z]+)$/,
                /^d([\da-z]{6})-h{8}(?:-h{4}){3}-h{12}/,
            ];
            for (const reg of regexps) {
                const match = reg.exec(name);
                if (match) {
                    workId = Number.parseInt(match[1], 36);
                    break;
                }
            }
        }

        if (workId) return `https://www.deviantart.com/deviation/${workId}`;
        return url.toString();
    },
    fandom(url) {
        const WIKI_NAMES: Record<string, string | undefined> = {
            // "lang/database_name": subdomain
            /* spell-checker: disable */
            "/adventuretimewithfinnandjake": "adventuretime",
            "/age-of-ishtaria": "ishtaria",
            "/atelierseries": "atelier",
            "/b-dapedia": "bdaman",
            "/blackbullet2": "blackbullet",
            "/blacksurvival_gamepedia_en": "blacksurvival",
            "/capcomdatabase": "capcom",
            "/dragalialost_gamepedia_en": "dragalialost",
            "/dragonauttheresonance": "dragonaut",
            "/dungeon-ni-deai-o-motomeru": "danmachi",
            "/dynastywarriors": "koei",
            "/fault-milestone8968": "fault-series",
            "/genjitsushugisha": "genkoku",
            "/gen-impact": "genshin-impact",
            "/gensin-impact": "genshin-impact",
            "/grimm-notes-jp": "grimms-notes-jp",
            "/guilty-gear": "guiltygear",
            "/harvestmoonrunefactory": "therunefactory",
            "/honkaiimpact3_gamepedia_en": "honkaiimpact3",
            "/isekai-maou-to-shoukan-shoujo-dorei-majutstu": "isekai-maou",
            "/kagura": "senrankagura",
            "/langrisser_gamepedia_en": "langrisser",
            "/littlewitch": "little-witch-academia",
            "/madannooutovanadis": "madan",
            "/magiarecord-en": "magireco",
            "/magic-school-lussid": "sid-story",
            "/mahousenseinegima": "negima",
            "/masterofeternity_gamepedia_en": "masterofeternity",
            "/ninehourspersonsdoors": "zeroescape",
            "/onigiri-en": "onigiri",
            "/p__": "hero",
            "/ritualofthenight": "bloodstained",
            "/rockman_x_dive": "rockman-x-dive",
            "/romancingsaga": "saga",
            "/shirocolle": "shiropro",
            "/silent": "silenthill",
            "/strikewitches": "worldwitches",
            "/sword-art-online": "swordartonline",
            "ru/sword-art-online": "sword-art-online",
            "es/sao": "swordartonline",
            "/senkizesshousymphogear": "symphogear",
            "/talesofseries-the-tales-of": "tales-of",
            "/tensei-shitara-slime-datta-ke": "tensura",
            "/the-dreath-mage-who-doesnt-want-a-fourth-time": "death-mage",
            "/to-aru-majutsu-no-index": "toarumajutsunoindex",
            "/utawareru": "utawarerumono",
            "/yorukuni": "nightsofazure",
            "/youkoso-jitsuryoku-shijou-shugi-no-kyoushitsu-e": "you-zitsu",
            "/zoe": "zoneoftheenders",
            /* spell-checker: enable */
        };

        const { pathSegments } = splitUrl(url);

        if (pathSegments[0]?.match(/^__cb\d+$/)) pathSegments.shift();
        const { wikiName, prefix, file } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(
                // unresolvable case
                [[/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/, "imageUuid"], "**"],
            ),
            rubyArrayCase(
                [["_", "wikiName"], "images", /^[\da-f]$/, /^[\da-f]{2}$/, ["_", "file"], "**"],
                (match) => ({
                    ...match,
                    prefix: url.searchParams.get("path-prefix"),
                }),
            ),
            rubyArrayCase([
                ["_", "wikiName"],
                ["_", "prefix"],
                "images",
                /^[\da-f]$/,
                /^[\da-f]{2}$/,
                ["_", "file"],
                "**",
            ]),
            rubyArrayCase(
                [
                    ["_", "wikiName"],
                    "images",
                    "thumb",
                    /^[\da-f]$/,
                    /^[\da-f]{2}$/,
                    ["_", "file"],
                    "**",
                ],
                (match) => ({
                    ...match,
                    prefix: url.searchParams.get("path-prefix"),
                }),
            ),
            rubyArrayCase([
                ["_", "wikiName"],
                ["_", "prefix"],
                "images",
                "thumb",
                /^[\da-f]$/,
                /^[\da-f]{2}$/,
                ["_", "file"],
                "**",
            ]),
        );

        const lang = prefix === "en" || !prefix?.match(/^\w{2,3}(-\w{2,3})?$/) ? "" : prefix;
        const subdomain = WIKI_NAMES[`${lang}/${wikiName}`] ?? wikiName;
        const site = wikiName
            ? lang
                ? `https://${subdomain}.fandom.com/${lang}`
                : `https://${subdomain}.fandom.com`
            : null;
        if (site && file) return `${site}/wiki/File:${file}`;
        return url.toString();
    },
    fantia(url) {
        const { pathSegments } = splitUrl(url);
        const { postId, productId } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(
                [
                    "uploads",
                    ["_", "type"],
                    [["file", "image"]],
                    ["_", "id"],
                    [/(\w+_)?([\w-]+\.\w+)/, "ref"],
                ],
                (m) => {
                    switch (m.type) {
                        case "post":
                            return { postId: m.id };
                        case "product":
                            return { productId: m.id };
                        default:
                            return {};
                    }
                },
            ),
            rubyArrayCase(
                ["posts", ["_", "postId"], "album_image"],
                () => url.searchParams.has("query"),
                (m) => m,
            ),
            rubyArrayCase(["posts", [/\d+/, "id"], "**"], (m) => ({ postId: m.id[0] })),
            rubyArrayCase(["products", [/\d+/, "id"], "**"], (m) => ({ productId: m.id[0] })),
        );

        if (postId) return `https://fantia.jp/posts/${postId}`;
        if (productId) return `https://fantia.jp/products/${productId}`;
        return url.toString();
    },
    hentaiFoundry(url) {
        const { subdomain, pathSegments } = splitUrl(url);

        const { workId, username } = rubyArraySwitch(
            [subdomain, ...pathSegments],
            rubyArrayCase(
                ["pictures", "_", ["_", "username"], [/^\d+$/, "workId"], ["_", "filename"]],
                (m) => ({ ...m, workId: m.workId[0] }),
            ),
            rubyArrayCase(
                ["pictures", "_", ["_", "username"], [/^(\d+)\.\w+$/, "filename"]],
                (m) => ({ ...m, workId: m.filename[1] }),
            ),
            rubyArrayCase(
                ["_", "piccies", "user", ["_", "username"], [/^\d+$/, "workId"], "**"],
                (m) => ({ ...m, workId: m.workId[0] }),
            ),
            rubyArrayCase(["_", [/^pic\w*-(\d+)/, "filename"]], (m) => ({ workId: m.filename[1] })),
            rubyArrayCase(
                ["thumbs", "thumb.php"],
                () => url.searchParams.has("pid"),
                () => ({ workId: url.searchParams.get("pid") }),
            ),
        );

        if (username && workId) {
            return `https://www.hentai-foundry.com/pictures/user/${username}/${workId}`;
        }
        if (workId) return `https://www.hentai-foundry.com/pic-${workId}`;
        return url.toString();
    },
    imgur(url) {
        const { pathSegments } = splitUrl(url);
        const { albumId, imageId } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(
                [[/^\w+\.(jpeg|jpg|png|gif|gifv|webp|avif|webm|mp4)$/i, "file"]],
                (m) => ({ imageId: m.file[0].match(/^(\w{7}|\w{5})/)?.[1] }),
            ),
            rubyArrayCase(["download", ["_", "imageId"], "**"]),
            rubyArrayCase([[["gallery", "a"]], ["_", "file"], "**"], (m) => ({
                albumId: m.file.split("-").at(-1),
            })),
            rubyArrayCase(["t", "_", ["_", "albumId"]]),
            rubyArrayCase([[/\w{5,7}$/i, "ending"]], (m) => ({ imageId: m.ending[0] })),
        );

        if (albumId) return `https://imgur.com/a/${albumId}`;
        if (imageId) return `https://imgur.com/${imageId}`;
        return url.toString();
    },
    newGrounds(url) {
        const { pathSegments } = splitUrl(url);
        const { username, title, videoId } = rubyArraySwitch(
            [url.hostname, ...pathSegments],
            rubyArrayCase(["www.newgrounds.com", "art", "view", ["_", "username"], ["_", "title"]]),
            rubyArrayCase(["www.newgrounds.com", "portal", [["view", "video"]], ["_", "videoId"]]),
            rubyArrayCase(
                [
                    "art.ngfiles.com",
                    [["medium_views", "images"]],
                    "_",
                    [/^(\d+)_(\d+)_([^_]+)_(.*)\.([\da-f]{32})\.\w+$/, "reg"],
                ],
                () => ({}), // images with hash cannot be resolved
            ),
            rubyArrayCase(
                ["art.ngfiles.com", "images", "_", [/^(\d+)_([^_]+)_(.*)\.\w+$/, "reg"]],
                (m) => ({
                    username: m.reg[2],
                    title: m.reg[3],
                }),
            ),
        );

        if (username && title) {
            return `https://www.newgrounds.com/art/view/${username}/${title}`;
        }
        if (videoId) return `https://www.newgrounds.com/portal/view/${videoId}`;
        return url.toString();
    },
    nijie(url) {
        const { subdomain, domain, pathSegments } = splitUrl(url);
        let { workId, filename } = rubyArraySwitch(
            [domain, ...pathSegments],
            rubyArrayCase(
                ["nijie.info", [["view.php", "view_popup.php"]]],
                () => url.searchParams.has("id"),
                () => ({ workId: url.searchParams.get("id") }),
            ),
            rubyArrayCase(
                // eslint-disable-next-line max-len
                [
                    "_",
                    /^\d{2}$/,
                    "nijie",
                    /^\d{2}$/,
                    /^\d{2}$/,
                    ["_", "userId"],
                    "illust",
                    ["_", "filename"],
                ],
                () => subdomain.startsWith("pic"),
                (m) => m,
            ),
            rubyArrayCase(
                ["**", "nijie_picture", "**", ["_", "filename"]],
                () => subdomain.startsWith("pic"),
                (m) => m,
            ),
        );

        if (!workId && filename) {
            ({ workId } = rubyArraySwitch(
                filename.replace(/\.\w+$/, "").split("_"),
                rubyArrayCase(
                    [[/^\d+$/, "workId"], /^\d+$/, [/^\d+$/, "userId"], [/^\d{14}$/, "time"]],
                    (m) => m.workId[0] !== "0",
                    (m) => ({ workId: m.workId[0] }),
                ),
                rubyArrayCase(
                    [[/^\d+$/, "workId"], [/^\d+$/, "userId"], [/^\d{14}$/, "time"], /^\d+$/],
                    (m) => ({ workId: m.workId[0] }),
                ),
                rubyArrayCase(
                    [[/^\d+$/, "workId"], /^\d+$/, /^[\da-f]+$/, /^[\da-f]+$/],
                    (m) => m.workId[0] !== "0",
                    (m) => ({ workId: m.workId[0] }),
                ),
            ));
        }

        if (workId) return `https://nijie.info/view.php?id=${workId}`;
        return url.toString();
    },
    patreon(url) {
        const { pathSegments } = splitUrl(url);
        const { postId } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(["_", "patreon-media", "p", "post", ["_", "postId"], "**"]),
        );

        if (postId) return `https://www.patreon.com/posts/${postId}`;
        return url.toString();
    },
    pixiv(url) {
        const { subdomain, domain, pathSegments } = splitUrl(url);
        const isImageUrl =
            url.hostname === "i.pximg.net" ||
            url.hostname === "i-f.pximg.net" ||
            /^(i\d+|img\d+)\.pixiv\.net$/.test(url.hostname);
        let match = rubyArraySwitch(
            [subdomain, domain, ...pathSegments],
            rubyArrayCase(
                [
                    "**",
                    [
                        [
                            "img-original",
                            "img-master",
                            "img-zip-ugoira",
                            "img-inf",
                            "custom-thumb",
                            "novel-cover-original",
                            "novel-cover-master",
                        ],
                        "imageType",
                    ],
                    "img",
                    ["_", "year"],
                    ["_", "month"],
                    ["_", "day"],
                    ["_", "hour"],
                    ["_", "min"],
                    ["_", "sec"],
                    ["_", "filename"],
                ],
                () => isImageUrl,
                (m) => m,
            ),
            rubyArrayCase(
                ["**", "img", ["_", "username"], ["_", "filename"]],
                () => isImageUrl,
                (m) => m,
            ),
            rubyArrayCase(["_", "pixiv.net", "**", "artwork", ["_", "workId"]]),
            rubyArrayCase(
                ["_", "pixiv.net", "novel", "show.php"],
                () => url.searchParams.has("id"),
                () => ({ novelId: url.searchParams.get("id") }),
            ),
            rubyArrayCase(
                ["embed", "pixiv.net", "novel.php"],
                () => url.searchParams.has("id"),
                () => ({ novelId: url.searchParams.get("id") }),
            ),
            rubyArrayCase(
                ["_", "pixiv.net", "novel", "series", [/^\d+$/, "novelSeriesId"]],
                (m) => ({ novelSeriesId: m.novelSeriesId[0] }),
            ),
            rubyArrayCase(["_", "pixiv.net", "i", ["_", "workId"]]),
            rubyArrayCase(
                ["_", "pixiv.net", "member_illust.php"],
                () => url.searchParams.has("illust_id"),
                () => ({ workId: url.searchParams.get("illust_id") }),
            ),
        );

        if (match.filename) {
            match = {
                ...match,
                ...rubyArraySwitch(
                    match.filename.replace(/\.\w+$/, "").split("_"),
                    rubyArrayCase([[/^\d+$/, "workId"], /^p\d+$/, "**"], (m) => ({
                        workId: m.workId[0],
                    })),
                    rubyArrayCase([[/^\d+$/, "workId"], "big", /^p\d+$/], (m) => ({
                        workId: m.workId[0],
                    })),
                    rubyArrayCase([[/^(?:ci)?(\d+)$/, "novelId"], /^[\da-f]{32}$/, "**"], (m) => ({
                        novelId: m.novelId[1],
                    })),
                    rubyArrayCase(
                        [[/^sci(\d+)$/, "novelSeriesId"], /^[\da-f]{32}$/, "**"],
                        (m) => ({ novelSeriesId: m.novelSeriesId[1] }),
                    ),
                    rubyArrayCase([[/^\d+$/, "workId"], "**"], (m) => ({ workId: m.workId[0] })),
                ),
            };
        }

        if (match.workId) return `https://www.pixiv.net/artworks/${match.workId}`;
        if (match.novelId) return `https://www.pixiv.net/novel/show.php?id=${match.novelId}`;
        if (match.novelSeriesId) return `https://www.pixiv.net/novel/series/${match.novelSeriesId}`;
        return url.toString();
    },
    weibo(url) {
        const { subdomain, domain, pathSegments } = splitUrl(url);

        const { imgBase62Id, imgLongId, userShortId } = rubyArraySwitch(
            [subdomain, domain, ...pathSegments],
            rubyArrayCase(["tw", "weibo.com", /^\w+$/, [/^\d+$/, "imgLongId"]]),
            rubyArrayCase([
                "_",
                [["weibo.com", "weibo.cn"]],
                [/^\d+$/, "userShortId"],
                [/^\w+$/, "imgBase62Id"],
            ]),
            rubyArrayCase([
                "photo",
                "weibo.com",
                [/^\d+$/, "userShortId"],
                "_",
                "_",
                "_",
                [/^\d+$/, "imgLongId"],
                "**",
            ]),
            rubyArrayCase(["_", [["weibo.com", "weibo.cn"]], "detail", [/^\d+$/, "imgLongId"]]),
            rubyArrayCase(["share.api", "weibo.cn", "share", [/^(\d+),(\d+)/, "img"]], (m) => ({
                imgLongId: m.img[2],
            })),
            rubyArrayCase(["m", "weibo.cn", "status", [/^\w+$/, "imgBase62Id"]]),
        );

        if (imgBase62Id && userShortId)
            return `https://www.weibo.com/${userShortId}/${imgBase62Id}`;
        if (imgLongId) return `https://m.weibo.cn/detail/${imgLongId}`;
        if (imgBase62Id) return `https://m.weibo.cn/status/${imgBase62Id}`;

        return url.toString();
    },
    zerochan(url) {
        const { pathSegments } = splitUrl(url);
        const { workId } = rubyArraySwitch(
            pathSegments,
            rubyArrayCase(
                [[/^(full|\d+)$/, "size"], /\d{2}/, /\d{2}/, [/(\d+)\.(jpg|png|gif)$/, "file"]],
                (m) => ({ workId: m.file[1] }),
            ),
            rubyArrayCase([[/^(.*?)\.(full|\d+)\.(\d+)\.(jpg|png|gif)$/, "file"]], (m) => ({
                workId: m.file[3],
            })),
            rubyArrayCase(["full", [/^\d+$/, "workId"]]),
            rubyArrayCase([[/^\d+$/, "reg"]], (m) => ({ workId: m.reg[0] })),
        );

        if (workId) return `https://www.zerochan.net/${workId}#full`;

        return url.toString();
    },
} satisfies Record<string, UrlNormalizer["normalize"]>;

// #endregion

// #region source url

const NORMALIZE_SOURCE_URL: Record<string, UrlNormalizer> = {
    "art.ngfiles.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.newGrounds,
    },
    "www.deviantart.com": {
        path: /(^\/[\w-_]+\/art\/)|(^\/deviation\/)/,
        normalize: SOURCE_NORMALIZER.deviantArt,
    },
    ".deviantart.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.deviantArt,
    },
    ".deviantart.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.deviantArt,
    },
    "fantia.jp": {
        path: /^\/(posts|products)\/\d+$/,
        normalize: SOURCE_NORMALIZER.fantia,
    },
    ".fantia.jp": {
        valid: false,
        normalize: SOURCE_NORMALIZER.fantia,
    },
    "imgur.com": {
        path: /^(\/a)?\/\w+$/,
        params: /^$/, // no params
        normalize: SOURCE_NORMALIZER.imgur,
    },
    ".imgur.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.imgur,
    },
    ".nijie.info": {
        path: /^\/view\.php$/,
        normalize: SOURCE_NORMALIZER.nijie,
    },
    ".nijie.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.nijie,
    },
    ".nocookie.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.fandom,
    },
    "pictures.hentai-foundry.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.hentaiFoundry,
    },
    "thumbs.hentai-foundry.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.hentaiFoundry,
    },
    ".patreonusercontent.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.patreon,
    },
    "www.pixiv.net": {
        path: /^(\/en)?\/(artworks\/\d+|novel\/show.php|novel\/series\/\d+)$/,
        params: /^(\?id=\d+)?$/,
        normalize: SOURCE_NORMALIZER.pixiv,
    },
    ".pixiv.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.pixiv,
    },
    ".pximg.net": {
        valid: false,
        normalize: SOURCE_NORMALIZER.pixiv,
    },
    ".sinaimg.cn": {
        valid: false,
        normalize: SOURCE_NORMALIZER.weibo,
    },
    ".weibo.cn": {
        path: /^\/(detail\/\d+|status\/\w+)$/,
        normalize: SOURCE_NORMALIZER.weibo,
    },
    "www.weibo.com": {
        path: /^\/\d+\/\w+$/,
        params: /^$/, // no params
        normalize: SOURCE_NORMALIZER.weibo,
    },
    ".weibo.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.weibo,
    },
    ".weibocdn.com": {
        valid: false,
        normalize: SOURCE_NORMALIZER.weibo,
    },
    ".zerochan.net": {
        path: /^\/\d+(#full)?$/,
        normalize: SOURCE_NORMALIZER.zerochan,
    },
};

/** Converts URLs to the same format used by the URL column on Danbooru */
export function normalizeSourceUrl(sourceUrl: string): string {
    const { url, error } = normalizeUrl(sourceUrl, NORMALIZE_SOURCE_URL);
    if (error && !error.startsWith("Unsupported domain:")) {
        console.warn("[TPT]:", error);
    }
    return url;
}
