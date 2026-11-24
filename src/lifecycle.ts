let oneTimeCleanups: Array<() => void> = [];
const permanentCleanups = new Set<() => void>();

export function addCleanup(cleanup: () => void, once = false) {
    if (once) {
        oneTimeCleanups.push(cleanup);
    } else {
        permanentCleanups.add(cleanup);
    }
}

function runCleanups() {
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

export function addAfterRestart(fn: () => void) {
    afterRestarts.push(fn);
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
