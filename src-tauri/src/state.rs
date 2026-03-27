use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Option<rusqlite::Connection>>,
}
