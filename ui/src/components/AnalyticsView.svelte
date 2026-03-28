<script lang="ts">
    import { $tasks as tasksStore } from "../stores/taskStore";
    import { $timeEntries as timeEntriesStore } from "../stores/timerStore";
    import { $projects as projectsStore } from "../stores/projectStore";
    import { TAG_COLORS } from "../domain/types";
    import { getWeekStart } from "../domain/dateUtils";

    $: tasks = $tasksStore;
    $: timeEntries = $timeEntriesStore;
    $: projects = $projectsStore;

    $: recent = (() => {
        const weekStart = getWeekStart(new Date());
        return tasks.filter((t) => (t.plannedDate ?? "") >= weekStart);
    })();

    $: tagMinutes = (() => {
        const m: Record<string, number> = {};
        for (const task of recent) {
            const tag = task.tags[0] ?? "sonstige";
            m[tag] = (m[tag] ?? 0) + (task.estimatedMinutes ?? 0);
        }
        return m;
    })();

    $: total = Object.values(tagMinutes).reduce((s, v) => s + v, 0);
    $: sortedEntries = Object.entries(tagMinutes).sort((a, b) => b[1] - a[1]);
    $: done = recent.filter((t) => t.status === "done").length;
    $: completion =
        recent.length > 0 ? Math.round((done / recent.length) * 100) : 0;
    $: trackedThisWeek = timeEntries
        .filter((entry) => entry.startAt >= weekStartIso())
        .reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);
    $: plannedThisWeek = recent.reduce(
        (sum, task) => sum + (task.estimatedMinutes ?? 0),
        0,
    );
    $: utilization =
        plannedThisWeek > 0
            ? Math.round((trackedThisWeek / plannedThisWeek) * 100)
            : 0;
    $: projectMinutes = (() => {
        const byProject: Record<string, number> = {};
        for (const entry of timeEntries.filter(
            (item) => item.startAt >= weekStartIso(),
        )) {
            const projectId = entry.projectId ?? "ohne-projekt";
            byProject[projectId] =
                (byProject[projectId] ?? 0) + (entry.durationMinutes ?? 0);
        }
        return Object.entries(byProject)
            .map(([projectId, minutes]) => ({
                name:
                    projects.find((project) => project.id === projectId)
                        ?.name ?? "Ohne Projekt",
                minutes,
            }))
            .sort((a, b) => b.minutes - a.minutes)
            .slice(0, 4);
    })();

    function weekStartIso(): string {
        return getWeekStart(new Date());
    }
</script>

<div class="overflow-y-auto p-6">
    <h2
        class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted pb-4"
    >
        Analytics
    </h2>

    <div class="flex flex-col gap-4">
        <div
            class="bg-surface rounded-2xl shadow-card border border-border p-5 flex flex-col gap-3"
        >
            <span
                class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                >Erledigungsrate diese Woche</span
            >
            <span class="text-[32px] font-bold text-primary"
                >{recent.length === 0 ? "–" : completion + "%"}</span
            >
            <div class="h-[6px] bg-border rounded-[3px] overflow-hidden">
                <div
                    class="h-full bg-success rounded-[3px] transition-[width] duration-[600ms]"
                    style="width:{completion}%"
                />
            </div>
        </div>

        <div
            class="bg-surface rounded-2xl shadow-card border border-border p-5 flex flex-col gap-3"
        >
            <span
                class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                >Zeit pro Kategorie</span
            >
            {#if sortedEntries.length === 0}
                <p class="text-[13px] text-muted">Noch keine Daten.</p>
            {/if}
            <ul class="list-none flex flex-col gap-2">
                {#each sortedEntries as [tag, minutes] (tag)}
                    {@const pct = total > 0 ? (minutes / total) * 100 : 0}
                    <li
                        class="grid items-center gap-3"
                        style="grid-template-columns: 70px 1fr 40px"
                    >
                        <span
                            class="text-[12px] text-secondary text-right overflow-hidden text-ellipsis whitespace-nowrap"
                            >{tag}</span
                        >
                        <div
                            class="h-[10px] bg-border rounded-[5px] overflow-hidden"
                        >
                            <div
                                class="h-full rounded-[5px] transition-[width] duration-[600ms]"
                                style="width:{pct}%; background:{TAG_COLORS[
                                    tag
                                ] ?? '#e5e7eb'}"
                            />
                        </div>
                        <span
                            class="text-[12px] text-muted text-right whitespace-nowrap"
                            >{Math.round((minutes / 60) * 10) / 10}h</span
                        >
                    </li>
                {/each}
            </ul>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
                class="bg-surface rounded-2xl shadow-card border border-border p-5 flex flex-col gap-2"
            >
                <span
                    class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                    >Geplant vs. erfasst</span
                >
                <strong class="text-[28px] font-bold text-primary">
                    {Math.round((trackedThisWeek / 60) * 10) / 10}h
                </strong>
                <p class="text-[13px] text-secondary">
                    Erfasst diese Woche bei {Math.round(
                        (plannedThisWeek / 60) * 10,
                    ) / 10}h geplanter Zeit.
                </p>
                <div class="h-[6px] bg-border rounded-[3px] overflow-hidden">
                    <div
                        class="h-full bg-accent rounded-[3px] transition-[width] duration-[600ms]"
                        style="width:{Math.min(utilization, 100)}%"
                    />
                </div>
            </div>

            <div
                class="bg-surface rounded-2xl shadow-card border border-border p-5 flex flex-col gap-3"
            >
                <span
                    class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                    >Top-Projekte</span
                >
                {#if projectMinutes.length === 0}
                    <p class="text-[13px] text-muted">
                        Noch keine Tracking-Daten.
                    </p>
                {:else}
                    <ul class="flex flex-col gap-2">
                        {#each projectMinutes as project (project.name)}
                            <li
                                class="flex items-center justify-between gap-3 text-[13px]"
                            >
                                <span class="text-primary">{project.name}</span>
                                <span class="text-muted"
                                    >{Math.round((project.minutes / 60) * 10) /
                                        10}h</span
                                >
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>
    </div>
</div>
