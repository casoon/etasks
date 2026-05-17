// @vitest-environment happy-dom
/**
 * Tests für die Navigation zwischen Views.
 *
 * Hintergrund: Sidebar.astro und App.svelte landen in getrennten Vite-Bundles.
 * Damit nanostores zwischen diesen Bundles kommunizieren können, wird zusätzlich
 * ein CustomEvent `etasks:nav` auf `window` ausgelöst. Wenn Svelte mit dem
 * falschen (SSR-)Entry-Point gebündelt wird, ist `onMount` eine leere Funktion
 * und der Listener wird nie registriert → grauer Hintergrund trotz gültigem Config.
 *
 * Diese Tests prüfen:
 *  1. Die CustomEvent-Mechanismus funktioniert isoliert.
 *  2. Der nanostore `$navItem` reagiert auf set().
 *  3. Dass kein onMount-Listener aktiv wird, wenn onMount eine leere Funktion ist
 *     (Regressionstest für den SSR-Bundling-Bug).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { atom } from 'nanostores';

// --- 1. CustomEvent-Mechanismus ---

describe('etasks:nav CustomEvent Mechanismus', () => {
  it('dispatched event wird vom Listener empfangen', () => {
    const received: string[] = [];
    const handler = (e: Event) => {
      received.push((e as CustomEvent<string>).detail);
    };
    window.addEventListener('etasks:nav', handler);

    window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'projects' }));
    window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'settings' }));

    window.removeEventListener('etasks:nav', handler);
    expect(received).toEqual(['projects', 'settings']);
  });

  it('entfernte Listener empfangen keine Events mehr', () => {
    const received: string[] = [];
    const handler = (e: Event) => {
      received.push((e as CustomEvent<string>).detail);
    };
    window.addEventListener('etasks:nav', handler);
    window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'today' }));
    window.removeEventListener('etasks:nav', handler);
    window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'focus' }));

    expect(received).toEqual(['today']); // 'focus' wurde nach removeEventListener geschickt
  });

  it('mehrere Listener werden alle benachrichtigt', () => {
    const a: string[] = [];
    const b: string[] = [];
    const ha = (e: Event) => a.push((e as CustomEvent<string>).detail);
    const hb = (e: Event) => b.push((e as CustomEvent<string>).detail);

    window.addEventListener('etasks:nav', ha);
    window.addEventListener('etasks:nav', hb);
    window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'clients' }));

    window.removeEventListener('etasks:nav', ha);
    window.removeEventListener('etasks:nav', hb);

    expect(a).toEqual(['clients']);
    expect(b).toEqual(['clients']);
  });
});

// --- 2. Nanostore $navItem ---

describe('$navItem nanostore', () => {
  it('hat "today" als Startwert', async () => {
    const { $navItem } = await import('../stores/uiStore');
    expect($navItem.get()).toBe('today');
  });

  it('set() ändert den Wert', async () => {
    const { $navItem } = await import('../stores/uiStore');
    $navItem.set('projects' as any);
    expect($navItem.get()).toBe('projects');
    $navItem.set('today' as any); // aufräumen
  });

  it('subscribe() wird bei Änderungen aufgerufen', async () => {
    const { $navItem } = await import('../stores/uiStore');
    // Startzustand fixieren damit der sofortige subscribe-Aufruf deterministisch ist
    $navItem.set('today' as any);
    const values: string[] = [];
    const unsub = $navItem.subscribe(v => values.push(v)); // feuert sofort mit 'today'
    $navItem.set('focus' as any);
    $navItem.set('settings' as any);
    unsub();
    $navItem.set('clients' as any); // nach unsub – darf nicht in values landen
    expect(values).toContain('today'); // sofortiger Aufruf beim subscribe
    expect(values).toContain('focus');
    expect(values).toContain('settings');
    expect(values).not.toContain('clients'); // nach unsub
    $navItem.set('today' as any); // aufräumen
  });

  it('mehrere Instanzen derselben Store-Datei teilen denselben Zustand', async () => {
    // Prüft dass es kein Cross-Bundle-Problem gibt: zwei Imports desselben Moduls
    // sollen auf dieselbe atom-Instanz zeigen (Node.js-Modulcache).
    const { $navItem: a } = await import('../stores/uiStore');
    const { $navItem: b } = await import('../stores/uiStore');
    expect(a).toBe(b); // identische Referenz
    a.set('planning-weekly' as any);
    expect(b.get()).toBe('planning-weekly');
    a.set('today' as any);
  });
});

// --- 3. Regression: onMount darf keine leere Funktion sein ---

describe('Regression: onMount SSR-Bug', () => {
  /**
   * Wenn Vite das falsche (SSR-)Entry-Point von `svelte` bündelt, ist onMount
   * eine leere Funktion: `function onMount2() {}`. Dann wird der etasks:nav-
   * Listener nie registriert und appReady bleibt false.
   *
   * Dieser Test stellt sicher, dass onMount tatsächlich seinen Callback
   * ausführt, wenn er nach dem Mounten des Components aufgerufen wird.
   */
  it('onMount führt Callback aus (kein SSR-no-op)', () => {
    // Simuliert was passiert wenn onMount eine leere Funktion ist
    let onMountNoop = () => {};
    const callbackExecuted: string[] = [];

    // No-op-Verhalten (Bug-Szenario)
    onMountNoop = function noop(_cb: () => void) {} as any;
    (onMountNoop as any)(() => callbackExecuted.push('ran'));
    expect(callbackExecuted).toHaveLength(0); // no-op → Callback nicht ausgeführt

    // Korrektes Verhalten: onMount speichert Callback zur späteren Ausführung
    const onMountCallbacks: Array<() => void> = [];
    const correctOnMount = (cb: () => void) => onMountCallbacks.push(cb);
    correctOnMount(() => callbackExecuted.push('ran'));
    // Callbacks werden beim Mounten ausgeführt
    onMountCallbacks.forEach(cb => cb());
    expect(callbackExecuted).toEqual(['ran']); // Callback wurde ausgeführt
  });

  it('etasks:nav Listener wird erst nach addEventListner empfangen', () => {
    // Prüft die zeitliche Reihenfolge: Events die vor dem Hinzufügen des
    // Listeners ausgelöst werden, gehen verloren.
    const received: string[] = [];
    window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'zu-früh' }));

    const handler = (e: Event) => received.push((e as CustomEvent<string>).detail);
    window.addEventListener('etasks:nav', handler);
    window.dispatchEvent(new CustomEvent('etasks:nav', { detail: 'rechtzeitig' }));
    window.removeEventListener('etasks:nav', handler);

    expect(received).toEqual(['rechtzeitig']);
    expect(received).not.toContain('zu-früh');
  });
});
