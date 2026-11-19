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

async function getItem<T>(key: string): Promise<CacheItem<T> | undefined> {
    try {
        const db = await openDB();
        const store = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
        return await promisify<CacheItem<T> | undefined>(store.get(key));
    } catch (error) {
        console.error("Failed to read from the cache", key, error);
        return undefined;
    }
}

async function setItem<T>(key: string, value: T): Promise<void> {
    try {
        const db = await openDB();
        const store = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
        await promisify(store.put({ key, time: Date.now(), value } satisfies CacheItem<T>));
    } catch (error) {
        console.error("Failed to write to the cache", key, error);
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
            await setItem(key, value);
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
