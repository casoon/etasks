import { isTauriAvailable } from './platform';
import { invoke } from '@tauri-apps/api/core';

export async function requestPermission(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function notify(title: string, body: string, icon?: string): void {
  if (typeof window === 'undefined') return;

  if (isTauriAvailable()) {
    invoke('show_notification', { title, body }).catch(console.warn);
    return;
  }

  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon });
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') new Notification(title, { body, icon });
    });
  }
}

export function notifyPomodoroComplete(taskTitle?: string): void {
  const body = taskTitle
    ? `Gut gemacht! „${taskTitle}" abgeschlossen.`
    : 'Pomodoro abgeschlossen – mach eine kurze Pause.';
  notify('Fokus-Session beendet ✓', body);
}

export function notifyTaskDue(taskTitle: string): void {
  notify('Aufgabe fällig', `„${taskTitle}" steht jetzt an.`);
}
