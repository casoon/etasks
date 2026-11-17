---
title: Installation
description: Woher eTasks kommt, wie ein Download geprüft wird und was macOS beim ersten Start meldet.
order: 1
---

## Stand: noch kein Release

Bisher gibt es keinen Git-Tag und keinen Release von eTasks. Die Installer entstehen im Release-Workflow
des Repositories, sobald ein Versions-Tag gesetzt wird. Bis dahin bleibt der Weg
[aus dem Quellcode](../../entwicklung/selbst-bauen/).

## Wo Installer herkommen werden

Offizielle Installer gibt es nur in den
[GitHub Releases von `casoon/etasks`](https://github.com/casoon/etasks/releases), gebaut vom
Release-Workflow und nie auf einem Entwicklerrechner. Für einen Tag wie `v0.1.0-alpha.1` sind nach der README
diese Dateien vorgesehen:

| Datei | Plattform |
| --- | --- |
| `eTasks_0.1.0-alpha.1_aarch64.dmg` | macOS, Apple Silicon |
| `eTasks_0.1.0-alpha.1_x64_en-US.msi` | Windows, Installer |
| `eTasks_0.1.0-alpha.1_x64-setup.exe` | Windows, NSIS |

macOS-Installer gibt es nur für Apple Silicon; ein Build für Intel-Macs wurde entfernt. Für Linux ist kein
fertiges Artefakt vorgesehen.

## Download verifizieren

Zu jeder Datei gehört eine `.sha256`-Datei und eine signierte Build-Provenance-Attestation. Beides lässt sich
prüfen, sobald ein Release vorliegt:

```sh
shasum -a 256 -c <datei>.sha256
gh attestation verify <datei> --repo casoon/etasks
```

## macOS: App ohne Apple-Zertifikat öffnen

Die Releases sind ad-hoc signiert, hinter ihnen steht kein kostenpflichtiges Apple-Entwicklerkonto.
macOS warnt deshalb beim ersten Start. Drei Wege führen weiter:

1. Rechtsklick auf die App, **Öffnen** wählen und bestätigen.
2. In den Systemeinstellungen unter **Datenschutz & Sicherheit** auf **Trotzdem öffnen** gehen.
3. Im Terminal die Quarantäne-Markierung entfernen:

```sh
xattr -cr /Applications/eTasks.app
```

Nach dem ersten Start öffnet sich die App normal.
