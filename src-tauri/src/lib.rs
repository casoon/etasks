mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::export::export_to_file,
            commands::export::save_to_icloud,
            commands::export::open_ics_file,
            commands::notification::show_notification,
            commands::report::generate_project_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
