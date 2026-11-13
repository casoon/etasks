// @module:projects
import type { BillingItem, BillingItemTask, Client, Project, Task } from "../domain/types";
import { toDateKey } from "../domain/dateUtils";
import { missingPdfProfileFields, missingProfileMessage, type AppConfig } from "../stores/configStore";
import { toast } from "../stores/toastStore";
import { isTauriAvailable } from "./platform";
import { generateOffer, type OfferData } from "./offerService";
import { commitOfferCounter, peekOfferNumber } from "./invoiceNumber";
import { calcInvoiceTotals, formatCents, lineTotalCents } from "./invoiceMoney";

export interface ProjectOfferInput {
    project: Project;
    client: Client | null;
    items: readonly BillingItem[];
    links: readonly BillingItemTask[];
    tasks: readonly Task[];
    config: AppConfig;
}

/** Splits a one-line client address („Straße 1, 12345 Ort“) into the PDF address fields. */
export function splitClientAddress(address?: string) {
    const fallback = {
        street: "",
        house_number: "",
        postal_code: "",
        city: "",
        country: "Deutschland",
    };
    if (!address?.trim()) return fallback;
    const [firstLine, secondLine = ""] = address
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    const streetMatch = firstLine.match(/^(.*?)(?:\s+(\d+[a-zA-Z/-]*))?$/);
    const locationMatch = secondLine.match(/^(\d{4,5})\s+(.+)$/);
    return {
        street: streetMatch?.[1]?.trim() ?? firstLine,
        house_number: streetMatch?.[2]?.trim() ?? "",
        postal_code: locationMatch?.[1] ?? "",
        city: locationMatch?.[2]?.trim() ?? secondLine,
        country: "Deutschland",
    };
}

/**
 * Builds the offer PDF of a project. Returns the status line to show, or null when a check failed
 * (the reason was shown as a toast).
 */
export async function exportProjectOffer(input: ProjectOfferInput): Promise<string | null> {
    const { project: selectedProject, client: selectedClient, items: projectBillingItems, links: billingItemTasks, tasks: allTasks, config: appConfig } = input;
    if (!selectedClient) {
        toast(
            "Für ein Angebot braucht das Projekt einen Kunden. Interne Projekte haben keinen.",
            "error",
            4500,
        );
        return null;
    }
    if (!isTauriAvailable()) {
        toast(
            "Angebote können nur in der Desktop-App als PDF erzeugt werden.",
            "info",
            4000,
        );
        return null;
    }
    if (!selectedClient.address?.trim()) {
        toast(
            `Beim Kunden "${selectedClient.name}" fehlt die Angebotsadresse.`,
            "error",
            4500,
        );
        return null;
    }
    if (projectBillingItems.length === 0) {
        toast(
            "Das Projekt hat noch keine Rechnungs-/Angebotspositionen.",
            "error",
            4500,
        );
        return null;
    }

    const profile = appConfig.profile;
    const missing = missingPdfProfileFields(profile);
    if (missing.length) {
        toast(missingProfileMessage(missing), "error", 7000);
        return null;
    }
    const today = new Date();
    const year = today.getFullYear();
    const prefix = profile.offer_number_prefix?.trim() || `ANG-${year}-`;
    let offerNumber: string;
    let nextOfferCounter: number;
    try {
        ({ number: offerNumber, next: nextOfferCounter } =
            await peekOfferNumber(prefix, profile.offer_number_counter));
    } catch (error) {
        toast(
            `Angebotsnummer konnte nicht vergeben werden: ${String(error)}`,
            "error",
            5000,
        );
        return null;
    }
    const validUntil = new Date(today);
    validUntil.setDate(
        validUntil.getDate() + (profile.offer_validity_days ?? 30),
    );

    const offerItems = projectBillingItems.map((item, index) => {
        const linkedTasks = billingItemTasks
            .filter((link) => link.billingItemId === item.id)
            .map((link) => allTasks.find((task) => task.id === link.taskId))
            .filter(Boolean);
        const estimatedHours =
            linkedTasks.reduce(
                (sum, task) => sum + (task?.estimatedMinutes ?? 0) / 60,
                0,
            ) || 0;
        const quantity =
            item.quantity ??
            (item.billingType === "hourly"
                ? Math.max(1, Math.round(estimatedHours * 10) / 10)
                : 1);
        const unit =
            item.billingType === "hourly"
                ? "Stunden"
                : item.billingType === "fixed"
                  ? "Pauschal"
                  : "Einheit";
        const unitPrice = (item.unitPriceCents ?? 0) / 100;
        const total = formatCents(lineTotalCents(unitPrice, quantity));
        return {
            position: index + 1,
            title: item.title,
            description: item.description ?? "",
            sub_items: linkedTasks
                .map((task) => task?.title?.trim())
                .filter(Boolean) as string[],
            quantity: item.billingType === "fixed" ? "1" : quantity,
            unit,
            unit_price: { amount: unitPrice.toFixed(2), currency: "EUR" },
            total: { amount: total, currency: "EUR" },
        };
    });

    // Angebotspositionen haben keinen eigenen MwSt.-Satz: Profil-Standard, sonst 19 %.
    const vatRate = profile.default_vat_rate ?? 19;
    const offerTotals = calcInvoiceTotals(
        offerItems.map((item) => ({
            unitPrice: Number(item.total.amount),
            quantity: 1,
            vatRate,
        })),
    );
    const money = (cents: number) => ({
        amount: formatCents(cents),
        currency: "EUR",
    });
    const additionalTerms = (profile.offer_additional_terms ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const offerData: OfferData = {
        metadata: {
            offer_number: offerNumber,
            offer_date: { date: toDateKey(today) },
            valid_until: { date: toDateKey(validUntil) },
            customer_number:
                selectedClient.customerNumber?.trim() || undefined,
            project_reference: selectedProject.name,
            show_footer: true,
        },
        recipient: {
            name:
                selectedClient.contactPerson?.trim() || selectedClient.name,
            company: selectedClient.name,
            address: splitClientAddress(selectedClient.address),
        },
        salutation: {
            greeting: selectedClient.contactPerson?.trim()
                ? `Hallo ${selectedClient.contactPerson.trim()},`
                : `Hallo ${selectedClient.name},`,
            introduction: selectedProject.offerText?.trim() || undefined,
        },
        items: offerItems,
        totals: {
            subtotal: money(offerTotals.nettoCents),
            vat_breakdown: offerTotals.vatEntries.map((entry) => ({
                rate: { percentage: entry.rate },
                base: money(entry.baseCents),
                amount: money(entry.amountCents),
            })),
            total: money(offerTotals.totalCents),
        },
        terms: {
            validity: `Dieses Angebot ist gültig bis ${validUntil.toLocaleDateString("de-DE")}`,
            payment_terms: profile.offer_payment_terms?.trim() || undefined,
            delivery_terms:
                profile.offer_delivery_terms?.trim() || undefined,
            additional_terms:
                additionalTerms.length > 0 ? additionalTerms : undefined,
        },
    };

    try {
        const path = await generateOffer(offerData, appConfig);
        await commitOfferCounter(nextOfferCounter);
        toast(`Angebot gespeichert: ${path}`, "success", 5000);
        return `Angebot gespeichert: ${path}`;
    } catch (error) {
        toast(`Angebot fehlgeschlagen: ${String(error)}`, "error", 5000);
        return `Fehler: ${String(error)}`;
    }
}
