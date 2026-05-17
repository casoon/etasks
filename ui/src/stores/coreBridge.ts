// @core — bridge atoms that modules sync into; core components read from here
// Modules write to these; @core never imports from module stores directly.
import { atom } from 'nanostores';
import type { TimeEntry, Invoice, ServiceItem } from '../domain/types';

export const $bridgeTimeEntries = atom<TimeEntry[]>([]);
export const $bridgeInvoices = atom<Invoice[]>([]);
export const $bridgeServices = atom<ServiceItem[]>([]);
