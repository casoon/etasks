// @core
const TASK_DRAG_MIME = 'application/x-etasks-task-id';
const TASK_DRAG_LEGACY = 'taskId';
const TASK_DRAG_LEGACY_LOWER = 'taskid';

export function setTaskDragData(dataTransfer: DataTransfer, taskId: string): void {
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData(TASK_DRAG_MIME, taskId);
  dataTransfer.setData(TASK_DRAG_LEGACY, taskId);
  dataTransfer.setData(TASK_DRAG_LEGACY_LOWER, taskId);
  dataTransfer.setData('text/plain', taskId);
}

export function getTaskDragData(dataTransfer: DataTransfer | null | undefined): string {
  if (!dataTransfer) return '';
  return (
    dataTransfer.getData(TASK_DRAG_MIME) ||
    dataTransfer.getData(TASK_DRAG_LEGACY) ||
    dataTransfer.getData(TASK_DRAG_LEGACY_LOWER) ||
    dataTransfer.getData('text/plain') ||
    ''
  );
}

export function hasTaskDragData(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;
  const types = Array.from(dataTransfer.types ?? []).map(type => type.toLowerCase());
  return types.includes(TASK_DRAG_MIME) ||
    types.includes(TASK_DRAG_LEGACY_LOWER) ||
    types.includes('text/plain');
}
