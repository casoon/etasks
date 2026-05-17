// @module:projects
import { atom } from 'nanostores';
import type { ProjectTemplate, TemplateTask } from '../domain/types';
import { loadAllTemplates, applyTemplate as svcApply, saveAsTemplate as svcSave } from '../lib/templateService';
import { loadTasks } from '../lib/db';
import { $tasks } from './taskStore';

export const $templates = atom<ProjectTemplate[]>([]);

export function initTemplates(): void {
  $templates.set(loadAllTemplates());
}

export function applyProjectTemplate(templateId: string, projectId: string): void {
  svcApply(templateId, projectId);
  $tasks.set(loadTasks());
}

export function saveAsTemplate(name: string, tasks: TemplateTask[]): void {
  svcSave(name, tasks);
  $templates.set(loadAllTemplates());
}