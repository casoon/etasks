// @module:billing
import { today, toDateKey } from "../domain/dateUtils";
import { $appConfig } from "../stores/configStore";
import { $clients } from "../stores/projectStore";
import { $invoices, $pendingImportRange, $selectedInvoiceId, addInvoice } from "../stores/invoiceStore";
import { $navItem } from "../stores/uiStore";
import { toast } from "../stores/toastStore";
import { allocateInvoiceNumber } from "./invoiceNumber";

let creating = false;

export interface InvoicePeriod {
  from: string;
  to: string;
  /** Text für „Leistungszeitraum“. */
  label: string;
}

/** Neuer Rechnungsentwurf (optional für einen Kunden und Zeitraum); öffnet ihn im Editor unter „Rechnungen“. */
export async function createInvoiceDraft(clientId = "", period?: InvoicePeriod): Promise<void> {
  if (creating) return;
  creating = true;
  try {
    const profile = $appConfig.get()?.profile;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (profile?.payment_days ?? 14));
    const invoiceNumber = await allocateInvoiceNumber(
      profile?.invoice_number_prefix ?? "RE-",
      profile?.invoice_number_counter,
      () => $invoices.get().map((i) => i.invoiceNumber),
    );
    const client = clientId ? $clients.get().find((c) => c.id === clientId) : undefined;
    const invoice = addInvoice({
      clientId: client?.id ?? "",
      invoiceNumber,
      customerNumber: client?.customerNumber ?? "",
      date: today(),
      dueDate: toDateKey(dueDate),
      performancePeriod: period?.label ?? "",
      projectReference: "",
      status: "draft",
      lineItems: [],
    });
    $pendingImportRange.set(period ? { from: period.from, to: period.to } : null);
    $selectedInvoiceId.set(invoice.id);
    $navItem.set("invoices");
  } catch (error) {
    toast(`Rechnungsnummer konnte nicht vergeben werden: ${String(error)}`, "error", 5000);
  } finally {
    creating = false;
  }
}
