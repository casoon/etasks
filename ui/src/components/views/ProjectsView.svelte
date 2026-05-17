<!-- @module:projects -->
<script lang="ts">
    import {
        $clients as clientsStore,
        $projects as projectsStore,
        $selectedProjectId as selectedProjectIdStore,
        $selectedProject as selectedProjectStore,
        addClient,
        addProject,
        updateClient,
        updateProject,
        assignClientToProject,
        removeProject,
    } from "../../stores/projectStore";
    import { $tasks as tasksStore } from "../../stores/taskStore";
    import { $timeEntries as timeEntriesStore } from "../../stores/timerStore";
    import { $projectsView as projectsViewStore } from "../../stores/uiStore";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
    } from "../../stores/configStore";
    import { toast } from "../../stores/toastStore";
    import { PROJECT_COLORS, type Task } from "../../domain/types";
    import {
        $billingItems as billingItemsStore,
        $billingItemTasks as billingItemTasksStore,
        $unlockedBillingItemIds as unlockedBillingItemIdsStore,
        addBillingItem,
        updateBillingItem,
        removeBillingItem,
        linkTaskToBillingItem,
        unlinkTaskFromBillingItem,
    } from "../../stores/billingStore";
    import { isTauriAvailable } from "../../lib/platform";
    import {
        buildProjectReportInput,
        generateProjectReport,
    } from "../../lib/reportService";
    import { generateOffer, type OfferData } from "../../lib/offerService";
    import KanbanBoard from "./KanbanBoard.svelte";
    import { $termine as termineStore, addTermin, removeTermin } from "../../stores/terminStore";
    import type { TerminType } from "../../domain/types";
    import TemplatePickerModal from "../modals/TemplatePickerModal.svelte";
    import ClientManager from "../modals/ClientManager.svelte";
    import ServiceCatalog from "../modals/ServiceCatalog.svelte";

    $: clients = $clientsStore;
    $: projects = $projectsStore;
    $: internalProjects = projects.filter((p) => !p.clientId);
    $: selectedId = $selectedProjectIdStore;
    $: selectedProject = $selectedProjectStore;
    $: allTasks = $tasksStore;
    $: allTimeEntries = [...$timeEntriesStore];
    $: appConfig = $appConfigStore;
    $: billingItems = $billingItemsStore;
    $: billingItemTasks = $billingItemTasksStore;
    $: unlockedIds = $unlockedBillingItemIdsStore;
    $: projectBillingItems = selectedId
        ? billingItems
              .filter((i) => i.projectId === selectedId)
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        : [];
    $: selectedClient = selectedProject
        ? (clients.find((client) => client.id === selectedProject.clientId) ??
          null)
        : null;

    $: allTermine = $termineStore;
    $: projectTermine = selectedId
        ? allTermine.filter(t => t.projectId === selectedId).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        : [];

    const TERMIN_TYPE_ICONS: Record<TerminType, string> = { video: '📹', phone: '📞', onsite: '🏢' };
    const TERMIN_TYPE_LABELS: Record<TerminType, string> = { video: 'Video', phone: 'Telefon', onsite: 'Vor Ort' };

    let addingTerminProject = false;
    let newPTerminTitle = '';
    let newPTerminDate = new Date().toISOString().slice(0, 10);
    let newPTerminTime = '09:00';
    let newPTerminDuration = 60;
    let newPTerminType: TerminType = 'video';
    let newPTerminBillable = false;

    function handleAddProjectTermin(e: Event) {
        e.preventDefault();
        if (!newPTerminTitle.trim() || !selectedId) return;
        addTermin({
            date: newPTerminDate,
            startTime: newPTerminTime,
            durationMinutes: newPTerminDuration,
            type: newPTerminType,
            title: newPTerminTitle.trim(),
            projectId: selectedId,
            billable: newPTerminBillable,
        });
        newPTerminTitle = '';
        addingTerminProject = false;
    }

    let reportGenerating = false;
    let reportMessage = "";
    let offerGenerating = false;

    async function handleGenerateReport() {
        if (!selectedProject) return;
        reportGenerating = true;
        reportMessage = "";
        try {
            const input = buildProjectReportInput(
                selectedProject,
                allTasks as Task[],
                allTimeEntries,
            );
            const path = await generateProjectReport(input);
            reportMessage = `PDF gespeichert: ${path}`;
        } catch (e) {
            reportMessage = `Fehler: ${e}`;
        } finally {
            reportGenerating = false;
            setTimeout(() => {
                reportMessage = "";
            }, 5000);
        }
    }

    function splitClientAddress(address?: string) {
        const fallback = {
            street: "",
            house_number: "",
            postal_code: "",
            city: "",
            country: "Deutschland",
        };
        if (!address?.trim()) return fallback;
        const [firstLine, secondLine = ""] = address
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
        const streetMatch = firstLine.match(/^(.*?)(?:\s+(\d+[a-zA-Z/-]*))?$/);
        const locationMatch = secondLine.match(/^(\d{4,5})\s+(.+)$/);
        return {
            street: streetMatch?.[1]?.trim() ?? firstLine,
            house_number: streetMatch?.[2]?.trim() ?? "",
            postal_code: locationMatch?.[1] ?? "",
            city: locationMatch?.[2]?.trim() ?? secondLine,
            country: "Deutschland",
        };
    }

    async function handleGenerateOffer() {
        if (!selectedProject || !selectedClient || !appConfig) return;
        if (!isTauriAvailable()) {
            toast(
                "Angebote koennen nur in der Desktop-App als PDF erzeugt werden.",
                "info",
                4000,
            );
            return;
        }
        if (!selectedClient.address?.trim()) {
            toast(
                `Beim Kunden "${selectedClient.name}" fehlt die Angebotsadresse.`,
                "error",
                4500,
            );
            return;
        }
        if (projectBillingItems.length === 0) {
            toast(
                "Das Projekt hat noch keine Rechnungs-/Angebotspositionen.",
                "error",
                4500,
            );
            return;
        }

        const profile = appConfig.profile;
        const today = new Date();
        const year = today.getFullYear();
        const counter = profile.offer_number_counter ?? 1;
        const prefix = profile.offer_number_prefix?.trim() || `ANG-${year}-`;
        const offerNumber = prefix + String(counter).padStart(3, "0");
        const validUntil = new Date(today);
        validUntil.setDate(
            validUntil.getDate() + (profile.offer_validity_days ?? 30),
        );

        const offerItems = projectBillingItems.map((item, index) => {
            const linkedTasks = billingItemTasks
                .filter((link) => link.billingItemId === item.id)
                .map((link) => allTasks.find((task) => task.id === link.taskId))
                .filter(Boolean);
            const estimatedHours =
                linkedTasks.reduce(
                    (sum, task) => sum + (task?.estimatedMinutes ?? 0) / 60,
                    0,
                ) || 0;
            const quantity =
                item.quantity ??
                (item.billingType === "hourly"
                    ? Math.max(1, Math.round(estimatedHours * 10) / 10)
                    : 1);
            const unit =
                item.billingType === "hourly"
                    ? "Stunden"
                    : item.billingType === "fixed"
                      ? "Pauschal"
                      : "Einheit";
            const unitPrice = (item.unitPriceCents ?? 0) / 100;
            const total = Math.round(quantity * unitPrice * 100) / 100;
            return {
                position: index + 1,
                title: item.title,
                description: item.description ?? "",
                sub_items: linkedTasks
                    .map((task) => task?.title?.trim())
                    .filter(Boolean) as string[],
                quantity: item.billingType === "fixed" ? "1" : quantity,
                unit,
                unit_price: { amount: unitPrice.toFixed(2), currency: "EUR" },
                total: { amount: total.toFixed(2), currency: "EUR" },
            };
        });

        const subtotal = offerItems.reduce(
            (sum, item) => sum + Number(item.total.amount),
            0,
        );
        const additionalTerms = (profile.offer_additional_terms ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        const offerData: OfferData = {
            metadata: {
                offer_number: offerNumber,
                offer_date: { date: today.toISOString().slice(0, 10) },
                valid_until: { date: validUntil.toISOString().slice(0, 10) },
                customer_number:
                    selectedClient.customerNumber?.trim() || undefined,
                project_reference: selectedProject.name,
                show_footer: true,
            },
            recipient: {
                name:
                    selectedClient.contactPerson?.trim() || selectedClient.name,
                company: selectedClient.name,
                address: splitClientAddress(selectedClient.address),
            },
            salutation: {
                greeting: selectedClient.contactPerson?.trim()
                    ? `Hallo ${selectedClient.contactPerson.trim()},`
                    : `Hallo ${selectedClient.name},`,
                introduction: selectedProject.notes?.trim() || undefined,
            },
            items: offerItems,
            totals: {
                subtotal: { amount: subtotal.toFixed(2), currency: "EUR" },
                total: { amount: subtotal.toFixed(2), currency: "EUR" },
            },
            terms: {
                validity: `Dieses Angebot ist gueltig bis ${validUntil.toLocaleDateString("de-DE")}`,
                payment_terms: profile.offer_payment_terms?.trim() || undefined,
                delivery_terms:
                    profile.offer_delivery_terms?.trim() || undefined,
                additional_terms:
                    additionalTerms.length > 0 ? additionalTerms : undefined,
            },
            notes: selectedProject.notes?.trim() || undefined,
        };

        offerGenerating = true;
        reportMessage = "";
        try {
            const path = await generateOffer(offerData, appConfig);
            await saveAppConfig({
                ...appConfig,
                profile: {
                    ...appConfig.profile,
                    offer_number_counter: counter + 1,
                },
            });
            reportMessage = `Angebot gespeichert: ${path}`;
            toast(`Angebot gespeichert: ${path}`, "success", 5000);
        } catch (error) {
            reportMessage = `Fehler: ${String(error)}`;
            toast(`Angebot fehlgeschlagen: ${String(error)}`, "error", 5000);
        } finally {
            offerGenerating = false;
            setTimeout(() => {
                reportMessage = "";
            }, 5000);
        }
    }

    // Right panel view – driven by global store (TopBar switch)
    $: rightView = $projectsViewStore;

    // Add client
    let addingClientSource: "left" | "right" | null = null;
    $: addingClient = addingClientSource !== null;
    let newClientName = "";

    // Add project (unified form)
    let addingNewProject = false;
    let newProjectName = "";
    let newProjectClientId = ""; // "" = internal, client.id = client project

    // Add project under specific client (inline in list)
    let addingProjectForClient: string | null = null;

    // Project list filter
    let statusFilter: 'active' | 'all' = 'active';
    $: clientMap = new Map(clients.map(c => [c.id, c]));
    $: filteredProjects = projects
        .filter(p => statusFilter === 'all' || p.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    // (addingInternalProject removed — unified form handles both intern and client projects)

    // Assign client to internal project
    let assigningClient = false;
    let assignClientId = "";
    $: if (selectedId) { assigningClient = false; assignClientId = ""; }

    function confirmAssignClient() {
        if (!assignClientId || !selectedId) return;
        assignClientToProject(selectedId, assignClientId);
        assigningClient = false;
        assignClientId = "";
    }

    // Edit project/client name
    let editingProjectName = false;
    let editProjectNameVal = "";
    let editingClientId: string | null = null;
    let editClientNameVal = "";

    // Template picker
    let showTemplatePicker = false;

    // Notes debounce
    let notesDebounce: ReturnType<typeof setTimeout> | null = null;
    function handleNotesChange(value: string) {
        if (!selectedId) return;
        if (notesDebounce) clearTimeout(notesDebounce);
        notesDebounce = setTimeout(
            () => updateProject(selectedId!, { notes: value }),
            600,
        );
    }

    function handleAddClient(e: Event) {
        e.preventDefault();
        if (!newClientName.trim()) return;
        addClient(newClientName.trim());
        newClientName = "";
        addingClientSource = null;
    }

    function handleAddNewProject(e: Event) {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        const project = addProject(newProjectClientId, newProjectName.trim());
        selectedProjectIdStore.set(project.id);
        projectsViewStore.set("project");
        newProjectName = "";
        newProjectClientId = "";
        addingNewProject = false;
    }

    function handleAddProject(e: Event, clientId: string) {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        const project = addProject(clientId, newProjectName.trim());
        selectedProjectIdStore.set(project.id);
        projectsViewStore.set("project");
        newProjectName = "";
        addingProjectForClient = null;
    }


    function startEditProjectName() {
        if (!selectedProject) return;
        editProjectNameVal = selectedProject.name;
        editingProjectName = true;
    }

    function saveProjectName() {
        if (selectedId && editProjectNameVal.trim()) {
            updateProject(selectedId, { name: editProjectNameVal.trim() });
        }
        editingProjectName = false;
    }

    const projectTaskCount = (pid: string) =>
        allTasks.filter((t) => t.projectId === pid).length;
    const projectDoneCount = (pid: string) =>
        allTasks.filter((t) => t.projectId === pid && t.status === "done")
            .length;
    const projectOpenCount = (pid: string) =>
        allTasks.filter((t) => t.projectId === pid && t.status === "todo")
            .length;
    const projectTrackedMinutes = (pid: string) => {
        const taskIds = new Set(allTasks.filter(t => t.projectId === pid).map(t => t.id));
        return allTimeEntries
            .filter(e => taskIds.has(e.taskId) && e.durationMinutes)
            .reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
    };
    function fmtMinutes(min: number): string {
        if (min < 60) return `${min} min`;
        const h = Math.floor(min / 60);
        const m = min % 60;
        return m === 0 ? `${h} h` : `${h}:${String(m).padStart(2, '0')} h`;
    }

    function handleStatusSelect(e: Event) {
        if (!selectedId) return;
        const val = (e.currentTarget as HTMLSelectElement).value as
            | "active"
            | "paused"
            | "done";
        updateProject(selectedId, { status: val });
    }

    function handleNotesInput(e: Event) {
        handleNotesChange((e.currentTarget as HTMLTextAreaElement).value);
    }

    function handleDeadlineChange(e: Event) {
        if (!selectedId) return;
        const val = (e.currentTarget as HTMLInputElement).value;
        updateProject(selectedId, { deadline: val || undefined });
    }

    // ── Rechnungspositionen ────────────────────────────────────────────────────────

    let addingBillingItem = false;
    let expandedBillingItemId: string | null = null;

    interface BillingItemDraft {
        title: string;
        billingType: "fixed" | "hourly" | "unit";
        unitPriceEuro: string;
    }

    const emptyBillingDraft = (): BillingItemDraft => ({
        title: "",
        billingType: "hourly",
        unitPriceEuro: "",
    });
    let billingDraft: BillingItemDraft = emptyBillingDraft();

    function saveBillingItem() {
        if (!billingDraft.title.trim() || !selectedId) return;
        const unitPriceCents = billingDraft.unitPriceEuro
            ? Math.round(parseFloat(billingDraft.unitPriceEuro) * 100)
            : null;
        addBillingItem(selectedId, {
            title: billingDraft.title.trim(),
            billingType: billingDraft.billingType,
            unitPriceCents: isNaN(unitPriceCents ?? NaN)
                ? null
                : unitPriceCents,
        });
        billingDraft = emptyBillingDraft();
        addingBillingItem = false;
    }

    function toggleBillingItemExpand(id: string) {
        expandedBillingItemId = expandedBillingItemId === id ? null : id;
    }

    function isTaskLinked(billingItemId: string, taskId: string): boolean {
        return billingItemTasks.some(
            (l) => l.billingItemId === billingItemId && l.taskId === taskId,
        );
    }

    function toggleTaskLink(billingItemId: string, taskId: string) {
        if (isTaskLinked(billingItemId, taskId)) {
            unlinkTaskFromBillingItem(billingItemId, taskId);
        } else {
            linkTaskToBillingItem(billingItemId, taskId);
        }
    }
</script>

<div class="flex-1 flex flex-col overflow-hidden">
    <!-- ── Kunden view ── -->
    {#if rightView === "clients"}
        <ClientManager
            onProjectOpen={(projectId) => {
                projectsViewStore.set("project");
                selectedProjectIdStore.set(projectId);
            }}
            emptyProjectsMessage="Noch keine Projekte für diesen Kunden."
        />

    <!-- ── Leistungen view ── -->
    {:else if rightView === "services"}
        <ServiceCatalog />

    <!-- ── Projekt-Liste ── -->
    {:else if !selectedProject}
        <div class="flex flex-col overflow-hidden flex-1">
            <!-- List header -->
            <div class="px-5 pt-4 pb-2 flex-shrink-0 border-b border-border">
                <div class="flex items-center gap-3 mb-3">
                    <h2 class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted flex-1">Projekte</h2>
                    {#if !addingNewProject}
                        <button
                            class="px-3 py-1.5 rounded-lg border border-dashed border-border text-[12px] text-muted hover:border-accent hover:text-accent transition-colors"
                            on:click={() => { addingNewProject = true; newProjectName = ""; newProjectClientId = ""; }}
                        >+ Projekt anlegen</button>
                    {/if}
                </div>
                <!-- Filter toggle -->
                <div class="flex gap-1">
                    <button
                        class="px-3 py-1 rounded-md text-[11px] font-medium transition-colors {statusFilter === 'active' ? 'bg-accent text-white' : 'bg-bg text-secondary hover:text-primary'}"
                        on:click={() => statusFilter = 'active'}
                    >Aktiv</button>
                    <button
                        class="px-3 py-1 rounded-md text-[11px] font-medium transition-colors {statusFilter === 'all' ? 'bg-accent text-white' : 'bg-bg text-secondary hover:text-primary'}"
                        on:click={() => statusFilter = 'all'}
                    >Alle</button>
                </div>
            </div>

            <!-- New project form (inline) -->
            {#if addingNewProject}
                <div class="px-5 py-3 border-b border-border flex-shrink-0 bg-surface">
                    <form class="flex flex-col gap-2 max-w-sm" on:submit={handleAddNewProject}>
                        <!-- svelte-ignore a11y-autofocus -->
                        <input
                            class="w-full px-2 py-[6px] border border-accent rounded-lg text-[13px] outline-none bg-bg focus:ring-0"
                            bind:value={newProjectName}
                            placeholder="Projektname…"
                            autofocus
                            on:keydown={(e) => { if (e.key === "Escape") addingNewProject = false; }}
                        />
                        <select
                            class="w-full px-2 py-[6px] border border-border rounded-lg text-[13px] outline-none bg-bg text-primary"
                            bind:value={newProjectClientId}
                        >
                            <option value="">Intern (kein Kunde)</option>
                            {#each clients as c (c.id)}
                                <option value={c.id}>{c.name}</option>
                            {/each}
                        </select>
                        <p class="text-[10px] text-muted leading-snug">Ohne Kunde = intern. Kundenzuordnung ist später einmalig möglich.</p>
                        <div class="flex gap-2">
                            <button type="submit" class="px-3 py-1.5 text-[12px] bg-accent text-white rounded-lg hover:opacity-90 transition-opacity font-medium">Anlegen</button>
                            <button type="button" class="px-3 py-1.5 text-[12px] text-secondary hover:text-primary transition-colors" on:click={() => addingNewProject = false}>Abbrechen</button>
                        </div>
                    </form>
                </div>
            {/if}

            <!-- Flat project list -->
            <div class="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-[2px]">
                {#each filteredProjects as project (project.id)}
                    {@const total = projectTaskCount(project.id)}
                    {@const done = projectDoneCount(project.id)}
                    {@const open = projectOpenCount(project.id)}
                    {@const tracked = projectTrackedMinutes(project.id)}
                    {@const client = project.clientId ? clientMap.get(project.clientId) : null}
                    {@const pct = total > 0 ? Math.round((done / total) * 100) : 0}
                    {@const today = new Date().toISOString().slice(0, 10)}
                    {@const isOverdue = !!project.deadline && project.status !== 'done' && project.deadline < today}
                    {@const isDueSoon = !!project.deadline && !isOverdue && project.status !== 'done' && project.deadline <= (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })()}
                    <button
                        class="flex flex-col gap-1.5 py-3 px-3 rounded-lg w-full text-left transition-colors hover:bg-surface border border-transparent hover:border-border"
                        on:click={() => { selectedProjectIdStore.set(project.id); projectsViewStore.set('project'); }}
                    >
                        <!-- Row 1: Name + status badge -->
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:{project.color}" />
                            <span class="flex-1 text-[13px] text-primary font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{project.name}</span>
                            <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 {project.status === 'active' ? 'bg-green-100 text-green-700' : project.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}">
                                {project.status === 'active' ? 'Aktiv' : project.status === 'paused' ? 'Pausiert' : 'Abgeschlossen'}
                            </span>
                        </div>

                        <!-- Row 2: Meta info -->
                        <div class="flex items-center gap-3 pl-[18px] flex-wrap">
                            {#if client}
                                <span class="text-[11px] text-muted">{client.name}</span>
                            {:else}
                                <span class="text-[10px] text-muted/50">Intern</span>
                            {/if}
                            {#if open > 0}
                                <span class="text-[11px] text-secondary">{open} offen</span>
                            {/if}
                            {#if total > 0}
                                <span class="text-[11px] text-muted tabular-nums">{done}/{total} erledigt</span>
                            {/if}
                            {#if tracked > 0}
                                <span class="text-[11px] text-muted tabular-nums">⏱ {fmtMinutes(tracked)}</span>
                            {/if}
                            {#if project.deadline}
                                <span class="text-[11px] font-medium {isOverdue ? 'text-red-500' : isDueSoon ? 'text-yellow-600' : 'text-muted'}">
                                    {isOverdue ? '⚠' : '◷'} {new Date(project.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                </span>
                            {/if}
                        </div>

                        <!-- Row 3: Progress bar (only if tasks exist) -->
                        {#if total > 0}
                            <div class="pl-[18px] pr-1">
                                <div class="w-full h-1 bg-border rounded-full overflow-hidden">
                                    <div class="h-full rounded-full transition-all" style="width:{pct}%; background:{project.color}" />
                                </div>
                            </div>
                        {/if}
                    </button>
                {:else}
                    <div class="flex flex-col items-start gap-3 py-8 px-2">
                        <p class="text-[13px] text-muted">
                            {statusFilter === 'active' ? 'Keine aktiven Projekte.' : 'Noch keine Projekte.'}
                        </p>
                        <button
                            class="px-4 py-2.5 border border-dashed border-border rounded-lg text-[13px] text-muted hover:border-accent hover:text-accent transition-colors"
                            on:click={() => { addingNewProject = true; newProjectName = ""; newProjectClientId = ""; }}
                        >+ Erstes Projekt anlegen</button>
                    </div>
                {/each}
            </div>

            <!-- Footer -->
            <div class="px-5 py-3 border-t border-border flex-shrink-0 flex items-center gap-4">
                <button
                    class="text-[11px] text-muted hover:text-secondary transition-colors"
                    on:click={() => projectsViewStore.set("clients")}
                >Kunden verwalten →</button>
            </div>
        </div>

    <!-- ── Projekt-Detail ── -->
    {:else}
        <!-- Back navigation -->
        <div class="px-4 py-2.5 border-b border-border flex-shrink-0 flex items-center gap-2 bg-surface">
            <button
                class="flex items-center gap-1.5 text-[12px] text-secondary hover:text-primary transition-colors"
                on:click={() => { selectedProjectIdStore.set(null); }}
            >‹ Projekte</button>
        </div>

        <div class="flex-1 overflow-y-auto flex flex-col">
            <div
                class="px-6 py-4 border-b border-border flex flex-col gap-3 flex-shrink-0"
            >
                <!-- Client status row -->
                {#if selectedProject.clientId}
                    {@const assignedClient = clients.find(c => c.id === selectedProject.clientId)}
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:{assignedClient?.color ?? '#999'}" />
                        <span class="text-[12px] text-muted">Kunde: <span class="text-primary font-medium">{assignedClient?.name ?? '—'}</span></span>
                        <span class="text-[10px] text-muted/50 ml-auto" title="Die Kundenzuordnung ist dauerhaft und kann nicht geändert werden.">🔒 fix</span>
                    </div>
                {:else}
                    <div class="flex flex-col gap-2">
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Intern</span>
                            {#if !assigningClient}
                                <button
                                    class="text-[11px] text-accent hover:underline transition-colors ml-1"
                                    on:click={() => { assigningClient = true; assignClientId = ""; }}
                                >Kunde zuweisen</button>
                            {/if}
                        </div>
                        {#if assigningClient}
                            <div class="flex flex-col gap-2 p-3 bg-bg rounded-lg border border-amber-200">
                                <select
                                    class="w-full border border-border rounded-md px-2 py-[5px] text-[13px] outline-none bg-surface text-primary focus:border-accent"
                                    bind:value={assignClientId}
                                >
                                    <option value="">Kunden auswählen…</option>
                                    {#each clients as c (c.id)}
                                        <option value={c.id}>{c.name}</option>
                                    {/each}
                                </select>
                                <p class="text-[11px] text-amber-700 leading-snug">Diese Zuordnung ist dauerhaft und kann später nicht mehr geändert werden.</p>
                                <div class="flex gap-2">
                                    <button
                                        class="flex-1 px-3 py-1.5 bg-accent text-white rounded-lg text-[12px] font-medium hover:opacity-90 disabled:opacity-40"
                                        disabled={!assignClientId}
                                        on:click={confirmAssignClient}
                                    >Kunde zuweisen</button>
                                    <button
                                        class="px-3 py-1.5 text-secondary rounded-lg text-[12px] hover:bg-surface transition-colors"
                                        on:click={() => { assigningClient = false; assignClientId = ""; }}
                                    >Abbrechen</button>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                <div class="flex items-center gap-3 min-w-0">
                    <span
                        class="w-3 h-3 rounded-full flex-shrink-0"
                        style="background:{selectedProject.color}"
                    />
                    {#if editingProjectName}
                        <!-- svelte-ignore a11y-autofocus -->
                        <input
                            class="flex-1 px-3 py-2 border border-accent rounded-lg text-sm outline-none bg-surface min-w-0"
                            bind:value={editProjectNameVal}
                            autofocus
                            on:blur={saveProjectName}
                            on:keydown={(e) => {
                                if (e.key === "Enter") saveProjectName();
                                if (e.key === "Escape")
                                    editingProjectName = false;
                            }}
                        />
                    {:else}
                        <!-- svelte-ignore a11y-no-static-element-interactions a11y-click-events-have-key-events -->
                        <h2
                            class="text-base font-semibold text-primary flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 cursor-text hover:bg-bg rounded px-2 py-1 -mx-2 -my-1 transition-colors"
                            on:click={startEditProjectName}
                            title="Klicken zum Bearbeiten"
                        >
                            {selectedProject.name}
                        </h2>
                    {/if}
                    <select
                        class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none text-secondary flex-shrink-0"
                        value={selectedProject.status}
                        on:change={handleStatusSelect}
                    >
                        <option value="active">Aktiv</option>
                        <option value="paused">Pausiert</option>
                        <option value="done">Abgeschlossen</option>
                    </select>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <span class="text-[11px] text-muted">Deadline</span>
                        <input
                            type="date"
                            class="border border-border rounded-md px-2 py-[2px] text-[12px] bg-bg outline-none text-secondary focus:border-accent"
                            value={selectedProject.deadline ?? ''}
                            on:change={handleDeadlineChange}
                        />
                        {#if selectedProject.deadline}
                            <button
                                class="text-[11px] text-muted hover:text-red-500 transition-colors"
                                title="Deadline entfernen"
                                on:click={() => updateProject(selectedProject.id, { deadline: undefined })}
                            >×</button>
                        {/if}
                    </div>
                    <button
                        class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap"
                        on:click={() => (showTemplatePicker = true)}
                        >Template anwenden</button
                    >
                    {#if isTauriAvailable()}
                        <button
                            class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap"
                            on:click={handleGenerateOffer}
                            disabled={offerGenerating}
                            >{offerGenerating ? "..." : "↓ PDF-Angebot"}</button
                        >
                        <button
                            class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors whitespace-nowrap"
                            on:click={handleGenerateReport}
                            disabled={reportGenerating}
                            >{reportGenerating
                                ? "..."
                                : "↓ PDF-Bericht"}</button
                        >
                    {/if}
                    <button
                        class="px-3 py-1 text-secondary rounded-lg text-[13px] hover:bg-gray-100 transition-colors"
                        on:click={startEditProjectName}
                        title="Name bearbeiten">✎</button
                    >
                </div>

                <div class="flex gap-1 flex-wrap">
                    {#each PROJECT_COLORS as c (c)}
                        <button
                            class="w-[18px] h-[18px] rounded-full transition-transform hover:scale-[1.15] {selectedProject.color ===
                            c
                                ? 'ring-2 ring-secondary ring-offset-2'
                                : ''}"
                            style="background:{c}"
                            on:click={() =>
                                updateProject(selectedProject.id, { color: c })}
                            aria-label="Farbe {c}"
                        />
                    {/each}
                </div>
            </div>

            {#if reportMessage}
                <div
                    class="px-6 py-2 text-[13px] text-secondary bg-accent-subtle border-b border-border flex-shrink-0"
                >
                    {reportMessage}
                </div>
            {/if}

            <div
                class="px-6 py-4 border-b border-border-subtle flex-shrink-0 flex flex-col gap-2"
            >
                <span
                    class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                    >Notizen & Fähigkeiten</span
                >
                {#key selectedProject.id}
                    <textarea
                        class="w-full px-3 py-3 border border-border rounded-lg text-[13px] font-mono leading-relaxed resize-y outline-none bg-bg text-primary min-h-[80px] focus:border-accent focus:bg-surface"
                        value={selectedProject.notes ?? ""}
                        on:input={handleNotesInput}
                        placeholder="Tech-Stack, Client-Zugänge, besondere Anforderungen, Code-Snippets..."
                        rows={4}
                    />
                {/key}
            </div>

            <!-- ── Rechnungspositionen ── -->
            <div
                class="px-6 py-4 border-b border-border-subtle flex-shrink-0 flex flex-col gap-2"
            >
                <div class="flex items-center justify-between">
                    <span
                        class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                        >Rechnungspositionen</span
                    >
                    {#if !addingBillingItem}
                        <button
                            class="px-2 py-0.5 text-[11px] font-medium rounded-lg border border-border text-secondary hover:bg-bg hover:text-primary transition-colors"
                            on:click={() => {
                                addingBillingItem = true;
                                billingDraft = emptyBillingDraft();
                            }}>+ Hinzufügen</button
                        >
                    {/if}
                </div>

                {#if addingBillingItem}
                    <div
                        class="flex flex-col gap-2 p-3 rounded-lg border border-accent bg-accent/5"
                    >
                        <div class="flex gap-2">
                            <!-- svelte-ignore a11y-autofocus -->
                            <input
                                class="flex-1 px-2 py-1 border border-border rounded-md text-[13px] outline-none bg-surface focus:border-accent"
                                bind:value={billingDraft.title}
                                placeholder="Bezeichnung..."
                                autofocus
                                on:keydown={(e) => {
                                    if (e.key === "Escape") {
                                        addingBillingItem = false;
                                    }
                                    if (e.key === "Enter") saveBillingItem();
                                }}
                            />
                            <select
                                class="border border-border rounded-md px-2 py-1 text-[12px] bg-bg outline-none text-secondary"
                                bind:value={billingDraft.billingType}
                            >
                                <option value="hourly">Stunden</option>
                                <option value="fixed">Pauschal</option>
                                <option value="unit">Einheit</option>
                            </select>
                            <input
                                class="w-24 px-2 py-1 border border-border rounded-md text-[13px] outline-none bg-surface focus:border-accent"
                                bind:value={billingDraft.unitPriceEuro}
                                placeholder="€ 0.00"
                                type="number"
                                step="0.01"
                            />
                        </div>
                        <div class="flex gap-2">
                            <button
                                class="px-3 py-1 rounded-lg bg-accent text-white text-[12px] font-medium hover:opacity-90 transition-opacity"
                                on:click={saveBillingItem}>Hinzufügen</button
                            >
                            <button
                                class="px-3 py-1 rounded-lg border border-border text-secondary text-[12px] hover:bg-bg transition-colors"
                                on:click={() => {
                                    addingBillingItem = false;
                                    billingDraft = emptyBillingDraft();
                                }}>Abbrechen</button
                            >
                        </div>
                    </div>
                {/if}

                {#if projectBillingItems.length === 0 && !addingBillingItem}
                    <p class="text-[12px] text-muted italic">
                        Keine Rechnungspositionen für dieses Projekt.
                    </p>
                {/if}

                {#each projectBillingItems as item (item.id)}
                    {@const isUnlocked = unlockedIds.includes(item.id)}
                    {@const linkedTaskIds = billingItemTasks
                        .filter((l) => l.billingItemId === item.id)
                        .map((l) => l.taskId)}
                    {@const projectTasks = allTasks.filter(
                        (t) => t.projectId === selectedId,
                    )}
                    <div
                        class="rounded-lg border {isUnlocked
                            ? 'border-green-300 bg-green-50/30'
                            : 'border-border bg-bg'} overflow-hidden"
                    >
                        <button
                            class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface transition-colors"
                            on:click={() => toggleBillingItemExpand(item.id)}
                        >
                            <span
                                class="flex-1 text-[13px] font-medium text-primary truncate"
                                >{item.title}</span
                            >
                            <span
                                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border {item.billingType ===
                                'hourly'
                                    ? 'border-blue-200 text-blue-600 bg-blue-50'
                                    : item.billingType === 'fixed'
                                      ? 'border-purple-200 text-purple-600 bg-purple-50'
                                      : 'border-orange-200 text-orange-600 bg-orange-50'}"
                            >
                                {item.billingType === "hourly"
                                    ? "Stundenbasiert"
                                    : item.billingType === "fixed"
                                      ? "Festpreis"
                                      : "Pauschal"}
                            </span>
                            {#if item.unitPriceCents != null}
                                <span
                                    class="text-[12px] text-secondary font-mono"
                                    >{(item.unitPriceCents / 100).toFixed(2)} €</span
                                >
                            {/if}
                            {#if isUnlocked}
                                <span
                                    class="text-[11px] text-green-600 font-medium"
                                    >✓ Abrechenbar</span
                                >
                            {:else if linkedTaskIds.length > 0}
                                <span class="text-[11px] text-muted"
                                    >{linkedTaskIds.filter(
                                        (id) =>
                                            allTasks.find((t) => t.id === id)
                                                ?.status === "done",
                                    ).length}/{linkedTaskIds.length} Aufgaben erledigt</span
                                >
                            {/if}
                            <span class="text-muted text-[11px]"
                                >{expandedBillingItemId === item.id
                                    ? "▲"
                                    : "▼"}</span
                            >
                        </button>

                        {#if expandedBillingItemId === item.id}
                            <div
                                class="px-3 pb-3 flex flex-col gap-2 border-t border-border"
                            >
                                <p
                                    class="text-[11px] text-muted pt-2 font-medium"
                                >
                                    Verknüpfte Tasks:
                                </p>
                                {#if projectTasks.length === 0}
                                    <p class="text-[12px] text-muted italic">
                                        Keine Tasks in diesem Projekt.
                                    </p>
                                {:else}
                                    <div
                                        class="flex flex-col gap-1 max-h-40 overflow-y-auto"
                                    >
                                        {#each projectTasks as task (task.id)}
                                            {@const linked = isTaskLinked(
                                                item.id,
                                                task.id,
                                            )}
                                            <label
                                                class="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-surface cursor-pointer transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={linked}
                                                    on:change={() =>
                                                        toggleTaskLink(
                                                            item.id,
                                                            task.id,
                                                        )}
                                                    class="accent-accent"
                                                />
                                                <span
                                                    class="flex-1 text-[12px] text-primary truncate"
                                                    >{task.title}</span
                                                >
                                                <span
                                                    class="text-[10px] font-medium flex-shrink-0 {task.status ===
                                                    'done'
                                                        ? 'text-green-600'
                                                        : 'text-muted'}"
                                                    >{task.status === "done"
                                                        ? "erledigt"
                                                        : "offen"}</span
                                                >
                                            </label>
                                        {/each}
                                    </div>
                                {/if}
                                <div class="flex justify-end pt-1">
                                    <button
                                        class="px-2 py-0.5 text-[11px] text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                                        on:click={() => {
                                            removeBillingItem(item.id);
                                            if (
                                                expandedBillingItemId ===
                                                item.id
                                            )
                                                expandedBillingItemId = null;
                                        }}>Position löschen</button
                                    >
                                </div>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>

            <!-- ── Termine ── -->
            <div class="px-6 py-4 border-b border-border-subtle flex-shrink-0 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">Termine</span>
                    <button
                        class="text-[11px] text-muted hover:text-accent transition-colors"
                        on:click={() => addingTerminProject = !addingTerminProject}
                    >+ Termin</button>
                </div>

                {#if addingTerminProject}
                    <form class="flex flex-col gap-2 p-3 bg-bg rounded-lg border border-accent/30" on:submit={handleAddProjectTermin}>
                        <!-- svelte-ignore a11y-autofocus -->
                        <input
                            class="w-full px-2 py-1.5 border border-border rounded-lg text-[12px] outline-none bg-surface focus:border-accent"
                            bind:value={newPTerminTitle}
                            placeholder="Titel des Termins…"
                            autofocus
                        />
                        <div class="flex gap-2 flex-wrap">
                            <select class="border border-border rounded-md px-1.5 py-1 text-[11px] bg-bg outline-none" bind:value={newPTerminType}>
                                <option value="video">📹 Video</option>
                                <option value="phone">📞 Telefon</option>
                                <option value="onsite">🏢 Vor Ort</option>
                            </select>
                            <input type="date" class="border border-border rounded-md px-1.5 py-1 text-[11px] bg-bg outline-none" bind:value={newPTerminDate} />
                            <input type="time" class="border border-border rounded-md px-1.5 py-1 text-[11px] bg-bg outline-none" bind:value={newPTerminTime} />
                            <select class="border border-border rounded-md px-1.5 py-1 text-[11px] bg-bg outline-none" bind:value={newPTerminDuration}>
                                <option value={30}>30 min</option>
                                <option value={45}>45 min</option>
                                <option value={60}>1 h</option>
                                <option value={90}>1,5 h</option>
                                <option value={120}>2 h</option>
                            </select>
                        </div>
                        <label class="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
                            <input type="checkbox" bind:checked={newPTerminBillable} class="accent-accent" />
                            Abrechenbar
                        </label>
                        <div class="flex gap-2">
                            <button type="submit" class="flex-1 px-3 py-1.5 bg-accent text-white rounded-lg text-[12px] font-medium hover:opacity-90">Speichern</button>
                            <button type="button" class="px-3 py-1.5 text-secondary rounded-lg text-[12px] hover:bg-border transition-colors" on:click={() => addingTerminProject = false}>Abbrechen</button>
                        </div>
                    </form>
                {/if}

                {#if projectTermine.length === 0 && !addingTerminProject}
                    <p class="text-[12px] text-muted italic">Noch keine Termine für dieses Projekt.</p>
                {:else}
                    <div class="flex flex-col gap-1">
                        {#each projectTermine as termin (termin.id)}
                            <div class="flex items-center gap-2 group px-2 py-1.5 rounded-lg hover:bg-bg/80">
                                <span class="text-[13px] flex-shrink-0">{TERMIN_TYPE_ICONS[termin.type]}</span>
                                <div class="flex-1 min-w-0">
                                    <span class="text-[12px] text-primary truncate block">{termin.title}</span>
                                    <span class="text-[10px] text-muted">{termin.date} {termin.startTime} · {TERMIN_TYPE_LABELS[termin.type]}{termin.billable ? ' · €' : ''}</span>
                                </div>
                                <button
                                    class="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 text-[13px] transition-all flex-shrink-0"
                                    on:click={() => removeTermin(termin.id)}
                                    title="Termin löschen"
                                >×</button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="min-h-[320px] flex flex-col">
                <KanbanBoard
                    projectId={selectedProject.id}
                    projectColor={selectedProject.color}
                />
            </div>

            <div class="px-6 py-4 border-t border-border-subtle flex-shrink-0">
                <button
                    class="px-3 py-1 text-red-500 border border-red-200 rounded-lg text-[12px] hover:bg-red-50 transition-colors"
                    on:click={() => {
                        if (
                            confirm(
                                `Projekt „${selectedProject?.name}" wirklich löschen?`,
                            )
                        )
                            removeProject(selectedProject.id);
                    }}>Projekt löschen</button
                >
            </div>

            {#if showTemplatePicker}
                <TemplatePickerModal
                    projectId={selectedProject.id}
                    onClose={() => (showTemplatePicker = false)}
                />
            {/if}
        </div><!-- end flex-1 overflow-y-auto -->
    {/if}
</div>