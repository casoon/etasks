/**
 * Platform detection — single source of truth for Tauri availability.
 */
export function isTauriAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
  );
}
