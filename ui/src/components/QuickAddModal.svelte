<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { $quickAddOpen as openStore, $quickAddProjectId as projectIdStore } from '../stores/uiStore';
  import { $projects as projectsStore } from '../stores/projectStore';
  import { addTask } from '../stores/taskStore';

  let title = '';
  let duration = 30;
  let projectId = '';
  let inputEl: HTMLInputElement;

  $: open = $openStore;
  $: projects = $projectsStore;
  $: activeProjects = projects.filter(p => p.status === 'active');

  $: if (open) {
    title = '';
    duration = 30;
    projectId = $projectIdStore ?? '';
    setTimeout(() => inputEl?.focus(), 50);
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
    if (e.metaKey && e.key === 'k') { e.preventDefault(); openStore.set(true); }
    if (e.key === 'Escape') openStore.set(false);
  }

  onMount(() => document.addEventListener('keydown', onKey));
  onDestroy(() => document.removeEventListener('keydown', onKey));
</script>

{#if open}
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="quick-add-overlay" on:click={handleOverlayClick}>
  <div class="quick-add-modal" role="dialog" aria-modal="true" aria-label="Aufgabe hinzufügen">
    <p class="quick-add-hint">⌘K — Neue Aufgabe</p>
    <form on:submit={handleSubmit}>
      <input
        bind:this={inputEl}
        class="quick-add-input"
        bind:value={title}
        placeholder="Was steht an?"
      />
      <div class="quick-add-row">
        <select class="duration-select" bind:value={duration}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>1 h</option>
          <option value={90}>1,5 h</option>
          <option value={120}>2 h</option>
        </select>
        {#if activeProjects.length > 0}
          <select class="duration-select" bind:value={projectId}>
            <option value="">Kein Projekt</option>
            {#each activeProjects as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        {/if}
        <button type="submit" class="btn-primary" disabled={!title.trim()}>Hinzufügen ↵</button>
      </div>
    </form>
  </div>
</div>
{/if}
