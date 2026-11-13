use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;

use crate::commands::fsutil::{free_path, plain_file_name};
use crate::state::DbState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
/// Lists missing from the payload leave the matching tables untouched.
/// Profile and workspace meta are never part of an import.
pub struct SnapshotImportPayload {
    #[serde(default)]
    pub tasks: Option<Vec<Value>>,
    #[serde(default)]
    pub blocks: Option<Vec<Value>>,
    #[serde(default)]
    pub goals: Option<Vec<Value>>,
    #[serde(default)]
    pub notes: Option<Vec<Value>>,
    #[serde(default)]
    pub clients: Option<Vec<Value>>,
    #[serde(default)]
    pub projects: Option<Vec<Value>>,
    #[serde(default)]
    pub services: Option<Vec<Value>>,
    #[serde(default)]
    pub time_entries: Option<Vec<Value>>,
    #[serde(default)]
    pub templates: Option<Vec<Value>>,
    #[serde(default)]
    pub billing_items: Option<Vec<Value>>,
    #[serde(default)]
    pub billing_item_tasks: Option<Vec<Value>>,
    #[serde(default)]
    pub day_plans: Option<Vec<Value>>,
    #[serde(default)]
    pub invoices: Option<Vec<Value>>,
    // Stored in the kv table; absent in backups from older versions.
    #[serde(default)]
    pub termine: Option<Vec<Value>>,
    #[serde(default)]
    pub week_plans: Option<Vec<Value>>,
}

#[tauri::command]
pub async fn export_to_file(
    app: tauri::AppHandle,
    json: String,
    filename: String,
    directory: Option<String>,
) -> Result<String, String> {
    let base_dir = match directory {
        Some(dir) if !dir.trim().is_empty() => std::path::PathBuf::from(dir),
        _ => app.path().download_dir().map_err(|e| e.to_string())?,
    };
    std::fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;
    let path = free_path(&base_dir, &plain_file_name(&filename)?, None);
    std::fs::write(&path, &json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Wie viele Tages-Sicherungen pro Arbeitsbereich im Ordner bleiben.
const KEEP_DAILY_SNAPSHOTS: usize = 14;

/// Zerlegt `snapshot-<slug>-<YYYY-MM-DD>.json` in Slug und Datum; alles andere ist keine eigene Sicherung.
fn snapshot_parts(name: &str) -> Option<(&str, &str)> {
    let rest = name.strip_prefix("snapshot-")?.strip_suffix(".json")?;
    let (slug, date) = rest.split_at(rest.len().checked_sub(10)?);
    let slug = slug.strip_suffix('-')?;
    let b = date.as_bytes();
    let is_date = b.iter().enumerate().all(|(i, c)| match i {
        4 | 7 => *c == b'-',
        _ => c.is_ascii_digit(),
    });
    (is_date && !slug.is_empty()).then_some((slug, date))
}

/// Löscht die ältesten Tages-Sicherungen desselben Arbeitsbereichs über `keep` hinaus.
/// Angefasst werden nur Dateien, die exakt dem eigenen Namensmuster entsprechen.
fn prune_snapshots(dir: &std::path::Path, slug: &str, keep: usize) -> Result<(), String> {
    let mut own: Vec<(String, std::path::PathBuf)> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let (file_slug, date) = snapshot_parts(&name)?;
            (file_slug == slug && entry.file_type().ok()?.is_file())
                .then(|| (date.to_string(), entry.path()))
        })
        .collect();
    own.sort();
    let excess = own.len().saturating_sub(keep);
    for (_, path) in own.into_iter().take(excess) {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn snapshot_dir(app: &tauri::AppHandle, directory: Option<String>) -> Result<std::path::PathBuf, String> {
    let base_dir = match directory {
        Some(dir) if !dir.trim().is_empty() => std::path::PathBuf::from(dir),
        _ => app.path().download_dir().map_err(|e| e.to_string())?,
    };
    Ok(base_dir.join("Sicherungen"))
}

/// Schreibt die tägliche Sicherung in `<directory>/Sicherungen` (Standard: Downloads-Ordner)
/// und behält die letzten 14 pro Arbeitsbereich.
#[tauri::command]
pub async fn save_daily_snapshot(
    app: tauri::AppHandle,
    json: String,
    filename: String,
    directory: Option<String>,
) -> Result<String, String> {
    let dir = snapshot_dir(&app, directory)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let filename = plain_file_name(&filename)?;
    let (slug, _) = snapshot_parts(&filename).ok_or("Ungültiger Sicherungsname")?;
    let slug = slug.to_string();
    // Die Sicherung desselben Tages darf ihre Datei überschreiben.
    let path = dir.join(&filename);
    std::fs::write(&path, &json).map_err(|e| e.to_string())?;
    prune_snapshots(&dir, &slug, KEEP_DAILY_SNAPSHOTS)?;
    Ok(path.to_string_lossy().to_string())
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    pub filename: String,
    /// `YYYY-MM-DD` aus dem Dateinamen.
    pub date: String,
    pub size_bytes: u64,
}

/// Eigene Sicherungen des Arbeitsbereichs `slug` im Ordner, neueste zuerst.
fn list_snapshot_files(dir: &std::path::Path, slug: &str) -> Result<Vec<SnapshotInfo>, String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e.to_string()),
    };
    let mut list: Vec<SnapshotInfo> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let (file_slug, date) = snapshot_parts(&name)?;
            let meta = entry.metadata().ok()?;
            let date = date.to_string();
            (file_slug == slug && meta.is_file()).then(|| SnapshotInfo {
                date,
                size_bytes: meta.len(),
                filename: name,
            })
        })
        .collect();
    list.sort_by(|a, b| b.date.cmp(&a.date));
    Ok(list)
}

/// Listet die Sicherungen des Arbeitsbereichs im Ordner `Sicherungen`.
#[tauri::command]
pub async fn list_snapshots(
    app: tauri::AppHandle,
    slug: String,
    directory: Option<String>,
) -> Result<Vec<SnapshotInfo>, String> {
    list_snapshot_files(&snapshot_dir(&app, directory)?, &slug)
}

/// Liest den Text einer Sicherung; nur Dateien mit eigenem Namensmuster im Ordner `Sicherungen`.
#[tauri::command]
pub async fn read_snapshot(
    app: tauri::AppHandle,
    filename: String,
    directory: Option<String>,
) -> Result<String, String> {
    let filename = plain_file_name(&filename)?;
    snapshot_parts(&filename).ok_or("Ungültiger Sicherungsname")?;
    std::fs::read_to_string(snapshot_dir(&app, directory)?.join(&filename)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_snapshot(
    state: tauri::State<DbState>,
    payload: SnapshotImportPayload,
) -> Result<(), String> {
    let mut guard = state.lock();
    let conn = guard.as_mut().ok_or("Keine Datenbank geöffnet")?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    for (present, table) in [
        (payload.billing_item_tasks.is_some(), "billing_item_tasks"),
        (payload.billing_items.is_some(), "billing_items"),
        (payload.invoices.is_some(), "invoices"),
        (payload.time_entries.is_some(), "time_entries"),
        (payload.blocks.is_some(), "calendar_blocks"),
        (payload.goals.is_some(), "weekly_goals"),
        (payload.notes.is_some(), "daily_notes"),
        (payload.day_plans.is_some(), "day_plans"),
        (payload.templates.is_some(), "project_templates"),
        (payload.services.is_some(), "services"),
        (payload.projects.is_some(), "projects"),
        (payload.clients.is_some(), "clients"),
        (payload.tasks.is_some(), "tasks"),
    ] {
        if present {
            tx.execute(&format!("DELETE FROM {table}"), [])
                .map_err(|e| e.to_string())?;
        }
    }

    for task in payload.tasks.unwrap_or_default() {
        let id = task["id"].as_str().ok_or("task: missing id")?;
        let data = serde_json::to_string(&task).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO tasks (id, data, planned_date, status, project_id)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                id,
                data,
                task["plannedDate"].as_str(),
                task["status"].as_str(),
                task["projectId"].as_str()
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    for client in payload.clients.unwrap_or_default() {
        let id = client["id"].as_str().ok_or("client: missing id")?;
        let data = serde_json::to_string(&client).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO clients (id, data) VALUES (?1, ?2)",
            params![id, data],
        )
        .map_err(|e| e.to_string())?;
    }

    for project in payload.projects.unwrap_or_default() {
        let id = project["id"].as_str().ok_or("project: missing id")?;
        let data = serde_json::to_string(&project).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO projects (id, data, client_id, status)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                id,
                data,
                project["clientId"].as_str(),
                project["status"].as_str()
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    for service in payload.services.unwrap_or_default() {
        let id = service["id"].as_str().ok_or("service: missing id")?;
        let data = serde_json::to_string(&service).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO services (id, data) VALUES (?1, ?2)",
            params![id, data],
        )
        .map_err(|e| e.to_string())?;
    }

    for item in payload.billing_items.unwrap_or_default() {
        let id = item["id"].as_str().ok_or("billing_item: missing id")?;
        let project_id = item["projectId"]
            .as_str()
            .ok_or("billing_item: missing projectId")?;
        let data = serde_json::to_string(&item).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO billing_items (id, data, project_id)
             VALUES (?1, ?2, ?3)",
            params![id, data, project_id],
        )
        .map_err(|e| e.to_string())?;
    }

    for link in payload.billing_item_tasks.unwrap_or_default() {
        let billing_item_id = link["billingItemId"]
            .as_str()
            .ok_or("billing_item_task: missing billingItemId")?;
        let task_id = link["taskId"]
            .as_str()
            .ok_or("billing_item_task: missing taskId")?;
        let created_at = link["createdAt"]
            .as_str()
            .ok_or("billing_item_task: missing createdAt")?;
        tx.execute(
            "INSERT INTO billing_item_tasks (billing_item_id, task_id, created_at)
             VALUES (?1, ?2, ?3)",
            params![billing_item_id, task_id, created_at],
        )
        .map_err(|e| e.to_string())?;
    }

    for entry in payload.time_entries.unwrap_or_default() {
        let id = entry["id"].as_str().ok_or("time_entry: missing id")?;
        let data = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
        let is_running: i32 = if entry["isRunning"].as_bool().unwrap_or(false) {
            1
        } else {
            0
        };
        tx.execute(
            "INSERT INTO time_entries (id, data, task_id, is_running)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, data, entry["taskId"].as_str(), is_running],
        )
        .map_err(|e| e.to_string())?;
    }

    for plan in payload.day_plans.unwrap_or_default() {
        let id = plan["id"].as_str().ok_or("day_plan: missing id")?;
        let date = plan["date"].as_str().ok_or("day_plan: missing date")?;
        let data = serde_json::to_string(&plan).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO day_plans (id, data, date)
             VALUES (?1, ?2, ?3)",
            params![id, data, date],
        )
        .map_err(|e| e.to_string())?;
    }

    for block in payload.blocks.unwrap_or_default() {
        let id = block["id"].as_str().ok_or("block: missing id")?;
        let data = serde_json::to_string(&block).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO calendar_blocks (id, data, date, task_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, data, block["date"].as_str(), block["taskId"].as_str()],
        )
        .map_err(|e| e.to_string())?;
    }

    for goal in payload.goals.unwrap_or_default() {
        let id = goal["id"].as_str().ok_or("goal: missing id")?;
        let data = serde_json::to_string(&goal).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO weekly_goals (id, data, week_start)
             VALUES (?1, ?2, ?3)",
            params![id, data, goal["weekStart"].as_str()],
        )
        .map_err(|e| e.to_string())?;
    }

    for note in payload.notes.unwrap_or_default() {
        let date = note["date"].as_str().ok_or("note: missing date")?;
        let data = serde_json::to_string(&note).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO daily_notes (date, data) VALUES (?1, ?2)",
            params![date, data],
        )
        .map_err(|e| e.to_string())?;
    }

    for template in payload.templates.unwrap_or_default() {
        let id = template["id"].as_str().ok_or("template: missing id")?;
        let data = serde_json::to_string(&template).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO project_templates (id, data) VALUES (?1, ?2)",
            params![id, data],
        )
        .map_err(|e| e.to_string())?;
    }

    for invoice in payload.invoices.unwrap_or_default() {
        let id = invoice["id"].as_str().ok_or("invoice: missing id")?;
        let data = serde_json::to_string(&invoice).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO invoices (id, data, client_id, status, invoice_number)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                id,
                data,
                invoice["clientId"].as_str(),
                invoice["status"].as_str(),
                invoice["invoiceNumber"].as_str()
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    for (key, list) in [
        ("etasks:termine", payload.termine),
        ("etasks:weekPlans", payload.week_plans),
    ] {
        if let Some(list) = list {
            let value = serde_json::to_string(&list).map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT INTO kv (key, value, updated_at)
                 VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
                 ON CONFLICT(key) DO UPDATE
                   SET value = excluded.value,
                       updated_at = excluded.updated_at",
                params![key, value],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch(dir: &std::path::Path, name: &str) {
        std::fs::write(dir.join(name), "{}").unwrap();
    }

    fn names(dir: &std::path::Path) -> Vec<String> {
        let mut v: Vec<String> = std::fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        v.sort();
        v
    }

    #[test]
    fn only_own_pattern_is_recognised() {
        assert_eq!(
            snapshot_parts("snapshot-buero-a-2026-03-28.json"),
            Some(("buero-a", "2026-03-28"))
        );
        assert_eq!(snapshot_parts("snapshot-2026-03-28.json"), None);
        assert_eq!(snapshot_parts("snapshot-x-2026-3-28.json"), None);
        assert_eq!(snapshot_parts("etasks-export-x-2026-03-28.json"), None);
        assert_eq!(snapshot_parts("snapshot-x-2026-03-28.json.bak"), None);
    }

    #[test]
    fn lists_own_snapshots_newest_first() {
        let dir = std::env::temp_dir().join(format!("etasks-list-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        touch(&dir, "snapshot-a-2026-03-01.json");
        touch(&dir, "snapshot-a-2026-03-03.json");
        touch(&dir, "snapshot-b-2026-03-04.json");
        touch(&dir, "notes.json");

        let list = list_snapshot_files(&dir, "a").unwrap();
        assert_eq!(
            list.iter().map(|i| i.filename.as_str()).collect::<Vec<_>>(),
            vec!["snapshot-a-2026-03-03.json", "snapshot-a-2026-03-01.json"]
        );
        assert_eq!(list[0].date, "2026-03-03");
        assert!(list_snapshot_files(&dir.join("fehlt"), "a").unwrap().is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn prune_keeps_newest_of_same_workspace_and_ignores_the_rest() {
        let dir = std::env::temp_dir().join(format!("etasks-prune-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for day in 1..=5 {
            touch(&dir, &format!("snapshot-a-2026-03-0{day}.json"));
        }
        touch(&dir, "snapshot-a-b-2026-03-01.json");
        touch(&dir, "snapshot-other-2026-01-01.json");
        touch(&dir, "notes.json");
        touch(&dir, "etasks-export-a-2026-01-01.json");

        prune_snapshots(&dir, "a", 3).unwrap();

        assert_eq!(
            names(&dir),
            vec![
                "etasks-export-a-2026-01-01.json",
                "notes.json",
                "snapshot-a-2026-03-03.json",
                "snapshot-a-2026-03-04.json",
                "snapshot-a-2026-03-05.json",
                "snapshot-a-b-2026-03-01.json",
                "snapshot-other-2026-01-01.json",
            ]
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
