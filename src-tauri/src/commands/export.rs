use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn export_to_file(
    app: tauri::AppHandle,
    json: String,
    filename: String,
) -> Result<String, String> {
    let downloads = app.path().download_dir().map_err(|e| e.to_string())?;
    let path = downloads.join(&filename);
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
    let icloud_base =
        home.join("Library/Mobile Documents/dev~jseidel~etasks/Documents");
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
                tauri_plugin_dialog::FilePath::Url(url) => {
                    std::path::PathBuf::from(url.path())
                }
            };
            let content =
                std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            Ok(Some(content))
        }
        None => Ok(None),
    }
}
