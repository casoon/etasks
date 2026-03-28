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
        removeProject,
    } from "../stores/projectStore";
    import { $tasks as tasksStore } from "../stores/taskStore";
    import { $timeEntries as timeEntriesStore } from "../stores/timerStore";
    import { $projectsView as projectsViewStore } from "../stores/uiStore";
    import {
        $appConfig as appConfigStore,
        saveAppConfig,
    } from "../stores/configStore";
    import { toast } from "../stores/toastStore";
    import { PROJECT_COLORS } from "../domain/types";
    import {
        $billingItems as billingItemsStore,
        $billingItemTasks as billingItemTasksStore,
        $unlockedBillingItemIds as unlockedBillingItemIdsStore,
        addBillingItem,
        updateBillingItem,
        removeBillingItem,
        linkTaskToBillingItem,
        unlinkTaskFromBillingItem,
    } from "../stores/billingStore";
    import { isTauriAvailable } from "../lib/platform";
    import {
        buildProjectReportInput,
        generateProjectReport,
    } from "../lib/reportService";
    import { generateOffer, type OfferData } from "../lib/offerService";
    import KanbanBoard from "./KanbanBoard.svelte";
    import TemplatePickerModal from "./TemplatePickerModal.svelte";
    import RecurringTasksPanel from "./RecurringTasksPanel.svelte";
    import ClientManager from "./ClientManager.svelte";
    import ServiceCatalog from "./ServiceCatalog.svelte";

    $: clients = $clientsStore;
    $: projects = $projectsStore;
    $: selectedId = $selectedProjectIdStore;
    $: selectedProject = $selectedProjectStore;
    $: allTasks = $tasksStore;
    $: allTimeEntries = $timeEntriesStore;
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
                allTasks,
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

    // Tabs
    type Tab = "projects" | "recurring";
    let activeTab: Tab = "projects";

    // Right panel view – driven by global store (TopBar switch)
    $: rightView = $projectsViewStore;

    // Add client
    let addingClientSource: "left" | "right" | null = null;
    $: addingClient = addingClientSource !== null;
    let newClientName = "";

    // Add project
    let addingProjectForClient: string | null = null;
    let newProjectName = "";

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

    function handleAddProject(e: Event, clientId: string) {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        const project = addProject(clientId, newProjectName.trim());
        selectedProjectIdStore.set(project.id);
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

<div
    class="flex-1 grid overflow-hidden"
    style="grid-template-columns: 240px 1fr"
>
    <!-- Left panel -->
    <div class="border-r border-border flex flex-col overflow-hidden">
        <div class="flex items-center gap-[2px] p-4 flex-shrink-0">
            <button
                class="flex-1 px-2 py-1 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap {activeTab ===
                'projects'
                    ? 'bg-accent-subtle text-accent'
                    : 'text-secondary hover:bg-bg hover:text-primary'}"
                on:click={() => (activeTab = "projects")}>Projekte</button
            >
            <button
                class="flex-1 px-2 py-1 text-[12px] font-medium rounded-lg transition-colors whitespace-nowrap {activeTab ===
                'recurring'
                    ? 'bg-accent-subtle text-accent'
                    : 'text-secondary hover:bg-bg hover:text-primary'}"
                on:click={() => (activeTab = "recurring")}>↺ Wiederholt</button
            >
        </div>

        <!-- ── Wiederholt ── -->
        {#if activeTab === "recurring"}
            <div class="px-3 overflow-y-auto flex-1">
                <RecurringTasksPanel />
            </div>

            <!-- ── Projekte list ── -->
        {:else}
            <div
                class="flex items-center justify-between px-4 pb-2 flex-shrink-0"
            >
                <span class="text-[11px] text-muted">&nbsp;</span>
                <button
                    class="w-6 h-6 flex items-center justify-center rounded-lg text-muted text-lg hover:bg-bg hover:text-primary transition-colors"
                    on:click={() => (addingClientSource = "left")}
                    title="Neuer Kunde">+</button
                >
            </div>
            <div class="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-1">
                {#if clients.length === 0 && !addingClient}
                    <p class="text-[13px] text-muted leading-relaxed px-2 py-4">
                        Noch keine Kunden. Füge deinen ersten Kunden hinzu.
                    </p>
                {/if}

                {#each clients as client (client.id)}
                    {@const cp = projects.filter(
                        (p) => p.clientId === client.id,
                    )}
                    <div class="flex flex-col gap-[1px] mb-3">
                        <div class="flex items-center gap-2 px-2 py-1 mb-[2px]">
                            <span
                                class="w-2 h-2 rounded-full flex-shrink-0"
                                style="background:{client.color}"
                            />
                            {#if editingClientId === client.id}
                                <!-- svelte-ignore a11y-autofocus -->
                                <input
                                    class="flex-1 px-2 py-1 border border-accent rounded-lg text-[13px] outline-none bg-surface min-w-0"
                                    bind:value={editClientNameVal}
                                    autofocus
                                    on:blur={() => {
                                        if (editClientNameVal.trim())
                                            updateClient(client.id, {
                                                name: editClientNameVal.trim(),
                                            });
                                        editingClientId = null;
                                    }}
                                    on:keydown={(e) => {
                                        if (
                                            e.key === "Enter" ||
                                            e.key === "Escape"
                                        )
                                            editingClientId = null;
                                    }}
                                />
                            {:else}
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <span
                                    class="text-[12px] font-semibold text-secondary flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 cursor-default"
                                    on:dblclick={() => {
                                        editingClientId = client.id;
                                        editClientNameVal = client.name;
                                    }}
                                >
                                    {client.name}
                                </span>
                            {/if}
                            <button
                                class="w-[18px] h-[18px] flex items-center justify-center rounded-lg text-muted text-sm hover:bg-bg hover:text-primary transition-colors flex-shrink-0"
                                on:click={() => {
                                    addingProjectForClient = client.id;
                                    newProjectName = "";
                                }}
                                title="Neues Projekt">+</button
                            >
                        </div>

                        {#each cp as project (project.id)}
                            {@const total = projectTaskCount(project.id)}
                            {@const done = projectDoneCount(project.id)}
                            <button
                                class="flex items-center gap-2 py-[6px] px-2 pl-6 rounded-lg w-full text-left transition-colors min-w-0 {selectedId ===
                                project.id
                                    ? 'bg-accent-subtle'
                                    : 'hover:bg-bg'}"
                                on:click={() =>
                                    selectedProjectIdStore.set(project.id)}
                            >
                                <span
                                    class="w-2 h-2 rounded-full flex-shrink-0"
                                    style="background:{project.color}"
                                />
                                <span
                                    class="flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap min-w-0 {selectedId ===
                                    project.id
                                        ? 'text-accent font-medium'
                                        : 'text-primary'}">{project.name}</span
                                >
                                {#if total > 0}<span
                                        class="text-[11px] text-muted whitespace-nowrap flex-shrink-0"
                                        >{done}/{total}</span
                                    >{/if}
                                <span
                                    class="w-[6px] h-[6px] rounded-full flex-shrink-0 {project.status ===
                                    'active'
                                        ? 'bg-success'
                                        : project.status === 'paused'
                                          ? 'bg-yellow-400'
                                          : 'bg-gray-300'}"
                                />
                            </button>
                        {/each}

                        {#if addingProjectForClient === client.id}
                            <form
                                class="py-1 pl-6 pr-2"
                                on:submit={(e) =>
                                    handleAddProject(e, client.id)}
                            >
                                <!-- svelte-ignore a11y-autofocus -->
                                <input
                                    class="w-full px-2 py-[5px] border border-accent rounded-lg text-[13px] outline-none bg-surface"
                                    bind:value={newProjectName}
                                    placeholder="Projektname..."
                                    autofocus
                                    on:keydown={(e) => {
                                        if (e.key === "Escape")
                                            addingProjectForClient = null;
                                    }}
                                />
                            </form>
                        {/if}
                    </div>
                {/each}

                {#if addingClientSource === "left"}
                    <form class="py-1" on:submit={handleAddClient}>
                        <!-- svelte-ignore a11y-autofocus -->
                        <input
                            class="w-full px-2 py-[5px] border border-accent rounded-lg text-[13px] outline-none bg-surface"
                            bind:value={newClientName}
                            placeholder="Kundenname..."
                            autofocus
                            on:keydown={(e) => {
                                if (e.key === "Escape")
                                    addingClientSource = null;
                            }}
                        />
                    </form>
                {/if}
            </div>
        {/if}
    </div>

    <!-- Right panel -->
    <div class="flex flex-col overflow-hidden">
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

            <!-- ── Projekte detail ── -->
        {:else if !selectedProject}
            <div
                class="flex-1 flex items-center justify-center text-muted text-sm"
            >
                <p>Wähle ein Projekt aus oder lege ein neues an.</p>
            </div>
        {:else}
            <div
                class="px-6 py-4 border-b border-border flex flex-col gap-3 flex-shrink-0"
            >
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
                        <!-- svelte-ignore a11y-no-static-element-interactions -->
                        <h2
                            class="text-base font-semibold text-primary flex-1 overflow-hidden text-ellipsis whitespace-nowrap min-w-0 cursor-default"
                            on:dblclick={startEditProjectName}
                            title="Doppelklick zum Bearbeiten"
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
                <label
                    class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                    >Notizen & Fähigkeiten</label
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
                    <label
                        class="text-[11px] font-bold uppercase tracking-[0.07em] text-muted"
                        >Rechnungspositionen</label
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
                                    ? "Std."
                                    : item.billingType === "fixed"
                                      ? "Pauschal"
                                      : "Einheit"}
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
                                    ).length}/{linkedTaskIds.length} erledigt</span
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
                                                    class="flex-1 text-[12px] text-primary truncate {task.status ===
                                                    'done'
                                                        ? 'line-through text-muted'
                                                        : ''}"
                                                    >{task.title}</span
                                                >
                                                {#if task.status === "done"}
                                                    <span
                                                        class="text-[10px] text-green-600 font-medium"
                                                        >✓</span
                                                    >
                                                {/if}
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

            <div class="flex-1 overflow-hidden flex flex-col">
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
        {/if}
    </div>
</div>
