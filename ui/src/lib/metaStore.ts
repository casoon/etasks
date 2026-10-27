// @core
import { command } from '@casoon/origin-client';
import { isTauriAvailable } from './platform';

export async function metaGet(key: string): Promise<string | null> {
  if (!isTauriAvailable()) return null;
  return command<string | null>('meta_get', { key });
}

export async function metaSet(key: string, value: string, valueType?: string): Promise<void> {
  if (!isTauriAvailable()) return;
  return command('meta_set', { key, value, valueType: valueType ?? 'string' });
}

export async function metaDelete(key: string): Promise<void> {
  if (!isTauriAvailable()) return;
  return command('meta_delete', { key });
}

export async function metaAll(): Promise<Array<{ key: string; value: string | null; valueType: string }>> {
  if (!isTauriAvailable()) return [];
  const rows = await command<Array<[string, string | null, string]>>('meta_all');
  return rows.map(([key, value, valueType]) => ({ key, value, valueType }));
}