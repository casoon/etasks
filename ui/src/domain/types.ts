export type TaskStatus = "todo" | "done" | "archived";
export type KanbanStatus = "backlog" | "in_progress" | "review" | "done";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  dayOfWeek?: number; // 0–6 (Mo=1…So=0) für weekly
  dayOfMonth?: number; // 1–31 für monthly
}

export interface Task {
  id: string;
  title: string;
  estimatedMinutes?: number | null;
  status: TaskStatus;
  tags: string[];
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  plannedDate?: string | null; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  sortOrder?: number | null;
  priorityRank?: 1 | 2 | 3 | null;
  projectId?: string;
  kanbanStatus?: KanbanStatus;
  notes?: string;
  recurrence?: RecurrenceRule;
  sourceTaskId?: string; // ID des Ursprungs-Tasks bei generierten Instanzen
  trackedSeconds?: number; // akkumulierte Zeit aus TimeEntries
  completedAt?: string | null;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  projectId?: string;
  startAt: string; // ISO
  endAt?: string | null; // ISO, null = läuft noch
  durationMinutes?: number | null; // null solange läuft, gesetzt beim Stopp
  isRunning: boolean;
  updatedAt: string;
}

export interface CalendarBlock {
  id: string;
  taskId?: string;
  start: string;
  end: string;
  title?: string;
  color?: string;
  date: string;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  done: boolean;
  weekStart: string;
  taskIds: string[];
}

export interface DayPlan {
  id: string;
  date: string;
  intention?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BillingType = "fixed" | "hourly" | "unit";

export interface BillingItem {
  id: string;
  projectId: string;
  serviceId?: string | null; // optional reference to ServiceItem as template
  title: string;
  description?: string | null;
  billingType: BillingType;
  unitPriceCents?: number | null; // price in cents to avoid float issues
  quantity?: number | null;
  sortOrder?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingItemTask {
  billingItemId: string;
  taskId: string;
  createdAt: string;
}

export interface DailyNote {
  date: string;
  highlight: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  customerNumber?: string;
  hourlyRate?: number; // EUR
  currency?: string; // default 'EUR'
  // Contact details
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ServiceItem {
  id: string;
  name: string; // Kurzbezeichnung z. B. "Webentwicklung"
  description: string; // Rechnungstext (Langtext)
  unit: string; // z. B. "Stunde", "Tag", "Pauschal"
  unitPrice: number; // EUR
  vatRate: number; // Prozent, z. B. 19
  category?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  color: string;
  status: "active" | "paused" | "done";
  notes?: string;
  createdAt: string;
}

export interface TemplateTask {
  title: string;
  estimatedMinutes: number;
  kanbanStatus: KanbanStatus;
  tags: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  isBuiltIn: boolean;
  tasks: TemplateTask[];
}

export type InvoiceStatus = "draft" | "sent" | "paid";

export interface InvoiceLineItem {
  id: string;
  serviceItemId?: string; // Katalog-Referenz – unveränderlich sobald gesetzt
  name: string;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  vatRate: number;
  taskIds: string[];
}

export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  customerNumber?: string;
  date: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  performancePeriod?: string;
  projectReference?: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  notes?: string;
  createdAt: string;
}

export type ViewMode = "day" | "board";
export type NavItem =
  | "today"
  | "focus"
  | "planning-daily"
  | "planning-weekly"
  | "projects"
  | "time-tracking"
  | "clients"
  | "settings";

export const TAG_COLORS: Record<string, string> = {
  work: "#bfdbfe",
  admin: "#ddd6fe",
  personal: "#bbf7d0",
  meeting: "#fde68a",
  deep: "#fbcfe8",
  review: "#fed7aa",
};

export const PROJECT_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export const KANBAN_COLUMNS: { id: KanbanStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Arbeit" },
  { id: "review", label: "Review" },
  { id: "done", label: "Erledigt" },
];
