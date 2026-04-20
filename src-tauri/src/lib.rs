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
            commands::config::default_tenant_path,
            commands::config::default_workspace_paths,
            commands::config::workspace_paths,
            commands::config::app_paths,
            commands::config::default_export_dir,
            commands::config::pick_tenant_path,
            commands::config::import_logo_file,
            commands::config::file_exists,
            commands::config::list_workspace_files,
            commands::config::write_log,
            commands::database::db_open,
            commands::database::db_get,
            commands::database::db_set,
            commands::database::db_remove,
            commands::database::db_all_keys,
            commands::database::meta_get,
            commands::database::meta_set,
            commands::database::meta_delete,
            commands::database::meta_all,
            commands::entities::list_tasks,
            commands::entities::upsert_task,
            commands::entities::delete_task,
            commands::entities::list_projects,
            commands::entities::upsert_project,
            commands::entities::delete_project,
            commands::entities::list_clients,
            commands::entities::upsert_client,
            commands::entities::delete_client,
            commands::entities::list_services,
            commands::entities::upsert_service,
            commands::entities::delete_service,
            commands::entities::list_billing_items,
            commands::entities::upsert_billing_item,
            commands::entities::delete_billing_item,
            commands::entities::list_billing_item_tasks,
            commands::entities::add_billing_item_task,
            commands::entities::remove_billing_item_task,
            commands::entities::list_time_entries,
            commands::entities::upsert_time_entry,
            commands::entities::delete_time_entry,
            commands::entities::list_day_plans,
            commands::entities::upsert_day_plan,
            commands::entities::list_blocks,
            commands::entities::upsert_block,
            commands::entities::delete_block,
            commands::entities::delete_blocks_by_task_id,
            commands::entities::list_goals,
            commands::entities::upsert_goal,
            commands::entities::delete_goal,
            commands::entities::list_notes,
            commands::entities::upsert_note,
            commands::entities::list_templates,
            commands::entities::upsert_template,
            commands::entities::delete_template,
            commands::entities::list_invoices,
            commands::entities::upsert_invoice,
            commands::entities::delete_invoice,
            commands::export::export_to_file,
            commands::export::save_to_icloud,
            commands::export::open_ics_file,
            commands::export::import_snapshot,
            commands::invoice::generate_invoice,
            commands::invoice::generate_offer,
            commands::notification::show_notification,
            commands::report::generate_project_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
