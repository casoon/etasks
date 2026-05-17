// @core
import { invoke } from "@tauri-apps/api/core";
import { isTauriAvailable } from "./platform";
import { $appConfig } from "../stores/configStore";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function getLogPath(): string | null {
  const config = $appConfig.get();
  if (!config.logging_enabled) return null;
  const tenant = config.active_tenant;
  if (!tenant) return null;
  const lastSlash = tenant.lastIndexOf("/");
  const dir = lastSlash >= 0 ? tenant.substring(0, lastSlash) : ".";
  return dir + "/app.log";
}

function log(level: LogLevel, message: string): void {
  const formatted = `[${level}] ${message}`;
  if (level === "ERROR") console.error(formatted);
  else if (level === "WARN") console.warn(formatted);
  else console.log(formatted);

  if (isTauriAvailable()) {
    const path = getLogPath();
    if (path) {
      invoke("write_log", { path, level, message }).catch(() => {});
    }
  }
}

export const logger = {
  info: (msg: string) => log("INFO", msg),
  warn: (msg: string) => log("WARN", msg),
  error: (msg: string) => log("ERROR", msg),
  debug: (msg: string) => log("DEBUG", msg),
};