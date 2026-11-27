let opener = () => {};

/** Sets the function opening the settings dialog, called by the dialog's module */
export function setSettingsOpener(fn: () => void) {
    opener = fn;
}

/**
 * Opens the settings dialog.
 * The UI showing the settings icon imports this instead of the dialog,
 * as the dialog depends on most of the app, which would make an import cycle.
 */
export default function showSettings() {
    opener();
}
