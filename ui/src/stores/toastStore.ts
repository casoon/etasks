import { atom } from 'nanostores';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export const $toasts = atom<Toast[]>([]);

export function toast(message: string, type: ToastType = 'info', duration = 3000): void {
  const id = Math.random().toString(36).slice(2);
  $toasts.set([...$toasts.get(), { id, message, type }]);
  setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: string): void {
  $toasts.set($toasts.get().filter(t => t.id !== id));
}
