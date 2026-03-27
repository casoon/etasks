mod commands;
mod state;

use state::DbState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DbState {
            conn: std::sync::Mutex::new(None),
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::config::load_config,
            commands::config::save_config,
            commands::config::pick_directory,
            commands::database::db_open,
            commands::database::db_get,
            commands::database::db_set,
            commands::database::db_remove,
            commands::database::db_all_keys,
            commands::export::export_to_file,
            commands::export::save_to_icloud,
            commands::export::open_ics_file,
            commands::invoice::generate_invoice,
            commands::notification::show_notification,
            commands::report::generate_project_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
