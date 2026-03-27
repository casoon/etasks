export type TaskStatus = 'todo' | 'done';
export type KanbanStatus = 'backlog' | 'in_progress' | 'review' | 'done';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  dayOfWeek?: number; // 0–6 (Mo=1…So=0) für weekly
  dayOfMonth?: number; // 1–31 für monthly
}

export interface Task {
  id: string;
  title: string;
  duration: number; // planned minutes
  status: TaskStatus;
  tags: string[];
  scheduledAt?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  order: number;
  projectId?: string;
  kanbanStatus?: KanbanStatus;
  notes?: string;
  recurrence?: RecurrenceRule;
  sourceTaskId?: string; // ID des Ursprungs-Tasks bei generierten Instanzen
  trackedSeconds?: number; // akkumulierte Zeit aus TimeEntries
}

export interface TimeEntry {
  id: string;
  taskId: string;
  projectId?: string;
  startedAt: string; // ISO
  stoppedAt?: string; // ISO, undefined = läuft noch
  durationSeconds: number; // 0 solange läuft, gesetzt beim Stopp
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
  hourlyRate?: number; // EUR
  currency?: string; // default 'EUR'
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  color: string;
  status: 'active' | 'paused' | 'done';
  notes?: string;
  createdAt: string;
}

export interface TemplateTask {
  title: string;
  duration: number;
  kanbanStatus: KanbanStatus;
  tags: string[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  isBuiltIn: boolean;
  tasks: TemplateTask[];
}

export type ViewMode = 'day' | 'board';
export type NavItem =
  | 'today'
  | 'focus'
  | 'planning-daily'
  | 'planning-weekly'
  | 'projects'
  | 'time-tracking'
  | 'clients';

export const TAG_COLORS: Record<string, string> = {
  work: '#bfdbfe',
  admin: '#ddd6fe',
  personal: '#bbf7d0',
  meeting: '#fde68a',
  deep: '#fbcfe8',
  review: '#fed7aa',
};

export const PROJECT_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
];

export const KANBAN_COLUMNS: { id: KanbanStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Arbeit' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Erledigt' },
];
