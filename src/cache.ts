import { SETTINGS } from "./settings";
import { console } from "./utils";

/** Persistent cache in the site's IndexedDB */

const DB_NAME = "tpt-cache";
const STORE_NAME = "cache";
/** Items older than this are removed on startup, in ms */
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

type CacheItem<T = unknown> = { key: string; time: number; value: T };

let dbPromise: Promise<IDBDatabase> | null = null;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () => reject(request.error));
    });
}

function openDB(): Promise<IDBDatabase> {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.addEventListener("upgradeneeded", () => {
            const store = request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
            store.createIndex("time", "time");
        });
        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("blocked", () => reject(new Error("IndexedDB is blocked")));
    }).catch((error) => {
        // allow retrying later
        dbPromise = null;
        throw error;
    });
    return dbPromise;
}

type ReadCallback = (item: CacheItem | undefined) => void;

/** Keys to read in the next batch, with the callbacks waiting for them */
let pendingReads: Map<string, ReadCallback[]> | null = null;

/**
 * Reads the item from the cache.
 * The reads requested within the same tick are done in a single transaction.
 */
function getItem<T>(key: string): Promise<CacheItem<T> | undefined> {
    return new Promise((resolve) => {
        if (!pendingReads) {
            pendingReads = new Map();
            queueMicrotask(flushReads);
        }
        const callbacks = pendingReads.get(key);
        if (callbacks) {
            callbacks.push(resolve as ReadCallback);
        } else {
            pendingReads.set(key, [resolve as ReadCallback]);
        }
    });
}

async function flushReads() {
    if (!pendingReads) return;
    const reads = pendingReads;
    pendingReads = null;
    try {
        const db = await openDB();
        const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
        // all the requests are made synchronously, while the transaction is active
        await Promise.all(
            [...reads].map(async ([key, callbacks]) => {
                const item = await promisify<CacheItem | undefined>(store.get(key));
                for (const callback of callbacks) callback(item);
            }),
        );
    } catch (error) {
        console.error("Failed to read from the cache", [...reads.keys()], error);
        // treat as missing, resolving the already resolved ones is a no-op
        for (const callbacks of reads.values()) {
            for (const callback of callbacks) callback(undefined);
        }
    }
}

/** Items to write in the next batch, by key */
let pendingWrites: Map<string, CacheItem> | null = null;
/** Delay before writing, to gather more items in a batch, in ms */
const WRITE_DELAY = 100;

/**
 * Writes the item to the cache in background.
 * The writes requested within a short period are done in a single transaction.
 */
function setItem<T>(key: string, value: T) {
    if (!pendingWrites) {
        pendingWrites = new Map();
        setTimeout(flushWrites, WRITE_DELAY);
    }
    pendingWrites.set(key, { key, time: Date.now(), value });
}

async function flushWrites() {
    if (!pendingWrites) return;
    const writes = pendingWrites;
    pendingWrites = null;
    try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        for (const item of writes.values()) {
            try {
                store.put(item);
            } catch (error) {
                // e.g. the value isn't structured-cloneable, skip only this item
                console.error("Failed to write to the cache", item.key, error);
            }
        }
        await new Promise((resolve, reject) => {
            transaction.addEventListener("complete", resolve);
            transaction.addEventListener("error", () => reject(transaction.error));
            transaction.addEventListener("abort", () => reject(transaction.error));
        });
    } catch (error) {
        console.error("Failed to write to the cache", [...writes.keys()], error);
    }
}

type CacheEntry = {
    promise: Promise<unknown>;
    controller: AbortController;
    /** Number of the callers with a signal, that still wait for the value */
    waiters: number;
    /** Whether a caller without a signal waits, then the call can't be aborted */
    unabortable: boolean;
    settled: boolean;
};

/** Running calls and the got values, by key */
const entries = new Map<string, CacheEntry>();

/**
 * Wraps `fn` with a persistent cache and shares the calls with the same key between the callers.
 *
 * Returns the cached value if it isn't older than `SETTINGS.cache_lifetime`,
 * otherwise gets a fresh value with `fn` and caches it.
 * If `fn` throws, falls back to the stale cached value if any.
 * The got values are also kept in memory till the page reload.
 *
 * The abort signal is always the last argument: the callers pass theirs (or `null` for none),
 * `fn` gets the signal of the shared call, and `hasher` gets the arguments without it.
 * A caller stops waiting when its signal is aborted,
 * and the shared call is aborted when all its callers have aborted.
 * @param fn - the function to get a fresh value, the value must be structured-cloneable
 * @param hasher - the function to build cache key
 */
export function cache<A extends unknown[], R>(
    fn: (...args: [...A, AbortSignal]) => Promise<R>,
    hasher: (...args: A) => string = (...args) => args.join("\0"),
): (...args: [...A, AbortSignal | null | undefined]) => Promise<R> {
    return (...argsWithSignal) => {
        const args = argsWithSignal.slice(0, -1) as A;
        const signal = argsWithSignal.at(-1) as AbortSignal | null | undefined;
        if (signal?.aborted) return Promise.reject(signal.reason);

        const key = hasher(...args);
        const entry = entries.get(key) ?? load(key, (callSignal) => fn(...args, callSignal));
        return wait(entry, key, signal) as Promise<R>;
    };
}

/** Starts the shared call: reads the cache, and gets a fresh value if needed */
function load(key: string, getFresh: (signal: AbortSignal) => Promise<unknown>): CacheEntry {
    const controller = new AbortController();
    const lifetime = SETTINGS.cache_lifetime * 1000;

    const promise = (async () => {
        const item = await getItem(key);
        if (item && Date.now() - item.time <= lifetime) return item.value;
        // could be aborted during the cache lookup
        controller.signal.throwIfAborted();
        let value: unknown;
        try {
            value = await getFresh(controller.signal);
        } catch (error) {
            // nobody waits for the value
            if (controller.signal.aborted) throw error;
            if (item) {
                console.warn("Failed to get a fresh value, using the cached one", key, error);
                return item.value;
            }
            throw error;
        }
        setItem(key, value);
        return value;
    })();

    const entry: CacheEntry = {
        promise,
        controller,
        waiters: 0,
        unabortable: false,
        settled: false,
    };
    entries.set(key, entry);

    promise.then(
        () => {
            entry.settled = true;
        },
        () => {
            entry.settled = true;
            // let the next caller retry, unless a newer call has replaced this one
            if (entries.get(key) === entry) entries.delete(key);
        },
    );
    return entry;
}

/** Waits for the shared call, or till the caller's signal is aborted */
function wait(entry: CacheEntry, key: string, signal: AbortSignal | null | undefined) {
    if (!signal || entry.settled) {
        if (!signal) entry.unabortable = true;
        return entry.promise;
    }

    entry.waiters += 1;
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            reject(signal.reason);
            entry.waiters -= 1;
            if (entry.waiters > 0 || entry.unabortable || entry.settled) return;
            // nobody waits for the value anymore, the next caller starts a new call
            if (entries.get(key) === entry) entries.delete(key);
            entry.controller.abort(signal.reason);
        };
        signal.addEventListener("abort", onAbort, { once: true });
        entry.promise.then(
            (value) => {
                signal.removeEventListener("abort", onAbort);
                resolve(value);
            },
            (error) => {
                signal.removeEventListener("abort", onAbort);
                reject(error);
            },
        );
    });
}

/** Removes the items older than 7 days from the cache */
export async function cleanupCache(): Promise<void> {
    try {
        const db = await openDB();
        const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
        const range = IDBKeyRange.upperBound(Date.now() - MAX_AGE);
        const keys = await promisify(store.index("time").getAllKeys(range));
        for (const key of keys) store.delete(key);
        if (keys.length > 0) console.info("Removed", keys.length, "outdated cache items");
    } catch (error) {
        console.error("Failed to clean up the cache", error);
    }
}
