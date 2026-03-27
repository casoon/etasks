use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub company: String,
    pub street: String,
    pub zip: String,
    pub city: String,
    pub country: String,
    pub tax_id: String,
    pub iban: String,
    pub hourly_rate: f64,
}

impl Default for UserProfile {
    fn default() -> Self {
        UserProfile {
            first_name: "Max".into(),
            last_name: "Mustermann".into(),
            email: "max@musterfirma.de".into(),
            company: "Musterfirma GmbH".into(),
            street: "Musterstraße 1".into(),
            zip: "12345".into(),
            city: "Musterstadt".into(),
            country: "Deutschland".into(),
            tax_id: "DE123456789".into(),
            iban: "DE89 3704 0044 0532 0130 00".into(),
            hourly_rate: 90.0,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TenantInfo {
    pub path: String,
    pub name: String,
    pub last_opened: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub version: u32,
    pub setup_done: bool,
    pub active_tenant: Option<String>,
    pub tenants: Vec<TenantInfo>,
    pub profile: UserProfile,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            version: 1,
            setup_done: false,
            active_tenant: None,
            tenants: vec![],
            profile: UserProfile::default(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .expect("no config dir")
        .join("config.json")
}

#[tauri::command]
pub fn load_config(app: tauri::AppHandle) -> AppConfig {
    let path = config_path(&app);
    if path.exists() {
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

#[tauri::command]
pub fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = config_path(&app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pick_directory(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let result = app.dialog().file().blocking_pick_folder();
    Ok(result.map(|p| match p {
        tauri_plugin_dialog::FilePath::Path(pb) => pb.to_string_lossy().to_string(),
        tauri_plugin_dialog::FilePath::Url(url) => url.path().to_string(),
    }))
}
