use serde::Deserialize;
use tauri::Manager;

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
    pub notes: Option<String>,
    pub tasks: Vec<TaskReportRow>,
}

#[tauri::command]
pub async fn generate_project_report(
    app: tauri::AppHandle,
    project: ProjectReportInput,
) -> Result<String, String> {
    let pdf = tauri::async_runtime::spawn_blocking(move || build_pdf(project))
        .await
        .map_err(|e| e.to_string())??;

    let downloads = app.path().download_dir().map_err(|e| e.to_string())?;
    let safe_name = project_safe_name(&pdf.0);
    let filename = format!("{}-bericht.pdf", safe_name);
    let path = downloads.join(&filename);
    std::fs::write(&path, &pdf.1).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

struct PdfResult(String, Vec<u8>);

fn build_pdf(project: ProjectReportInput) -> Result<PdfResult, String> {
    use renderreport::components::advanced::{KeyValueList, ProgressBar};
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
        TableColumn::new("Dauer").with_width("20%"),
    ])
    .with_title("Aufgaben");

    for task in &project.tasks {
        task_table = task_table.add_row(vec![
            task.title.clone(),
            task.status.clone(),
            format!("{}min", task.duration_minutes),
        ]);
    }

    let mut builder = engine
        .report("default")
        .title(&project.name)
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

    if let Some(notes) = &project.notes {
        if !notes.trim().is_empty() {
            builder = builder.add_component(
                KeyValueList::new()
                    .with_title("Notizen")
                    .add("Details", notes.trim()),
            );
        }
    }

    let request = builder.add_component(task_table).build();
    let pdf = engine.render_pdf(&request).map_err(|e| e.to_string())?;
    Ok(PdfResult(project.name, pdf))
}

fn project_safe_name(name: &str) -> String {
    name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
        .collect::<String>()
        .to_lowercase()
}
