use rusqlite::params;
use tauri::State;

use crate::state::DbState;

fn init_schema(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    conn.execute_batch(
        "-- KV store (config / legacy)
        CREATE TABLE IF NOT EXISTS kv (
            key        TEXT PRIMARY KEY,
            value      TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );

        -- Flexible key/value for tenant metadata and app settings
        CREATE TABLE IF NOT EXISTS meta_entries (
            key        TEXT PRIMARY KEY NOT NULL,
            value      TEXT,
            value_type TEXT NOT NULL DEFAULT 'string'
                CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        );
        CREATE INDEX IF NOT EXISTS idx_meta_entries_key ON meta_entries(key);

        -- Tasks
        CREATE TABLE IF NOT EXISTS tasks (
            id           TEXT PRIMARY KEY NOT NULL,
            data         TEXT NOT NULL,
            planned_date TEXT,
            status       TEXT,
            project_id   TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks(planned_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

        -- Projects
        CREATE TABLE IF NOT EXISTS projects (
            id        TEXT PRIMARY KEY NOT NULL,
            data      TEXT NOT NULL,
            client_id TEXT,
            status    TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
        CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

        -- Clients (customers)
        CREATE TABLE IF NOT EXISTS clients (
            id   TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL
        );

        -- Service catalog
        CREATE TABLE IF NOT EXISTS services (
            id   TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL
        );

        -- Billing items (per project)
        CREATE TABLE IF NOT EXISTS billing_items (
            id         TEXT PRIMARY KEY NOT NULL,
            data       TEXT NOT NULL,
            project_id TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_billing_items_project_id ON billing_items(project_id);

        -- Billing item <-> task join table
        CREATE TABLE IF NOT EXISTS billing_item_tasks (
            billing_item_id TEXT NOT NULL,
            task_id         TEXT NOT NULL,
            created_at      TEXT NOT NULL,
            PRIMARY KEY (billing_item_id, task_id)
        );
        CREATE INDEX IF NOT EXISTS idx_billing_item_tasks_task_id ON billing_item_tasks(task_id);

        -- Time entries
        CREATE TABLE IF NOT EXISTS time_entries (
            id         TEXT PRIMARY KEY NOT NULL,
            data       TEXT NOT NULL,
            task_id    TEXT,
            is_running INTEGER DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
        CREATE INDEX IF NOT EXISTS idx_time_entries_is_running ON time_entries(is_running);

        -- Day plans
        CREATE TABLE IF NOT EXISTS day_plans (
            id   TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL,
            date TEXT NOT NULL UNIQUE
        );
        CREATE INDEX IF NOT EXISTS idx_day_plans_date ON day_plans(date);

        -- Calendar blocks
        CREATE TABLE IF NOT EXISTS calendar_blocks (
            id      TEXT PRIMARY KEY NOT NULL,
            data    TEXT NOT NULL,
            date    TEXT,
            task_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_calendar_blocks_date ON calendar_blocks(date);
        CREATE INDEX IF NOT EXISTS idx_calendar_blocks_task_id ON calendar_blocks(task_id);

        -- Weekly goals
        CREATE TABLE IF NOT EXISTS weekly_goals (
            id         TEXT PRIMARY KEY NOT NULL,
            data       TEXT NOT NULL,
            week_start TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_weekly_goals_week_start ON weekly_goals(week_start);

        -- Daily notes
        CREATE TABLE IF NOT EXISTS daily_notes (
            date TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL
        );

        -- Project templates
        CREATE TABLE IF NOT EXISTS project_templates (
            id   TEXT PRIMARY KEY NOT NULL,
            data TEXT NOT NULL
        );

        -- Invoices
        CREATE TABLE IF NOT EXISTS invoices (
            id             TEXT PRIMARY KEY NOT NULL,
            data           TEXT NOT NULL,
            client_id      TEXT,
            status         TEXT,
            invoice_number TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
        ",
    )
}

#[tauri::command]
pub fn db_open(state: State<DbState>, path: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = rusqlite::Connection::open(&path).map_err(|e| e.to_string())?;
    init_schema(&conn).map_err(|e| e.to_string())?;
    *state.conn.lock().unwrap() = Some(conn);
    Ok(())
}

#[tauri::command]
pub fn db_get(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    match conn.query_row(
        "SELECT value FROM kv WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    ) {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn db_set(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    conn.execute(
        "INSERT INTO kv (key, value, updated_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(key) DO UPDATE
           SET value = excluded.value,
               updated_at = excluded.updated_at",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_remove(state: State<DbState>, key: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    conn.execute("DELETE FROM kv WHERE key = ?1", params![key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_all_keys(state: State<DbState>) -> Result<Vec<String>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let mut stmt = conn
        .prepare("SELECT key FROM kv")
        .map_err(|e| e.to_string())?;
    let keys: rusqlite::Result<Vec<String>> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect();
    keys.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn meta_get(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    match conn.query_row(
        "SELECT value FROM meta_entries WHERE key = ?1",
        params![key],
        |row| row.get::<_, Option<String>>(0),
    ) {
        Ok(val) => Ok(val),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn meta_set(state: State<DbState>, key: String, value: Option<String>, value_type: Option<String>) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let vtype = value_type.unwrap_or_else(|| "string".to_string());
    conn.execute(
        "INSERT INTO meta_entries (key, value, value_type, updated_at)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         ON CONFLICT(key) DO UPDATE
           SET value = excluded.value,
               value_type = excluded.value_type,
               updated_at = excluded.updated_at",
        params![key, value, vtype],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn meta_delete(state: State<DbState>, key: String) -> Result<(), String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    conn.execute("DELETE FROM meta_entries WHERE key = ?1", params![key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn meta_all(state: State<DbState>) -> Result<Vec<(String, Option<String>, String)>, String> {
    let guard = state.conn.lock().unwrap();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    let mut stmt = conn
        .prepare("SELECT key, value, value_type FROM meta_entries ORDER BY key")
        .map_err(|e| e.to_string())?;
    let rows: rusqlite::Result<Vec<(String, Option<String>, String)>> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?
        .collect();
    rows.map_err(|e| e.to_string())
}
