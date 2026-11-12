<!-- @core -->
<script lang="ts">
    import type { TenantInfo } from "../../stores/configStore";

    export let kind: "config-corrupt" | "workspace-missing";
    export let message = "";
    export let missingPath = "";
    export let tenants: TenantInfo[] = [];
    export let onChoose: (path: string) => void = () => {};
    export let onSetup: () => void = () => {};
    export let onReset: () => void = () => {};
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div class="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 flex flex-col gap-5">
        {#if kind === "config-corrupt"}
            <h2 class="text-xl font-semibold text-primary">Konfiguration beschädigt</h2>
            <p class="text-sm text-secondary leading-relaxed">{message}</p>
            <p class="text-xs text-muted leading-relaxed">
                Beim Neu einrichten wird die beschädigte Datei zur Seite gelegt (config.json.corrupt-…), nicht gelöscht.
                Deine Arbeitsbereiche mit allen Daten bleiben unverändert und lassen sich im Setup wieder öffnen.
            </p>
            <div class="flex justify-end">
                <button class="btn-primary" on:click={onReset}>Neu einrichten</button>
            </div>
        {:else}
            <h2 class="text-xl font-semibold text-primary">Arbeitsbereich nicht gefunden</h2>
            <p class="text-sm text-secondary leading-relaxed">
                Die Datenbank des letzten Arbeitsbereichs ist nicht erreichbar. Wurde der Ordner verschoben, gelöscht
                oder liegt er auf einem Laufwerk, das nicht angeschlossen ist?
            </p>
            <p class="text-xs text-muted break-all">{missingPath}</p>
            {#if tenants.length > 0}
                <div class="rounded-xl border border-border bg-bg/60 p-4 flex flex-col gap-2">
                    <div class="text-xs font-medium text-secondary">Anderen Arbeitsbereich wählen</div>
                    {#each tenants as t (t.path)}
                        <button
                            class="text-left text-sm text-accent hover:underline truncate"
                            on:click={() => onChoose(t.path)}
                        >
                            {t.displayName ?? t.name}
                        </button>
                    {/each}
                </div>
            {/if}
            <div class="flex justify-end">
                <button class="btn-primary" on:click={onSetup}>Neu einrichten oder suchen</button>
            </div>
        {/if}
    </div>
</div>
