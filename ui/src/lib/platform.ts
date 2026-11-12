// @core
/**
 * The platform seam — the single source of truth for "is the desktop host there".
 *
 * Everything that crosses the IPC boundary goes through `@casoon/origin-client`
 * (ADR-0010).
 */

/** True inside the Tauri host, false in a plain browser. */
export function isTauriAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined"
  );
}

/** True on macOS, where the quick-add shortcut is Cmd instead of Ctrl. */
export function isMac(platform: string = typeof navigator !== "undefined" ? navigator.platform : ""): boolean {
  return /^Mac/i.test(platform);
}

/** Label of the quick-add shortcut for the current platform. */
export function quickAddShortcutLabel(mac: boolean = isMac()): string {
  return mac ? "⌘K" : "Strg+K";
}
