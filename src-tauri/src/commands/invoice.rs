use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;
use typst_business_templates::types::{BankAccount, CompanyAddress, CompanyContact};
use typst_business_templates::{CompanyData, DocgenCompiler};

use crate::commands::config::UserProfile;

/// Input from the frontend — company info comes from the stored UserProfile.
#[derive(Deserialize)]
pub struct GenerateInvoiceInput {
    /// Full invoice JSON (items, totals, recipient, metadata, …) as the template reads it.
    /// Kept untyped: the crate's `InvoiceData` serializes `vat_breakdown[].rate` as a number,
    /// but the template needs `{ percentage: … }` (and `{ date: … }` for the dates), and it only
    /// allows whole-number rates.
    pub invoice: Value,
    /// User profile from AppConfig — used to build CompanyData
    pub profile: UserProfile,
}

/// Result returned to the frontend
#[derive(Serialize)]
pub struct GenerateInvoiceResult {
    /// Absolute path to the generated PDF
    pub path: String,
}

#[derive(Deserialize)]
pub struct GenerateOfferInput {
    pub offer: Value,
    pub profile: UserProfile,
}

#[derive(Serialize)]
pub struct GenerateOfferResult {
    pub path: String,
}

#[tauri::command]
pub fn generate_invoice(
    app: tauri::AppHandle,
    input: GenerateInvoiceInput,
    output_dir: Option<String>,
    replace_path: Option<String>,
) -> Result<GenerateInvoiceResult, String> {
    let company = profile_to_company(&input.profile)?;

    let pdf_bytes = render_invoice(&input.invoice, &company)?;

    // Save to Downloads folder
    let downloads = match output_dir {
        Some(dir) if !dir.trim().is_empty() => std::path::PathBuf::from(dir),
        _ => app.path().download_dir().map_err(|e| e.to_string())?,
    };

    std::fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;

    let invoice_number = input.invoice["metadata"]["invoice_number"]
        .as_str()
        .unwrap_or("rechnung")
        .replace(['/', '\\', ' '], "-");
    let path = free_pdf_path(
        &downloads,
        &format!("Rechnung-{}", invoice_number),
        replace_path.as_deref().map(std::path::Path::new),
    );

    std::fs::write(&path, &pdf_bytes).map_err(|e| e.to_string())?;

    Ok(GenerateInvoiceResult {
        path: path.to_string_lossy().to_string(),
    })
}

/// `<stem>.pdf` in `dir`, or `<stem>-2.pdf`, `-3`, … if that file already exists.
/// `replace` is the PDF this invoice produced last time; it may be overwritten.
fn free_pdf_path(
    dir: &std::path::Path,
    stem: &str,
    replace: Option<&std::path::Path>,
) -> std::path::PathBuf {
    let mut path = dir.join(format!("{stem}.pdf"));
    let mut n = 2;
    while path.exists() && Some(path.as_path()) != replace {
        path = dir.join(format!("{stem}-{n}.pdf"));
        n += 1;
    }
    path
}

fn render_invoice(invoice: &Value, company: &CompanyData) -> Result<Vec<u8>, String> {
    DocgenCompiler::new()
        .compile(
            "invoice",
            serde_json::to_vec(invoice).map_err(|e| e.to_string())?,
            company,
            &company.language,
        )
        .map_err(|e| e.to_string())
}

fn render_offer(offer: &Value, company: &CompanyData) -> Result<Vec<u8>, String> {
    DocgenCompiler::new()
        .compile(
            "offer",
            serde_json::to_vec(offer).map_err(|e| e.to_string())?,
            company,
            &company.language,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn generate_offer(
    app: tauri::AppHandle,
    input: GenerateOfferInput,
    output_dir: Option<String>,
) -> Result<GenerateOfferResult, String> {
    let company = profile_to_company(&input.profile)?;

    let pdf_bytes = render_offer(&input.offer, &company)?;

    let downloads = match output_dir {
        Some(dir) if !dir.trim().is_empty() => std::path::PathBuf::from(dir),
        _ => app.path().download_dir().map_err(|e| e.to_string())?,
    };
    std::fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;

    let offer_number = input.offer["metadata"]["offer_number"]
        .as_str()
        .unwrap_or("angebot")
        .replace(['/', '\\', ' '], "-");
    let filename = format!("Angebot-{}.pdf", offer_number);
    let path = downloads.join(&filename);

    std::fs::write(&path, &pdf_bytes).map_err(|e| e.to_string())?;

    Ok(GenerateOfferResult {
        path: path.to_string_lossy().to_string(),
    })
}

/// 1x1 transparent PNG. The template always draws a grey "Logo hinzufügen" box when the
/// company has no logo, so an invisible image takes its place.
const BLANK_LOGO_PNG: &[u8] = &[
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
    0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
    0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60,
    0x00, 0x02, 0x00, 0x00, 0x05, 0x00, 0x01, 0x7a, 0x5e, 0xab, 0x3f, 0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
];

/// Absolute path for the template's `image("/" + logo)`: the configured logo file, or the
/// invisible placeholder image.
fn logo_for_template(logo: Option<&str>) -> Result<String, String> {
    let path = match logo.map(str::trim).filter(|value| !value.is_empty()) {
        Some(value) => {
            if !std::path::Path::new(value).is_file() {
                return Err(format!("Logo-Datei nicht gefunden: {value}"));
            }
            std::path::PathBuf::from(value)
        }
        None => {
            let blank = std::env::temp_dir().join("etasks-blank-logo.png");
            std::fs::write(&blank, BLANK_LOGO_PNG).map_err(|e| e.to_string())?;
            blank
        }
    };
    Ok(path.to_string_lossy().trim_start_matches('/').to_string())
}

fn profile_to_company(p: &UserProfile) -> Result<CompanyData, String> {
    // The template draws the logo at a fixed 150 pt width; `logo_width` is not read.
    let logo = logo_for_template(p.logo.as_deref())?;
    let tax_id = Some(p.tax_id.trim().to_string()).filter(|value| !value.is_empty());
    Ok(CompanyData {
        name: p.company.clone(),
        language: "de".to_string(),
        logo: Some(logo),
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
            phone: p.phone.clone().filter(|value| !value.trim().is_empty()),
            email: Some(p.email.clone()),
            website: p.website.clone().filter(|value| !value.trim().is_empty()),
        },
        // The footer only prints `vat_id` (labelled "USt-IdNr."), so the profile's tax number
        // goes there; `tax_id` is kept for completeness.
        vat_id: tax_id.clone(),
        tax_id,
        business_owner: Some(format!("{} {}", p.first_name, p.last_name).trim().to_string()),
        bank_account: Some(BankAccount {
            // The footer template reads bank_name and bic unconditionally, so a missing key
            // aborts the PDF; empty strings render as blank lines instead.
            bank_name: Some(p.bank_name.clone().unwrap_or_default()),
            account_holder: Some(format!("{} {}", p.first_name, p.last_name).trim().to_string()),
            iban: Some(p.iban.clone()),
            bic: Some(p.bic.clone().unwrap_or_default()),
        }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_profile() -> UserProfile {
        UserProfile {
            first_name: "Anna".into(),
            last_name: "Testfrau".into(),
            email: "anna@testfrau.example".into(),
            phone: Some("+49 30 123456".into()),
            company: "Testfrau Studio".into(),
            street: "Teststraße 7".into(),
            zip: "10115".into(),
            city: "Berlin".into(),
            tax_id: "DE999888777".into(),
            iban: "DE02 1203 0000 0000 2020 51".into(),
            bank_name: Some("Testbank".into()),
            bic: Some("BYLADEM1001".into()),
            ..UserProfile::default()
        }
    }

    fn pdf_dir() -> Option<std::path::PathBuf> {
        std::env::var("ETASKS_TEST_PDF_DIR").ok().map(std::path::PathBuf::from)
    }

    fn sample_invoice() -> Value {
        json!({
            "metadata": {
                "invoice_number": "RE-001",
                "invoice_date": { "date": "2026-11-12" },
                "due_date": { "date": "2026-11-26" },
                "customer_number": "K-1"
            },
            "recipient": {
                "name": "Erika Beispiel",
                "company": "Beispiel GmbH",
                "address": {
                    "street": "Hauptstraße",
                    "house_number": "5",
                    "postal_code": "10115",
                    "city": "Berlin",
                    "country": "Deutschland"
                }
            },
            "salutation": { "greeting": "Hallo Erika," },
            "items": [
                {
                    "position": 1,
                    "description": "Beratung",
                    "quantity": 0.25,
                    "unit": "Stunde",
                    "vat_rate": { "percentage": 19 },
                    "unit_price": { "amount": 95.5 },
                    "total": { "amount": 23.88 }
                },
                {
                    "position": 2,
                    "description": "Buch",
                    "quantity": 1,
                    "unit": "Stück",
                    "vat_rate": { "percentage": 7 },
                    "unit_price": { "amount": 20 },
                    "total": { "amount": 20 }
                }
            ],
            "totals": {
                "subtotal": { "amount": 43.88 },
                "vat_breakdown": [
                    { "rate": { "percentage": 19 }, "base": { "amount": 23.88 }, "amount": { "amount": 4.54 } },
                    { "rate": { "percentage": 7 }, "base": { "amount": 20 }, "amount": { "amount": 1.4 } }
                ],
                "total": { "amount": 49.82 }
            },
            "payment": { "due_date": { "date": "2026-11-26" }, "bank_transfer_note": "RE-001" }
        })
    }

    #[test]
    fn renders_invoice_pdf_with_vat_rate_objects() {
        let company = profile_to_company(&test_profile()).unwrap();
        let pdf = render_invoice(&sample_invoice(), &company).expect("invoice PDF");
        assert!(pdf.starts_with(b"%PDF"));
        if let Some(dir) = pdf_dir() {
            std::fs::write(dir.join("invoice.pdf"), &pdf).unwrap();
        }
    }

    #[test]
    fn decimal_vat_rates_render() {
        let mut invoice = sample_invoice();
        invoice["items"][1]["vat_rate"]["percentage"] = json!(7.5);
        invoice["totals"]["vat_breakdown"][1]["rate"]["percentage"] = json!(7.5);
        let company = profile_to_company(&test_profile()).unwrap();
        assert!(render_invoice(&invoice, &company).is_ok());
    }

    #[test]
    fn numeric_vat_rate_in_breakdown_is_rejected_by_template() {
        let mut invoice = sample_invoice();
        invoice["totals"]["vat_breakdown"][0]["rate"] = json!(19);
        let company = profile_to_company(&test_profile()).unwrap();
        assert!(render_invoice(&invoice, &company).is_err());
    }

    #[test]
    fn renders_offer_pdf_with_totals_block() {
        let offer = json!({
            "metadata": {
                "offer_number": "ANG-2026-001",
                "offer_date": { "date": "2026-11-12" },
                "valid_until": { "date": "2026-12-12" },
                "show_footer": true
            },
            "recipient": {
                "name": "Erika Beispiel",
                "company": "Beispiel GmbH",
                "address": {
                    "street": "Hauptstraße",
                    "house_number": "5",
                    "postal_code": "10115",
                    "city": "Berlin",
                    "country": "Deutschland"
                }
            },
            "salutation": { "greeting": "Hallo Erika," },
            "items": [{
                "position": 1,
                "title": "Konzept",
                "description": "",
                "quantity": 2,
                "unit": "Stunden",
                "unit_price": { "amount": "95.50", "currency": "EUR" },
                "total": { "amount": "191.00", "currency": "EUR" }
            }],
            "totals": {
                "subtotal": { "amount": "191.00", "currency": "EUR" },
                "vat_breakdown": [{
                    "rate": { "percentage": 19 },
                    "base": { "amount": "191.00", "currency": "EUR" },
                    "amount": { "amount": "36.29", "currency": "EUR" }
                }],
                "total": { "amount": "227.29", "currency": "EUR" }
            },
            "terms": { "validity": "Dieses Angebot ist gültig bis 12.12.2026" }
        });
        let company = profile_to_company(&test_profile()).unwrap();
        let pdf = render_offer(&offer, &company).expect("offer PDF");
        assert!(pdf.starts_with(b"%PDF"));
        if let Some(dir) = pdf_dir() {
            std::fs::write(dir.join("offer.pdf"), &pdf).unwrap();
        }
    }

    #[test]
    fn invoice_footer_prints_bank_details_and_tax_number() {
        let company = profile_to_company(&test_profile()).unwrap();
        let mut invoice = sample_invoice();
        invoice["metadata"]["show_footer"] = json!(true);
        invoice["salutation"]["introduction"] = json!("Vielen Dank für Ihren Auftrag.");
        let pdf = render_invoice(&invoice, &company).expect("invoice PDF");
        if let Some(dir) = pdf_dir() {
            std::fs::write(dir.join("invoice-footer.pdf"), &pdf).unwrap();
        }
        assert_eq!(company.vat_id.as_deref(), Some("DE999888777"));
        assert_eq!(company.tax_id.as_deref(), Some("DE999888777"));
    }

    #[test]
    fn invoice_with_logo_file_renders() {
        let dir = std::env::temp_dir().join(format!("etasks-logo-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let logo = dir.join("company-logo.svg");
        std::fs::write(
            &logo,
            r##"<svg xmlns="http://www.w3.org/2000/svg" width="60" height="20"><rect width="60" height="20" fill="#d02020"/></svg>"##,
        )
        .unwrap();
        let mut profile = test_profile();
        profile.logo = Some(logo.to_string_lossy().to_string());
        let company = profile_to_company(&profile).unwrap();
        let pdf = render_invoice(&sample_invoice(), &company).expect("invoice PDF with logo");
        assert!(pdf.starts_with(b"%PDF"));
        if let Some(out) = pdf_dir() {
            std::fs::write(out.join("invoice-logo.pdf"), &pdf).unwrap();
        }
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn missing_logo_file_is_an_error_and_no_logo_uses_the_blank_image() {
        let mut profile = test_profile();
        profile.logo = Some("/definitely/not/here.png".into());
        assert!(profile_to_company(&profile).unwrap_err().contains("Logo-Datei nicht gefunden"));

        let company = profile_to_company(&test_profile()).unwrap();
        assert!(company.logo.unwrap().ends_with("etasks-blank-logo.png"));
    }

    #[test]
    fn pdf_path_gets_a_suffix_unless_it_is_the_invoices_own_file() {
        let dir = std::env::temp_dir().join(format!("etasks-pdf-path-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let first = free_pdf_path(&dir, "Rechnung-RE-001", None);
        assert_eq!(first, dir.join("Rechnung-RE-001.pdf"));
        std::fs::write(&first, b"x").unwrap();

        let second = free_pdf_path(&dir, "Rechnung-RE-001", None);
        assert_eq!(second, dir.join("Rechnung-RE-001-2.pdf"));
        assert_eq!(free_pdf_path(&dir, "Rechnung-RE-001", Some(&first)), first);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
