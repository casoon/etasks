# eTasks

A local-first productivity desktop app for focused daily planning, time tracking, and project management. Built with Tauri, Astro, and Svelte — no cloud required.

## Features

**Daily Planning**
- Task list for today with duration estimates and progress bar
- Drag tasks into the calendar for visual timeboxing
- Auto-scheduling: fills free time slots automatically
- Board view (Kanban) as an alternative to the day view

**Calendar & Time Tracking**
- Day view with drag-and-drop scheduling
- Per-task timer with time entry history
- ICS import for external calendar events
- Analytics: tracked vs. planned time per week/category

**Projects & Clients**
- Project management with Kanban board per project
- Client management with hourly rate and billing overview
- CSV export per client for invoicing
- Project templates for recurring setups
- **PDF status reports** generated locally via [renderreport](https://github.com/casoon/renderreport)

**Focus & Planning**
- Pomodoro timer bound to tasks
- Weekly objectives with task linking
- Guided morning planning and daily shutdown workflow
- Recurring tasks (daily / weekly / monthly)

**Data & Privacy**
- All data stored locally in IndexedDB — no account, no sync, no telemetry
- Daily JSON snapshots to iCloud (macOS)
- Full JSON export/import at any time

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) |
| Frontend framework | [Astro 5](https://astro.build) + [Svelte 4](https://svelte.dev) |
| State management | [nanostores](https://github.com/nanostores/nanostores) |
| PDF report engine | [renderreport](https://github.com/casoon/renderreport) (Rust + Typst) |
| Storage | IndexedDB (localStorage abstraction) |
| Tests | [vitest](https://vitest.dev) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 22+
- [Rust](https://rustup.rs) (stable)
- [Tauri CLI](https://tauri.app/start/prerequisites/): `cargo install tauri-cli --version "^2"`
- [renderreport](https://github.com/casoon/renderreport) cloned as a sibling directory:

```
GitHub/
├── etasks/         ← this repo
└── renderreport/   ← required for PDF reports
```

### Setup

```bash
# Install frontend dependencies
npm install --prefix ui

# Install root dependencies (optional — no longer needed with Tauri)
# Generate app icons (already committed, only needed after icon changes)
npm run icons
```

### Development

```bash
cargo tauri dev
```

Starts the Astro dev server on port 4321 and opens the Tauri window.

### Build

```bash
cargo tauri build
```

Produces a native macOS `.app` bundle in `src-tauri/target/release/bundle/`.

### Tests

```bash
npm test
# or
npm run test --prefix ui
```

## Project Structure

```
etasks/
├── src-tauri/               # Tauri Rust backend
│   ├── src/
│   │   ├── commands/
│   │   │   ├── export.rs    # File export, iCloud sync, ICS file dialog
│   │   │   ├── notification.rs
│   │   │   └── report.rs    # PDF generation via renderreport
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── capabilities/
│   └── tauri.conf.json
├── ui/                      # Astro + Svelte frontend
│   └── src/
│       ├── components/      # Svelte UI components
│       ├── domain/          # Pure domain logic + tests
│       ├── lib/             # Services (export, ICS, reports, storage)
│       ├── stores/          # nanostores state
│       └── styles/          # Global CSS
└── assets/
    └── icon.svg
```

## CI

GitHub Actions runs on every push to `main`:

- **Test & Build UI** — installs deps, runs vitest, builds Astro
- **Rust Check** — `cargo check` against the full Tauri + renderreport dependency tree

## License

MIT
