use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::Manager;

const WORKSPACE_DB_FILENAME: &str = "etasks.sqlite3";

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
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
            first_name: String::new(),
            last_name: String::new(),
            email: String::new(),
            phone: None,
            website: None,
            logo: None,
            logo_width: Some("3cm".into()),
            company: String::new(),
            street: String::new(),
            zip: String::new(),
            city: String::new(),
            country: "Deutschland".into(),
            tax_id: String::new(),
            iban: String::new(),
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
    #[serde(default, rename = "displayName", alias = "display_name")]
    pub display_name: Option<String>,
    pub last_opened: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
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

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Konfigurationsordner nicht verfügbar: {e}"))?
        .join("config.json"))
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

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ConfigStatus {
    Ok,
    /// Keine config.json vorhanden (erster Start).
    Missing,
    /// config.json war beschädigt; die Sicherung wurde wiederhergestellt.
    RecoveredFromBackup,
    /// config.json ist beschädigt und es gibt keine brauchbare Sicherung.
    Corrupt,
}

#[derive(Serialize)]
pub struct LoadedConfig {
    pub config: AppConfig,
    pub status: ConfigStatus,
    pub message: Option<String>,
}

fn sibling_path(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(suffix);
    path.with_file_name(name)
}

fn timestamp() -> String {
    chrono::Local::now().format("%Y%m%d-%H%M%S").to_string()
}

fn parse_config(path: &Path) -> Result<AppConfig, String> {
    let text = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

/// Schreibt in eine Temp-Datei im selben Ordner und benennt sie danach um, damit ein Absturz
/// mitten im Schreiben nie eine halbe Datei hinterlässt.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let tmp = sibling_path(path, ".tmp");
    let mut file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

/// Liest die Konfiguration. Eine beschädigte Datei wird nie stillschweigend durch Standardwerte
/// ersetzt: erst wird `config.json.bak` versucht, sonst wird der Fehler gemeldet.
fn read_config_file(path: &Path) -> LoadedConfig {
    if !path.exists() {
        return LoadedConfig {
            config: AppConfig::default(),
            status: ConfigStatus::Missing,
            message: None,
        };
    }
    let parse_error = match parse_config(path) {
        Ok(config) => {
            return LoadedConfig {
                config,
                status: ConfigStatus::Ok,
                message: None,
            }
        }
        Err(e) => e,
    };
    let bak = sibling_path(path, ".bak");
    if let Ok(config) = parse_config(&bak) {
        let corrupt = sibling_path(path, &format!(".corrupt-{}", timestamp()));
        let restored = std::fs::copy(path, &corrupt)
            .map_err(|e| e.to_string())
            .and_then(|_| std::fs::read(&bak).map_err(|e| e.to_string()))
            .and_then(|bytes| write_atomic(path, &bytes));
        if restored.is_ok() {
            return LoadedConfig {
                config,
                status: ConfigStatus::RecoveredFromBackup,
                message: Some(format!(
                    "Die Konfiguration war beschädigt und wurde aus der Sicherung wiederhergestellt. Die beschädigte Datei liegt unter {}.",
                    corrupt.display()
                )),
            };
        }
    }
    LoadedConfig {
        config: AppConfig::default(),
        status: ConfigStatus::Corrupt,
        message: Some(format!(
            "Die Konfiguration {} ist beschädigt und es gibt keine brauchbare Sicherung ({parse_error}).",
            path.display()
        )),
    }
}

/// Schreibt die Konfiguration atomar. Die letzte gültige Datei bleibt als `.bak` erhalten; eine
/// beschädigte Datei wird nie ohne Kopie (`.corrupt-<Zeit>`) überschrieben.
fn write_config_file(path: &Path, config: &AppConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    if path.exists() {
        let keep = if parse_config(path).is_ok() {
            sibling_path(path, ".bak")
        } else {
            sibling_path(path, &format!(".corrupt-{}", timestamp()))
        };
        std::fs::copy(path, &keep).map_err(|e| e.to_string())?;
    }
    write_atomic(path, json.as_bytes())
}

/// Konfiguration für interne Aufrufer; bei Fehlern gelten Standardwerte.
fn read_config(app: &tauri::AppHandle) -> AppConfig {
    config_path(app)
        .map(|path| read_config_file(&path).config)
        .unwrap_or_default()
}

#[tauri::command]
pub fn load_config(app: tauri::AppHandle) -> Result<LoadedConfig, String> {
    Ok(read_config_file(&config_path(&app)?))
}

#[tauri::command]
pub fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    write_config_file(&config_path(&app)?, &config)
}

/// Legt eine beschädigte config.json zur Seite, damit der Nutzer neu einrichten kann.
#[tauri::command]
pub fn reset_config(app: tauri::AppHandle) -> Result<(), String> {
    let path = config_path(&app)?;
    if path.exists() && parse_config(&path).is_err() {
        let corrupt = sibling_path(&path, &format!(".corrupt-{}", timestamp()));
        std::fs::rename(&path, corrupt).map_err(|e| e.to_string())?;
    }
    Ok(())
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
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "svg"])
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
    let config = read_config(&app);
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

/// Logo als Data-URL für die Vorschau in den Einstellungen (kein Asset-Protokoll nötig).
#[tauri::command]
pub fn logo_data_url(path: String) -> Result<String, String> {
    use base64::Engine;
    let path = std::path::Path::new(&path);
    let mime = match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        _ => return Err("Dateityp wird nicht unterstützt".into()),
    };
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() > 5 * 1024 * 1024 {
        return Err("Datei ist größer als 5 MB".into());
    }
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
pub fn file_exists(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

/// Sammelt Datenbankdateien eine Ebene unterhalb von `root`. Mit `only_default_name`
/// zählt nur `etasks.sqlite3` (für allgemeine Ordner wie Dokumente).
fn scan_workspace_root(root: &std::path::Path, only_default_name: bool, found: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };
    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let Ok(files) = std::fs::read_dir(entry.path()) else {
            continue;
        };
        for file in files.flatten() {
            let name = file.file_name().to_string_lossy().to_string();
            let matches = if only_default_name {
                name == WORKSPACE_DB_FILENAME
            } else {
                name.ends_with(".etasks")
                    || name.ends_with(".db")
                    || name.ends_with(".sqlite")
                    || name.ends_with(".sqlite3")
            };
            if matches {
                found.push(file.path().to_string_lossy().to_string());
            }
        }
    }
}

/// Ein Arbeitsbereich, der direkt im Ordner liegt (Standardordner = Arbeitsbereichsordner).
fn push_direct_workspace(dir: &std::path::Path, found: &mut Vec<String>) {
    let db = dir.join(WORKSPACE_DB_FILENAME);
    if db.is_file() {
        found.push(db.to_string_lossy().to_string());
    }
}

#[tauri::command]
pub fn list_workspace_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let mut found = vec![];
    scan_workspace_root(&documents_workspace_root(&app)?, false, &mut found);
    if let Ok(app_data) = app.path().app_data_dir() {
        scan_workspace_root(&app_data.join("Workspaces"), false, &mut found);
    }
    // Der Wizard legt Arbeitsbereiche unter <Dokumente>/<slug>/ bzw. im gewählten Standardordner an.
    if let Ok(documents) = app.path().document_dir() {
        scan_workspace_root(&documents, true, &mut found);
    }
    if let Some(dir) = read_config(&app).default_workspace_dir {
        scan_workspace_root(std::path::Path::new(&dir), true, &mut found);
        push_direct_workspace(std::path::Path::new(&dir), &mut found);
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_profile_has_no_sample_data() {
        let p = UserProfile::default();
        assert!(p.first_name.is_empty() && p.company.is_empty() && p.iban.is_empty());
        assert!(p.street.is_empty() && p.tax_id.is_empty() && p.email.is_empty());
    }

    #[test]
    fn old_config_without_newer_profile_fields_still_loads() {
        let cfg: AppConfig = serde_json::from_str(
            r#"{"version":1,"setup_done":true,"active_tenant":null,"tenants":[],
                "profile":{"first_name":"Ada","hourly_rate":80.5}}"#,
        )
        .unwrap();
        assert!(cfg.setup_done);
        assert_eq!(cfg.profile.first_name, "Ada");
        assert_eq!(cfg.profile.hourly_rate, 80.5);
        assert_eq!(cfg.profile.payment_days, Some(14));
        assert_eq!(cfg.profile.country, "Deutschland");
    }

    #[test]
    fn config_with_empty_options_and_missing_sections_loads() {
        let cfg: AppConfig = serde_json::from_str(r#"{"profile":{"payment_days":null}}"#).unwrap();
        assert_eq!(cfg.profile.payment_days, None);
        assert!(!cfg.setup_done);
        assert!(cfg.tenants.is_empty());
    }

    #[test]
    fn tenant_display_name_round_trips_as_camel_case() {
        let tenant: TenantInfo = serde_json::from_str(
            r#"{"path":"/a/etasks.sqlite3","name":"Studio","displayName":"Studio Nord","last_opened":"x"}"#,
        )
        .unwrap();
        assert_eq!(tenant.display_name.as_deref(), Some("Studio Nord"));
        let json = serde_json::to_string(&tenant).unwrap();
        assert!(json.contains(r#""displayName":"Studio Nord""#));
    }

    #[test]
    fn old_tenant_entries_without_display_name_still_load() {
        let tenant: TenantInfo =
            serde_json::from_str(r#"{"path":"/a","name":"a","last_opened":"x"}"#).unwrap();
        assert!(tenant.display_name.is_none());
        let snake: TenantInfo = serde_json::from_str(
            r#"{"path":"/a","name":"a","display_name":"A","last_opened":"x"}"#,
        )
        .unwrap();
        assert_eq!(snake.display_name.as_deref(), Some("A"));
    }

    #[test]
    fn scan_finds_default_named_databases_one_level_down() {
        let root = std::env::temp_dir().join(format!("etasks-scan-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("studio-nord")).unwrap();
        std::fs::create_dir_all(root.join("other")).unwrap();
        std::fs::write(root.join("studio-nord").join(WORKSPACE_DB_FILENAME), "").unwrap();
        std::fs::write(root.join("other").join("notes.db"), "").unwrap();
        std::fs::write(root.join(WORKSPACE_DB_FILENAME), "").unwrap();

        let mut strict = vec![];
        scan_workspace_root(&root, true, &mut strict);
        assert_eq!(strict.len(), 1);
        assert!(strict[0].ends_with("studio-nord/etasks.sqlite3"));

        let mut loose = vec![];
        scan_workspace_root(&root, false, &mut loose);
        assert_eq!(loose.len(), 2);

        let mut missing = vec![];
        scan_workspace_root(&root.join("nope"), true, &mut missing);
        assert!(missing.is_empty());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn direct_workspace_in_default_dir_is_found() {
        let root = std::env::temp_dir().join(format!("etasks-direct-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        let mut found = vec![];
        push_direct_workspace(&root, &mut found);
        assert!(found.is_empty());
        std::fs::write(root.join(WORKSPACE_DB_FILENAME), "").unwrap();
        push_direct_workspace(&root, &mut found);
        assert_eq!(found.len(), 1);
        let _ = std::fs::remove_dir_all(&root);
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("etasks-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn config_with_tenant(path: &str) -> AppConfig {
        let mut cfg = AppConfig::default();
        cfg.setup_done = true;
        cfg.active_tenant = Some(path.into());
        cfg
    }

    #[test]
    fn config_write_is_atomic_and_keeps_the_last_good_file_as_bak() {
        let dir = temp_dir("cfg-write");
        let path = dir.join("config.json");
        write_config_file(&path, &config_with_tenant("/a")).unwrap();
        assert!(!sibling_path(&path, ".tmp").exists());
        assert!(!sibling_path(&path, ".bak").exists());

        write_config_file(&path, &config_with_tenant("/b")).unwrap();
        assert!(!sibling_path(&path, ".tmp").exists());
        assert_eq!(parse_config(&path).unwrap().active_tenant.as_deref(), Some("/b"));
        assert_eq!(
            parse_config(&sibling_path(&path, ".bak")).unwrap().active_tenant.as_deref(),
            Some("/a")
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn missing_config_is_reported_as_missing() {
        let dir = temp_dir("cfg-missing");
        let loaded = read_config_file(&dir.join("config.json"));
        assert_eq!(loaded.status, ConfigStatus::Missing);
        assert!(!loaded.config.setup_done);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_config_is_restored_from_bak_and_the_corrupt_file_is_kept() {
        let dir = temp_dir("cfg-recover");
        let path = dir.join("config.json");
        write_config_file(&path, &config_with_tenant("/a")).unwrap();
        write_config_file(&path, &config_with_tenant("/b")).unwrap();
        std::fs::write(&path, "{ half a file").unwrap();

        let loaded = read_config_file(&path);
        assert_eq!(loaded.status, ConfigStatus::RecoveredFromBackup);
        assert!(loaded.message.is_some());
        assert_eq!(loaded.config.active_tenant.as_deref(), Some("/a"));
        assert_eq!(parse_config(&path).unwrap().active_tenant.as_deref(), Some("/a"));
        let kept = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().contains(".corrupt-"))
            .count();
        assert_eq!(kept, 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn corrupt_config_without_bak_is_an_error_state_and_stays_untouched() {
        let dir = temp_dir("cfg-corrupt");
        let path = dir.join("config.json");
        std::fs::write(&path, "not json").unwrap();

        let loaded = read_config_file(&path);
        assert_eq!(loaded.status, ConfigStatus::Corrupt);
        assert!(loaded.message.unwrap().contains("beschädigt"));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "not json");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn saving_over_a_corrupt_config_keeps_a_corrupt_copy_and_not_a_bak() {
        let dir = temp_dir("cfg-save-corrupt");
        let path = dir.join("config.json");
        std::fs::write(&path, "not json").unwrap();

        write_config_file(&path, &config_with_tenant("/new")).unwrap();
        assert!(!sibling_path(&path, ".bak").exists());
        let copies: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().contains(".corrupt-"))
            .collect();
        assert_eq!(copies.len(), 1);
        assert_eq!(std::fs::read_to_string(copies[0].path()).unwrap(), "not json");
        assert_eq!(parse_config(&path).unwrap().active_tenant.as_deref(), Some("/new"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn config_missing_a_formerly_required_field_still_loads_from_disk() {
        let dir = temp_dir("cfg-partial");
        let path = dir.join("config.json");
        std::fs::write(&path, r#"{"setup_done":true,"profile":{"first_name":"Ada"}}"#).unwrap();
        let loaded = read_config_file(&path);
        assert_eq!(loaded.status, ConfigStatus::Ok);
        assert_eq!(loaded.config.profile.country, "Deutschland");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
