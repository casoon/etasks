<!-- @core -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { $quickAddOpen as openStore, $quickAddProjectId as projectIdStore } from '../../stores/uiStore';
  import { $projects as projectsStore } from '../../stores/projectStore';
  import { quickAddShortcutLabel } from '../../lib/platform';
  import { addTask } from '../../stores/taskStore';

  let title = '';
  let duration = 30;
  let projectId = '';
  let inputEl: HTMLInputElement;

  $: open = $openStore;
  $: projects = $projectsStore;
  $: activeProjects = projects.filter(p => p.status === 'active');

  // Nur beim Öffnen zurücksetzen, nicht bei jeder Eingabe (sonst wird `title` sofort wieder geleert).
  let wasOpen = false;
  $: if (open !== wasOpen) {
    wasOpen = open;
    if (open) {
      title = '';
      duration = 30;
      projectId = $projectIdStore ?? '';
      setTimeout(() => inputEl?.focus(), 50);
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    addTask(t, duration, [], projectId || undefined);
    openStore.set(false);
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) openStore.set(false);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') openStore.set(false);
  }

  onMount(() => document.addEventListener('keydown', onKey));
  onDestroy(() => document.removeEventListener('keydown', onKey));
</script>

{#if open}
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 flex items-start justify-center pt-[20vh] z-[100]"
  style="background:rgba(28,27,25,0.45)"
  on:click={handleOverlayClick}
>
  <div
    class="w-[520px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[14px]"
    style="background:var(--et-surface);border:1px solid var(--et-border);box-shadow:var(--et-shadow-overlay)"
    role="dialog"
    aria-modal="true"
    aria-labelledby="quick-add-title"
  >
    <h2 id="quick-add-title" class="et-th px-4 py-2.5" style="border-bottom:1px solid var(--et-border-subtle)">Neue Aufgabe <span class="normal-case tracking-normal font-medium">· {quickAddShortcutLabel()}</span></h2>
    <form on:submit={handleSubmit}>
      <label class="sr-only" for="quick-add-title-input">Titel der Aufgabe</label>
      <input
        id="quick-add-title-input"
        bind:this={inputEl}
        class="w-full min-h-[56px] px-4 text-base bg-transparent outline-none placeholder:text-[var(--et-text-3)]"
        style="border-bottom:1px solid var(--et-border-subtle)"
        bind:value={title}
        placeholder="Was steht an?"
      />
      <div class="flex items-center gap-3 px-4 py-3 flex-wrap">
        <label class="sr-only" for="quick-add-duration">Geschätzte Dauer</label>
        <select id="quick-add-duration" class="et-field w-auto max-w-[140px]" bind:value={duration}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>1 h</option>
          <option value={90}>1,5 h</option>
          <option value={120}>2 h</option>
        </select>
        {#if activeProjects.length > 0}
          <label class="sr-only" for="quick-add-project">Projekt</label>
          <select id="quick-add-project" class="et-field w-auto max-w-[200px]" bind:value={projectId}>
            <option value="">Kein Projekt</option>
            {#each activeProjects as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        {/if}
        <button type="submit" class="et-btn et-btn-primary ml-auto" disabled={!title.trim()}>
          Hinzufügen
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6v6a2 2 0 0 1-2 2H5M9 10l-4 4 4 4"></path></svg>
        </button>
      </div>
    </form>
  </div>
</div>
{/if}
