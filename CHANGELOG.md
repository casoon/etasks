# Changelog

All notable changes to eTasks are listed here. eTasks follows
[Semantic Versioning](https://semver.org/): while in 0.x, a minor version may contain breaking changes.

## [Unreleased]

### Added

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
