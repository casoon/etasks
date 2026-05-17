<!-- @module:planning -->
<script lang="ts">
    import { $tasks as tasksStore } from "../../stores/taskStore";
    import { $bridgeTimeEntries as timeEntriesStore } from "../../stores/coreBridge";
    import { $projects as projectsStore } from "../../stores/projectStore";
    import { TAG_COLORS } from "../../domain/types";
    import { diffDays, getWeekStart, today } from "../../domain/dateUtils";

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

    $: completedTasks = tasks.filter((task) => task.status === "done" && !!task.completedAt);
    $: leadTimeDays = completedTasks
        .map((task) => diffDays(task.createdAt, task.completedAt ?? null))
        .filter((days): days is number => days != null && days >= 0);
    $: avgLeadTimeDays = leadTimeDays.length > 0
        ? Math.round((leadTimeDays.reduce((sum, days) => sum + days, 0) / leadTimeDays.length) * 10) / 10
        : null;
    $: leadTimeByProject = (() => {
        const grouped = new Map<string, { name: string; color: string; values: number[] }>();
        for (const task of completedTasks) {
            const days = diffDays(task.createdAt, task.completedAt ?? null);
            if (days == null || days < 0) continue;
            const pid = task.projectId ?? "ohne-projekt";
            const project = projects.find((item) => item.id === pid);
            const entry = grouped.get(pid) ?? {
                name: project?.name ?? "Ohne Projekt",
                color: project?.color ?? "#d1d5db",
                values: [],
            };
            entry.values.push(days);
            grouped.set(pid, entry);
        }
        return [...grouped.values()]
            .map((entry) => ({
                name: entry.name,
                color: entry.color,
                avgDays: Math.round((entry.values.reduce((sum, days) => sum + days, 0) / entry.values.length) * 10) / 10,
                count: entry.values.length,
            }))
            .sort((a, b) => a.avgDays - b.avgDays)
            .slice(0, 5);
    })();

    function weekStartIso(): string {
        return getWeekStart(new Date());
    }

    // --- Ansichts-Toggle ---
    let chartView: 'woche' | 'heute' = 'woche';

    // Heute-Ansicht: Zeiterfassung heute nach Projekt
    $: todayStr = today();
    $: todayEntries = timeEntries.filter(
        (e) => e.startAt.slice(0, 10) === todayStr && (e.durationMinutes ?? 0) > 0,
    );
    $: todayByProject = (() => {
        const m: Record<string, number> = {};
        for (const e of todayEntries) {
            const pid = e.projectId ?? 'ohne-projekt';
            m[pid] = (m[pid] ?? 0) + (e.durationMinutes ?? 0);
        }
        return Object.entries(m)
            .map(([pid, minutes]) => ({
                pid,
                name: pid === 'ohne-projekt' ? 'Ohne Projekt' : (projects.find(p => p.id === pid)?.name ?? pid),
                color: pid === 'ohne-projekt' ? '#d1d5db' : (projects.find(p => p.id === pid)?.color ?? '#e5e7eb'),
                minutes,
            }))
            .sort((a, b) => b.minutes - a.minutes);
    })();
    $: todayTotalMinutes = todayByProject.reduce((s, p) => s + p.minutes, 0);
    $: todayMaxMinutes = Math.max(...todayByProject.map(p => p.minutes), 60);

    // --- Weekly stacked bar chart ---

    const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

    $: weekDays = (() => {
        const ws = new Date(weekStartIso());
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(ws);
            d.setDate(ws.getDate() + i);
            return d;
        });
    })();

    $: weekDayIsos = weekDays.map((d) => d.toISOString().slice(0, 10));

    // entries in current week
    $: weekEntries = timeEntries.filter(
        (e) =>
            e.startAt >= weekStartIso() &&
            e.durationMinutes != null &&
            (e.durationMinutes ?? 0) > 0,
    );

    // total minutes tracked this week (for headline)
    $: totalWeekMinutes = weekEntries.reduce(
        (s, e) => s + (e.durationMinutes ?? 0),
        0,
    );

    // collect unique projectIds that appear in weekEntries
    $: weekProjectIds = (() => {
        const seen = new Set<string>();
        for (const e of weekEntries) {
            seen.add(e.projectId ?? "ohne-projekt");
        }
        return [...seen];
    })();

    // data[dayIndex][projectId] = minutes
    $: chartData = (() => {
        const data: Record<string, number>[] = Array.from({ length: 7 }, () => ({}));
        for (const e of weekEntries) {
            const dayIso = e.startAt.slice(0, 10);
            const dayIdx = weekDayIsos.indexOf(dayIso);
            if (dayIdx < 0) continue;
            const pid = e.projectId ?? "ohne-projekt";
            data[dayIdx][pid] = (data[dayIdx][pid] ?? 0) + (e.durationMinutes ?? 0);
        }
        return data;
    })();

    // max total minutes per day → for y-axis
    $: maxDayMinutes = (() => {
        const totals = chartData.map((d) =>
            Object.values(d).reduce((s, v) => s + v, 0),
        );
        return Math.max(...totals, 60); // at least 60 min (1h)
    })();

    // round up to next full hour
    $: yMaxMinutes = Math.ceil(maxDayMinutes / 60) * 60;
    $: yTicks = Array.from({ length: yMaxMinutes / 60 + 1 }, (_, i) => i);

    function projectColor(pid: string): string {
        if (pid === "ohne-projekt") return "#d1d5db";
        return projects.find((p) => p.id === pid)?.color ?? "#e5e7eb";
    }

    function projectName(pid: string): string {
        if (pid === "ohne-projekt") return "Ohne Projekt";
        return projects.find((p) => p.id === pid)?.name ?? pid;
    }

    // SVG layout constants
    const CHART_H = 180;
    const LEFT_MARGIN = 32;
    const RIGHT_MARGIN = 8;
    const TOP_MARGIN = 8;
    const BOTTOM_MARGIN = 36;
    const SVG_W = 320;
    const SVG_H = CHART_H + TOP_MARGIN + BOTTOM_MARGIN;
    const PLOT_W = SVG_W - LEFT_MARGIN - RIGHT_MARGIN;
    const BAR_GAP = 6;

    $: barWidth = (() => {
        const slotW = PLOT_W / 7;
        return Math.max(slotW - BAR_GAP, 4);
    })();

    function barX(dayIdx: number): number {
        const slotW = PLOT_W / 7;
        return LEFT_MARGIN + dayIdx * slotW + (slotW - barWidth) / 2;
    }

    function minutesToY(minutes: number): number {
        return TOP_MARGIN + CHART_H - (minutes / yMaxMinutes) * CHART_H;
    }

    // stacked segments for a day: [{pid, y, h}]
    function stackedSegments(dayIdx: number): { pid: string; y: number; h: number }[] {
        const dayData = chartData[dayIdx];
        let accumulated = 0;
        return weekProjectIds.map((pid) => {
            const mins = dayData[pid] ?? 0;
            const h = (mins / yMaxMinutes) * CHART_H;
            const y = TOP_MARGIN + CHART_H - accumulated * (CHART_H / yMaxMinutes) - h;
            accumulated += mins;
            return { pid, y, h };
        });
    }
</script>

<div class="overflow-y-auto p-6">
    <h2
        class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted pb-4"
    >
        Analytics
    </h2>

    <div class="flex flex-col gap-4">
        <!-- Zeiterfassung: Woche / Heute -->
        <div
            class="bg-surface rounded-2xl shadow-card border border-border p-5 flex flex-col gap-3"
        >
            <div class="flex items-center justify-between gap-3">
                <span class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Was wurde erledigt</span>
                <div class="flex rounded-lg border border-border overflow-hidden text-[11px]">
                    <button
                        class="px-3 py-1 transition-colors {chartView === 'woche' ? 'bg-accent text-white font-semibold' : 'text-secondary hover:bg-bg'}"
                        on:click={() => chartView = 'woche'}
                    >Woche</button>
                    <button
                        class="px-3 py-1 transition-colors {chartView === 'heute' ? 'bg-accent text-white font-semibold' : 'text-secondary hover:bg-bg'}"
                        on:click={() => chartView = 'heute'}
                    >Heute</button>
                </div>
            </div>

            {#if chartView === 'woche'}
            <span class="text-[22px] font-bold text-primary">
                {Math.round((totalWeekMinutes / 60) * 10) / 10} Stunden erfasst diese Woche
            </span>

            <div class="w-full overflow-x-auto">
                <svg
                    viewBox="0 0 {SVG_W} {SVG_H}"
                    width={SVG_W}
                    height={SVG_H}
                    style="display:block; max-width:100%"
                >
                    <!-- Y gridlines + labels -->
                    {#each yTicks as tick}
                        {@const gy = minutesToY(tick * 60)}
                        <line
                            x1={LEFT_MARGIN}
                            y1={gy}
                            x2={SVG_W - RIGHT_MARGIN}
                            y2={gy}
                            stroke="#e5e7eb"
                            stroke-width="1"
                        />
                        <text
                            x={LEFT_MARGIN - 4}
                            y={gy + 4}
                            text-anchor="end"
                            font-size="9"
                            fill="#9ca3af"
                        >{tick}h</text>
                    {/each}

                    <!-- Bars -->
                    {#each Array.from({ length: 7 }, (_, i) => i) as dayIdx}
                        {@const segments = stackedSegments(dayIdx)}
                        {#each segments as seg (seg.pid)}
                            {#if seg.h > 0}
                                <rect
                                    x={barX(dayIdx)}
                                    y={seg.y}
                                    width={barWidth}
                                    height={seg.h}
                                    fill={projectColor(seg.pid)}
                                    rx="2"
                                />
                            {/if}
                        {/each}

                        <!-- X-axis labels -->
                        <text
                            x={barX(dayIdx) + barWidth / 2}
                            y={TOP_MARGIN + CHART_H + 14}
                            text-anchor="middle"
                            font-size="9"
                            fill="#6b7280"
                            font-weight="600"
                        >{DAY_LABELS[dayIdx]}</text>
                        <text
                            x={barX(dayIdx) + barWidth / 2}
                            y={TOP_MARGIN + CHART_H + 25}
                            text-anchor="middle"
                            font-size="9"
                            fill="#9ca3af"
                        >{weekDays[dayIdx]?.getDate()}</text>
                    {/each}
                </svg>
            </div>

            <!-- Legend -->
            {#if weekProjectIds.length > 0}
                <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {#each weekProjectIds as pid (pid)}
                        <span class="flex items-center gap-1.5 text-[11px] text-secondary">
                            <span
                                class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                style="background:{projectColor(pid)}"
                            ></span>
                            {projectName(pid)}
                        </span>
                    {/each}
                </div>
            {/if}
            {/if}

            {#if chartView === 'heute'}
            <span class="text-[22px] font-bold text-primary">
                {Math.round((todayTotalMinutes / 60) * 10) / 10} Stunden heute erfasst
            </span>
            {#if todayByProject.length === 0}
                <p class="text-[13px] text-muted">Noch keine Zeiterfassung heute.</p>
            {:else}
                <ul class="flex flex-col gap-2">
                    {#each todayByProject as proj (proj.pid)}
                        {@const pct = todayMaxMinutes > 0 ? (proj.minutes / todayMaxMinutes) * 100 : 0}
                        {@const label = proj.minutes < 60
                            ? proj.minutes + ' min'
                            : Math.floor(proj.minutes / 60) + 'h' + (proj.minutes % 60 > 0 ? '\u202f' + proj.minutes % 60 + 'min' : '')}
                        <li class="flex flex-col gap-1">
                            <div class="flex items-center justify-between text-[12px]">
                                <span class="flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{proj.color}"></span>
                                    <span class="text-primary">{proj.name}</span>
                                </span>
                                <span class="text-muted tabular-nums">{label}</span>
                            </div>
                            <div class="h-2 bg-border rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-[width] duration-500"
                                    style="width:{pct}%; background:{proj.color}"></div>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
            {/if}
        </div>

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

        <div
            class="bg-surface rounded-2xl shadow-card border border-border p-5 flex flex-col gap-3"
        >
            <div class="flex items-center justify-between gap-3">
                <span
                    class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                    >Lead Time</span
                >
                <span class="text-[11px] text-muted">{completedTasks.length} erledigte Tasks</span>
            </div>

            <span class="text-[32px] font-bold text-primary">
                {avgLeadTimeDays == null ? "–" : avgLeadTimeDays + " Tage"}
            </span>
            <p class="text-[13px] text-secondary">
                Durchschnitt von Erstellung bis Abschluss.
            </p>

            {#if leadTimeByProject.length === 0}
                <p class="text-[13px] text-muted">Noch keine abgeschlossenen Tasks mit Lead-Time-Daten.</p>
            {:else}
                <ul class="flex flex-col gap-2">
                    {#each leadTimeByProject as item (item.name)}
                        <li class="flex items-center justify-between gap-3 text-[13px]">
                            <span class="flex items-center gap-2 min-w-0">
                                <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{item.color}"></span>
                                <span class="text-primary truncate">{item.name}</span>
                            </span>
                            <span class="text-muted whitespace-nowrap">{item.avgDays}d · {item.count} Tasks</span>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </div>
</div>
