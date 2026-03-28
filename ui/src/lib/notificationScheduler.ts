/**
 * Scheduled notifications: daily shutdown reminder + break reminders.
 * Call startNotificationScheduler() once after app boot.
 * Call stopNotificationScheduler() on cleanup.
 */

import { notify } from "./notifications";
import { $appConfig } from "../stores/configStore";
import { $energyCheckPending } from "../stores/uiStore";

let shutdownInterval: ReturnType<typeof setInterval> | null = null;
let breakInterval: ReturnType<typeof setInterval> | null = null;
let lastBreakAt = Date.now();

// Track which HH:MM we already fired shutdown for (prevent double-fire within same minute)
let lastShutdownFired = "";

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function checkShutdown() {
  const profile = $appConfig.get()?.profile;
  const shutdownTime = profile?.shutdown_time?.trim();
  if (!shutdownTime) return;

  const now = nowHHMM();
  if (now === shutdownTime && lastShutdownFired !== now) {
    lastShutdownFired = now;
    notify(
      "Tagesabschluss 🌙",
      "Zeit, den Tag abzuschließen. Wie war heute?"
    );
  }
}

function checkBreak() {
  const profile = $appConfig.get()?.profile;
  const intervalMinutes = profile?.break_interval_minutes ?? 0;
  if (!intervalMinutes || intervalMinutes <= 0) return;

  const elapsedMs = Date.now() - lastBreakAt;
  if (elapsedMs >= intervalMinutes * 60 * 1000) {
    lastBreakAt = Date.now();
    notify(
      "Zeit für eine Pause ☕",
      `Du arbeitest schon ${intervalMinutes} Minuten. Kurze Pause einlegen?`
    );
    $energyCheckPending.set(true);
  }
}

export function startNotificationScheduler(): void {
  stopNotificationScheduler();

  // Check shutdown time every minute
  shutdownInterval = setInterval(checkShutdown, 60 * 1000);
  // Check break interval every 5 minutes (fine-grained enough)
  breakInterval = setInterval(checkBreak, 5 * 60 * 1000);
}

export function stopNotificationScheduler(): void {
  if (shutdownInterval) {
    clearInterval(shutdownInterval);
    shutdownInterval = null;
  }
  if (breakInterval) {
    clearInterval(breakInterval);
    breakInterval = null;
  }
}

/** Call this when the user confirms a break was taken (resets the break timer). */
export function resetBreakTimer(): void {
  lastBreakAt = Date.now();
}
