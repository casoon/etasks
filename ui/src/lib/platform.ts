// @core
/**
 * The platform seam — the single source of truth for "is the desktop host there"
 * and the only file in the frontend that touches a Tauri webview API directly.
 *
 * Everything that crosses the IPC boundary goes through `@casoon/origin-client`
 * (ADR-0010). What stays here is the one thing that is not IPC: turning an
 * absolute file path into a URL the webview is allowed to load.
 */
import { convertFileSrc } from "@tauri-apps/api/core";

/** True inside the Tauri host, false in a plain browser. */
export function isTauriAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined"
  );
}

/**
 * Turn an absolute file path into an asset-protocol URL the webview may load.
 *
 * Only meaningful inside the host — callers guard with {@link isTauriAvailable}.
 */
export function assetUrl(path: string): string {
  return convertFileSrc(path);
}