<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { $appConfig as appConfigStore, saveAppConfig, openTenant } from '../stores/configStore';
  import type { AppConfig } from '../stores/configStore';

  export let onDone: () => void = () => {};

  let step = 1;
  let pickedPath = '';
  let saving = false;
  let errorMsg = '';

  const config = appConfigStore.get()!;

  let profile = { ...config.profile };

  async function pickFolder() {
    try {
      const result = await invoke<string | null>('pick_directory');
      if (result) {
        pickedPath = result + '/etasks-data.db';
      }
    } catch (e) {
      errorMsg = String(e);
    }
  }

  async function finish() {
    if (!pickedPath) { errorMsg = 'Bitte wähle zuerst einen Ordner.'; return; }
    saving = true;
    errorMsg = '';
    try {
      const updated: AppConfig = {
        ...config,
        setup_done: true,
        profile,
      };
      await saveAppConfig(updated);
      await openTenant(pickedPath);
      onDone();
    } catch (e) {
      errorMsg = String(e);
      saving = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
  <div class="bg-surface border border-border rounded-xl shadow-xl w-full max-w-lg p-8 flex flex-col gap-6">

    {#if step === 1}
      <div class="flex flex-col gap-2">
        <h2 class="text-lg font-semibold text-primary">Willkommen bei eTasks</h2>
        <p class="text-sm text-secondary">Wähle einen Ordner, in dem deine Daten gespeichert werden sollen.</p>
      </div>

      <div class="flex flex-col gap-3">
        <button
          class="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-bg hover:bg-surface-raised text-primary text-sm font-medium transition-colors"
          on:click={pickFolder}
        >
          <span>📁</span>
          <span>{pickedPath ? pickedPath : 'Ordner auswählen…'}</span>
        </button>

        {#if errorMsg}
          <p class="text-xs text-red-500">{errorMsg}</p>
        {/if}
      </div>

      <div class="flex justify-end">
        <button
          class="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          disabled={!pickedPath}
          on:click={() => { step = 2; errorMsg = ''; }}
        >
          Weiter →
        </button>
      </div>

    {:else}
      <div class="flex flex-col gap-2">
        <h2 class="text-lg font-semibold text-primary">Dein Profil</h2>
        <p class="text-sm text-secondary">Diese Daten werden für Rechnungen und Berichte verwendet.</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted font-medium">Vorname</span>
          <input class="input" bind:value={profile.first_name} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted font-medium">Nachname</span>
          <input class="input" bind:value={profile.last_name} />
        </label>
        <label class="flex flex-col gap-1 col-span-2">
          <span class="text-xs text-muted font-medium">E-Mail</span>
          <input class="input" type="email" bind:value={profile.email} />
        </label>
        <label class="flex flex-col gap-1 col-span-2">
          <span class="text-xs text-muted font-medium">Unternehmen</span>
          <input class="input" bind:value={profile.company} />
        </label>
        <label class="flex flex-col gap-1 col-span-2">
          <span class="text-xs text-muted font-medium">Straße</span>
          <input class="input" bind:value={profile.street} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted font-medium">PLZ</span>
          <input class="input" bind:value={profile.zip} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted font-medium">Stadt</span>
          <input class="input" bind:value={profile.city} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted font-medium">Steuernummer / USt-IdNr.</span>
          <input class="input" bind:value={profile.tax_id} />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted font-medium">Stundensatz (€)</span>
          <input class="input" type="number" bind:value={profile.hourly_rate} />
        </label>
        <label class="flex flex-col gap-1 col-span-2">
          <span class="text-xs text-muted font-medium">IBAN</span>
          <input class="input font-mono" bind:value={profile.iban} />
        </label>
      </div>

      {#if errorMsg}
        <p class="text-xs text-red-500">{errorMsg}</p>
      {/if}

      <div class="flex justify-between">
        <button
          class="px-4 py-2 rounded-lg border border-border text-secondary text-sm hover:bg-bg transition-colors"
          on:click={() => step = 1}
        >
          ← Zurück
        </button>
        <button
          class="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          disabled={saving}
          on:click={finish}
        >
          {saving ? 'Speichern…' : 'Fertig'}
        </button>
      </div>
    {/if}

  </div>
</div>

<style>
  .input {
    width: 100%;
    padding: 6px 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .input:focus {
    border-color: var(--color-accent);
  }
</style>
