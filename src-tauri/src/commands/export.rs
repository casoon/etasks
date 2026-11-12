use rusqlite::params;
use serde::Deserialize;
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

#[tauri::command]
pub async fn save_to_icloud(
    app: tauri::AppHandle,
    json: String,
    filename: String,
) -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Err("iCloud-Snapshots sind nur unter macOS verfügbar".to_string());
    }
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let icloud_base = home.join("Library/Mobile Documents/dev~jseidel~etasks/Documents");
    std::fs::create_dir_all(&icloud_base).map_err(|e| e.to_string())?;
    // Der Tages-Snapshot darf seine Datei desselben Tages überschreiben.
    std::fs::write(icloud_base.join(plain_file_name(&filename)?), &json).map_err(|e| e.to_string())?;
    Ok(())
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
