import { invoke } from '@tauri-apps/api/core';
import type { Task, Project, TimeEntry } from '../domain/types';

export interface ProjectReportInput {
  name: string;
  status: string;
  completion_rate: number;
  total_tasks: number;
  done_tasks: number;
  tracked_hours: number;
  planned_hours: number;
  notes?: string;
  tasks: { title: string; status: string; duration_minutes: number }[];
}

export function buildProjectReportInput(
  project: Project,
  tasks: Task[],
  timeEntries: TimeEntry[],
): ProjectReportInput {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const doneTasks = projectTasks.filter((t) => t.status === 'done');

  const trackedSeconds = timeEntries
    .filter((e) => {
      const task = tasks.find((t) => t.id === e.taskId);
      return task?.projectId === project.id && e.stoppedAt;
    })
    .reduce((s, e) => s + e.durationSeconds, 0);

  const plannedMinutes = projectTasks.reduce((s, t) => s + t.duration, 0);
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
    notes: project.notes,
    tasks: projectTasks.map((t) => ({
      title: t.title,
      status: t.status,
      duration_minutes: t.duration,
    })),
  };
}

export async function generateProjectReport(input: ProjectReportInput): Promise<string> {
  return invoke<string>('generate_project_report', { project: input });
}
