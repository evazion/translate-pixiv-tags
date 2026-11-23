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
