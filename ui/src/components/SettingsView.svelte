<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { $appConfig as appConfigStore, saveAppConfig, openTenant, writeTenantMeta, removeTenant } from '../stores/configStore';
  import { syncFromDatabase } from '../lib/storage';
  import { reinitStores } from '../lib/storeInit';
  import type { AppConfig, UserProfile } from '../stores/configStore';

  let config = appConfigStore.get()!;
  let profile: UserProfile = { ...config.profile };
  let saved = false;
  let saving = false;
  let errorMsg = '';

  appConfigStore.subscribe((c) => {
    if (c) {
      config = c;
      profile = { ...c.profile };
    }
  });

  async function saveProfile() {
    saving = true;
    saved = false;
    errorMsg = '';
    try {
      await saveAppConfig({ ...config, profile });
      saved = true;
      setTimeout(() => (saved = false), 2500);
    } catch (e) {
      errorMsg = String(e);
    } finally {
      saving = false;
    }
  }

  async function addTenant() {
    errorMsg = '';
    try {
      const name = window.prompt('Name des neuen Arbeitsbereichs:');
      if (!name?.trim()) return;
      const dir = await invoke<string | null>('pick_directory');
      if (!dir) return;
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const path = dir + '/' + slug + '.db';
      await openTenant(path, name.trim());
      await writeTenantMeta(name.trim());
      await syncFromDatabase();
      reinitStores();
      config = appConfigStore.get()!;
    } catch (e) {
      errorMsg = String(e);
    }
  }

  async function switchTenant(path: string) {
    if (path === config.active_tenant) return;
    errorMsg = '';
    try {
      await openTenant(path);
      await syncFromDatabase();
      reinitStores();
      config = appConfigStore.get()!;
    } catch (e) {
      errorMsg = String(e);
    }
  }
</script>

<div class="flex-1 overflow-y-auto p-6 flex flex-col gap-8 max-w-2xl">

  <!-- Profile section -->
  <section class="flex flex-col gap-4">
    <h2 class="text-base font-semibold text-primary border-b border-border pb-2">Profil</h2>

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
        <span class="text-xs text-muted font-medium">Land</span>
        <input class="input" bind:value={profile.country} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted font-medium">Stundensatz (€)</span>
        <input class="input" type="number" bind:value={profile.hourly_rate} />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted font-medium">Steuernummer / USt-IdNr.</span>
        <input class="input" bind:value={profile.tax_id} />
      </label>
      <label class="flex flex-col gap-1 col-span-2">
        <span class="text-xs text-muted font-medium">IBAN</span>
        <input class="input font-mono" bind:value={profile.iban} />
      </label>
    </div>

    <div class="flex items-center gap-3">
      <button
        class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        disabled={saving}
        on:click={saveProfile}
      >
        {saving ? 'Speichern…' : 'Profil speichern'}
      </button>
      {#if saved}
        <span class="text-xs text-green-500">Gespeichert ✓</span>
      {/if}
    </div>
  </section>

  <!-- Rechnungsgrunddaten section -->
  <section class="flex flex-col gap-4">
    <h2 class="text-base font-semibold text-primary border-b border-border pb-2">Rechnungsgrunddaten</h2>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted font-medium">Nummernkreis-Präfix</span>
        <input class="input font-mono" bind:value={profile.invoice_number_prefix} placeholder="RE-2026-" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted font-medium">Aktueller Zähler</span>
        <input class="input font-mono" type="number" bind:value={profile.invoice_number_counter} placeholder="1" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted font-medium">Zahlungsziel (Tage)</span>
        <input class="input" type="number" bind:value={profile.payment_days} placeholder="14" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted font-medium">Standard-MwSt. (%)</span>
        <input class="input" type="number" bind:value={profile.default_vat_rate} placeholder="19" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted font-medium">Bankname</span>
        <input class="input" bind:value={profile.bank_name} placeholder="Sparkasse Berlin" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs text-muted font-medium">BIC</span>
        <input class="input font-mono" bind:value={profile.bic} placeholder="BELADEBEXXX" />
      </label>
      <label class="flex flex-col gap-1 col-span-2">
        <span class="text-xs text-muted font-medium">Fußzeile / Dankestext</span>
        <input class="input" bind:value={profile.invoice_footer_text} placeholder="Vielen Dank für Ihren Auftrag." />
      </label>
    </div>

    <div class="flex items-center gap-3">
      <button
        class="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        disabled={saving}
        on:click={saveProfile}
      >
        {saving ? 'Speichern…' : 'Speichern'}
      </button>
      {#if saved}
        <span class="text-xs text-green-500">Gespeichert ✓</span>
      {/if}
    </div>
  </section>

  <!-- Tenants section -->
  <section class="flex flex-col gap-4">
    <h2 class="text-base font-semibold text-primary border-b border-border pb-2">Arbeitsbereiche</h2>

    <ul class="flex flex-col gap-2">
      {#each config.tenants as tenant}
        <li class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border {tenant.path === config.active_tenant ? 'border-accent bg-accent/5' : 'border-border bg-bg'}">
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-sm font-medium text-primary">{tenant.name}</span>
            <span class="text-xs text-muted truncate">{tenant.path}</span>
          </div>
          {#if tenant.path === config.active_tenant}
            <span class="text-xs text-accent font-medium flex-shrink-0">Aktiv</span>
          {:else}
            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                class="text-xs text-secondary hover:text-primary px-3 py-1 rounded border border-border hover:bg-surface-raised transition-colors"
                on:click={() => switchTenant(tenant.path)}
              >
                Wechseln
              </button>
              <button
                class="text-xs text-muted hover:text-red-500 px-2 py-1 transition-colors"
                title="Aus Liste entfernen"
                on:click={() => removeTenant(tenant.path)}
              >×</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    <button
      class="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-secondary text-sm hover:bg-bg hover:text-primary transition-colors"
      on:click={addTenant}
    >
      <span>+</span>
      <span>Neuen Arbeitsbereich hinzufügen</span>
    </button>

    {#if errorMsg}
      <p class="text-xs text-red-500">{errorMsg}</p>
    {/if}
  </section>

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
