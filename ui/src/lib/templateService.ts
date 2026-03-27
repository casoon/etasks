import type { ProjectTemplate, TemplateTask, KanbanStatus } from '../domain/types';
import { loadCustomTemplates, upsertTemplate } from './db';
import { today } from '../domain/dateUtils';
import { createTask } from '../domain/taskService';
import { upsertTask } from './db';

export const BUILT_IN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tpl-webprojekt',
    name: 'Webprojekt',
    isBuiltIn: true,
    tasks: [
      { title: 'Kickoff & Briefing', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Anforderungsanalyse', estimatedMinutes: 120, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Konzept & Wireframes', estimatedMinutes: 180, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Design-Entwurf', estimatedMinutes: 240, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Design-Abstimmung', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Frontend-Entwicklung', estimatedMinutes: 480, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Backend / CMS Integration', estimatedMinutes: 360, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Content einpflegen', estimatedMinutes: 180, kanbanStatus: 'backlog', tags: ['admin'] },
      { title: 'Testing & QA', estimatedMinutes: 120, kanbanStatus: 'backlog', tags: ['review'] },
      { title: 'Launch & Deployment', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Übergabe & Dokumentation', estimatedMinutes: 90, kanbanStatus: 'backlog', tags: ['admin'] },
    ],
  },
  {
    id: 'tpl-redesign',
    name: 'Redesign',
    isBuiltIn: true,
    tasks: [
      { title: 'Analyse Bestandsseite', estimatedMinutes: 90, kanbanStatus: 'backlog', tags: ['review'] },
      { title: 'Mood Board & Inspiration', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Neues Design-Konzept', estimatedMinutes: 240, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Abstimmung Design', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Umsetzung neues Design', estimatedMinutes: 360, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Migration & Redirect-Konzept', estimatedMinutes: 90, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'SEO-Check nach Redesign', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['review'] },
    ],
  },
  {
    id: 'tpl-wartung',
    name: 'Wartungsvertrag',
    isBuiltIn: true,
    tasks: [
      { title: 'Updates & Sicherheits-Patches', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['admin'] },
      { title: 'Backup prüfen', estimatedMinutes: 30, kanbanStatus: 'backlog', tags: ['admin'] },
      { title: 'Performance-Check', estimatedMinutes: 30, kanbanStatus: 'backlog', tags: ['review'] },
      { title: 'Änderungswünsche umsetzen', estimatedMinutes: 120, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Monatsbericht', estimatedMinutes: 30, kanbanStatus: 'backlog', tags: ['admin'] },
    ],
  },
  {
    id: 'tpl-beratung',
    name: 'Beratungsprojekt',
    isBuiltIn: true,
    tasks: [
      { title: 'Erstgespräch', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Ist-Analyse', estimatedMinutes: 120, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Empfehlungen ausarbeiten', estimatedMinutes: 180, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Präsentation vorbereiten', estimatedMinutes: 90, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Ergebnispräsentation', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Abschlussbericht', estimatedMinutes: 60, kanbanStatus: 'backlog', tags: ['admin'] },
    ],
  },
];

export function loadAllTemplates(): ProjectTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...loadCustomTemplates()];
}

export function applyTemplate(templateId: string, projectId: string): void {
  const all = loadAllTemplates();
  const tpl = all.find(t => t.id === templateId);
  if (!tpl) return;

  for (const def of tpl.tasks) {
    const task = createTask({
      title: def.title,
      estimatedMinutes: def.estimatedMinutes,
      tags: def.tags,
      plannedDate: today(),
      projectId,
      kanbanStatus: def.kanbanStatus,
    });
    upsertTask(task);
  }
}

export function saveAsTemplate(name: string, tasks: TemplateTask[]): ProjectTemplate {
  const tpl: ProjectTemplate = {
    id: crypto.randomUUID(),
    name,
    isBuiltIn: false,
    tasks,
  };
  upsertTemplate(tpl);
  return tpl;
}
