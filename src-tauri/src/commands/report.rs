use serde::Deserialize;
use tauri::Manager;

use crate::commands::fsutil::{free_path, safe_file_name};

#[derive(Deserialize)]
pub struct TaskReportRow {
    pub title: String,
    pub status: String,
    pub duration_minutes: u32,
}

#[derive(Deserialize)]
pub struct ProjectReportInput {
    pub name: String,
    pub status: String,
    pub completion_rate: u32,
    pub total_tasks: usize,
    pub done_tasks: usize,
    pub tracked_hours: f64,
    pub planned_hours: f64,
    pub tasks: Vec<TaskReportRow>,
}

#[tauri::command]
pub async fn generate_project_report(
    app: tauri::AppHandle,
    project: ProjectReportInput,
    output_dir: Option<String>,
) -> Result<String, String> {
    let pdf = tauri::async_runtime::spawn_blocking(move || build_pdf(project))
        .await
        .map_err(|e| e.to_string())??;

    let downloads = match output_dir {
        Some(dir) if !dir.trim().is_empty() => std::path::PathBuf::from(dir),
        _ => app.path().download_dir().map_err(|e| e.to_string())?,
    };
    std::fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;
    let filename = safe_file_name(&format!("{}-bericht.pdf", project_safe_name(&pdf.0)));
    let path = free_path(&downloads, &filename, None);
    std::fs::write(&path, &pdf.1).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

struct PdfResult(String, Vec<u8>);

fn build_pdf(project: ProjectReportInput) -> Result<PdfResult, String> {
    use renderreport::components::advanced::ProgressBar;
    use renderreport::components::{AuditTable, SummaryBox, TableColumn};
    use renderreport::prelude::*;

    let engine = Engine::new().map_err(|e| e.to_string())?;

    let bar_color = if project.completion_rate >= 80 {
        "#22c55e"
    } else if project.completion_rate >= 50 {
        "#f59e0b"
    } else {
        "#ef4444"
    };

    let mut task_table = AuditTable::new(vec![
        TableColumn::new("Aufgabe").with_width("55%"),
        TableColumn::new("Status").with_width("25%"),
        TableColumn::new("Erfasst").with_width("20%"),
    ])
    .with_title("Aufgaben");

    for task in &project.tasks {
        task_table = task_table.add_row(vec![
            task.title.clone(),
            task.status.clone(),
            format!("{}min", task.duration_minutes),
        ]);
    }

    let builder = engine
        .report("default")
        .title(&escape_typst(&project.name))
        .subtitle("Projektstatusbericht")
        .add_component(
            SummaryBox::new("Übersicht")
                .add_item("Status", &project.status)
                .add_item(
                    "Fortschritt",
                    &format!(
                        "{}/{} Tasks ({}%)",
                        project.done_tasks, project.total_tasks, project.completion_rate
                    ),
                )
                .add_item("Geplant", &format!("{:.1}h", project.planned_hours))
                .add_item("Getrackt", &format!("{:.1}h", project.tracked_hours)),
        )
        .add_component(
            ProgressBar::new("Abschluss", project.completion_rate as f64)
                .with_max(100.0)
                .with_color(bar_color),
        );

    let request = builder.add_component(task_table).build();
    let pdf = engine.render_pdf(&request).map_err(|e| e.to_string())?;
    Ok(PdfResult(project.name, pdf))
}

/// Maskiert Text für `renderreport`, das den Titel roh in Typst-Markup (`[...]`) und in ein
/// Stringliteral (`"..."`, nur `"` maskiert) einsetzt. `\u{..}` ist in beiden Kontexten gültig
/// und ergibt das Zeichen selbst, ohne dass es als Markup, Code oder Kürzel (`--`, `...`,
/// Listen am Zeilenanfang) wirkt. Zeilenumbrüche und Steuerzeichen werden zu Leerzeichen.
fn escape_typst(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '\\' | '"' | '#' | '[' | ']' | '{' | '}' | '$' | '*' | '_' | '<' | '>' | '@' | '`'
            | '~' | '/' | '=' | '+' | '-' | '.' => out.push_str(&format!("\\u{{{:x}}}", c as u32)),
            c if c.is_control() => out.push(' '),
            c => out.push(c),
        }
    }
    out
}

fn project_safe_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
        .collect::<String>()
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn report_text(name: &str) -> Option<String> {
        let input = ProjectReportInput {
            name: name.to_string(),
            status: "Aktiv".into(),
            completion_rate: 50,
            total_tasks: 2,
            done_tasks: 1,
            tracked_hours: 1.5,
            planned_hours: 3.0,
            tasks: vec![TaskReportRow {
                title: format!("Aufgabe {name}"),
                status: "Offen".into(),
                duration_minutes: 30,
            }],
        };
        let pdf = build_pdf(input).expect("PDF must render").1;
        assert!(pdf.starts_with(b"%PDF"));
        let dir = std::env::temp_dir().join(format!("etasks-typst-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join(format!("{:x}.pdf", name.bytes().fold(0u64, |a, b| a.wrapping_mul(31).wrapping_add(b as u64))));
        std::fs::write(&file, &pdf).unwrap();
        let out = std::process::Command::new("pdftotext").arg(&file).arg("-").output().ok()?;
        out.status.success().then(|| String::from_utf8_lossy(&out.stdout).to_string())
    }

    #[test]
    fn escape_uses_unicode_escapes_valid_in_markup_and_strings() {
        assert_eq!(escape_typst("A]B"), "A\\u{5d}B");
        assert_eq!(escape_typst("x\\"), "x\\u{5c}");
        assert_eq!(escape_typst("Kunde Müller 2026"), "Kunde Müller 2026");
        assert_eq!(escape_typst("a\nb"), "a b");
    }

    #[test]
    fn project_names_with_typst_syntax_render_literally() {
        let names = [
            "A]B",
            "Foo #bar",
            "x\\",
            "[#raw(\"x\")]",
            "50% $a$ *b* _c_ <d> @e `f` ~g",
            "= Titel",
            "- Liste -- Strich ... drei",
            "/ Begriff: Text",
            "#read(\"/etc/passwd\")",
            "Café Müller & Söhne",
        ];
        for name in names {
            let Some(text) = report_text(name) else {
                eprintln!("pdftotext not available, skipping");
                return;
            };
            let flat = text.split_whitespace().collect::<Vec<_>>().join(" ");
            assert!(flat.contains(name), "PDF text for {name:?} was: {flat}");
        }
    }
}
