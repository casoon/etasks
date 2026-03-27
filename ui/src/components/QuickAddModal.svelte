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
<div
  class="fixed inset-0 bg-black/40 flex items-start justify-center pt-[20vh] z-[100] backdrop-blur-sm"
  on:click={handleOverlayClick}
>
  <div
    class="bg-surface border border-border rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] w-[520px] max-w-[calc(100vw-32px)] overflow-hidden"
    role="dialog"
    aria-modal="true"
    aria-label="Aufgabe hinzufügen"
  >
    <p class="text-[11px] font-bold uppercase tracking-[0.06em] text-muted px-4 py-2 border-b border-border-subtle">⌘K — Neue Aufgabe</p>
    <form on:submit={handleSubmit}>
      <input
        bind:this={inputEl}
        class="w-full px-4 py-4 text-base border-b border-border outline-none bg-transparent text-primary placeholder:text-muted"
        bind:value={title}
        placeholder="Was steht an?"
      />
      <div class="flex items-center gap-3 px-4 py-3 flex-wrap">
        <select class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none max-w-[120px]" bind:value={duration}>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>1 h</option>
          <option value={90}>1,5 h</option>
          <option value={120}>2 h</option>
        </select>
        {#if activeProjects.length > 0}
          <select class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none max-w-[120px]" bind:value={projectId}>
            <option value="">Kein Projekt</option>
            {#each activeProjects as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
        {/if}
        <button
          type="submit"
          class="ml-auto px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          disabled={!title.trim()}
        >Hinzufügen ↵</button>
      </div>
    </form>
  </div>
</div>
{/if}
