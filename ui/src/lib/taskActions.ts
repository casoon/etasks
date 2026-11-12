// @core
import { removeTask } from '../stores/taskStore';
import { removeBlockForTask } from '../stores/calendarStore';
import { $activeEntry, stopActiveTimer } from '../stores/timerStore';

// Delete a task together with its calendar blocks and stop a timer running on it.
// Time entries stay: they are recorded work, the views label them "Gelöschte Aufgabe".
export function deleteTaskCascade(id: string): void {
  if ($activeEntry.get()?.taskId === id) stopActiveTimer();
  removeBlockForTask(id);
  removeTask(id);
}
