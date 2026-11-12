use std::path::{Path, PathBuf};

const MAX_FILE_NAME_CHARS: usize = 120;
const RESERVED_DEVICE_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Macht aus beliebigem Text einen Dateinamen, der auf Windows, macOS und Linux gültig ist:
/// nur der Basisname, `<>:"/\|?*` und Steuerzeichen werden zu `-`, Punkte und Leerzeichen am
/// Ende entfallen, reservierte Gerätenamen (CON, NUL, COM1 …) bekommen ein `_` vorangestellt,
/// die Länge ist begrenzt (die Endung bleibt erhalten).
pub fn safe_file_name(name: &str) -> String {
    let base = name
        .rsplit(['/', '\\'])
        .find(|part| !part.trim().is_empty())
        .unwrap_or("");
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '-'
            } else {
                c
            }
        })
        .collect();
    let mut cleaned = cleaned.trim_matches(' ').trim_end_matches(['.', ' ']).to_string();
    if cleaned.is_empty() {
        cleaned = "datei".to_string();
    }
    if cleaned.chars().count() > MAX_FILE_NAME_CHARS {
        let (stem, ext) = match cleaned.rfind('.') {
            Some(i) if cleaned.len() - i <= 12 && i > 0 => (&cleaned[..i], &cleaned[i..]),
            _ => (cleaned.as_str(), ""),
        };
        let keep = MAX_FILE_NAME_CHARS.saturating_sub(ext.chars().count());
        let stem: String = stem.chars().take(keep).collect();
        cleaned = format!("{}{}", stem.trim_end_matches(['.', ' ']), ext);
    }
    let device_stem = cleaned.split('.').next().unwrap_or("").trim_end();
    if RESERVED_DEVICE_NAMES
        .iter()
        .any(|reserved| reserved.eq_ignore_ascii_case(device_stem))
    {
        cleaned = format!("_{cleaned}");
    }
    cleaned
}

/// Dateiname aus dem Webview: ein reiner Name ohne Pfadtrenner, `..` oder Steuerzeichen.
/// Alles andere wird abgelehnt statt umgedeutet; der Rest wird mit `safe_file_name` bereinigt.
pub fn plain_file_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty()
        || trimmed.contains(['/', '\\'])
        || trimmed.split('.').all(str::is_empty)
        || trimmed.contains("..")
        || trimmed.chars().any(char::is_control)
    {
        return Err("Ungültiger Dateiname".to_string());
    }
    Ok(safe_file_name(trimmed))
}

/// `<dir>/<file_name>`, oder `<name>-2.<ext>`, `-3`, … wenn die Datei schon existiert.
/// `replace` ist eine Datei, die überschrieben werden darf (die letzte Ausgabe desselben Belegs).
pub fn free_path(dir: &Path, file_name: &str, replace: Option<&Path>) -> PathBuf {
    let as_path = Path::new(file_name);
    let stem = as_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| file_name.to_string());
    let ext = as_path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let mut path = dir.join(file_name);
    let mut n = 2;
    while path.exists() && Some(path.as_path()) != replace {
        path = dir.join(format!("{stem}-{n}{ext}"));
        n += 1;
    }
    path
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reserved_characters_become_dashes() {
        assert_eq!(safe_file_name("Rechnung-RE:2026-1.pdf"), "Rechnung-RE-2026-1.pdf");
        assert_eq!(safe_file_name("a<b>c\"d|e?f*g.pdf"), "a-b-c-d-e-f-g.pdf");
        assert_eq!(safe_file_name("tab\there\u{0}.txt"), "tab-here-.txt");
    }

    #[test]
    fn only_the_basename_survives() {
        assert_eq!(safe_file_name("../../etc/passwd"), "passwd");
        assert_eq!(safe_file_name("C:\\Users\\x\\bericht.pdf"), "bericht.pdf");
        assert_eq!(safe_file_name("/abs/path/"), "path");
        assert_eq!(safe_file_name(".."), "datei");
        assert_eq!(safe_file_name(""), "datei");
    }

    #[test]
    fn trailing_dots_and_spaces_are_trimmed() {
        assert_eq!(safe_file_name("name. . "), "name");
        assert_eq!(safe_file_name("  name.pdf"), "name.pdf");
    }

    #[test]
    fn windows_device_names_are_avoided() {
        assert_eq!(safe_file_name("CON"), "_CON");
        assert_eq!(safe_file_name("nul.txt"), "_nul.txt");
        assert_eq!(safe_file_name("Com1.pdf"), "_Com1.pdf");
        assert_eq!(safe_file_name("console.txt"), "console.txt");
    }

    #[test]
    fn long_names_are_cut_but_keep_their_extension() {
        let long = format!("{}.pdf", "ä".repeat(300));
        let safe = safe_file_name(&long);
        assert_eq!(safe.chars().count(), MAX_FILE_NAME_CHARS);
        assert!(safe.ends_with(".pdf"));
    }

    #[test]
    fn plain_file_name_rejects_paths_and_dot_dot() {
        for bad in ["../x.json", "a/b.json", "a\\b.json", "/etc/passwd", "..", "x..json", "", "  ", "a\u{0}b"] {
            assert!(plain_file_name(bad).is_err(), "{bad:?} should be rejected");
        }
        assert_eq!(plain_file_name("etasks-export-x-2026-11-12.json").unwrap(), "etasks-export-x-2026-11-12.json");
        assert_eq!(plain_file_name("a:b.json").unwrap(), "a-b.json");
    }

    #[test]
    fn free_path_adds_a_suffix_unless_the_file_may_be_replaced() {
        let dir = std::env::temp_dir().join(format!("etasks-free-path-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let first = free_path(&dir, "Rechnung-RE-001.pdf", None);
        assert_eq!(first, dir.join("Rechnung-RE-001.pdf"));
        std::fs::write(&first, b"x").unwrap();

        let second = free_path(&dir, "Rechnung-RE-001.pdf", None);
        assert_eq!(second, dir.join("Rechnung-RE-001-2.pdf"));
        std::fs::write(&second, b"x").unwrap();
        assert_eq!(free_path(&dir, "Rechnung-RE-001.pdf", None), dir.join("Rechnung-RE-001-3.pdf"));
        assert_eq!(free_path(&dir, "Rechnung-RE-001.pdf", Some(&first)), first);
        assert_eq!(free_path(&dir, "export.json", None), dir.join("export.json"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
