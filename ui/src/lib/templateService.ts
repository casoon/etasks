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
      { title: 'Kickoff & Briefing', duration: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Anforderungsanalyse', duration: 120, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Konzept & Wireframes', duration: 180, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Design-Entwurf', duration: 240, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Design-Abstimmung', duration: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Frontend-Entwicklung', duration: 480, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Backend / CMS Integration', duration: 360, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Content einpflegen', duration: 180, kanbanStatus: 'backlog', tags: ['admin'] },
      { title: 'Testing & QA', duration: 120, kanbanStatus: 'backlog', tags: ['review'] },
      { title: 'Launch & Deployment', duration: 60, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Übergabe & Dokumentation', duration: 90, kanbanStatus: 'backlog', tags: ['admin'] },
    ],
  },
  {
    id: 'tpl-redesign',
    name: 'Redesign',
    isBuiltIn: true,
    tasks: [
      { title: 'Analyse Bestandsseite', duration: 90, kanbanStatus: 'backlog', tags: ['review'] },
      { title: 'Mood Board & Inspiration', duration: 60, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Neues Design-Konzept', duration: 240, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Abstimmung Design', duration: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Umsetzung neues Design', duration: 360, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Migration & Redirect-Konzept', duration: 90, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'SEO-Check nach Redesign', duration: 60, kanbanStatus: 'backlog', tags: ['review'] },
    ],
  },
  {
    id: 'tpl-wartung',
    name: 'Wartungsvertrag',
    isBuiltIn: true,
    tasks: [
      { title: 'Updates & Sicherheits-Patches', duration: 60, kanbanStatus: 'backlog', tags: ['admin'] },
      { title: 'Backup prüfen', duration: 30, kanbanStatus: 'backlog', tags: ['admin'] },
      { title: 'Performance-Check', duration: 30, kanbanStatus: 'backlog', tags: ['review'] },
      { title: 'Änderungswünsche umsetzen', duration: 120, kanbanStatus: 'backlog', tags: ['work'] },
      { title: 'Monatsbericht', duration: 30, kanbanStatus: 'backlog', tags: ['admin'] },
    ],
  },
  {
    id: 'tpl-beratung',
    name: 'Beratungsprojekt',
    isBuiltIn: true,
    tasks: [
      { title: 'Erstgespräch', duration: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Ist-Analyse', duration: 120, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Empfehlungen ausarbeiten', duration: 180, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Präsentation vorbereiten', duration: 90, kanbanStatus: 'backlog', tags: ['deep'] },
      { title: 'Ergebnispräsentation', duration: 60, kanbanStatus: 'backlog', tags: ['meeting'] },
      { title: 'Abschlussbericht', duration: 60, kanbanStatus: 'backlog', tags: ['admin'] },
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
      duration: def.duration,
      tags: def.tags,
      date: today(),
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
