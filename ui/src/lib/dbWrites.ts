// @core
import { command } from "@casoon/origin-client";
import { isTauriAvailable } from "./platform";

// Schreibzugriffe gehen an die jeweils offene Datenbank. Beim Wechsel des Arbeitsbereichs
// werden laufende Schreibzugriffe zuerst abgewartet und während des Wechsels keine neuen
// abgeschickt, damit nichts von Arbeitsbereich A in B landet.
const inflight = new Set<Promise<unknown>>();
let switching = false;

/** Schickt einen DB-Schreibbefehl ab. Während eines Arbeitsbereichswechsels wird er verworfen. */
export function dbWrite(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!isTauriAvailable() || switching) return Promise.resolve();
  const p = command(cmd, args);
  inflight.add(p);
  const done = () => inflight.delete(p);
  p.then(done, done);
  return p;
}

/** Wartet auf alle laufenden Schreibzugriffe (Fehler melden die Aufrufer selbst). */
export async function flushDbWrites(): Promise<void> {
  await Promise.allSettled([...inflight]);
}

/** Führt `fn` (db_open + Neuladen) aus, nachdem alle Schreibzugriffe abgeschlossen sind. */
export async function runWorkspaceSwitch<T>(fn: () => Promise<T>): Promise<T> {
  await flushDbWrites();
  switching = true;
  try {
    return await fn();
  } finally {
    switching = false;
  }
}
