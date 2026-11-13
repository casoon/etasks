// @module:billing
// Prüfliste im Rechnungseditor: dieselben Regeln wie beim Erzeugen des PDFs und beim Statuswechsel.
import type { Client, Invoice } from "../domain/types";
import { statusBlockedReason } from "./invoiceStatus";

export type CheckFix = "client" | "number" | "client-address" | "profile" | "positions";

export interface InvoiceCheck {
  id: string;
  ok: boolean;
  /** Text der Zeile; bei Fehlern der Grund. */
  text: string;
  /** Wo sich das Problem beheben lässt. */
  fix?: { target: CheckFix; label: string };
}

export function buildInvoiceChecks(input: {
  invoice: Pick<Invoice, "clientId" | "lineItems">;
  client: Pick<Client, "address"> | undefined;
  numberProblem: string;
  missingProfileFields: string[];
}): InvoiceCheck[] {
  const { invoice, client, numberProblem, missingProfileFields } = input;
  const checks: InvoiceCheck[] = [];

  checks.push(
    invoice.clientId
      ? { id: "client", ok: true, text: "Kunde gewählt" }
      : { id: "client", ok: false, text: "Wähle zuerst einen Kunden.", fix: { target: "client", label: "Kunden wählen" } },
  );
  if (invoice.clientId) {
    checks.push(
      client?.address?.trim()
        ? { id: "address", ok: true, text: "Rechnungsadresse des Kunden vorhanden" }
        : {
            id: "address",
            ok: false,
            text: "Beim Kunden fehlt die Rechnungsadresse.",
            fix: { target: "client-address", label: "Beim Kunden ergänzen" },
          },
    );
  }
  const noItems = statusBlockedReason({ clientId: "x", lineItems: invoice.lineItems }, "sent");
  checks.push(
    noItems
      ? { id: "positions", ok: false, text: noItems, fix: { target: "positions", label: "Position hinzufügen" } }
      : {
          id: "positions",
          ok: true,
          text: `${invoice.lineItems.length} ${invoice.lineItems.length === 1 ? "Position" : "Positionen"}`,
        },
  );
  checks.push(
    numberProblem
      ? { id: "number", ok: false, text: numberProblem, fix: { target: "number", label: "Nummer ändern" } }
      : { id: "number", ok: true, text: "Nummer ist frei" },
  );
  checks.push(
    missingProfileFields.length
      ? {
          id: "profile",
          ok: false,
          text: `Im Profil fehlt: ${missingProfileFields.join(", ")}.`,
          fix: { target: "profile", label: "Profil öffnen" },
        }
      : { id: "profile", ok: true, text: "Profil vollständig" },
  );
  return checks;
}
