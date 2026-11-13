<!-- @module:projects -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { updateProject } from '../../stores/projectStore';
  import type { Project } from '../../domain/types';

  export let project: Project;

  // Saved after a pause, on blur and when the tab is left.
  const projectId = project.id;
  let pending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pending === null) return;
    const value = pending;
    pending = null;
    updateProject(projectId, { notes: value });
  }

  function onInput(e: Event) {
    pending = (e.currentTarget as HTMLTextAreaElement).value;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 600);
  }

  onDestroy(flush);
</script>

<section class="et-card flex flex-col gap-2 px-5 py-4" aria-label="Notizen">
  <label class="et-h2" for="project-notes">Interne Notizen</label>
  <span class="text-[12px]" style="color:var(--et-text-3)">Nur für dich. Erscheinen nie im Angebot oder im Bericht.</span>
  <textarea
    id="project-notes"
    class="et-field resize-y font-mono min-h-[160px]"
    value={project.notes ?? ''}
    on:input={onInput}
    on:blur={flush}
    placeholder="Tech-Stack, Zugänge, besondere Anforderungen, Code-Snippets …"
    rows="8"
  ></textarea>
</section>
