---
title: Überblick
description: Was eTasks ist, wo die App aufhört und wie diese Dokumentation aufgebaut ist.
order: 0
---

eTasks ist eine Desktop-App für die Tagesplanung, die Zeiterfassung und die Verwaltung von Projekten,
Kunden und Rechnungen. Sie läuft lokal: Die Daten liegen in einer SQLite-Datenbank auf dem eigenen
Rechner, es gibt keinen Account, keinen Sync und keine Telemetrie. Gebaut ist sie mit Tauri v2, Astro 6
und Svelte 4.

eTasks steht in einer frühen Alpha (`0.1.0-alpha.1`). Es gibt noch keinen veröffentlichten Release.

## Was die App abdeckt

- **Planen:** Aufgaben mit Zeitschätzung, der Tag als Ablauf aus Planen, Arbeiten und Abschließen, ein
  Kalender mit Zeitblöcken und die Woche mit Zielen und Fokus-Projekten.
- **Messen:** ein Timer je Aufgabe, Zeiteinträge zum Nachtragen und Auswertungen von geplanter gegen
  erfasster Zeit.
- **Abrechnen:** Kunden mit Stundensatz, Rechnungen und Angebote als PDF, Statusberichte zu Projekten
  und der CSV-Export je Kunde.

## Wo sie aufhört

eTasks ist für eine Person auf einem Gerät gedacht und ersetzt keine Buchhaltung. Die vollständige Liste
steht unter [Grenzen](hilfe/grenzen/).

## So ist die Dokumentation aufgebaut

- **Erste Schritte:** [Installation](erste-schritte/installation/) und der
  [erste Start](erste-schritte/erster-start/).
- **Arbeiten mit eTasks:** die [Funktionen](arbeiten-mit-etasks/funktionen/) im Überblick.
- **Rechnungen und Daten:** [Rechnungen und Angebote](rechnungen-und-daten/rechnungen-und-angebote/) sowie
  [Daten und Sicherung](rechnungen-und-daten/daten-und-sicherung/).
- **Entwicklung:** die App [selbst bauen](entwicklung/selbst-bauen/).
- **Hilfe:** [Grenzen](hilfe/grenzen/) und [häufige Fragen](hilfe/faq/).
