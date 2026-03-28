<script lang="ts">
  import { $showShutdown as showStore } from '../stores/uiStore';
  import { $todayTasks as todayTasksStore, updateTask } from '../stores/taskStore';
  import { $appConfig as appConfigStore } from '../stores/configStore';
  import { today } from '../domain/dateUtils';
  import { upsertNote, loadTimeEntries, loadProjects } from '../lib/db';

  $: show = $showStore;
  $: tasks = $todayTasksStore;
  $: openTasks = tasks.filter(t => t.status === 'todo');
  $: doneTasks = tasks.filter(t => t.status === 'done');

  let highlight = '';
  let aiSummary = '';
  let aiLoading = false;
  let aiError = '';

  function handlePostpone(id: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    updateTask(id, { plannedDate: tomorrow.toISOString().slice(0, 10), scheduledStart: null });
  }

  function handleClose() {
    if (highlight.trim()) {
      upsertNote({ date: today(), highlight: highlight.trim(), createdAt: new Date().toISOString() });
    }
    showStore.set(false);
    highlight = '';
    aiSummary = '';
    aiError = '';
  }

  async function generateAISummary() {
    const apiKey = appConfigStore.get()?.profile?.claude_api_key?.trim();
    if (!apiKey) {
      aiError = 'Kein API Key hinterlegt. Bitte in den Einstellungen unter "KI-Integration" eintragen.';
      return;
    }

    aiLoading = true;
    aiError = '';
    aiSummary = '';

    try {
      const todayStr = today();
      const allEntries = loadTimeEntries().filter(e => e.date === todayStr);
      const projects = loadProjects();
      const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

      const totalMinutes = allEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
      const totalHours = (totalMinutes / 60).toFixed(1);

      const doneList = doneTasks.map(t => `- ${t.title}${t.estimatedMinutes ? ` (${t.estimatedMinutes} min)` : ''}`).join('\n') || '(keine)';
      const openList = openTasks.map(t => `- ${t.title}`).join('\n') || '(keine)';
      const timeList = allEntries.length > 0
        ? allEntries.map(e => `- ${projectMap[e.projectId] ?? 'Kein Projekt'}: ${e.durationMinutes ?? 0} min${e.description ? ` — ${e.description}` : ''}`).join('\n')
        : '(keine Zeiterfassung)';

      const prompt = `Du bist ein hilfreicher Arbeitsassistent. Erstelle eine kurze, motivierende Tages-Zusammenfassung auf Deutsch (3–5 Sätze).

Heute erledigte Aufgaben:
${doneList}

Noch offene Aufgaben:
${openList}

Erfasste Zeit (${totalHours}h gesamt):
${timeList}

${highlight.trim() ? `Highlight des Tages: "${highlight.trim()}"` : ''}

Schreibe eine persönliche, wertschätzende Zusammenfassung was heute gut gelaufen ist und gib einen kurzen Ausblick auf morgen.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any)?.error?.message ?? `HTTP ${response.status}`);
      }

      const data = await response.json();
      aiSummary = data.content?.[0]?.text ?? '';
    } catch (e: any) {
      aiError = e?.message ?? 'Unbekannter Fehler';
    } finally {
      aiLoading = false;
    }
  }
</script>

{#if show}
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000] backdrop-blur-sm"
  on:click={(e) => { if (e.target === e.currentTarget) handleClose(); }}
>
  <div class="bg-surface rounded-2xl shadow-overlay w-full max-w-[560px] p-8 flex flex-col gap-6 max-h-[80vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="shutdown-title">
    <div>
      <h2 id="shutdown-title" class="text-lg font-semibold text-primary">Tagesabschluss</h2>
    </div>

    {#if openTasks.length > 0}
      <section class="flex flex-col gap-3">
        <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Offene Aufgaben</h3>
        <ul class="list-none flex flex-col gap-2">
          {#each openTasks as task (task.id)}
            <li class="flex items-center justify-between gap-3 py-2 border-b border-border-subtle min-w-0">
              <span class="text-[13px] text-primary overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{task.title}</span>
              <button
                class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap flex-shrink-0"
                on:click={() => handlePostpone(task.id)}
              >→ morgen</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="flex flex-col gap-3">
      <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Highlight des Tages</h3>
      <textarea
        class="w-full px-3 py-3 border border-border rounded-lg text-[13px] resize-y outline-none bg-bg leading-relaxed focus:border-accent"
        bind:value={highlight}
        placeholder="Was war heute besonders gut?"
        rows={3}
      />
    </section>

    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <h3 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">KI-Zusammenfassung</h3>
        <button
          class="px-3 py-1.5 text-[12px] rounded-lg border border-border text-secondary hover:bg-bg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          on:click={generateAISummary}
          disabled={aiLoading}
        >
          {#if aiLoading}
            <span class="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin"></span>
            Generiere…
          {:else}
            ✨ Zusammenfassung erstellen
          {/if}
        </button>
      </div>
      {#if aiSummary}
        <div class="px-4 py-3 bg-bg rounded-xl border border-border text-[13px] text-primary leading-relaxed whitespace-pre-wrap">
          {aiSummary}
        </div>
      {/if}
      {#if aiError}
        <p class="text-[12px] text-red-500">{aiError}</p>
      {/if}
    </section>

    <div class="flex justify-end">
      <button
        class="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        on:click={handleClose}
      >Tag abschließen ✓</button>
    </div>
  </div>
</div>
{/if}
