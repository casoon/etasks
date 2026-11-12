// @core
import { command } from '@casoon/origin-client';
import { isTauriAvailable } from './platform';

// Im Browser-Modus ersetzt localStorage die Arbeitsbereich-Meta-Tabelle (z. B. für den Rechnungszähler).
const WEB_META_PREFIX = 'etasks.meta.';

function webMeta<T>(run: (storage: Storage) => T, fallback: T): T {
  try {
    return run(localStorage);
  } catch {
    return fallback;
  }
}

export async function metaGet(key: string): Promise<string | null> {
  if (!isTauriAvailable()) return webMeta((s) => s.getItem(WEB_META_PREFIX + key), null);
  return command<string | null>('meta_get', { key });
}

export async function metaSet(key: string, value: string, valueType?: string): Promise<void> {
  if (!isTauriAvailable()) return webMeta((s) => s.setItem(WEB_META_PREFIX + key, value), undefined);
  return command('meta_set', { key, value, valueType: valueType ?? 'string' });
}

export async function metaDelete(key: string): Promise<void> {
  if (!isTauriAvailable()) return webMeta((s) => s.removeItem(WEB_META_PREFIX + key), undefined);
  return command('meta_delete', { key });
}

export async function metaAll(): Promise<Array<{ key: string; value: string | null; valueType: string }>> {
  if (!isTauriAvailable()) return [];
  const rows = await command<Array<[string, string | null, string]>>('meta_all');
  return rows.map(([key, value, valueType]) => ({ key, value, valueType }));
}