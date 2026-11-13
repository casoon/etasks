<!-- @module:projects -->
<script lang="ts">
  import { $templates as templatesStore, applyProjectTemplate, removeTemplate } from '../../stores/templateStore';
  import type { ProjectTemplate } from '../../domain/types';
  import { formatDuration } from '../../domain/dateUtils';

  /** `null` opens the list only (preview and delete); applying needs a project. */
  export let projectId: string | null;
  export let onClose: () => void;

  $: templates = $templatesStore;
  let preview: ProjectTemplate | null = null;
  let applied = false;

  function handleDelete(tpl: ProjectTemplate) {
    if (!confirm(`Vorlage „${tpl.name}“ löschen?`)) return;
    removeTemplate(tpl.id);
    preview = null;
  }

  function handleApply(tpl: ProjectTemplate) {
    if (!projectId) return;
    applyProjectTemplate(tpl.id, projectId);
    applied = true;
    setTimeout(onClose, 1000);
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape') onClose(); }} />

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm"
  on:click={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <div
    class="bg-surface border border-border rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-[640px] max-w-[calc(100vw-32px)] max-h-[70vh] flex flex-col overflow-hidden"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tpl-title"
  >
    <div class="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
      <h2 id="tpl-title" class="text-[15px] font-semibold text-primary">{projectId ? 'Vorlage anwenden' : 'Vorlagen'}</h2>
      <button class="et-btn et-btn-ghost et-btn-icon" aria-label="Schließen" on:click={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      </button>
    </div>

    {#if applied}
      <div class="p-8 text-center text-lg text-success" role="status">Aufgaben wurden angelegt.</div>
    {:else}
      <div class="grid flex-1 overflow-hidden" style="grid-template-columns: 220px 1fr">
        <div class="border-r border-border overflow-y-auto flex flex-col p-2 gap-[1px]">
          {#each templates as tpl (tpl.id)}
            <button
              class="flex flex-col gap-[2px] px-3 py-2 rounded-lg text-left transition-colors w-full {preview?.id === tpl.id ? 'bg-accent-subtle' : 'hover:bg-bg'}"
              on:click={() => preview = tpl}
            >
              <span class="text-[13px] font-medium text-primary">{tpl.name}</span>
              <span class="text-[11px] text-muted">{tpl.tasks.length} Aufgaben</span>
              {#if tpl.isBuiltIn}
                <span class="et-badge et-badge-blue self-start">Mitgeliefert</span>
              {/if}
            </button>
          {/each}
        </div>

        {#if preview}
          <div class="overflow-y-auto p-4 flex flex-col gap-3">
            <h3 class="text-[11px] font-bold uppercase tracking-[0.06em] text-muted mb-1">{preview.name}</h3>
            <ul class="list-none flex flex-col gap-1">
              {#each preview.tasks as t, i (i)}
                <li class="flex items-center gap-2 px-2 py-2 rounded-lg bg-bg text-[13px]">
                  <span class="flex-1 text-primary min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{t.title}</span>
                  <span class="text-[11px] text-muted whitespace-nowrap">{formatDuration(t.estimatedMinutes)}</span>
                </li>
              {/each}
            </ul>
            <div class="flex items-center justify-between pt-3 border-t border-border-subtle mt-2">
              <span class="text-[12px] text-muted">
                Gesamt: {formatDuration(preview.tasks.reduce((s, t) => s + t.estimatedMinutes, 0))}
              </span>
              {#if projectId}
                <button class="et-btn et-btn-primary" on:click={() => preview && handleApply(preview)}>Anwenden</button>
              {:else}
                <span class="text-[12px] text-muted">Zum Anwenden ein Projekt öffnen: Mehr › Vorlage anwenden.</span>
              {/if}
            </div>
            <div class="flex justify-end">
              {#if !preview.isBuiltIn}
                <button class="et-btn et-btn-danger" on:click={() => preview && handleDelete(preview)}>Vorlage löschen</button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>