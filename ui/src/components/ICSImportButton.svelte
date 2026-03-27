<script lang="ts">
  import { importICSFile } from '../lib/icsParser';
  import { upsertBlock, loadBlocks } from '../lib/db';
  import { $blocks as blocksStore } from '../stores/calendarStore';

  type Status = 'idle' | 'loading' | 'done' | 'error';
  let status: Status = 'idle';
  let count = 0;

  async function handleImport() {
    status = 'loading';
    try {
      const blocks = await importICSFile();
      if (blocks.length === 0) { status = 'idle'; return; }

      const existing = loadBlocks();
      const existingIds = new Set(existing.map(b => b.id));
      let imported = 0;
      for (const block of blocks) {
        if (!existingIds.has(block.id)) { upsertBlock(block); imported++; }
      }

      blocksStore.set(loadBlocks());
      count = imported;
      status = 'done';
      setTimeout(() => status = 'idle', 3000);
    } catch {
      status = 'error';
      setTimeout(() => status = 'idle', 3000);
    }
  }
</script>

<button
  class="flex items-center gap-1 text-[12px] text-muted px-2 py-1 rounded-lg border border-border transition-colors hover:bg-bg hover:text-primary whitespace-nowrap disabled:opacity-50"
  on:click={handleImport}
  disabled={status === 'loading'}
  title="ICS-Kalender importieren"
>
  {#if status === 'loading'}…
  {:else if status === 'done'}✓ {count} importiert
  {:else if status === 'error'}✕ Fehler
  {:else}↓ .ics
  {/if}
</button>
