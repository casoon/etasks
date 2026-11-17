---
title: Häufige Fragen
description: Antworten zu Daten, Geräten, Downloads, PDFs und Lizenz.
order: 2
---

## Wo liegen meine Daten?

In einer SQLite-Datenbank je Arbeitsbereich auf dem eigenen Rechner. Es gibt keinen Account, keinen
Server und keine Telemetrie. Siehe [Daten und Sicherung](../../rechnungen-und-daten/daten-und-sicherung/).

## Kann ich auf zwei Geräten arbeiten?

Nicht über einen Sync. Der Weg auf einen zweiten Rechner führt über den vollständigen JSON-Export und den
Import dort.

## Gibt es schon einen Download?

Noch nicht. Es existiert bisher kein Release. Die App lässt sich [aus dem Quellcode
bauen](../../entwicklung/selbst-bauen/).

## Warum warnt macOS beim ersten Start?

Die Releases sind ad-hoc signiert, weil kein kostenpflichtiges Apple-Entwicklerkonto dahintersteht.
Rechtsklick und **Öffnen**, die Freigabe in den Systemeinstellungen oder `xattr -cr` helfen; Details unter
[Installation](../../erste-schritte/installation/#macos-app-ohne-apple-zertifikat-öffnen).

## Wie entstehen die PDFs?

Lokal über renderreport, eine Rust-Engine auf Basis von Typst. Es wird nichts an einen Dienst im Netz
geschickt, und das PDF ist kein Ausdruck aus dem Browser.

## Plant die App meinen Tag allein?

Nein. Die automatische Planung schlägt Zeitfenster vor und bucht erst, wenn du **Übernehmen** wählst.

## Was kostet eTasks?

Nichts. Die App ist MIT-lizenziert, der Quellcode liegt öffentlich auf GitHub.
