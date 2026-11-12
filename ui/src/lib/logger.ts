// @core
import { command } from "@casoon/origin-client";
import { isTauriAvailable } from "./platform";
import { $appConfig } from "../stores/configStore";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function log(level: LogLevel, message: string): void {
  const formatted = `[${level}] ${message}`;
  if (level === "ERROR") console.error(formatted);
  else if (level === "WARN") console.warn(formatted);
  else console.log(formatted);

  if (isTauriAvailable()) {
    if ($appConfig.get().logging_enabled) {
      command("write_log", { level, message }).catch(() => {});
    }
  }
}

export const logger = {
  info: (msg: string) => log("INFO", msg),
  warn: (msg: string) => log("WARN", msg),
  error: (msg: string) => log("ERROR", msg),
  debug: (msg: string) => log("DEBUG", msg),
};