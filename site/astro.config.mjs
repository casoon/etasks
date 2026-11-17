// @ts-check
import casoonPages from '@casoon/pages-theme';
import { defineConfig } from 'astro/config';

// Project page: https://casoon.github.io/etasks/ — `base` is the GitHub Pages path.
// No custom domain yet: etasks.de will point here later.
export default defineConfig({
  site: 'https://casoon.github.io/etasks',
  base: '/etasks/',
  integrations: [
    casoonPages({
      name: 'eTasks',
      description:
        'Desktop-App für Tagesplanung, Zeiterfassung und Projekte: Planen, Messen und Abrechnen in einem lokalen Datenbestand. Kein Account, kein Sync, keine Telemetrie.',
      tagline: 'Tagesplanung und Zeiterfassung, lokal',
      repo: 'casoon/etasks',
      version: '0.1.0-alpha.1',
      license: 'MIT',
      lang: 'de',
      showcase: false,
      catalog: 'etasks',
      docsGroups: {
        'erste-schritte': 'Erste Schritte',
        'arbeiten-mit-etasks': 'Arbeiten mit eTasks',
        'rechnungen-und-daten': 'Rechnungen und Daten',
        entwicklung: 'Entwicklung',
        hilfe: 'Hilfe',
      },
    }),
  ],
});
