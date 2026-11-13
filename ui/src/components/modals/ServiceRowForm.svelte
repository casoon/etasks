<!-- @module:billing -->
<script lang="ts">
  import type { ServiceDraft } from '../../lib/serviceDraft';

  export let draft: ServiceDraft;
  export let error = '';
  export let idPrefix: string;
  export let categories: string[] = [];
  export let saveLabel = 'Sichern';
  export let onSave: () => void;
  export let onCancel: () => void;
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<form
  class="grid items-end gap-x-4 gap-y-3 px-5 py-3.5 border-t"
  style="grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));background:var(--et-accent-soft);border-color:var(--et-border-subtle)"
  aria-label={draft.name ? `${draft.name} bearbeiten` : 'Neue Leistung'}
  on:submit|preventDefault={onSave}
  on:keydown={(e) => e.key === 'Escape' && onCancel()}
>
  <div class="flex flex-col gap-1" style="grid-column:span 2">
    <label class="et-label" for="{idPrefix}-name">Bezeichnung</label>
    <!-- svelte-ignore a11y-autofocus -->
    <input id="{idPrefix}-name" class="et-field" style="border:1.5px solid var(--et-accent)" bind:value={draft.name} placeholder="Webentwicklung" required autofocus />
  </div>
  <div class="flex flex-col gap-1" style="grid-column:span 2">
    <label class="et-label" for="{idPrefix}-text">Rechnungstext</label>
    <input id="{idPrefix}-text" class="et-field" bind:value={draft.description} placeholder="Entwicklung und Implementierung …" />
  </div>
  <div class="flex flex-col gap-1">
    <label class="et-label" for="{idPrefix}-unit">Einheit</label>
    <input id="{idPrefix}-unit" class="et-field" bind:value={draft.unit} placeholder="Stunde" />
  </div>
  <div class="flex flex-col gap-1">
    <label class="et-label" for="{idPrefix}-price">Preis netto (€)</label>
    <input id="{idPrefix}-price" class="et-field" type="number" step="0.01" min="0" bind:value={draft.unitPrice} placeholder="95.00" />
  </div>
  <div class="flex flex-col gap-1">
    <label class="et-label" for="{idPrefix}-vat">MwSt. (%)</label>
    <input id="{idPrefix}-vat" class="et-field" type="number" min="0" max="100" bind:value={draft.vatRate} placeholder="19" />
  </div>
  <div class="flex flex-col gap-1">
    <label class="et-label" for="{idPrefix}-cat">Kategorie</label>
    <input id="{idPrefix}-cat" class="et-field" list="{idPrefix}-cats" bind:value={draft.category} placeholder="Entwicklung" />
    <datalist id="{idPrefix}-cats">{#each categories as c (c)}<option value={c}></option>{/each}</datalist>
  </div>
  <div class="flex gap-2">
    <button type="submit" class="et-btn et-btn-primary" disabled={Boolean(error) || !draft.name.trim()}>{saveLabel}</button>
    <button type="button" class="et-btn" on:click={onCancel}>Abbrechen</button>
  </div>
  {#if error}<p class="text-[13px]" role="alert" style="grid-column:1/-1;color:var(--et-danger)">{error}</p>{/if}
</form>
