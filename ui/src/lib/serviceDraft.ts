// @module:billing
export interface ServiceDraft {
  name: string;
  description: string;
  unit: string;
  unitPrice: number | null;
  vatRate: number | null;
  category: string;
}
