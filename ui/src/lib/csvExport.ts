// @core
import { command } from "@casoon/origin-client";
import { $appConfig } from "../stores/configStore";
import { isTauriAvailable } from "./platform";

/** Saves a CSV in the export folder (desktop app) or downloads it (browser); desktop returns the path. */
export async function saveCsvFile(filename: string, csv: string): Promise<string | null> {
  if (isTauriAvailable()) {
    return command<string>("export_to_file", {
      json: csv,
      filename,
      directory: $appConfig.get()?.default_export_dir ?? null,
    });
  }
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return null;
}
