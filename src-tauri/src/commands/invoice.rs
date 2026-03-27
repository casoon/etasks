use serde::{Deserialize, Serialize};
use tauri::Manager;
use typst_business_templates::{
    CompanyData, DocgenCompiler, InvoiceData,
};
use typst_business_templates::types::{BankAccount, CompanyAddress, CompanyContact};

use crate::commands::config::UserProfile;

/// Input from the frontend — company info comes from the stored UserProfile.
#[derive(Deserialize)]
pub struct GenerateInvoiceInput {
    /// Full InvoiceData JSON (items, totals, recipient, metadata, …)
    pub invoice: InvoiceData,
    /// User profile from AppConfig — used to build CompanyData
    pub profile: UserProfile,
}

/// Result returned to the frontend
#[derive(Serialize)]
pub struct GenerateInvoiceResult {
    /// Absolute path to the generated PDF
    pub path: String,
}

#[tauri::command]
pub fn generate_invoice(
    app: tauri::AppHandle,
    input: GenerateInvoiceInput,
) -> Result<GenerateInvoiceResult, String> {
    let company = profile_to_company(&input.profile);

    let pdf_bytes = DocgenCompiler::new()
        .compile_invoice(&input.invoice, &company)
        .map_err(|e| e.to_string())?;

    // Save to Downloads folder
    let downloads = app
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;

    let invoice_number = input
        .invoice
        .metadata
        .invoice_number
        .replace(['/', '\\', ' '], "-");
    let filename = format!("Rechnung-{}.pdf", invoice_number);
    let path = downloads.join(&filename);

    std::fs::write(&path, &pdf_bytes).map_err(|e| e.to_string())?;

    Ok(GenerateInvoiceResult {
        path: path.to_string_lossy().to_string(),
    })
}

fn profile_to_company(p: &UserProfile) -> CompanyData {
    CompanyData {
        name: p.company.clone(),
        language: "de".to_string(),
        logo: None,
        logo_width: None,
        branding: typst_business_templates::types::CompanyBranding::default(),
        address: CompanyAddress {
            street: p.street.clone(),
            house_number: String::new(),
            postal_code: p.zip.clone(),
            city: p.city.clone(),
            country: Some(p.country.clone()),
        },
        contact: CompanyContact {
            phone: None,
            email: Some(p.email.clone()),
            website: None,
        },
        tax_id: Some(p.tax_id.clone()),
        vat_id: None,
        business_owner: Some(format!("{} {}", p.first_name, p.last_name)),
        bank_account: Some(BankAccount {
            bank_name: None,
            account_holder: Some(format!("{} {}", p.first_name, p.last_name)),
            iban: Some(p.iban.clone()),
            bic: None,
        }),
    }
}
