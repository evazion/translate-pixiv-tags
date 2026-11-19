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

const pending = new Map<string, Promise<unknown>>();

/**
 * Returns the cached value if it isn't older than `SETTINGS.cache_lifetime`,
 * otherwise gets a fresh value with `fn` and caches it.
 * If `fn` throws, falls back to the stale cached value if any.
 * @param fn - the function to get a fresh value, the value must be structured-cloneable
 * @param hasher - the function to build cache key
 */
export function cache<F extends (...args: any[]) => Promise<any>>(
    fn: F,
    hasher: (...args: Parameters<F>) => string = (...args) => args.join("\0"),
): F {
    return function (...args: Parameters<F>) {
        const key = hasher(...args);
        // deduplicate simultaneous requests of the same key
        if (pending.has(key)) return pending.get(key);

        const promise = (async () => {
            const item = await getItem(key);
            if (item && Date.now() - item.time <= SETTINGS.cache_lifetime * 1000) {
                return item.value;
            }
            let value: any;
            try {
                value = await fn(...args);
            } catch (error) {
                if (item) {
                    console.warn("Failed to get a fresh value, using the cached one", key, error);
                    return item.value;
                }
                throw error;
            }
            setItem(key, value);
            return value;
        })().finally(() => pending.delete(key));

        pending.set(key, promise);
        return promise;
    } as F;
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
