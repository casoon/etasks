// @module:billing
import { invoke } from "@tauri-apps/api/core";
import { isTauriAvailable } from "./platform";
import type { AppConfig } from "../stores/configStore";

export interface OfferRecipient {
  name: string;
  company?: string;
  address: {
    street: string;
    house_number: string;
    postal_code: string;
    city: string;
    country?: string;
  };
}

export interface OfferItem {
  position: number;
  title: string;
  description: string;
  sub_items?: string[];
  quantity: string | number;
  unit: string;
  unit_price: { amount: string | number; currency?: string };
  total: { amount: string | number; currency?: string };
}

export interface OfferData {
  metadata: {
    offer_number: string;
    offer_date: { date: string };
    valid_until: { date: string };
    customer_number?: string;
    project_reference?: string;
    show_footer?: boolean;
  };
  recipient: OfferRecipient;
  salutation?: {
    greeting: string;
    introduction?: string;
  };
  items: OfferItem[];
  totals: {
    subtotal: { amount: string | number; currency?: string };
    total: { amount: string | number; currency?: string };
  };
  terms: {
    validity: string;
    payment_terms?: string;
    delivery_terms?: string;
    additional_terms?: string[];
  };
  notes?: string;
}

export async function generateOffer(
  offer: OfferData,
  config: AppConfig,
): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error("Angebotserzeugung ist nur in der Desktop-App verfügbar.");
  }
  const result = await invoke<{ path: string }>("generate_offer", {
    input: { offer, profile: config.profile },
    outputDir: config.default_export_dir ?? null,
  });
  return result.path;
}
