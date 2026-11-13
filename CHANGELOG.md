# Changelog

All notable changes to eTasks are listed here. eTasks follows
[Semantic Versioning](https://semver.org/): while in 0.x, a minor version may contain breaking changes.

## [Unreleased]

### Added

- **Navigation:** new sidebar with groups (Planen, Arbeiten, Abrechnen), "Neue Aufgabe" button, running-timer pill, open-invoice counter and a "Gesichert" backup status; new Übersicht page and a "Heute" area with the steps Planen, Arbeiten and Abschließen.
- **Heute:** the day header has previous day, "Heute" and next day; the whole day (plan, work, close) follows the chosen date. The running timer with a stop button is shown in the header.
- **Heute · Planen:** the pool is grouped by project with the filters Fokus-Projekte, Alle and Wiederkehrend; the Heute column shows a capacity bar, Top 3 stars and a time slot mark per task.
- **Heute · Planen:** "Automatisch einplanen" first suggests slots (dashed in the list and the calendar) and books them on "Übernehmen".
- **Daily close:** "Abschließen" is a page with the day's balance (ring, tracked, planned, time per project) and the open tasks with "Morgen", "In den Pool" and "Erledigt"; "In den Pool" clears the planned date, the calendar block and the Top 3 rank. The "Highlight des Tages" is pre-filled and shown in Heute.
- **Notifications:** the step bar marks "Abschließen" from the shutdown time; clicking the shutdown notification opens it (browser notifications only).
- **Tasks:** tags can be set when editing a task (double-click, comma-separated); Analytics groups the week's tracked time by the first tag.
- **Appointments:** today's Termine appear in the Tagesplan of Heute and can be edited (title, date, time, duration, type, project, billable) in the Tagesplanung. Billable Termine are listed in Berichte (as "Termin: …") and can be added as one line to an invoice via "Erfasste Zeit übernehmen", priced with the client's hourly rate.
- **Time tracking:** time entries can be edited (task, day, start, end) and deleted in the Zeiterfassung list, and added by hand with "Eintrag hinzufügen".
- **Time tracking:** if a timer was left running (started on an earlier day or open for over 12 hours), the app asks at start whether to stop it now, stop it at a time you enter, or discard it.
- **Time tracking:** the timer button (▶/⏹) is available in Heute, in the Tagesplanung rows and on project board cards. A finished Pomodoro work session records a time entry for the focus task.
- **Invoices:** "Aus Projekt übernehmen" adds a client's project billing items as line items; "Erfasste Zeit übernehmen" adds tracked time per project for a date range, priced with the client's hourly rate (fallback: profile rate) and rounded to quarter hours. The task picker shows tracked time instead of estimates.
- **Project templates:** "Als Template speichern" on a project saves its tasks as a custom template; custom templates can be deleted in the template picker.
- **Releases:** every installer ships with a `.sha256` file and a signed build provenance
  attestation. Details: [Verify a download](https://github.com/casoon/etasks#verify-a-download).

### Changed

- **Dialogs:** Neue Aufgabe, the forgotten-timer dialog, the energy check, the template picker, the toasts, the Pomodoro buttons, the empty state, the setup wizard and the startup problem screens use the new tokens and shared buttons and fields; emoji and Unicode symbols are SVG icons, fields have labels and buttons are at least 44 px.
- **Window:** the minimum window width is 1100 px.
- **Einstellungen:** a sub-navigation (Profil, Rechnungen und Angebote, Tagesablauf, Arbeitsbereiche, Daten und Sicherung) with a state line per entry such as "IBAN fehlt"; all existing fields are kept, now in the form style of the invoice head. "Daten und Sicherung" shows the backup status with "Jetzt sichern", the folder, the last backups with "Wiederherstellen" (Desktop app), the full export and the import from a file.
- **Übersicht:** the start page shows four tiles that link into their areas (Aufgaben heute, Zeit heute, Diese Woche, Offene Rechnungen) and the cards Heute (running task first), Aktive Projekte (progress, deadline mark) and Abrechnung (unpaid invoices, overdue first), with the actions "Tag planen" and "Weiterarbeiten". The app opens on it.
- **Woche:** one page for the week with week navigation: weekly goals with seven day buttons, counter and streak, Fokus-Projekte chips, the "Was soll am Freitag stehen?" note, figures (tracked, done, for customers), bars planned vs. tracked per day (a click opens that day in Heute) and time by project or by category. Weekly goals are editable again (add, mark days, delete).
- **Heute:** "Arbeiten" follows the new layout (intention, Top 3 cards, further tasks, Tagesplan with Geplant/Erfasst and a now line); the Tagesplanung no longer limits "Heute" to five tasks, the capacity bar shows overload instead.
- **Zeiten:** week view with week navigation, the running timer as a dark bar with "Stoppen", tiles for today and the week (with the part for customers), project filter chips, entries grouped by day with day totals, "Eintrag nachtragen" and editing in place. "Als CSV exportieren" saves the shown week and filter. The running entry is highlighted and cannot be edited.
- **Projekte:** the list is a table (status filters with counts, search over project and client, deadline marks yellow within 7 days and red when overdue) with "Vorlagen" and "Neues Projekt". The project page has a path back, a status select, "Angebot als PDF" and "Statusbericht als PDF" (disabled with a note outside the desktop app), a "Mehr" menu (rename, colour, save as template, apply template, delete), a key figures row and the tabs Board, Positionen, Zeiten, Notizen and Details. Zeiten also lists the project's Termine.
- **Board:** cards show duration or tracked time, the Heute mark, the running timer and the backlog age; a column over its limit says so in words; Backlog and Erledigt show five cards until "weitere anzeigen"; the "Spalte" select in the card form moves a card without dragging.
- **Heute:** the day close is a page instead of a dialog.
- **Kunden:** a client list with search (name, contact, customer number) and the selected client on the right: master data in read mode ("Bearbeiten" switches to form fields and saves as you type), three figures (tracked, open invoices, paid), the client's projects and invoices, and the actions "Neue Rechnung", "Neues Projekt" and "Zeiten als CSV".
- **Rechnungen:** a list with the filters Offen, Entwürfe, Gesendet, Bezahlt and Alle, search over number and client, due dates in words and the derived status "Überfällig" (sent and past due). The invoice page has a path back, the flow bar (Daten prüfen, PDF erzeugen, Als gesendet markieren, Bezahlt), line items as a table with "Erfasste Zeit übernehmen", "Aus Projekt übernehmen", "Aus Leistungskatalog" and "Freie Position", and a checklist (client, client address, positions, number, complete profile) next to the total. "PDF erzeugen" stays disabled until the checklist passes and names the reason with a link to fix it.
- **Leistungen:** the catalog is a table grouped by category; editing happens in the row.
- **Berichte:** a filter card (type, quick period, from/to, client, project), figures, a table with a total row and "Als Text kopieren" for both report types. "Rechnung aus diesem Zeitraum erstellen" opens a draft for the client with the period as Leistungszeitraum and the time import already set to that range.
- **Design:** new look "A · Tagesfluss" (flat cards, warm grey background, blue accent, system font instead of Inter until a font file is bundled); gradient, stripe pattern and glass styles are gone.
- **Navigation:** Kunden and Leistungen are own menu items, Rechnungen is the former Abrechnung page; the Fokus (Pomodoro) view opens from "Heute · Arbeiten" via "Fokus".
- **Backup:** the daily snapshot is a local backup, no longer called iCloud: it goes to `Sicherungen` inside the export folder on every platform, keeps the last 14 per workspace and leaves IBAN, tax number and bank data out (the JSON export keeps the full profile). Old files in the former iCloud folder are not touched.
- **Contributors:** all calls into the Rust core go through `@casoon/origin-client`;
  `ui/src/lib/platform.ts` is the only file that still touches a Tauri webview API.
- **Contributors:** the export snapshot test mocks `coreBridge` again, so CI on `main` is green.

### Removed

- **Navigation:** the top bar and the right data rail; export, import and backup stay in Einstellungen › Daten.
- **Settings:** the unused workspace fields "Typ" and "Währung" (documents are always in EUR).
- **Security:** the unused file-system and dialog permissions of the webview and the `tauri-plugin-fs` and `@tauri-apps/plugin-dialog` dependencies; file dialogs and file access stay in the Rust core.
- **Cleanup:** the unused energy check log, the unmounted weekly objectives widget, the unused `open_ics_file` command and the dead card drag in Fokus.
- **Releases:** the macOS Intel (`x64`) build; macOS installers are Apple Silicon only.

### Fixed

- **Build:** the production UI starts again; the manual view/modal chunk split caused a circular chunk and the main view never rendered in release builds.
- **Reports:** the project report PDF shows German status labels (Aktiv, Backlog, Erledigt) instead of raw `active` / `todo`.
- **Profile:** the tax number placeholder no longer suggests `DE123456789`, which counts as a missing legacy sample value for PDFs.
- **Quick add:** the input field keeps typed text instead of being cleared immediately, so tasks can be added again.
- **Backup:** a failing export is reported as an error with the reason instead of "Backup exportiert." (the silent download fallback inside the desktop app is gone), a successful one shows the file path, and the sidebar "Exportieren" now gives that feedback too.
- **Weekly planning:** the outcome note is saved on blur and when leaving the view, for the week it was typed in.
- **Backup:** the import in the right panel asks like the one in Settings, with the number of entries that get replaced; both use the same path. The file is checked first (version, lists, required fields) and an invalid file is rejected before anything is touched. Before importing, the current state is saved to the export folder as `etasks-vor-import-…json`; if that fails, nothing is imported.
- **Navigation:** the sidebar highlight follows every view change, including "Fokus starten", "Tag planen" and "Zur Tagesplanung".
- **Analytics:** the weekly figures (completion rate, planned time, tracked time) only count the calendar week Monday–Sunday instead of everything planned from Monday on, "Zeit pro Kategorie" shows tracked time instead of estimates, and "Diese Woche" in Zeiterfassung uses the same calendar week.
- **Appointments:** the day grid widens for Termine before 06:00 or after 20:00 instead of drawing them outside the grid.
- **Reports:** time on a deleted task keeps its project and client in the report table and the client report.
- **Board:** dropping a card no longer changes the "updated" time of cards that only moved position, so old done cards stay out of today's report and the backlog age is kept. "Heute einplanen" (board) and pulling a task scheduled on another day into Heute also remove its calendar block; calendar blocks left over from deleted or unscheduled tasks are cleaned up at start.
- **Recurring tasks:** a generated instance that is removed from "Heute" or deleted does not come back at the next start; the template remembers which days were generated. New instances are also created at midnight while the app is open, and templates no longer count as open tasks in project progress, delete confirmations, the billing item task picker and the project report.
- **Time tracking:** entries are stored to the second; short sessions no longer round to 0 min and sums, reports, invoices import and CSV add up exact seconds. The running timer shows a live clock, appears as "läuft" in the day list and counts in the totals.
- **Time tracking:** switching the timer to another task refreshes the task times; marking a task done stops its running timer.
- **Daily close:** "Zeit heute" uses the local day and includes the running timer.
- **Analytics:** the week's tracked time follows the local week start.
- **UI:** primary buttons (`bg-accent`) are visible again; the global button reset no longer overrides Tailwind background utilities.
- **Quick add:** opens with Ctrl+K as well as Cmd+K, shows the shortcut for the current platform, and has a "Neue Aufgabe" button in the top bar.
- **Daily close:** Escape and a close button dismiss the dialog without saving, and the summary updates after moving a task to tomorrow.
- **Planning:** task titles in the "Noch einplanen" list stay readable at narrow window widths; the row actions wrap to a second line.
- **UI:** texts that spelled umlauts as ae/oe/ue now use real umlauts.
- **Texts:** the invoice list and editor show dates as dd.mm.yyyy, the "Projektbezug" placeholder uses a neutral example, the counter reset option no longer shows literal backticks, and the Pomodoro task list only offers today's open tasks (plus the focused one).
- **Invoices:** the invoice counter is kept in the browser mode as well (including "Rechnungszähler zurücksetzen"), and Settings → Arbeitsbereich has a "Nächste Rechnungsnummer" field to set the start value, never below an already issued number.
- **Setup:** "Eigener Projektordner" creates the workspace in its own subfolder like "Neuer Arbeitsbereich" and never reuses or renames an existing one; a workspace already in the chosen folder can be opened as it is. Workspaces directly in the default folder show up under existing workspaces.
- **Settings:** empty or decimal number fields in the profile no longer block saving; values are checked before saving with a message at the field, the save error and "Gespeichert ✓" appear next to the button, and saving the Arbeitsbereich tab keeps unsaved profile edits. Older `config.json` files missing newer fields load again.
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

- **App:** the webview runs under a restrictive Content Security Policy (own files only, no frames or plugins; IPC and data/blob images allowed) instead of none.
- **Dependencies:** `rusqlite` 0.41 bundles SQLite 3.54, which closes RUSTSEC-2026-0459 (a crafted
  database with a mismatched `-wal` file could read uninitialised memory). Building needs Rust 1.89.
- **Configuration:** `config.json` is written atomically and the last good file is kept as `config.json.bak`. A damaged file is no longer replaced by defaults: the backup is restored automatically, otherwise an error screen offers a fresh setup. If the database of the last workspace is missing at start, "Arbeitsbereich nicht gefunden" offers the other workspaces instead of resetting the setup.
- **Database:** SQLite waits up to 5 s for a locked database instead of failing at once, a schema version (`user_version`) with ordered migrations is in place, deleting a billing item and saving a day plan are transactional (a day plan with a known id and a new date no longer fails), unreadable rows are skipped instead of reaching the UI as `null`, and a panic in one command no longer blocks all others. Writes still in flight are finished before a workspace switch and none are sent during it, so data of one workspace cannot land in another.
- **Logging (Windows):** the log file is written next to the open database by the Rust side, so Windows paths no longer end up in `./app.log` relative to the working directory; the workspace name in the sidebar fallback also handles `\`.
- **Export and PDFs:** file names of exports, invoices, offers and project reports are cleaned for Windows (no `: * ? " < > |`, no reserved device names, no trailing dots, limited length), so an invoice prefix like `RE:` no longer creates a broken file. Project reports and exports no longer overwrite an existing file but get a `-2`, `-3` suffix; a re-created invoice still replaces its own previous PDF. The backend rejects export file names with path separators or `..`, and `db_open` only opens `etasks.sqlite3`, known workspaces or database files under the workspace folders.
- **Project report:** project names with Typst special characters (`]`, `[`, `#`, `$`, `*`, `_`, `@`, a trailing `\`, even Typst code) are escaped, so the PDF is created and shows the name literally instead of failing or running the markup.
- **CSV export:** cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return are prefixed with `'` so Excel does not run them as formulas (numbers stay numeric); cells containing a carriage return are quoted.
