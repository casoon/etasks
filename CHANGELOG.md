# Changelog

All notable changes to eTasks are listed here. eTasks follows
[Semantic Versioning](https://semver.org/): while in 0.x, a minor version may contain breaking changes.

## [Unreleased]

### Added

- **Invoices:** "Aus Projekt übernehmen" adds a client's project billing items as line items; "Erfasste Zeit übernehmen" adds tracked time per project for a date range, priced with the client's hourly rate (fallback: profile rate) and rounded to quarter hours. The task picker shows tracked time instead of estimates.
- **Project templates:** "Als Template speichern" on a project saves its tasks as a custom template; custom templates can be deleted in the template picker.
- **Releases:** every installer ships with a `.sha256` file and a signed build provenance
  attestation. Details: [Verify a download](https://github.com/casoon/etasks#verify-a-download).

### Changed

- **Contributors:** all calls into the Rust core go through `@casoon/origin-client`;
  `ui/src/lib/platform.ts` is the only file that still touches a Tauri webview API.
- **Contributors:** the export snapshot test mocks `coreBridge` again, so CI on `main` is green.

### Removed

- **Releases:** the macOS Intel (`x64`) build; macOS installers are Apple Silicon only.

### Fixed

- **UI:** primary buttons (`bg-accent`) are visible again; the global button reset no longer overrides Tailwind background utilities.
- **Quick add:** opens with Ctrl+K as well as Cmd+K, shows the shortcut for the current platform, and has a "Neue Aufgabe" button in the top bar.
- **Daily close:** Escape and a close button dismiss the dialog without saving, and the summary updates after moving a task to tomorrow.
- **Planning:** task titles in the "Noch einplanen" list stay readable at narrow window widths; the row actions wrap to a second line.
- **UI:** texts that spelled umlauts as ae/oe/ue now use real umlauts.
- **Invoices:** "Gesendet" and "Bezahlt" need a client and at least one line item (dropdown and buttons alike); "PDF erzeugen" no longer changes the status; setting a sent or paid invoice back to "Entwurf" asks first, and sent or paid invoices show a hint when number or date are edited.
- **Dates:** day keys use the local date instead of UTC, so "today", the week start, invoice and offer dates are correct around midnight; the active day follows midnight while the app stays open.
- **Today:** the day plan shows scheduled and tracked times in local time instead of UTC, block heights match their duration, and dragging a block keeps a full timestamp; tasks with a calendar block are no longer drawn twice.
- **Project board:** new cards appear immediately; column contents, counters and collapse state update reactively.
- **Project board:** new cards and applied project templates no longer land in today's plan; dragging a card to or from "Erledigt" sets or clears the completion date, a drop only updates cards whose column or position changed, and the duration dropdown works in card edit mode.
- **Planning:** dropping an already scheduled task on the calendar moves its block instead of creating a second one.
- **Tasks:** deleting a task also removes its calendar blocks and stops a timer running on it; its time entries stay and show as "Gelöschte Aufgabe". "→ morgen" in the daily close removes today's block and clears the top-3 rank.
- **Planning:** auto-plan on the current day starts at the next quarter hour instead of 09:00, never runs past the end of the day, plans on the selected day, and shows a notice for tasks that no longer fit.
- **Recurring tasks:** the template no longer shows up as a normal task in the pool or on the project board; rules with weekdays create their instances, and new instances appear right after start without a reload.
- **Notifications:** the daily close, break and energy-check reminders start on every launch and after switching the workspace, not only after the setup wizard; the daily close reminder fires every day.
- **Focus:** the Pomodoro timer keeps running and notifies at the end while another view is open; "Start" after a finished session begins a fresh one, and the ±5 minute buttons are disabled while the timer runs.
- **Workspaces:** switching the workspace clears the previous workspace's appointments, week plans and export state instead of showing and re-saving them; a failed load is reported instead of silently keeping old data.
- **Backup:** exports, snapshots and imports include appointments and week plans (focus projects, weekly goal note); older backup files without them still import.
- **Backup:** an import writes to the database first and refreshes the UI from it, so a broken file changes nothing; lists missing from the file leave the workspace's data untouched, and the import no longer replaces the workspace meta, the profile or the invoice/offer counters.
- **Backup:** export and snapshot file names contain the workspace, so workspaces no longer overwrite each other; the daily snapshot is also checked after switching the workspace and hourly or on refocus while the app stays open; the iCloud snapshot is only written on macOS and reports failure elsewhere.
- **Persistence:** failed database writes are logged and shown as a "Speichern fehlgeschlagen" toast (once per burst) instead of being swallowed.
- **Workspaces:** the display name is stored in `config.json` and kept on startup and when switching; renaming it sticks. Without a name the folder name is used instead of "etasks.sqlite3".
- **Settings:** saving the "Arbeitsbereich" tab no longer resets the invoice prefix and payment term of the profile; both fields now read and write the profile only.
- **Workspaces:** switching to a workspace whose database file is gone shows an error instead of silently creating an empty one; "Neuen Arbeitsbereich hinzufügen" creates its own subfolder and never reopens or renames an existing workspace.
- **Setup:** "Vorhandene Arbeitsbereiche" also finds workspaces created by the wizard (`Documents/<name>/` and the default workspace folder) and lists them by folder name; the path preview updates while typing the name or changing the location.
- **Invoices:** the net amount is the sum of the rounded line totals; net, VAT per rate and gross are calculated in cents, so the editor and the PDF show the same figures.
- **Invoices:** "PDF erzeugen" produces a PDF again: the invoice dates and the VAT rate per breakdown row are sent in the shape the template reads, the VAT base is the net of that rate, decimal VAT rates are accepted, and a missing bank name or BIC in the profile no longer aborts the PDF.
- **Offers:** the offer PDF shows net, VAT and total; the VAT rate is the profile default (19 % if unset), since project positions have no VAT rate of their own.
- **Invoices:** the invoice editor takes the customer number from the selected client (also when empty) and drops task links when the client changes; "Als gesendet markieren" needs a client and a position; price, quantity and VAT rate are range-checked in the editor, service catalog and project positions; an empty client name is not saved; the header fields have labels.
- **Invoices:** the invoice number counter is kept per workspace (existing workspaces continue from the profile counter, never below an existing number) and handed out one at a time, so a double click no longer creates two invoices with the same number; a duplicate or empty number in the editor blocks PDF and sending; a PDF never overwrites another invoice's file (suffix `-2`, `-3`, …); the number field shows the real format; "Rechnungszähler zurücksetzen" only resets the current workspace.
- **Reports:** the completion date comes from `completedAt` (`updatedAt` only for old tasks without it); tracked time is attributed by the day of the time entry, time on open tasks and on deleted tasks appears, and estimates are shown in their own "Geschätzt" column instead of counting as tracked time. The project PDF lists tracked time per task and counts time of deleted tasks.
- **Clients and projects:** deleting a project or client also deletes its tasks (with calendar blocks), their time entries, billing items with links and appointments, in the database as well; the confirmation lists what goes, invoices are kept (shown under "Ohne Kunde"). Deleting a task removes its billing item links, so the item can become "Abrechenbar"; links to already deleted tasks are ignored. The invoice list no longer fails on invoices of a deleted client.
- **Clients, project notes, invoices:** delayed saves no longer lose input or write into another record: the client form keeps one timer per client and field, project notes and invoice line item texts are bound to their record and saved on blur, when switching and when leaving the view.
- **Project positions:** type labels are the same in the dropdown and the badge (Stundenbasiert, Festpreis, Einheit); positions can be edited after creating them, unit positions take a quantity, and prices show with a decimal comma.
- **Export:** the client CSV uses a decimal comma for hours, starts with a UTF-8 BOM so Excel shows umlauts, and goes to the configured export folder; the project report creates the export folder if it is missing.
- **Logo:** a configured logo now appears in invoice and offer PDFs (instead of failing with "file not found"), the settings preview shows it, and without a logo the PDF has no grey placeholder box. "Logo-Breite" is gone: the template draws the logo at a fixed width.
- **Invoices:** the PDF footer with bank details, phone and email is always printed, the tax number appears under "USt-IdNr.", and the thank-you text from the profile is printed below the greeting; "Anmerkungen" is marked as internal.
- **Profile:** a new profile starts empty instead of with sample data (Max Mustermann, sample IBAN); the examples are only input placeholders. Invoice and offer PDFs need a complete profile (name, email, company, address, tax number, IBAN) and say what is missing; old sample values still in a profile count as missing.
- **Projects:** the internal project notes no longer appear in the offer PDF or the project report; the offer introduction comes from a separate optional "Angebotstext" field.
- **Invoices:** an empty "Projektbezug" stays empty in the PDF instead of printing the client's first project.
- **Offers:** the PDF says "gültig" and the setting "Gültigkeit (Tage)" uses real umlauts; the offer number counter is kept per workspace (starting from the profile counter, only advanced after the PDF was created); the PDF never overwrites an earlier offer (suffix `-2`, `-3`, …); "PDF-Angebot" on an internal project (no client) shows a notice instead of doing nothing, and a missing profile entry is reported.

### Security

- **Dependencies:** `rusqlite` 0.41 bundles SQLite 3.54, which closes RUSTSEC-2026-0459 (a crafted
  database with a mismatched `-wal` file could read uninitialised memory). Building needs Rust 1.89.
