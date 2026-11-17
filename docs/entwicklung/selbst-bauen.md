---
title: Selbst bauen
description: Voraussetzungen, Befehle und der Nachbarordner renderreport, den der Build braucht.
order: 1
---

Solange es keinen Release gibt, ist der Quellcode der Weg zur App. Aufgebaut ist sie aus einem Rust-Backend
(Tauri v2) und einer Oberfläche aus Astro 6 und Svelte 4.

## Voraussetzungen

- [Node.js](https://nodejs.org) 22 oder neuer
- [Rust](https://rustup.rs) (stable); das gebündelte SQLite in `rusqlite` 0.41 verlangt Rust 1.89
- die [Tauri-CLI](https://tauri.app/start/prerequisites/) in Version 2: `cargo install tauri-cli --version "^2"`
- [renderreport](https://github.com/casoon/renderreport) als **Nachbarverzeichnis** des Repositories

```text
GitHub/
├── etasks/         ← dieses Repository
└── renderreport/   ← wird für die PDF-Berichte gebraucht
```

## Einrichten und starten

```sh
npm install --prefix ui
cargo tauri dev
```

`cargo tauri dev` startet den Astro-Dev-Server auf Port 4321 und öffnet das Tauri-Fenster.

## Bauen

```sh
cargo tauri build
```

Das erzeugt ein natives macOS-`.app`-Bundle unter `src-tauri/target/release/bundle/`.

## Tests

```sh
npm test
```

Die Tests laufen mit vitest in `ui/`.

## Aufbau des Repositories

| Ordner | Inhalt |
| --- | --- |
| `src-tauri/` | Rust-Backend: Datenbank, Export und Sicherung, Benachrichtigungen, PDF über renderreport |
| `ui/src/components/` | Svelte-Komponenten |
| `ui/src/domain/` | reine Fachlogik mit Tests |
| `ui/src/lib/` | Dienste für Export, Berichte und Speicher |
| `ui/src/stores/` | Zustand mit nanostores |
| `assets/` | das App-Symbol |

## Release

Release-Builds starten bei einem Versions-Tag (zum Beispiel `v0.1.0-alpha.1`) im Release-Workflow und laden
die Installer samt `.sha256`-Datei und Attestation zu den GitHub Releases hoch.
Siehe [Installation](../../erste-schritte/installation/).
