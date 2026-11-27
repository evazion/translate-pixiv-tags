let oneTimeCleanups: Array<() => void> = [];
const permanentCleanups = new Set<() => void>();

export function addCleanup(cleanup: () => void, once = false) {
    if (once) {
        oneTimeCleanups.push(cleanup);
    } else {
        permanentCleanups.add(cleanup);
    }
}

export function runCleanups() {
    for (const fn of [...oneTimeCleanups, ...permanentCleanups]) {
        try {
            fn();
        } catch (ex) {
            console.error("[TPT]:", ex);
        }
    }
    oneTimeCleanups = [];
}

const afterRestarts: Array<() => void> = [];

/**
 * Registers a function to run after the cleanups on restart
 * @returns function to unregister it
 */
export function addAfterRestart(fn: () => void) {
    afterRestarts.push(fn);
    return () => {
        const index = afterRestarts.indexOf(fn);
        if (index >= 0) afterRestarts.splice(index, 1);
    };
}

function runAfterRestarts() {
    for (const fn of afterRestarts) {
        try {
            fn();
        } catch (ex) {
            console.log("[TPT]:", ex);
        }
    }
}

let restartScheduled = false;
export function requestAppRestart() {
    if (restartScheduled) return;
    queueMicrotask(() => {
        runCleanups();
        runAfterRestarts();
        restartScheduled = false;
    });
    restartScheduled = true;
}

// The registered cleanups would be lost on a hot update of this module, so reload the page
import.meta.hot?.accept(() => window.location.reload());
