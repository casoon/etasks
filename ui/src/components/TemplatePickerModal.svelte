<script lang="ts">
  import { $templates as templatesStore, applyProjectTemplate } from '../stores/templateStore';
  import type { ProjectTemplate } from '../domain/types';
  import { formatDuration } from '../domain/dateUtils';

  export let projectId: string;
  export let onClose: () => void;

  $: templates = $templatesStore;
  let preview: ProjectTemplate | null = null;
  let applied = false;

  function handleApply(tpl: ProjectTemplate) {
    applyProjectTemplate(tpl.id, projectId);
    applied = true;
    setTimeout(onClose, 1000);
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] backdrop-blur-sm"
  on:click={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <div
    class="bg-surface border border-border rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-[640px] max-w-[calc(100vw-32px)] max-h-[70vh] flex flex-col overflow-hidden"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
      <h2 class="text-[15px] font-semibold text-primary">Projekt-Template anwenden</h2>
      <button
        class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors"
        on:click={onClose}
      >✕</button>
    </div>

    {#if applied}
      <div class="p-8 text-center text-lg text-success">✓ Tasks wurden angelegt</div>
    {:else}
      <div class="grid flex-1 overflow-hidden" style="grid-template-columns: 220px 1fr">
        <div class="border-r border-border overflow-y-auto flex flex-col p-2 gap-[1px]">
          {#each templates as tpl (tpl.id)}
            <button
              class="flex flex-col gap-[2px] px-3 py-2 rounded-lg text-left transition-colors w-full {preview?.id === tpl.id ? 'bg-accent-subtle' : 'hover:bg-bg'}"
              on:click={() => preview = tpl}
            >
              <span class="text-[13px] font-medium text-primary">{tpl.name}</span>
              <span class="text-[11px] text-muted">{tpl.tasks.length} Tasks</span>
              {#if tpl.isBuiltIn}
                <span class="text-[10px] text-accent px-[5px] py-[1px] bg-accent-subtle rounded self-start">Built-in</span>
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
              <button
                class="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                on:click={() => handleApply(preview)}
              >Anwenden</button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
