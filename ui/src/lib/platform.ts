/**
 * Platform detection — single source of truth for Neutralino availability.
 */
export function isNeutralinoAvailable(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).Neutralino !== 'undefined';
}
