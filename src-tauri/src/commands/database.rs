use rusqlite::params;
use tauri::State;

use crate::state::DbState;

/// Schema-Migrationen in Reihenfolge. Eintrag `i` hebt `user_version` von `i` auf `i + 1`.
/// Neue Schemaänderungen kommen als weiterer Eintrag ans Ende; bestehende Einträge bleiben stehen.
/// Jede Migration muss idempotent sein (Datenbanken ohne `user_version` laufen ab Eintrag 0).
const MIGRATIONS: &[&str] = &[SCHEMA_V1];

fn run_migrations(conn: &mut rusqlite::Connection, migrations: &[&str]) -> Result<(), String> {
    let current: usize = conn
        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())? as usize;
    if current > migrations.len() {
        return Err(format!(
            "Die Datenbank stammt aus einer neueren eTasks-Version (Schema {current}, bekannt {}).",
            migrations.len()
        ));
    }
    for (index, sql) in migrations.iter().enumerate().skip(current) {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute_batch(sql).map_err(|e| e.to_string())?;
        tx.execute_batch(&format!("PRAGMA user_version = {}", index + 1))
            .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) fn init_schema(conn: &mut rusqlite::Connection) -> Result<(), String> {
    conn.busy_timeout(std::time::Duration::from_millis(5000))
        .map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .map_err(|e| e.to_string())?;
    run_migrations(conn, MIGRATIONS)
}

const SCHEMA_V1: &str =
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
        ";

#[tauri::command]
pub fn db_open(app: tauri::AppHandle, state: State<DbState>, path: String) -> Result<(), String> {
    crate::commands::config::ensure_db_open_allowed(&app, &path)?;
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut conn = rusqlite::Connection::open(&path).map_err(|e| e.to_string())?;
    init_schema(&mut conn)?;
    *state.lock() = Some(conn);
    Ok(())
}

#[tauri::command]
pub fn db_get(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let guard = state.lock();
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
    let guard = state.lock();
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
    let guard = state.lock();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    conn.execute("DELETE FROM kv WHERE key = ?1", params![key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_all_keys(state: State<DbState>) -> Result<Vec<String>, String> {
    let guard = state.lock();
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
    let guard = state.lock();
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
    let guard = state.lock();
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
    let guard = state.lock();
    let conn = guard.as_ref().ok_or("Keine Datenbank geöffnet")?;
    conn.execute("DELETE FROM meta_entries WHERE key = ?1", params![key])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn meta_all(state: State<DbState>) -> Result<Vec<(String, Option<String>, String)>, String> {
    let guard = state.lock();
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

#[cfg(test)]
mod tests {
    use super::*;

    fn user_version(conn: &rusqlite::Connection) -> i64 {
        conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap()
    }

    #[test]
    fn fresh_database_gets_the_current_schema_version() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        init_schema(&mut conn).unwrap();
        assert_eq!(user_version(&conn), MIGRATIONS.len() as i64);
        conn.execute("INSERT INTO tasks (id, data) VALUES ('t', '{}')", []).unwrap();
    }

    #[test]
    fn existing_database_without_user_version_is_migrated_and_keeps_its_data() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(SCHEMA_V1).unwrap();
        conn.execute("INSERT INTO tasks (id, data) VALUES ('t', '{}')", []).unwrap();
        assert_eq!(user_version(&conn), 0);

        init_schema(&mut conn).unwrap();
        init_schema(&mut conn).unwrap();
        assert_eq!(user_version(&conn), 1);
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM tasks", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn migrations_run_in_order_once_and_a_newer_database_is_rejected() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        let migrations = [
            "CREATE TABLE a (x INTEGER);",
            "ALTER TABLE a ADD COLUMN y INTEGER;",
        ];
        run_migrations(&mut conn, &migrations[..1]).unwrap();
        assert_eq!(user_version(&conn), 1);
        run_migrations(&mut conn, &migrations).unwrap();
        run_migrations(&mut conn, &migrations).unwrap();
        assert_eq!(user_version(&conn), 2);
        conn.execute("INSERT INTO a (x, y) VALUES (1, 2)", []).unwrap();

        assert!(run_migrations(&mut conn, &migrations[..1]).unwrap_err().contains("neueren"));
    }

    #[test]
    fn a_failing_migration_leaves_the_version_untouched() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        assert!(run_migrations(&mut conn, &["CREATE TABLE a (x); NOT SQL;"]).is_err());
        assert_eq!(user_version(&conn), 0);
    }

    #[test]
    fn poisoned_lock_is_recovered() {
        let state = std::sync::Arc::new(DbState { conn: std::sync::Mutex::new(None) });
        let clone = state.clone();
        let _ = std::thread::spawn(move || {
            let _guard = clone.conn.lock().unwrap();
            panic!("poison");
        })
        .join();
        assert!(state.conn.is_poisoned());
        assert!(state.lock().is_none());
    }
}
