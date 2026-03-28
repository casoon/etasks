use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub website: Option<String>,
    pub logo: Option<String>,
    pub logo_width: Option<String>,
    pub company: String,
    pub street: String,
    pub zip: String,
    pub city: String,
    pub country: String,
    pub tax_id: String,
    pub iban: String,
    pub hourly_rate: f64,
    pub invoice_number_prefix: Option<String>,
    pub invoice_number_counter: Option<u32>,
    pub offer_number_prefix: Option<String>,
    pub offer_number_counter: Option<u32>,
    pub offer_validity_days: Option<u32>,
    pub offer_payment_terms: Option<String>,
    pub offer_delivery_terms: Option<String>,
    pub offer_additional_terms: Option<String>,
    pub payment_days: Option<u32>,
    pub default_vat_rate: Option<f64>,
    pub bank_name: Option<String>,
    pub bic: Option<String>,
    pub invoice_footer_text: Option<String>,
    pub shutdown_time: Option<String>,
    pub break_interval_minutes: Option<u32>,
}

impl Default for UserProfile {
    fn default() -> Self {
        UserProfile {
            first_name: "Max".into(),
            last_name: "Mustermann".into(),
            email: "max@musterfirma.de".into(),
            phone: None,
            website: None,
            logo: None,
            logo_width: Some("3cm".into()),
            company: "Musterfirma GmbH".into(),
            street: "Musterstraße 1".into(),
            zip: "12345".into(),
            city: "Musterstadt".into(),
            country: "Deutschland".into(),
            tax_id: "DE123456789".into(),
            iban: "DE89 3704 0044 0532 0130 00".into(),
            hourly_rate: 90.0,
            invoice_number_prefix: Some("RE-".into()),
            invoice_number_counter: Some(1),
            offer_number_prefix: Some("ANG-".into()),
            offer_number_counter: Some(1),
            offer_validity_days: Some(30),
            offer_payment_terms: Some(
                "Zahlbar innerhalb von 14 Tagen nach Rechnungsstellung ohne Abzug.".into(),
            ),
            offer_delivery_terms: Some(String::new()),
            offer_additional_terms: Some(String::new()),
            payment_days: Some(14),
            default_vat_rate: Some(19.0),
            bank_name: None,
            bic: None,
            invoice_footer_text: None,
            shutdown_time: Some("17:00".into()),
            break_interval_minutes: Some(90),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TenantInfo {
    pub path: String,
    pub name: String,
    pub display_name: Option<String>,
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

fn tenant_slug(name: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;
    for ch in name.chars().flat_map(|c| c.to_lowercase()) {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_dash = false;
        } else if !last_dash {
            slug.push('-');
            last_dash = true;
        }
    }
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "mandant".to_string()
    } else {
        trimmed
    }
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

#[tauri::command]
pub fn default_tenant_path(app: tauri::AppHandle, tenant_name: String) -> Result<String, String> {
    let slug = tenant_slug(&tenant_name);
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = base.join("tenants");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{slug}.db")).to_string_lossy().to_string())
}

#[tauri::command]
pub fn import_logo_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let result = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "svg", "webp"])
        .blocking_pick_file();

    let source = match result {
        Some(tauri_plugin_dialog::FilePath::Path(pb)) => pb,
        Some(tauri_plugin_dialog::FilePath::Url(url)) => PathBuf::from(url.path()),
        None => return Ok(None),
    };

    let ext = source
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");
    let target_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("assets");
    std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let target = target_dir.join(format!("company-logo.{ext}"));
    std::fs::copy(&source, &target).map_err(|e| e.to_string())?;

    Ok(Some(target.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}
