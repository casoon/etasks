// @module:reporting
import { command } from '@casoon/origin-client';
import type { Task, Project, TimeEntry } from '../domain/types';
import { entrySeconds, toDateKeyFromIso } from '../domain/dateUtils';
import { $appConfig } from '../stores/configStore';

export interface ProjectReportInput {
  name: string;
  status: string;
  completion_rate: number;
  total_tasks: number;
  done_tasks: number;
  tracked_hours: number;
  planned_hours: number;
  tasks: { title: string; status: string; duration_minutes: number }[];
}

export interface ReportRow {
  taskId: string;
  task: Task | null; // null = Aufgabe wurde gelöscht, die Zeit bleibt erhalten
  completedDate: string; // Tag der Erledigung, sonst Tag des letzten Zeiteintrags im Zeitraum
  done: boolean;
  trackedMinutes: number; // erfasste Zeit im Zeitraum, nach Tag des Zeiteintrags
  estimatedMinutes: number;
}

// Rows for the report: tasks completed in [from, to] (by completedAt, updatedAt only as
// fallback for old data) plus every task with tracked time in the range. Tracked time is
// attributed by the day of the time entry itself; estimates stay separate.
export function buildReportRows(
  tasks: readonly Task[],
  timeEntries: readonly TimeEntry[],
  from: string,
  to: string,
  inScope: (projectId: string | undefined) => boolean,
): ReportRow[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const tracked = new Map<string, { seconds: number; lastDay: string; projectId?: string }>();
  for (const e of timeEntries) {
    if (!entrySeconds(e)) continue;
    const day = toDateKeyFromIso(e.startAt);
    if (!day || day < from || day > to) continue;
    const cur = tracked.get(e.taskId) ?? { seconds: 0, lastDay: '', projectId: e.projectId };
    cur.seconds += entrySeconds(e);
    if (day > cur.lastDay) cur.lastDay = day;
    tracked.set(e.taskId, cur);
  }

  const rows: ReportRow[] = [];
  for (const task of tasks) {
    if (!inScope(task.projectId)) continue;
    const t = tracked.get(task.id);
    const doneDay =
      task.status === 'done' ? toDateKeyFromIso(task.completedAt ?? task.updatedAt) : null;
    const doneInRange = !!doneDay && doneDay >= from && doneDay <= to;
    if (!doneInRange && !t) continue;
    rows.push({
      taskId: task.id,
      task,
      completedDate: doneInRange ? doneDay! : t!.lastDay,
      done: doneInRange,
      trackedMinutes: Math.round((t?.seconds ?? 0) / 60),
      estimatedMinutes: task.estimatedMinutes ?? 0,
    });
  }
  for (const [taskId, t] of tracked) {
    if (taskMap.has(taskId) || !inScope(t.projectId)) continue;
    rows.push({
      taskId,
      task: null,
      completedDate: t.lastDay,
      done: false,
      trackedMinutes: Math.round(t.seconds / 60),
      estimatedMinutes: 0,
    });
  }
  rows.sort((a, b) => a.completedDate.localeCompare(b.completedDate));
  return rows;
}

export function buildProjectReportInput(
  project: Project,
  tasks: Task[],
  timeEntries: TimeEntry[],
): ProjectReportInput {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const doneTasks = projectTasks.filter((t) => t.status === 'done');

  // Entries of deleted tasks count via the entry's own projectId.
  const projectEntries = timeEntries.filter((e) => {
    if (!e.endAt) return false;
    const task = tasks.find((t) => t.id === e.taskId);
    return task ? task.projectId === project.id : e.projectId === project.id;
  });
  const trackedSeconds = projectEntries.reduce((s, e) => s + entrySeconds(e), 0);

  const plannedMinutes = projectTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  const completionRate =
    projectTasks.length > 0
      ? Math.round((doneTasks.length / projectTasks.length) * 100)
      : 0;

  return {
    name: project.name,
    status: project.status,
    completion_rate: completionRate,
    total_tasks: projectTasks.length,
    done_tasks: doneTasks.length,
    tracked_hours: trackedSeconds / 3600,
    planned_hours: plannedMinutes / 60,
    tasks: projectTasks.map((t) => ({
      title: t.title,
      status: t.status,
      duration_minutes: Math.round(
        projectEntries.filter((e) => e.taskId === t.id).reduce((s, e) => s + entrySeconds(e), 0) / 60,
      ),
    })),
  };
}

export async function generateProjectReport(input: ProjectReportInput): Promise<string> {
  return command<string>('generate_project_report', {
    project: input,
    outputDir: $appConfig.get()?.default_export_dir ?? null,
  });
}
