---
title: Funktionen
description: Die Bereiche von eTasks im Überblick, von Heute über Woche und Zeiten bis zu Projekten und Kunden.
order: 1
---

Die Seitenleiste gliedert die App in drei Gruppen: **Planen**, **Arbeiten** und **Abrechnen**.
Darüber stehen die **Übersicht**, der Button **Neue Aufgabe**, ein Chip für den laufenden Timer und
unten der Status der Sicherung. Aufnahmen der App stehen auf der [Startseite](../../../#ansicht).

## Übersicht

Die Startseite der App: vier Kacheln (Aufgaben heute, Zeit heute, Diese Woche, Offene Rechnungen), darunter
die Karten Heute, Aktive Projekte und Abrechnung. Die Aktionen **Tag planen** und **Weiterarbeiten**
führen direkt in die Arbeit.

## Heute

Der Tag läuft in drei Schritten, und der ganze Tag folgt dem gewählten Datum (vorheriger Tag, Heute,
nächster Tag).

- **Planen:** der Pool ist nach Projekten gruppiert und lässt sich nach Fokus-Projekten, allen Aufgaben
  oder wiederkehrenden filtern. Die Spalte Heute zeigt einen Kapazitätsbalken, die Top 3 mit Sternen und
  die Zeitfenster. Aufgaben lassen sich in den Kalender ziehen.
- **Automatisch einplanen:** schlägt zuerst Zeitfenster vor (gestrichelt in Liste und Kalender) und bucht
  sie erst bei **Übernehmen**. Am aktuellen Tag beginnt die Planung zur nächsten Viertelstunde und läuft
  nicht über das Tagesende hinaus; Aufgaben, die nicht mehr passen, meldet die App.
- **Arbeiten:** Intention des Tages, die Top 3, weitere Aufgaben und der Tagesplan mit geplanter und
  erfasster Zeit samt Jetzt-Linie.
- **Abschließen:** eine eigene Seite mit der Bilanz (Ring, erfasst, geplant, Zeit je Projekt) und den
  offenen Aufgaben mit **Morgen**, **In den Pool** und **Erledigt**. Das Highlight des Tages ist
  vorbelegt.

Termine des Tages erscheinen im Tagesplan und lassen sich dort bearbeiten (Titel, Datum, Zeit, Dauer, Art,
Projekt, abrechenbar).

## Woche

Eine Seite für die Kalenderwoche mit Wochennavigation: Wochenziele mit sieben Tagesknöpfen, Zähler und
Serie, Fokus-Projekte, die Notiz „Was soll am Freitag stehen?“, Kennzahlen, Balken von geplanter gegen
erfasster Zeit je Tag und die Zeit nach Projekt oder Kategorie. Ein Klick auf einen Tag öffnet ihn unter
Heute.

## Zeiten

Die Zeiterfassung zeigt die Woche mit dem laufenden Timer, Kacheln für heute und die Woche, Filter nach
Projekt und Einträge nach Tagen gruppiert. Einträge lassen sich nachtragen, bearbeiten und löschen. Der
Timer ist an Heute, den Tagesplan-Zeilen und den Karten im Board erreichbar. Wurde ein Timer
vergessen (am Vortag gestartet oder über 12 Stunden offen), fragt die App beim Start, ob sie ihn jetzt, zu
einer genannten Zeit oder gar nicht stoppen soll. **Als CSV exportieren** speichert die angezeigte Woche.

## Projekte

Die Projektliste ist eine Tabelle mit Statusfiltern, Suche und Fristen, die innerhalb von sieben Tagen
gelb und überfällig rot markiert sind. Ein Projekt hat die Reiter Board, Positionen, Zeiten, Notizen und
Details.

- Das **Board** ist ein Kanban mit Karten, die Dauer oder erfasste Zeit, die Heute-Markierung und den
  laufenden Timer zeigen. Karten lassen sich ziehen oder über das Feld „Spalte“ verschieben.
- **Vorlagen:** ein Projekt lässt sich als Vorlage speichern und später auf ein neues Projekt anwenden.
- **PDF:** vom Projekt aus entstehen ein Angebot und ein Statusbericht als PDF, lokal über renderreport.
  Außerhalb der Desktop-App sind die Knöpfe deaktiviert und sagen es.

## Fokus

Ein Pomodoro-Timer, gebunden an eine Aufgabe, geöffnet über **Fokus** in Heute · Arbeiten. Eine beendete
Arbeitsphase schreibt einen Zeiteintrag für die Fokus-Aufgabe.

## Schnell erfassen und Wiederkehrendes

- **Quick add** öffnet mit `Cmd+K` (macOS) oder `Ctrl+K`.
- **Wiederkehrende Aufgaben** gelten für gewählte Wochentage. Die App erzeugt die Instanzen beim Start und um
  Mitternacht, solange sie läuft; eine entfernte Instanz kommt nicht zurück.
- **Tags** lassen sich beim Bearbeiten einer Aufgabe setzen (kommagetrennt); die Auswertung gruppiert die
  erfasste Wochenzeit nach dem ersten Tag.

## Kunden, Leistungen, Berichte

- **Kunden:** Liste mit Suche, Stammdaten (**Bearbeiten** speichert beim Tippen), drei Kennzahlen (erfasst,
  offene Rechnungen, bezahlt), die Projekte und Rechnungen des Kunden sowie **Zeiten als CSV**. Das CSV
  verwendet ein Dezimalkomma und beginnt mit einer UTF-8-BOM, damit Excel Umlaute zeigt.
- **Leistungen:** ein Katalog als Tabelle, nach Kategorien gruppiert.
- **Berichte:** Filter nach Art, Zeitraum, Kunde und Projekt, Summen und **Als Text kopieren**.
  **Rechnung aus diesem Zeitraum erstellen** öffnet einen Entwurf mit dem Zeitraum als
  Leistungszeitraum.

Rechnungen und Angebote sind [eigens beschrieben](../../rechnungen-und-daten/rechnungen-und-angebote/).
