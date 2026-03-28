import { atom } from 'nanostores';
import type { NavItem, ViewMode } from '../domain/types';

export type ProjectsView = 'project' | 'clients' | 'services';

export const $navItem = atom<NavItem>('today');
export const $viewMode = atom<ViewMode>('day');
export const $projectsView = atom<ProjectsView>('project');
export const $focusTaskId = atom<string | null>(null);
export const $pomodoroRunning = atom<boolean>(false);
export const $pomodoroSeconds = atom<number>(25 * 60);
export const $pomodoroSessionMinutes = atom<number>(25);
export const $pomodoroMode = atom<'work' | 'break'>('work');
export const $pomodoroSessionCount = atom<number>(0);
export const $showShutdown = atom<boolean>(false);
export const $quickAddOpen = atom<boolean>(false);
export const $quickAddProjectId = atom<string | null>(null);
