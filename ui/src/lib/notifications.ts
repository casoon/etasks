// @core
import { isTauriAvailable } from './platform';
import { command } from '@casoon/origin-client';

export async function requestPermission(): Promise<void> {
  if (typeof window === 'undefined') return;
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/** `onClick` runs when the user clicks the notification (browser notifications only; the Tauri command has no click callback). */
export function notify(title: string, body: string, icon?: string, onClick?: () => void): void {
  if (typeof window === 'undefined') return;

  if (isTauriAvailable()) {
    command('show_notification', { title, body }).catch(console.warn);
    return;
  }

  if (!('Notification' in window)) return;

  const show = () => {
    const n = new Notification(title, { body, icon });
    if (onClick) n.onclick = () => { window.focus(); onClick(); n.close(); };
  };
  if (Notification.permission === 'granted') {
    show();
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') show();
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