/**
 * MutationSummary supports only a subset of CSS selectors:
 * comma-separated compounds of `tag`, `*`, `.class`, `#id`, `[attr]`, `[attr=value]`, `[attr~=value]`.
 * The names must match this regex.
 */
const NAME_REGEX = /^[a-zA-Z_][\w-]*$/;
/** Attribute selector: name, operator, value, case-sensitivity flag */
const ATTR_REGEX =
    /^\s*([\w-]+)\s*(?:([~|^$*]?=)\s*("[^"]*"|'[^']*'|[^\s"'\]]+)\s*([is])?)?\s*$/i;

/**
 * Returns the index after the CSS escape sequence starting at `start` (at the backslash):
 * either one char, or up to 6 hex digits followed by an optional whitespace
 */
function skipEscape(selector: string, start: number) {
    const hex = /^[\da-f]{1,6}\s?/i.exec(selector.slice(start + 1, start + 8))?.[0];
    return start + 1 + (hex?.length || 1);
}

/**
 * Splits the selector by the separator chars at the top level,
 * i.e. outside of brackets, parentheses and quotes
 */
function splitTopLevel(selector: string, isSeparator: (char: string) => boolean) {
    const parts: string[] = [];
    let depth = 0;
    let quote = "";
    let start = 0;
    for (let i = 0; i < selector.length; i++) {
        const char = selector[i];
        if (char === "\\") {
            i = skipEscape(selector, i) - 1;
        } else if (quote) {
            if (char === quote) quote = "";
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === "(" || char === "[") {
            depth++;
        } else if (char === ")" || char === "]") {
            depth--;
        } else if (depth === 0 && isSeparator(char)) {
            parts.push(selector.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(selector.slice(start));
    return parts.map((part) => part.trim()).filter(Boolean);
}

/** Returns the index after the closing char of the block opened at `start` */
function skipBlock(compound: string, start: number) {
    let depth = 0;
    let quote = "";
    for (let i = start; i < compound.length; i++) {
        const char = compound[i];
        if (char === "\\") {
            i = skipEscape(compound, i) - 1;
        } else if (quote) {
            if (char === quote) quote = "";
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (char === "(" || char === "[") {
            depth++;
        } else if ((char === ")" || char === "]") && --depth === 0) {
            return i + 1;
        }
    }
    return compound.length;
}

/** Compound selector: tag name (empty for any) and other parts like `.class` or `[attr]` */
type Compound = { tag: string; parts: Set<string> };

/**
 * Keeps only the parts of the compound selector supported by MutationSummary
 * @returns The simplified compound, or null when it can match any element
 */
function simplifyCompound(compound: string): Compound | null {
    const tag = /^(?:\*|[a-zA-Z][\w-]*)/.exec(compound)?.[0] ?? "";
    const parts = new Set<string>();
    let i = tag.length;
    while (i < compound.length) {
        const char = compound[i];
        if (char === "." || char === "#") {
            const name = /^[\w-]*/.exec(compound.slice(i + 1))![0];
            // a name with escaped chars is unsupported, drop it
            if (compound[i + 1 + name.length] === "\\") {
                i = skipName(compound, i + 1);
                continue;
            }
            if (NAME_REGEX.test(name)) parts.add(char + name);
            i += 1 + name.length;
        } else if (char === "[") {
            const end = skipBlock(compound, i);
            const match = ATTR_REGEX.exec(compound.slice(i + 1, end - 1));
            if (match && NAME_REGEX.test(match[1])) {
                const [, name, operator, rawValue, flag] = match;
                const value = rawValue?.replace(/^(["'])(.*)\1$/, "$2");
                const exact = (operator === "=" || operator === "~=") && !flag;
                // MutationSummary doesn't support escapes in values
                parts.add(
                    exact && !/["\\]/.test(value)
                        ? `[${name}${operator}"${value}"]`
                        : `[${name}]`,
                );
            }
            i = end;
        } else if (char === ":") {
            // pseudo-classes aren't supported, skip them with their arguments
            const name = /^::?[\w-]*/.exec(compound.slice(i))![0];
            i += name.length;
            if (compound[i] === "(") i = skipBlock(compound, i);
        } else {
            // something unexpected, e.g. a namespace, match any element
            return null;
        }
    }
    const result = { tag: tag === "*" ? "" : tag, parts };
    return result.tag || parts.size > 0 ? result : null;
}

/** Whether every element matching `b` also matches `a` */
function covers(a: Compound, b: Compound) {
    return (!a.tag || a.tag === b.tag) && [...a.parts].every((part) => b.parts.has(part));
}

/** Returns the index after the (possibly escaped) name starting at `start` */
function skipName(compound: string, start: number) {
    let i = start;
    while (i < compound.length && /[\w\\-]/.test(compound[i])) {
        i = compound[i] === "\\" ? skipEscape(compound, i) : i + 1;
    }
    return i;
}

/**
 * Converts the selector to a simplified one supported by MutationSummary,
 * which matches the same elements or more.
 * For each comma-separated group, only the last compound selector is kept
 * without pseudo-classes and unsupported attribute operators.
 * @example
 * simplifySelector("main > section h2:has(a) > a.name[href^='/users/']:not(.x), .tag > span")
 * // "a.name[href], span"
 */
export default function simplifySelector(selector: string) {
    const groups = splitTopLevel(selector, (char) => char === ",").map((group) =>
        simplifyCompound(splitTopLevel(group, (char) => /[\s>+~]/.test(char)).at(-1) ?? "*"),
    );
    if (groups.includes(null)) return "*";
    // drop the groups covered by other ones, e.g. `a.tag` by `a`
    const compounds = groups as Compound[];
    return compounds
        .filter((group, i) =>
            compounds.every(
                (other, j) => i === j || !covers(other, group) || (covers(group, other) && i < j),
            ),
        )
        .map(({ tag, parts }) => tag + [...parts].join(""))
        .join(", ");
}
