<!-- @module:projects -->
<script lang="ts">
  import { $clients as clientsStore, assignClientToProject, updateProject } from '../../stores/projectStore';
  import type { Client, Project } from '../../domain/types';
  import ColorSwatches from './ColorSwatches.svelte';

  export let project: Project;
  export let client: Client | null;

  $: clients = $clientsStore;

  let assigning = false;
  let assignClientId = '';

  function confirmAssign() {
    if (!assignClientId) return;
    assignClientToProject(project.id, assignClientId);
    assigning = false;
    assignClientId = '';
  }
</script>

<div class="flex flex-col gap-4 max-w-[720px]">
  <section class="et-card flex flex-col gap-4 px-5 py-4" aria-label="Stammdaten">
    <h2 class="et-h2">Stammdaten</h2>

    <div class="flex flex-col gap-1">
      <span class="et-label">Kunde</span>
      {#if project.clientId}
        <div class="flex items-center gap-2 min-h-11">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:{client?.color ?? 'var(--et-project-neutral)'}" aria-hidden="true"></span>
          <span class="font-semibold">{client?.name ?? '–'}</span>
          <span class="et-badge">fest zugeordnet</span>
        </div>
        <span class="text-[12px]" style="color:var(--et-text-3)">Die Kundenzuordnung ist dauerhaft und kann nicht geändert werden.</span>
      {:else if assigning}
        <div class="flex flex-col gap-2 p-3 rounded-xl" style="background:var(--et-warning-soft)">
          <label class="et-label" for="assign-client">Kunde wählen</label>
          <select id="assign-client" class="et-field" bind:value={assignClientId}>
            <option value="">Kunden auswählen …</option>
            {#each clients as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
          </select>
          <p class="text-[13px]" style="color:var(--et-warning-text)">Diese Zuordnung ist dauerhaft und kann später nicht mehr geändert werden.</p>
          <div class="flex gap-2">
            <button class="et-btn et-btn-primary" disabled={!assignClientId} on:click={confirmAssign}>Kunde zuweisen</button>
            <button class="et-btn" on:click={() => { assigning = false; assignClientId = ''; }}>Abbrechen</button>
          </div>
        </div>
      {:else}
        <div class="flex flex-wrap items-center gap-3">
          <span class="et-badge">Intern</span>
          <button class="et-btn et-btn-sm" on:click={() => { assigning = true; assignClientId = ''; }}>Kunde zuweisen</button>
        </div>
      {/if}
    </div>

    <div class="flex flex-col gap-1">
      <label class="et-label" for="project-deadline">Deadline</label>
      <div class="flex flex-wrap items-center gap-2">
        <input
          id="project-deadline"
          type="date"
          class="et-field max-w-[200px]"
          value={project.deadline ?? ''}
          on:change={(e) => updateProject(project.id, { deadline: e.currentTarget.value || undefined })}
        />
        {#if project.deadline}
          <button class="et-btn et-btn-danger" on:click={() => updateProject(project.id, { deadline: undefined })}>Deadline entfernen</button>
        {/if}
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="et-label">Farbe</span>
      <ColorSwatches color={project.color} onPick={(c) => updateProject(project.id, { color: c })} />
    </div>
  </section>

  <section class="et-card flex flex-col gap-2 px-5 py-4" aria-label="Angebotstext">
    <label class="et-h2" for="project-offer-text">Angebotstext</label>
    <span class="text-[12px]" style="color:var(--et-text-3)">Optional. Steht im Angebot unter der Anrede.</span>
    {#key project.id}
      <textarea
        id="project-offer-text"
        class="et-field resize-y min-h-[100px]"
        value={project.offerText ?? ''}
        on:blur={(e) => updateProject(project.id, { offerText: e.currentTarget.value })}
        placeholder="z. B. Vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen an:"
        rows="4"
      ></textarea>
    {/key}
  </section>
</div>
