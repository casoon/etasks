import { describe, expect, it } from "vitest";
import { buildInvoiceChecks } from "./invoiceChecklist";

const line = {} as never;
const base = {
  invoice: { clientId: "c", lineItems: [line, line] },
  client: { address: "Musterstr. 1, 10115 Berlin" },
  numberProblem: "",
  missingProfileFields: [] as string[],
};

describe("buildInvoiceChecks", () => {
  it("passes for a complete invoice", () => {
    const checks = buildInvoiceChecks(base);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks.find((c) => c.id === "positions")?.text).toBe("2 Positionen");
  });
  it("reports each existing rule with a fix target", () => {
    const checks = buildInvoiceChecks({
      invoice: { clientId: "", lineItems: [] },
      client: undefined,
      numberProblem: "Diese Rechnungsnummer ist bereits vergeben.",
      missingProfileFields: ["IBAN", "Ort"],
    });
    const bad = checks.filter((c) => !c.ok);
    expect(bad.map((c) => c.fix?.target)).toEqual(["client", "positions", "number", "profile"]);
    expect(checks.find((c) => c.id === "profile")?.text).toBe("Im Profil fehlt: IBAN, Ort.");
  });
  it("asks for the client address only once a client is chosen", () => {
    const checks = buildInvoiceChecks({ ...base, client: { address: " " } });
    expect(checks.find((c) => c.id === "address")?.fix?.target).toBe("client-address");
  });
});
