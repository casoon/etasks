use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

const WORKSPACE_DB_FILENAME: &str = "etasks.sqlite3";

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
    pub logging_enabled: Option<bool>,
    pub default_workspace_dir: Option<String>,
    pub default_export_dir: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            version: 1,
            setup_done: false,
            active_tenant: None,
            tenants: vec![],
            profile: UserProfile::default(),
            logging_enabled: Some(false),
            default_workspace_dir: None,
            default_export_dir: None,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePaths {
    pub workspace_dir: String,
    pub database_path: String,
    pub assets_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub documents_dir: Option<String>,
    pub downloads_dir: Option<String>,
    pub app_data_dir: Option<String>,
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

fn documents_workspace_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let documents = app
        .path()
        .document_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| e.to_string())?;
    Ok(documents.join("eTasks").join("Arbeitsbereiche"))
}

fn download_export_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .download_dir()
        .or_else(|_| app.path().document_dir())
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| e.to_string())
}

fn derive_workspace_paths(base_dir: PathBuf, tenant_name: &str) -> WorkspacePaths {
    let slug = tenant_slug(tenant_name);
    let workspace_dir = base_dir.join(slug);
    let database_path = workspace_dir.join(WORKSPACE_DB_FILENAME);
    let assets_dir = workspace_dir.join("assets");
    WorkspacePaths {
        workspace_dir: workspace_dir.to_string_lossy().to_string(),
        database_path: database_path.to_string_lossy().to_string(),
        assets_dir: assets_dir.to_string_lossy().to_string(),
    }
}

fn tenant_workspace_dir(path: &str) -> PathBuf {
    let pb = PathBuf::from(path);
    if pb
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext, "sqlite" | "sqlite3" | "db" | "etasks"))
        .unwrap_or(false)
    {
        pb.parent().unwrap_or(&pb).to_path_buf()
    } else {
        pb
    }
}

fn tenant_assets_dir(path: &str) -> PathBuf {
    tenant_workspace_dir(path).join("assets")
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
pub fn pick_directory(
    app: tauri::AppHandle,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let mut dialog = app.dialog().file();
    if let Some(path) = default_path {
        dialog = dialog.set_directory(path);
    }
    let result = dialog.blocking_pick_folder();
    Ok(result.map(|p| match p {
        tauri_plugin_dialog::FilePath::Path(pb) => pb.to_string_lossy().to_string(),
        tauri_plugin_dialog::FilePath::Url(url) => url.path().to_string(),
    }))
}

#[tauri::command]
pub fn default_tenant_path(
    app: tauri::AppHandle,
    tenant_name: String,
    base_dir: Option<String>,
) -> Result<String, String> {
    let workspaces = match base_dir {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => documents_workspace_root(&app)?,
    };
    std::fs::create_dir_all(&workspaces).map_err(|e| e.to_string())?;
    let initial = derive_workspace_paths(workspaces.clone(), &tenant_name);
    if !PathBuf::from(&initial.workspace_dir).exists() {
        return Ok(initial.database_path);
    }

    let mut i = 2u32;
    loop {
        let candidate_name = format!("{tenant_name} {i}");
        let candidate = derive_workspace_paths(workspaces.clone(), &candidate_name);
        if !PathBuf::from(&candidate.workspace_dir).exists() {
            return Ok(candidate.database_path);
        }
        i += 1;
    }
}

#[tauri::command]
pub fn default_workspace_paths(
    app: tauri::AppHandle,
    tenant_name: String,
    base_dir: Option<String>,
) -> Result<WorkspacePaths, String> {
    let db_path = default_tenant_path(app.clone(), tenant_name, base_dir)?;
    workspace_paths(db_path)
}

#[tauri::command]
pub fn workspace_paths(path: String) -> Result<WorkspacePaths, String> {
    let workspace_dir = tenant_workspace_dir(&path);
    let database_path = if workspace_dir == PathBuf::from(&path) {
        workspace_dir.join(WORKSPACE_DB_FILENAME)
    } else {
        PathBuf::from(&path)
    };
    let assets_dir = workspace_dir.join("assets");
    Ok(WorkspacePaths {
        workspace_dir: workspace_dir.to_string_lossy().to_string(),
        database_path: database_path.to_string_lossy().to_string(),
        assets_dir: assets_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn app_paths(app: tauri::AppHandle) -> AppPaths {
    AppPaths {
        documents_dir: app
            .path()
            .document_dir()
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
        downloads_dir: app
            .path()
            .download_dir()
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
        app_data_dir: app
            .path()
            .app_data_dir()
            .ok()
            .map(|p| p.to_string_lossy().to_string()),
    }
}

#[tauri::command]
pub fn default_export_dir(app: tauri::AppHandle) -> Result<String, String> {
    Ok(download_export_root(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn pick_tenant_path(app: tauri::AppHandle, tenant_name: String) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let slug = tenant_slug(&tenant_name);
    let default_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let result = app
        .dialog()
        .file()
        .set_file_name(&format!("{slug}.etasks"))
        .set_directory(&default_dir)
        .add_filter("eTasks Workspace", &["etasks"])
        .blocking_save_file();
    match result {
        Some(tauri_plugin_dialog::FilePath::Path(pb)) => {
            let path = pb.to_string_lossy().to_string();
            let path = if path.ends_with(".etasks") { path } else { format!("{path}.etasks") };
            Ok(Some(path))
        }
        Some(tauri_plugin_dialog::FilePath::Url(url)) => {
            let path = url.path().to_string();
            let path = if path.ends_with(".etasks") { path } else { format!("{path}.etasks") };
            Ok(Some(path))
        }
        None => Ok(None),
    }
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
    let config = load_config(app.clone());
    let target_dir = config
        .active_tenant
        .as_deref()
        .map(tenant_assets_dir)
        .unwrap_or_else(|| {
            app.path()
                .app_config_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("assets")
        });
    std::fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let target = target_dir.join(format!("company-logo.{ext}"));
    std::fs::copy(&source, &target).map_err(|e| e.to_string())?;

    Ok(Some(target.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
pub fn list_workspace_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let mut found = vec![];
    let mut roots = vec![documents_workspace_root(&app)?];
    if let Ok(app_data) = app.path().app_data_dir() {
        roots.push(app_data.join("Workspaces"));
    }

    for workspaces in roots {
        if !workspaces.exists() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(&workspaces) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    if let Ok(files) = std::fs::read_dir(entry.path()) {
                        for file in files.flatten() {
                            let name = file.file_name().to_string_lossy().to_string();
                            if name.ends_with(".etasks")
                                || name.ends_with(".db")
                                || name.ends_with(".sqlite")
                                || name.ends_with(".sqlite3")
                            {
                                found.push(file.path().to_string_lossy().to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    found.sort();
    found.dedup();
    Ok(found)
}

/// Schreibt einen Log-Eintrag in die angegebene Datei.
/// Rolling: Datei > 512 KB → die älteste Hälfte der Zeilen wird verworfen.
#[tauri::command]
pub fn write_log(path: String, level: String, message: String) -> Result<(), String> {
    use std::io::Write;
    let log_path = std::path::PathBuf::from(&path);
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Rolling: bei > 512 KB die ältere Hälfte der Zeilen verwerfen
    if log_path.exists() {
        let meta = std::fs::metadata(&log_path).map_err(|e| e.to_string())?;
        if meta.len() > 512 * 1024 {
            let content = std::fs::read_to_string(&log_path).unwrap_or_default();
            let lines: Vec<&str> = content.lines().collect();
            let keep_from = lines.len() / 2;
            let trimmed = lines[keep_from..].join("\n") + "\n";
            std::fs::write(&log_path, trimmed).map_err(|e| e.to_string())?;
        }
    }
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| e.to_string())?;
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    writeln!(file, "[{now}] [{level}] {message}").map_err(|e| e.to_string())
}
