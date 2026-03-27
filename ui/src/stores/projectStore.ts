import { atom, computed } from 'nanostores';
import type { Client, Project } from '../domain/types';
import { PROJECT_COLORS } from '../domain/types';
import {
  loadClients, upsertClient, deleteClient as dbDeleteClient,
  loadProjects, upsertProject, deleteProject as dbDeleteProject,
} from '../lib/db';

// ── State ─────────────────────────────────────────────────────────────────────

export const $clients = atom<Client[]>([]);
export const $projects = atom<Project[]>([]);
export const $selectedProjectId = atom<string | null>(null);

// ── Derived ──────────────────────────────────────────────────────────────────

export const $selectedProject = computed([$projects, $selectedProjectId], (projects, id) =>
  id ? projects.find((p) => p.id === id) ?? null : null
);

export const $activeProjects = computed($projects, (projects) =>
  projects.filter((p) => p.status !== 'done')
);

// ── Init ─────────────────────────────────────────────────────────────────────

export function initProjects(): void {
  $clients.set(loadClients());
  $projects.set(loadProjects());
}

// ── Client actions ────────────────────────────────────────────────────────────

export function addClient(name: string): Client {
  const existing = $clients.get();
  const color = PROJECT_COLORS[existing.length % PROJECT_COLORS.length];
  const client: Client = {
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
    createdAt: new Date().toISOString(),
  };
  $clients.set(upsertClient(client));
  return client;
}

export function updateClient(id: string, patch: Partial<Client>): void {
  const client = $clients.get().find((c) => c.id === id);
  if (!client) return;
  $clients.set(upsertClient({ ...client, ...patch }));
}

export function removeClient(id: string): void {
  $clients.set(dbDeleteClient(id));
  // Remove all projects of this client
  const toRemove = $projects.get().filter((p) => p.clientId === id);
  let projects = $projects.get();
  for (const p of toRemove) {
    projects = dbDeleteProject(p.id);
  }
  $projects.set(projects);
}

// ── Project actions ───────────────────────────────────────────────────────────

export function addProject(clientId: string, name: string): Project {
  const existing = $projects.get();
  const client = $clients.get().find((c) => c.id === clientId);
  const color = client?.color ?? PROJECT_COLORS[existing.length % PROJECT_COLORS.length];
  const project: Project = {
    id: crypto.randomUUID(),
    clientId,
    name: name.trim(),
    color,
    status: 'active',
    notes: '',
    createdAt: new Date().toISOString(),
  };
  $projects.set(upsertProject(project));
  return project;
}

export function updateProject(id: string, patch: Partial<Project>): void {
  const project = $projects.get().find((p) => p.id === id);
  if (!project) return;
  $projects.set(upsertProject({ ...project, ...patch }));
}

export function removeProject(id: string): void {
  $projects.set(dbDeleteProject(id));
  if ($selectedProjectId.get() === id) $selectedProjectId.set(null);
}
