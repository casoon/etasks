use rusqlite::params;
use serde::Deserialize;
use serde_json::Value;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use crate::state::DbState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaImportEntry {
    pub key: String,
    pub value: Option<String>,
    pub value_type: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotImportPayload {
    pub tasks: Vec<Value>,
    pub blocks: Vec<Value>,
    pub goals: Vec<Value>,
    pub notes: Vec<Value>,
    pub clients: Vec<Value>,
    pub projects: Vec<Value>,
    pub services: Vec<Value>,
    pub time_entries: Vec<Value>,
    pub templates: Vec<Value>,
    pub billing_items: Vec<Value>,
    pub billing_item_tasks: Vec<Value>,
    pub day_plans: Vec<Value>,
    pub invoices: Vec<Value>,
    pub tenant_meta: Vec<MetaImportEntry>,
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
    let path = base_dir.join(&filename);
    std::fs::write(&path, &json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_to_icloud(
    app: tauri::AppHandle,
    json: String,
    filename: String,
) -> Result<(), String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let icloud_base = home.join("Library/Mobile Documents/dev~jseidel~etasks/Documents");
    std::fs::create_dir_all(&icloud_base).map_err(|e| e.to_string())?;
    std::fs::write(icloud_base.join(&filename), &json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_ics_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let result = app
        .dialog()
        .file()
        .add_filter("iCalendar", &["ics"])
        .blocking_pick_file();

    match result {
        Some(file_path) => {
            let path = match file_path {
                tauri_plugin_dialog::FilePath::Path(p) => p,
                tauri_plugin_dialog::FilePath::Url(url) => std::path::PathBuf::from(url.path()),
            };
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            Ok(Some(content))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn import_snapshot(
    state: tauri::State<DbState>,
    payload: SnapshotImportPayload,
) -> Result<(), String> {
    let mut guard = state.conn.lock().unwrap();
    let conn = guard.as_mut().ok_or("Keine Datenbank geöffnet")?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute_batch(
        "
        DELETE FROM billing_item_tasks;
        DELETE FROM billing_items;
        DELETE FROM invoices;
        DELETE FROM time_entries;
        DELETE FROM calendar_blocks;
        DELETE FROM weekly_goals;
        DELETE FROM daily_notes;
        DELETE FROM day_plans;
        DELETE FROM project_templates;
        DELETE FROM services;
        DELETE FROM projects;
        DELETE FROM clients;
        DELETE FROM tasks;
        DELETE FROM meta_entries;
        ",
    )
    .map_err(|e| e.to_string())?;

    for task in payload.tasks {
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

    for client in payload.clients {
        let id = client["id"].as_str().ok_or("client: missing id")?;
        let data = serde_json::to_string(&client).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO clients (id, data) VALUES (?1, ?2)",
            params![id, data],
        )
        .map_err(|e| e.to_string())?;
    }

    for project in payload.projects {
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

    for service in payload.services {
        let id = service["id"].as_str().ok_or("service: missing id")?;
        let data = serde_json::to_string(&service).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO services (id, data) VALUES (?1, ?2)",
            params![id, data],
        )
        .map_err(|e| e.to_string())?;
    }

    for item in payload.billing_items {
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

    for link in payload.billing_item_tasks {
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

    for entry in payload.time_entries {
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

    for plan in payload.day_plans {
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

    for block in payload.blocks {
        let id = block["id"].as_str().ok_or("block: missing id")?;
        let data = serde_json::to_string(&block).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO calendar_blocks (id, data, date, task_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, data, block["date"].as_str(), block["taskId"].as_str()],
        )
        .map_err(|e| e.to_string())?;
    }

    for goal in payload.goals {
        let id = goal["id"].as_str().ok_or("goal: missing id")?;
        let data = serde_json::to_string(&goal).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO weekly_goals (id, data, week_start)
             VALUES (?1, ?2, ?3)",
            params![id, data, goal["weekStart"].as_str()],
        )
        .map_err(|e| e.to_string())?;
    }

    for note in payload.notes {
        let date = note["date"].as_str().ok_or("note: missing date")?;
        let data = serde_json::to_string(&note).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO daily_notes (date, data) VALUES (?1, ?2)",
            params![date, data],
        )
        .map_err(|e| e.to_string())?;
    }

    for template in payload.templates {
        let id = template["id"].as_str().ok_or("template: missing id")?;
        let data = serde_json::to_string(&template).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO project_templates (id, data) VALUES (?1, ?2)",
            params![id, data],
        )
        .map_err(|e| e.to_string())?;
    }

    for invoice in payload.invoices {
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

    for meta in payload.tenant_meta {
        tx.execute(
            "INSERT INTO meta_entries (key, value, value_type, updated_at)
             VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))",
            params![meta.key, meta.value, meta.value_type],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
