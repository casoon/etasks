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
) -> Result<GenerateInvoiceResult, String> {
    let company = profile_to_company(&input.profile);

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
    let filename = format!("Rechnung-{}.pdf", invoice_number);
    let path = downloads.join(&filename);

    std::fs::write(&path, &pdf_bytes).map_err(|e| e.to_string())?;

    Ok(GenerateInvoiceResult {
        path: path.to_string_lossy().to_string(),
    })
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
    let company = profile_to_company(&input.profile);

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

fn profile_to_company(p: &UserProfile) -> CompanyData {
    CompanyData {
        name: p.company.clone(),
        language: "de".to_string(),
        logo: p
            .logo
            .clone()
            .filter(|value| !value.trim().is_empty())
            .map(|value| value.trim_start_matches('/').to_string()),
        logo_width: p
            .logo_width
            .clone()
            .filter(|value| !value.trim().is_empty()),
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
        tax_id: Some(p.tax_id.clone()),
        vat_id: None,
        business_owner: Some(format!("{} {}", p.first_name, p.last_name)),
        bank_account: Some(BankAccount {
            // The footer template reads bank_name and bic unconditionally, so a missing key
            // aborts the PDF; empty strings render as blank lines instead.
            bank_name: Some(p.bank_name.clone().unwrap_or_default()),
            account_holder: Some(format!("{} {}", p.first_name, p.last_name)),
            iban: Some(p.iban.clone()),
            bic: Some(p.bic.clone().unwrap_or_default()),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

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
        let company = profile_to_company(&UserProfile::default());
        let pdf = render_invoice(&sample_invoice(), &company).expect("invoice PDF");
        assert!(pdf.starts_with(b"%PDF"));
        if let Ok(dir) = std::env::var("ETASKS_TEST_PDF_DIR") {
            std::fs::write(std::path::Path::new(&dir).join("invoice.pdf"), &pdf).unwrap();
        }
    }

    #[test]
    fn decimal_vat_rates_render() {
        let mut invoice = sample_invoice();
        invoice["items"][1]["vat_rate"]["percentage"] = json!(7.5);
        invoice["totals"]["vat_breakdown"][1]["rate"]["percentage"] = json!(7.5);
        let company = profile_to_company(&UserProfile::default());
        assert!(render_invoice(&invoice, &company).is_ok());
    }

    #[test]
    fn numeric_vat_rate_in_breakdown_is_rejected_by_template() {
        let mut invoice = sample_invoice();
        invoice["totals"]["vat_breakdown"][0]["rate"] = json!(19);
        let company = profile_to_company(&UserProfile::default());
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
        let company = profile_to_company(&UserProfile::default());
        let pdf = render_offer(&offer, &company).expect("offer PDF");
        assert!(pdf.starts_with(b"%PDF"));
        if let Ok(dir) = std::env::var("ETASKS_TEST_PDF_DIR") {
            std::fs::write(std::path::Path::new(&dir).join("offer.pdf"), &pdf).unwrap();
        }
    }
}
