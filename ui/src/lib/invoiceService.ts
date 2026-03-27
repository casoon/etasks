import { invoke } from '@tauri-apps/api/core';
import { isTauriAvailable } from './platform';
import type { AppConfig } from '../stores/configStore';

export interface InvoiceItem {
  position: number;
  description: string;
  quantity: number;
  unit: string;
  vat_rate: { percentage: number };
  unit_price: { amount: number };
  total: { amount: number };
  sub_items?: string[];
}

export interface InvoiceRecipient {
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

export interface InvoiceData {
  metadata: {
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    customer_number?: string;
    performance_period?: string;
    project_reference?: string;
    show_footer?: boolean;
  };
  recipient: InvoiceRecipient;
  salutation?: {
    greeting: string;
    introduction?: string;
  };
  items: InvoiceItem[];
  totals: {
    subtotal: { amount: number };
    vat_breakdown: { rate: number; base: { amount: number }; amount: { amount: number } }[];
    total: { amount: number };
  };
  payment: {
    due_date: string;
    bank_transfer_note?: string;
  };
  closing?: {
    text?: string;
    signature?: string;
  };
}

export async function generateInvoice(
  invoice: InvoiceData,
  config: AppConfig
): Promise<string> {
  if (!isTauriAvailable()) {
    throw new Error('Rechnungsgenerierung ist nur in der Desktop-App verfügbar.');
  }
  const result = await invoke<{ path: string }>('generate_invoice', {
    input: { invoice, profile: config.profile },
  });
  return result.path;
}


/**
 * Build a minimal InvoiceData from time entries and project info.
 * Caller fills in recipient + invoice metadata.
 */
export function buildInvoiceItems(
  timeEntries: { description: string; hours: number; hourlyRate: number }[]
): InvoiceItem[] {
  return timeEntries.map((entry, i) => {
    const total = Math.round(entry.hours * entry.hourlyRate * 100) / 100;
    return {
      position: i + 1,
      description: entry.description,
      quantity: entry.hours,
      unit: 'h',
      vat_rate: { percentage: 19 },
      unit_price: { amount: entry.hourlyRate },
      total: { amount: total },
    };
  });
}

export function calcTotals(items: InvoiceItem[]): InvoiceData['totals'] {
  const subtotal = items.reduce((s, item) => s + item.total.amount, 0);
  const vatAmount = Math.round(subtotal * 0.19 * 100) / 100;
  return {
    subtotal: { amount: Math.round(subtotal * 100) / 100 },
    vat_breakdown: [
      {
        rate: 19,
        base: { amount: Math.round(subtotal * 100) / 100 },
        amount: { amount: vatAmount },
      },
    ],
    total: { amount: Math.round((subtotal + vatAmount) * 100) / 100 },
  };
}
