---
title: Daten und Sicherung
description: Wo eTasks Daten speichert, wie die lokale Sicherung funktioniert und was Export und Import prüfen.
order: 2
---

## Wo die Daten liegen

Jeder Arbeitsbereich hat eine SQLite-Datenbank (`etasks.sqlite3`), die die App über `rusqlite` anspricht.
Der Browser-Speicher (`localStorage`) dient nur als Cache der Oberfläche, er ist nicht die Quelle der
Daten. Die Einstellungen der Arbeitsbereiche stehen in einer `config.json`; die App schreibt sie atomar und
behält die letzte gute Fassung als `config.json.bak`. Ist die Datei beschädigt, stellt die App die
Sicherung selbst wieder her, sonst bietet ein Fehlerbildschirm eine neue Einrichtung an. Es gibt keinen
Account, keinen Server und keine Telemetrie.

## Lokale Sicherung

Die App legt täglich einen JSON-Schnappschuss in den Ordner `Sicherungen` im Exportordner. Pro Arbeitsbereich
bleiben die letzten 14 erhalten. Bank- und Steuerdaten (IBAN, Steuernummer) fehlen in dieser Sicherung; der
vollständige JSON-Export enthält das ganze Profil. Das ist eine lokale Sicherung, keine Cloud-Sicherung.

Unter **Einstellungen › Daten und Sicherung** stehen:

- der Status der Sicherung, auch als „Gesichert“ in der Seitenleiste,
- **Jetzt sichern**,
- der Ordner und die letzten Sicherungen, jeweils mit **Wiederherstellen** (in der Desktop-App),
- der vollständige Export und der Import aus einer Datei.

Schlägt ein Export fehl, meldet die App den Fehler mit Grund; ein erfolgreicher nennt den Dateipfad.

## Import: erst prüfen, dann ersetzen

Der Import fragt vorher nach und nennt die Zahl der Einträge, die ersetzt werden.

1. **Die Datei wird geprüft** (Version, Listen, Pflichtfelder). Eine ungültige Datei wird abgewiesen, bevor
   etwas verändert wird.
2. **Ein Sicherheitsabzug** des aktuellen Stands landet im Exportordner als `etasks-vor-import-…json`.
   Schlägt das fehl, wird nichts importiert.
3. Erst dann ersetzt der Import die Daten, zuerst in der Datenbank, danach aktualisiert sich die Oberfläche
   daraus. Listen, die in der Datei fehlen, lassen die Daten des Arbeitsbereichs unberührt. Ältere
   Sicherungsdateien ohne Termine und Wochenpläne lassen sich weiterhin importieren.

Arbeitsbereichs-Metadaten, Profil und die Zähler für Rechnungen und Angebote ersetzt der Import nicht.

## Auf ein zweites Gerät

Es gibt keinen Sync. Der Weg auf einen zweiten Rechner führt über den vollständigen JSON-Export und den
Import dort.
