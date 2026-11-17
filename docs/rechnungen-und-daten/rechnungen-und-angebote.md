---
title: Rechnungen und Angebote
description: Vom Entwurf über die Prüfliste zum PDF, von der erfassten Zeit zur Position, und welche Zähler und Regeln gelten.
order: 1
---

Rechnungen und Angebote entstehen in der App und werden lokal als PDF erzeugt, über renderreport und
Typst. Es geht nichts an einen Dienst im Netz. eTasks ist keine Buchhaltung: Zahlungsabgleich und Steuer
bleiben im Buchhaltungswerkzeug, und die Rechnung gehört vor dem Versand geprüft.

## Statusfluss

Die Rechnungsseite führt durch vier Schritte:

1. **Daten prüfen**
2. **PDF erzeugen**
3. **Als gesendet markieren**
4. **Bezahlt**

Der Status **Überfällig** wird abgeleitet: eine gesendete
Rechnung nach dem Fälligkeitsdatum. Er ist kein eigener Schritt. **Gesendet** und **Bezahlt** brauchen einen
Kunden und mindestens eine Position. Eine gesendete oder bezahlte Rechnung auf **Entwurf** zurückzusetzen
fragt nach.

Die Liste filtert nach Offen, Entwürfen, Gesendet, Bezahlt und Alle, sucht in Nummer und Kunde und nennt
Fälligkeiten in Worten.

## Prüfliste vor dem PDF

Neben der Summe steht eine Prüfliste: Kunde, Kundenadresse, Positionen, Nummer und ein vollständiges
Profil. **PDF erzeugen** bleibt deaktiviert, bis sie erfüllt ist, und nennt den Grund samt Link zur
Stelle, an der er sich beheben lässt. Ein PDF überschreibt nie die Datei einer anderen Rechnung: bei
gleichem Namen hängt die App `-2`, `-3` und so weiter an.

## Positionen

Positionen entstehen auf vier Wegen:

- **Erfasste Zeit übernehmen:** die erfasste Zeit je Projekt für einen Datumsbereich, bepreist mit dem
  Stundensatz des Kunden (ersatzweise dem des Profils) und auf Viertelstunden gerundet.
- **Aus Projekt übernehmen:** die Abrechnungspositionen eines Projekts.
- **Aus Leistungskatalog:** Einträge aus dem Katalog unter Leistungen.
- **Freie Position.**

Abrechenbare Termine lassen sich ebenfalls als eine Zeile übernehmen, bepreist mit dem Stundensatz des
Kunden. Die Nettosumme ist die Summe der gerundeten Zeilenbeträge; Netto, Umsatzsteuer je Satz und Brutto
werden in Cent gerechnet, sodass Editor und PDF dieselben Zahlen zeigen.

## Nummern und Zähler

Der Rechnungszähler gilt je Arbeitsbereich und wird nacheinander vergeben, ein Doppelklick erzeugt also
keine zwei gleichen Nummern. Eine doppelte oder leere Nummer blockiert PDF und Versand. Den Startwert setzt
das Feld **Nächste Rechnungsnummer** unter **Einstellungen › Arbeitsbereich**, nie unter eine bereits
vergebene Nummer. Angebote haben einen eigenen Zähler je Arbeitsbereich.

## Angebote

Ein Angebot entsteht vom Projekt aus über **Angebot als PDF**. Es zeigt Netto, Umsatzsteuer und Gesamtsumme.
Der Steuersatz ist der Standardsatz aus dem Profil (19 %, wenn keiner gesetzt ist), weil Projektpositionen
keinen eigenen Satz haben. Der Einleitungstext kommt aus dem optionalen Feld „Angebotstext“, die Gültigkeit aus der
Einstellung „Gültigkeit (Tage)“. Interne Projektnotizen erscheinen nie im Angebot.

## Statusbericht

Der Statusbericht eines Projekts ist ein PDF mit den Aufgaben und der erfassten Zeit je Aufgabe, auch der
Zeit auf gelöschten Aufgaben.
