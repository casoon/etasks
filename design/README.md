# eTasks – Oberflächenstand „A · Tagesfluss“ (Design-Übergabe)

Stand: 2026-11-13. Dieser Ordner ist die Übergabe des neuen Oberflächenstands an die Technik.
Er beschreibt Zielstruktur, Screens, Tokens und die Stellen, an denen das Design etwas voraussetzt,
das der Code heute nicht liefert. Umgesetzt ist davon im Code noch nichts.

Die Entwürfe sind nicht gerendert gegengeprüft worden. Wo Entwurf und diese Beschreibung
voneinander abweichen, gilt diese Beschreibung; bei Unklarheit zurück an die Design-Runde.

## Inhalt

| Datei | Zweck |
|---|---|
| `README.md` | Diese Spezifikation |
| `tokens.css` | Farb-, Typo-, Abstands- und Radius-Tokens, passend zur Host-Token-Schicht in `ui/src/styles/global.css` |
| `screens/*.dc.html` | Quelltext der Entwürfe, ein Screen pro Datei |

Die `.dc.html`-Dateien sind HTML mit Inline-Styles. Sie laufen nur in der Design-Leinwand
(`./support.js` gehört zur Leinwand, nicht ins Repo), sind aber als Vorlage direkt lesbar:
Struktur, Maße, Farben und Texte stehen im Markup. `<dc-import name="Sidebar">` bindet
`Sidebar.dc.html` ein; `{{…}}` sind Platzhalter, die im `<script>`-Block am Dateiende berechnet werden.
Alle Namen, Beträge und Zeiten in den Entwürfen sind erfundene Beispieldaten.

Leinwand (privat): https://claude.ai/artifact/SzCdUnEEKmQuAf4HefzUYy

## 1. Leitlinien

1. Der Tag ist ein Ablauf, kein Menüpunkt: **Planen → Arbeiten → Abschließen** auf einem Screen.
2. Jeder Bereich hat genau einen Ort. Kunden, Rechnungen und Leistungen tauchen nicht mehr doppelt auf.
3. Von oben nach unten: Übersicht → Bereichsliste → Detail. Jedes Detail hat oben links einen Zurück-Pfad.
4. Timer und „Neue Aufgabe“ sind von jedem Screen aus erreichbar.
5. Sperren erklären sich selbst: Ein deaktivierter Knopf nennt daneben den Grund und den Weg zur Lösung.
6. Echte Bedienelemente (`button`, `a`, `input` mit `label`), Klickflächen mindestens 44 px, Text mindestens 4,5:1 Kontrast. Icons als SVG, keine Unicode-Zeichen oder Emoji.

## 2. Navigation: Ist → Soll

Seitenleiste (232 px), Reihenfolge und Gruppen wie in `screens/Sidebar.dc.html`:

| Gruppe | Eintrag | Screen-Datei | Bisher (`NavItem`) | Bisherige Komponenten |
|---|---|---|---|---|
| – | Übersicht | `Uebersicht` | neu | – |
| Planen | Heute | `Heute-Planen`, `Main`, `Heute-Abschliessen` | `planning-daily`, `today`, Modal | `DailyPlanningView`, `TodayView`, `ShutdownModal` |
| Planen | Woche | `Woche` | `planning-weekly` | `WeeklyPlanningView` + `AnalyticsView` |
| Arbeiten | Projekte | `Projekte`, `Projekt-Detail` | `projects` | `ProjectsView`, `KanbanBoard` |
| Arbeiten | Zeiten | `Zeiten` | `time-tracking` | `TimeTrackingView` |
| Abrechnen | Kunden | `Kunden` | `projects`/`clients` (Umschalter) | `ClientManager` |
| Abrechnen | Rechnungen | `Rechnungen`, `Rechnung` | `clients` | `ClientsView`, `InvoiceList`, `InvoiceEditor` |
| Abrechnen | Leistungen | `Leistungen` | `projects`/`clients` (Umschalter) | `ServiceCatalog` |
| Abrechnen | Berichte | `Berichte` | `report` | `ReportView` |
| unten | Einstellungen | `Einstellungen` | `settings` | `SettingsView`, `SettingsDatenSection`, `SettingsArbeitsbereichSection` |

Was aus der Shell verschwindet:

- **`TopBar.astro`** entfällt. Das Datum steht im Seitenkopf von „Heute“, „Neue Aufgabe“ in der Seitenleiste, der Umschalter Projekte/Kunden/Leistungen wird durch eigene Menüpunkte ersetzt (`$projectsView` wird überflüssig).
- **`RightPanel.astro`** (Daten-Leiste) entfällt. Export, Import und „Jetzt sichern“ liegen nur noch unter Einstellungen › Daten und Sicherung.
- **Seitenleiste unten:** „Exportieren“ und „Abschluss“ entfallen. Stattdessen eine Statuszeile „Gesichert · heute 08:02“ (Zeitpunkt des letzten Snapshots).
- **Menüpunkt „Fokus“** entfällt als eigener Bereich. Der Pomodoro-Timer bleibt als Funktion erhalten; sein neuer Ort ist noch nicht entworfen (siehe Abschnitt 7).

Vorschlag für den Routing-Typ:

```ts
export type NavItem =
  | "overview" | "today" | "week"
  | "projects" | "time"
  | "clients" | "invoices" | "services" | "reports"
  | "settings";

export type TodayPhase = "plan" | "work" | "close";   // eigener Atom, z. B. $todayPhase
```

Detailansichten (Projekt, Rechnung, gewählter Kunde) bleiben wie heute über einen ausgewählten Datensatz
gesteuert (`$selectedProjectId` usw.), bekommen aber einheitlich den Zurück-Pfad aus Abschnitt 4.

## 3. Screens

Jeder Screen besteht aus Seitenleiste + Inhaltsbereich (Innenabstand 20 px oben, 32 px seitlich, 28 px unten).
Seitenkopf: Titel 24 px/700, darunter eine Zeile Kontext in 13 px, rechts die Hauptaktionen.

### Übersicht (`Uebersicht.dc.html`)
Startseite nach dem Öffnen. Vier Kacheln (Aufgaben heute, Zeit heute, Diese Woche, Offene Rechnungen),
jede ist ein Link in ihren Bereich. Darunter drei Karten: Heute (Aufgaben des Tages, laufende zuerst),
Aktive Projekte (Fortschritt, Deadline-Hinweis), Abrechnung (offene Rechnungen plus Hinweis auf nicht abgerechnete Zeit).
Kopfaktionen: „Tag planen“ und „Weiterarbeiten“.

### Heute (drei Schritte)
Gemeinsamer Kopf: Datum als Titel, Tageswechsel (zurück, „Heute“, vor), darunter die Schrittleiste.
Erledigte Schritte zeigen einen grünen Haken, der aktive ist weiß hinterlegt. Alle drei sind jederzeit anklickbar.

- **1 Planen (`Heute-Planen.dc.html`)** ersetzt `DailyPlanningView`. Drei Spalten: Pool (nach Projekt gruppiert, Filter Fokus-Projekte/Alle/Wiederkehrend, Pfeil-Knopf plant für heute ein), Heute (Kapazitätsbalken, Stern für Top 3, Zeitslot-Marke oder „ohne Zeitslot“, „Automatisch einplanen“), Kalender (Stundenraster, „+ Termin“). Hauptaktion „Tag starten“ wechselt zu Schritt 2.
- **2 Arbeiten (`Main.dc.html`)** ersetzt `TodayView`. Links Intention, Top 3 als Karten, weitere Aufgaben als Liste, jeweils mit Timer-Knopf; rechts der Tagesplan mit Geplant (umrandet, linke Hälfte) und Erfasst (gefüllt, rechte Hälfte) plus Jetzt-Linie. Im Kopf der laufende Timer mit Stopp-Knopf.
- **3 Abschließen (`Heute-Abschliessen.dc.html`)** ersetzt `ShutdownModal` als Seite. Links Tagesbilanz (Ring, erfasst/geplant/abrechenbar, Zeit nach Projekt), rechts offene Aufgaben mit „Morgen“, „In den Pool“, „Erledigt“, darunter das Highlight des Tages. „Tag abschließen“ führt zur Übersicht.

Der Abschluss wird ab der eingestellten Abschlusszeit in der Schrittleiste hervorgehoben; die Benachrichtigung öffnet Schritt 3.

### Woche (`Woche.dc.html`)
Führt `WeeklyPlanningView` und `AnalyticsView` zusammen. Links Wochenziele (je Ziel sieben Tagesknöpfe Mo–So, Zähler, Serie),
Fokus-Projekte als umschaltbare Chips, Feld „Was soll am Freitag stehen?“ (`WeekPlan.outcomeNote`).
Rechts drei Kennzahlen, Balken Geplant/Erfasst je Tag (Klick auf einen Tag öffnet diesen Tag in „Heute“), Zeit nach Projekt.
„Zeit pro Kategorie“ (nach erstem Tag) ist im Entwurf nicht enthalten; falls weiter gewünscht, als Umschalter Projekt/Kategorie an der unteren Karte.

### Projekte (`Projekte.dc.html`, `Projekt-Detail.dc.html`)
Liste als Tabelle: Projekt (Farbe, offene Aufgaben), Kunde, Fortschritt, Erfasst, Deadline. Filter Aktiv/Pausiert/Abgeschlossen/Alle, Suche,
Aktionen „Vorlagen“ und „Neues Projekt“. Deadline-Marken: gelb bei höchstens 7 Tagen, rot bei überfällig (Logik wie heute in `ProjectsView`).

Detail: Zurück-Pfad „Projekte / Kunde / Projekt“, Titel mit Statusauswahl, PDF-Aktionen, Mehr-Menü (Name, Farbe, Als Vorlage speichern, Vorlage anwenden, Löschen).
Kennzahlenzeile, dann Reiter:

| Reiter | Inhalt (heute alles auf einer Seite in `ProjectsView`) |
|---|---|
| Board | `KanbanBoard`, vier Spalten, „In Arbeit“ mit Limit, Karten mit Dauer, Alter im Backlog, Heute-Marke |
| Positionen | Rechnungspositionen des Projekts (`BillingItem`) |
| Zeiten | Zeiteinträge des Projekts (gefilterte Sicht von „Zeiten“) |
| Notizen | interne Notizen |
| Details | Kunde (Zuordnung einmalig), Deadline, Farbe, Angebotstext |

Nur der Reiter „Board“ ist gezeichnet. Die anderen folgen dem Listen- und Formularmuster aus Abschnitt 4.

### Zeiten (`Zeiten.dc.html`)
Wochenweise. Oben der laufende Timer als dunkle Leiste, drei Kacheln (Heute, Diese Woche, Noch nicht abgerechnet),
Projektfilter als Chips, CSV-Export, darunter Einträge nach Tag gruppiert mit Tagessumme. Zeile: Aufgabe, Projekt, Von–Bis, Dauer, Bearbeiten/Löschen.
Der laufende Eintrag ist blau hinterlegt und hat keine Bearbeiten-Aktionen. „Eintrag nachtragen“ öffnet dieselbe Zeile im Bearbeitungszustand.

### Kunden (`Kunden.dc.html`)
Links Kundenliste mit Suche, rechts der gewählte Kunde: Stammdaten, drei Kennzahlen, seine Projekte, seine Rechnungen.
Aktionen „Neue Rechnung“, „Neues Projekt“, „Bearbeiten“, „Zeiten als CSV“. Stammdaten sind im Lesezustand gezeichnet;
„Bearbeiten“ schaltet die Felder in Formularfelder um (Muster wie im Rechnungskopf).

### Rechnungen (`Rechnungen.dc.html`, `Rechnung.dc.html`)
Liste mit Statusfilter (Offen, Entwürfe, Gesendet, Bezahlt, Alle), Suche, Spalten Nummer, Kunde, Datum, Fällig, Status, Betrag brutto.
Darüber ein Hinweis auf nicht abgerechnete Zeit mit direkter Aktion.

Editor: Zurück-Pfad, Nummer + Statusmarke, Ablaufleiste (Daten prüfen → PDF erzeugen → Als gesendet markieren → Bezahlt).
Links Rechnungskopf und Positionen als Tabelle mit den drei Übernahme-Aktionen (Erfasste Zeit, Aus Projekt, Aus Leistungskatalog) und „+ Freie Position“.
Rechts Summe und eine Prüfliste; fehlt etwas, ist „PDF erzeugen“ deaktiviert und der Grund steht darunter mit Link zur Behebung.
Die Prüfliste bildet die vorhandenen Regeln ab (`sendBlockedReason`, `numberProblem`, vollständiges Profil).

### Leistungen (`Leistungen.dc.html`)
Katalog als Tabelle, nach Kategorie gruppiert. Bearbeiten geschieht in der Zeile (eine Zeile ist im Bearbeitungszustand gezeichnet).

### Berichte (`Berichte.dc.html`)
Filterkarte: Berichtsart, Zeitraum-Schnellwahl, Von/Bis, Kunde, Projekt. Kennzahlenzeile, Tabelle mit Summenzeile,
Aktionen „Als Text kopieren“ und „Als PDF speichern“. Unten der Übergang in eine Rechnung für denselben Zeitraum.

### Einstellungen (`Einstellungen.dc.html`)
Eigene Unternavigation links: Profil, Rechnungen und Angebote, Tagesablauf, Arbeitsbereiche, Daten und Sicherung.
Jeder Eintrag zeigt in der zweiten Zeile seinen Zustand (z. B. „IBAN fehlt“). Gezeichnet ist „Daten und Sicherung“:
Status der Sicherung mit „Jetzt sichern“, Ordner, Liste der letzten Sicherungen mit „Wiederherstellen“, vollständiger Export, Import.
Die anderen vier Bereiche übernehmen die vorhandenen Felder aus `SettingsView` im Formularmuster des Rechnungskopfs.

## 4. Wiederkehrende Bausteine

| Baustein | Regel | Vorlage |
|---|---|---|
| Seitenkopf | Titel 24/700, Kontextzeile 13 px, Aktionen rechts; höchstens eine gefüllte Hauptaktion | alle Screens |
| Zurück-Pfad | Zeile über dem Titel: Pfeil + Bereich (Link), „/“, aktueller Datensatz fett | `Projekt-Detail`, `Rechnung` |
| Knöpfe | Höhe 44 (in Zeilen 36–40); gefüllt Blau = Hauptaktion, weiß mit Rand = Nebenaktion, blauer Rand = hervorgehobene Nebenaktion, roter Text = löschen | – |
| Umschalter | graue Schiene (`--et-track`), aktives Segment weiß mit leichtem Schatten | Schrittleiste, Statusfilter |
| Chips | Höhe 36, voll gerundet; aktiv dunkel gefüllt | Pool-Filter, Projektfilter |
| Karte | weiß, Rand 1 px, Radius 14 (Kacheln 12), kein Schatten | – |
| Listenzeile | min. 48–68 px hoch, Trennlinie oben, ganze Zeile klickbar, Pfeil rechts wenn sie in ein Detail führt | `Projekte`, `Rechnungen` |
| Kachel | Etikett 12 px Versalien, Wert 22–26/700, eine Zeile Erklärung; als Link, wenn sie in einen Bereich führt | `Uebersicht`, `Zeiten` |
| Statusmarke | 12/600, Radius 6: neutral (Entwurf), blau (Gesendet/läuft), grün (Bezahlt/erledigt), gelb (bald fällig, fehlt), rot (überfällig) | – |
| Projektfarbe | Punkt 8 px oder Quadrat 10–12 px vor dem Namen; nie als alleiniger Informationsträger | – |
| Timer-Knopf | rund 32–36 px mit Play-Symbol; laufend: blaue Pille „läuft“ mit Stopp-Symbol | `Main` |
| Formularfeld | Label 12/600 über dem Feld, Feld 44 px, Rand `--et-border-strong`, Radius 9 | `Rechnung` |
| Hinweis | gestrichelter Rand für Erklärtexte, blaue Fläche für Handlungsangebote | `Projekte`, `Rechnungen` |

Zustände, die für jeden Baustein umzusetzen sind: Hover (Fläche `--et-surface-sunken`), Tastaturfokus (2 px Ring `--et-accent`, 2 px Abstand),
gedrückt, deaktiviert (Fläche `--et-border-strong`, Text `--et-text-2`, `cursor: not-allowed`), leer (siehe Abschnitt 7).

## 5. Gestaltung

Werte stehen in `tokens.css`. Kurzfassung:

- **Schrift:** Inter (400/500/600/700) mit Systemschrift als Rückfall; Zahlen in Tabellen und Timern mit `font-variant-numeric: tabular-nums`. Inter lokal einbinden, die App lädt nichts aus dem Netz (CSP).
- **Grund:** warmes Hellgrau, weiße Karten. Der Farbverlauf, das Streifenmuster und die Glas-Klassen (`glass-shell`, `glass-sidebar`, `glass-rail`, `glass-card`) aus `global.css` entfallen.
- **Akzent:** ein Blau (`#2456D6`) für Hauptaktionen, aktive Navigation und Links. Grün nur für „erledigt/gesichert“, Gelb für „bald/fehlt“, Rot für „überfällig/löschen“.
- **Dunkelmodus:** nicht entworfen. Die Tokens sind so benannt, dass er später ergänzt werden kann.
- **Bewegung:** Seitenwechsel wie bisher (`pageReveal`), sonst keine neuen Animationen.

Breiten: Der Entwurf ist auf 1440 × 900 gezeichnet. Der Inhaltsbereich ist fließend; Spalten haben Mindestbreiten und brechen darunter um,
breite Tabellen scrollen in ihrem Rahmen. Mindestfensterbreite der App bitte prüfen (Empfehlung: 1100 px).

## 6. Was die Technik dafür liefern muss

Reihenfolge nach Abhängigkeit, nicht nach Aufwand.

1. **Routing und Shell.** `NavItem` wie oben, `$todayPhase`, `Sidebar.astro` neu, `TopBar.astro` und `RightPanel.astro` entfernen, `App.svelte` auf die neuen Routen umstellen. Tests in `lib/navigation.test.ts` anpassen.
2. **Tokens.** `tokens.css` in die Host-Token-Schicht von `global.css` übernehmen, Glas- und Verlaufsstile entfernen.
3. **Timer in der Shell.** Der laufende Timer (`timerStore`) ist auf „Heute“ im Kopf und auf „Zeiten“ als Leiste gezeichnet. Entscheidung offen, ob er auf allen Screens im Kopf erscheinen soll (Empfehlung: ja, gleiche Pille wie in `Main`).
4. **Heute als ein Bereich.** `DailyPlanningView`, `TodayView` und `ShutdownModal` unter einem Rahmen mit gemeinsamem Kopf und Schrittleiste. Die Abschluss-Benachrichtigung setzt `$todayPhase = "close"` statt `$showShutdown`.
5. **„In den Pool“ im Abschluss.** Neue Aktion: `plannedDate` leeren, Kalenderblock entfernen, Top-3-Rang löschen (analog zu „→ morgen“ in `ShutdownModal`).
6. **Auto-Plan als Vorschlag.** `autoPlanRemainingTasks` liefert zuerst Vorschläge, die im Kalender gestrichelt erscheinen und bestätigt werden. Wenn das zu aufwendig ist: wie bisher direkt einplanen und den gestrichelten Zustand weglassen.
7. **Nicht abgerechnete Zeit.** Wird auf Übersicht, Zeiten, Kunden, Projekt, Rechnungen und Berichte angezeigt. Heute übernimmt `invoiceImport.ts` Zeit nur über einen Datumsbereich, ohne die Einträge zu markieren. Nötig ist eine Zuordnung Zeiteintrag/Termin → Rechnungsposition (z. B. `invoiceLineItemId` am `TimeEntry` und am `Termin`, oder eine Verknüpfungstabelle wie `BillingItemTask`), samt Migration. Ohne diese Zuordnung müssen die Hinweise entfallen.
8. **Status „Überfällig“.** Abgeleitet: `status === "sent" && dueDate < heute`. Kein neues Feld. Die Seitenleisten-Zahl an „Rechnungen“ zählt gesendete, noch nicht bezahlte Rechnungen.
9. **Rechnungsvorschau.** Der Knopf „Vorschau“ im Editor setzt ein PDF ohne Speichern oder eine HTML-Vorschau voraus. Wenn nicht vorgesehen, Knopf weglassen.
10. **Berichte als PDF.** Heute gibt es „Als Text kopieren“ und das Projekt-PDF. „Als PDF speichern“ für den gefilterten Bericht wäre neu (renderreport).
11. **Sicherungsliste.** „Letzte Sicherungen“ mit „Wiederherstellen“ braucht einen Befehl, der die Snapshots im Ordner `Sicherungen` auflistet; das Wiederherstellen läuft über den vorhandenen Importpfad (`restoreFromBackupFile`).
12. **Kundenkürzel.** Die zwei Buchstaben im Farbquadrat werden aus dem Namen abgeleitet, kein neues Feld.

Punkte, die an der Modulgrenze reiben (siehe `arch/core-vs-modules.md`): Die Übersicht liest aus allen Modulen und gehört damit nicht in `@core`;
die Kundenansicht zeigt Rechnungen (Variante C aus `arch/open-questions.md`, Einbettung über Slot).

## 7. Noch nicht entworfen

- Dialog „Neue Aufgabe“ (⌘K / Strg+K) im neuen Look
- Fokus-Modus mit Pomodoro (Idee: Vollflächen-Ansicht aus „Heute · Arbeiten“ heraus, angelehnt an Richtung C)
- Leerzustände für den ersten Start (kein Kunde, kein Projekt, keine Aufgabe) und der Setup-Assistent
- Projekt-Reiter Positionen, Zeiten, Notizen, Details
- Einstellungen: Profil, Rechnungen und Angebote, Tagesablauf, Arbeitsbereiche
- Dialoge für Löschen, veralteten Timer (`StaleTimerDialog`), Energie-Abfrage, Vorlagenauswahl, Terminbearbeitung
- Wiederkehrende Aufgaben verwalten (im Pool als Filter angedeutet)
- Dunkelmodus

Die verworfenen Richtungen B (Cockpit) und C (Fokus) liegen nur auf der Leinwand, nicht in diesem Ordner.
