/// Entity-specific CRUD commands for all relational tables.
///
/// Pattern for every entity:
///   list_X()          → Vec<serde_json::Value>   (read all rows)
///   upsert_X(item)    → ()                       (insert or replace)
///   delete_X(id)      → ()                       (delete by id)
///
/// The full JSON object is stored in the `data` column; frequently-queried
/// fields are additionally extracted into indexed columns for efficient
/// server-side filtering (future use).
use rusqlite::params;
use serde_json::Value;
use tauri::State;

use crate::state::DbState;

// ── Helper ─────────────────────────────────────────────────────────────────

fn list_table(conn: &rusqlite::Connection, table: &str) -> Result<Vec<Value>, String> {
    let sql = format!("SELECT data FROM {table}");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows: rusqlite::Result<Vec<Value>> = stmt
        .query_map([], |row| {
            let data: String = row.get(0)?;
            Ok(serde_json::from_str(&data).unwrap_or(Value::Null))
        })
        .map_err(|e| e.to_string())?
        .collect();
    rows.map_err(|e| e.to_string())
}

fn delete_by_id(conn: &rusqlite::Connection, table: &str, id: &str) -> Result<(), String> {
    let sql = format!("DELETE FROM {table} WHERE id = ?1");
    conn.execute(&sql, params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ── Tasks ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_tasks(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "tasks")
}

#[tauri::command]
pub fn upsert_task(state: State<DbState>, task: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = task["id"].as_str().ok_or("task: missing id")?;
    let data = serde_json::to_string(&task).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tasks (id, data, planned_date, status, project_id)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
           data         = excluded.data,
           planned_date = excluded.planned_date,
           status       = excluded.status,
           project_id   = excluded.project_id",
        params![
            id,
            data,
            task["plannedDate"].as_str(),
            task["status"].as_str(),
            task["projectId"].as_str()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_task(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "tasks", &id)
}

// ── Projects ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_projects(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "projects")
}

#[tauri::command]
pub fn upsert_project(state: State<DbState>, project: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = project["id"].as_str().ok_or("project: missing id")?;
    let data = serde_json::to_string(&project).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO projects (id, data, client_id, status)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
           data      = excluded.data,
           client_id = excluded.client_id,
           status    = excluded.status",
        params![
            id,
            data,
            project["clientId"].as_str(),
            project["status"].as_str()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_project(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "projects", &id)
}

// ── Clients ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_clients(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "clients")
}

#[tauri::command]
pub fn upsert_client(state: State<DbState>, client: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = client["id"].as_str().ok_or("client: missing id")?;
    let data = serde_json::to_string(&client).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO clients (id, data) VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        params![id, data],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_client(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "clients", &id)
}

// ── Services ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_services(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "services")
}

#[tauri::command]
pub fn upsert_service(state: State<DbState>, service: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = service["id"].as_str().ok_or("service: missing id")?;
    let data = serde_json::to_string(&service).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO services (id, data) VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        params![id, data],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_service(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "services", &id)
}

// ── Billing Items ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_billing_items(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "billing_items")
}

#[tauri::command]
pub fn upsert_billing_item(state: State<DbState>, item: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = item["id"].as_str().ok_or("billing_item: missing id")?;
    let project_id = item["projectId"].as_str().ok_or("billing_item: missing projectId")?;
    let data = serde_json::to_string(&item).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO billing_items (id, data, project_id)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET
           data       = excluded.data,
           project_id = excluded.project_id",
        params![id, data, project_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_billing_item(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    // cascade: also remove join rows
    conn.execute("DELETE FROM billing_item_tasks WHERE billing_item_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    delete_by_id(conn, "billing_items", &id)
}

// ── Billing Item Tasks (join) ──────────────────────────────────────────────

#[tauri::command]
pub fn list_billing_item_tasks(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let mut stmt = conn
        .prepare("SELECT billing_item_id, task_id, created_at FROM billing_item_tasks")
        .map_err(|e| e.to_string())?;
    let rows: rusqlite::Result<Vec<Value>> = stmt
        .query_map([], |row| {
            let billing_item_id: String = row.get(0)?;
            let task_id: String = row.get(1)?;
            let created_at: String = row.get(2)?;
            Ok(serde_json::json!({
                "billingItemId": billing_item_id,
                "taskId": task_id,
                "createdAt": created_at,
            }))
        })
        .map_err(|e| e.to_string())?
        .collect();
    rows.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_billing_item_task(
    state: State<DbState>,
    billing_item_id: String,
    task_id: String,
    created_at: String,
) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    conn.execute(
        "INSERT OR IGNORE INTO billing_item_tasks (billing_item_id, task_id, created_at)
         VALUES (?1, ?2, ?3)",
        params![billing_item_id, task_id, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_billing_item_task(
    state: State<DbState>,
    billing_item_id: String,
    task_id: String,
) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    conn.execute(
        "DELETE FROM billing_item_tasks WHERE billing_item_id = ?1 AND task_id = ?2",
        params![billing_item_id, task_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Time Entries ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_time_entries(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "time_entries")
}

#[tauri::command]
pub fn upsert_time_entry(state: State<DbState>, entry: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = entry["id"].as_str().ok_or("time_entry: missing id")?;
    let data = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
    let is_running: i32 = if entry["isRunning"].as_bool().unwrap_or(false) { 1 } else { 0 };
    conn.execute(
        "INSERT INTO time_entries (id, data, task_id, is_running)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
           data       = excluded.data,
           task_id    = excluded.task_id,
           is_running = excluded.is_running",
        params![id, data, entry["taskId"].as_str(), is_running],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_time_entry(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "time_entries", &id)
}

// ── Day Plans ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_day_plans(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "day_plans")
}

#[tauri::command]
pub fn upsert_day_plan(state: State<DbState>, plan: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = plan["id"].as_str().ok_or("day_plan: missing id")?;
    let date = plan["date"].as_str().ok_or("day_plan: missing date")?;
    let data = serde_json::to_string(&plan).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO day_plans (id, data, date)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(date) DO UPDATE SET id = excluded.id, data = excluded.data",
        params![id, data, date],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Calendar Blocks ────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_blocks(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "calendar_blocks")
}

#[tauri::command]
pub fn upsert_block(state: State<DbState>, block: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = block["id"].as_str().ok_or("block: missing id")?;
    let data = serde_json::to_string(&block).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO calendar_blocks (id, data, date, task_id)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
           data    = excluded.data,
           date    = excluded.date,
           task_id = excluded.task_id",
        params![id, data, block["date"].as_str(), block["taskId"].as_str()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_block(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "calendar_blocks", &id)
}

#[tauri::command]
pub fn delete_blocks_by_task_id(state: State<DbState>, task_id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    conn.execute(
        "DELETE FROM calendar_blocks WHERE task_id = ?1",
        params![task_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Weekly Goals ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_goals(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "weekly_goals")
}

#[tauri::command]
pub fn upsert_goal(state: State<DbState>, goal: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = goal["id"].as_str().ok_or("goal: missing id")?;
    let data = serde_json::to_string(&goal).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO weekly_goals (id, data, week_start)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, week_start = excluded.week_start",
        params![id, data, goal["weekStart"].as_str()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_goal(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "weekly_goals", &id)
}

// ── Daily Notes ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_notes(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "daily_notes")
}

#[tauri::command]
pub fn upsert_note(state: State<DbState>, note: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let date = note["date"].as_str().ok_or("note: missing date")?;
    let data = serde_json::to_string(&note).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO daily_notes (date, data) VALUES (?1, ?2)
         ON CONFLICT(date) DO UPDATE SET data = excluded.data",
        params![date, data],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Invoices ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_invoices(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "invoices")
}

#[tauri::command]
pub fn upsert_invoice(state: State<DbState>, invoice: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = invoice["id"].as_str().ok_or("invoice: missing id")?;
    let data = serde_json::to_string(&invoice).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO invoices (id, data, client_id, status, invoice_number)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
           data           = excluded.data,
           client_id      = excluded.client_id,
           status         = excluded.status,
           invoice_number = excluded.invoice_number",
        params![
            id,
            data,
            invoice["clientId"].as_str(),
            invoice["status"].as_str(),
            invoice["invoiceNumber"].as_str()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_invoice(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "invoices", &id)
}

// ── Project Templates ──────────────────────────────────────────────────────

#[tauri::command]
pub fn list_templates(state: State<DbState>) -> Result<Vec<Value>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    list_table(conn, "project_templates")
}

#[tauri::command]
pub fn upsert_template(state: State<DbState>, template: Value) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let id = template["id"].as_str().ok_or("template: missing id")?;
    let data = serde_json::to_string(&template).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO project_templates (id, data) VALUES (?1, ?2)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data",
        params![id, data],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_template(state: State<DbState>, id: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    delete_by_id(conn, "project_templates", &id)
}
