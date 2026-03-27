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
<div class="modal-overlay" on:click={(e) => { if (e.target === e.currentTarget) onClose(); }}>
  <div class="modal template-modal card" role="dialog" aria-modal="true">
    <div class="modal-header">
      <h2 class="modal-title">Projekt-Template anwenden</h2>
      <button class="btn-ghost" on:click={onClose}>✕</button>
    </div>

    {#if applied}
      <div class="template-applied">✓ Tasks wurden angelegt</div>
    {:else}
      <div class="template-layout">
        <div class="template-list">
          {#each templates as tpl (tpl.id)}
            <button
              class="template-item {preview?.id === tpl.id ? 'template-item--active' : ''}"
              on:click={() => preview = tpl}
            >
              <span class="template-item-name">{tpl.name}</span>
              <span class="template-item-count">{tpl.tasks.length} Tasks</span>
              {#if tpl.isBuiltIn}<span class="template-built-in">Built-in</span>{/if}
            </button>
          {/each}
        </div>

        {#if preview}
          <div class="template-preview">
            <h3 class="template-preview-title">{preview.name}</h3>
            <ul class="template-task-list">
              {#each preview.tasks as t, i (i)}
                <li class="template-task-row">
                  <span class="template-task-title">{t.title}</span>
                  <span class="template-task-meta">{formatDuration(t.duration)}</span>
                </li>
              {/each}
            </ul>
            <div class="template-preview-footer">
              <span class="template-total">
                Gesamt: {formatDuration(preview.tasks.reduce((s, t) => s + t.duration, 0))}
              </span>
              <button class="btn-primary" on:click={() => handleApply(preview)}>Anwenden</button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
