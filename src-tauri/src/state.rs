use std::sync::{Mutex, MutexGuard};

pub struct DbState {
    pub conn: Mutex<Option<rusqlite::Connection>>,
}

impl DbState {
    /// Sperrt die Verbindung. Ein Panic unter dem Lock vergiftet den Mutex; die Verbindung selbst
    /// bleibt benutzbar, daher wird das Gift ignoriert statt alle DB-Befehle lahmzulegen.
    pub fn lock(&self) -> MutexGuard<'_, Option<rusqlite::Connection>> {
        self.conn.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}
