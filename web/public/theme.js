/*
 * Hell oder dunkel vor dem ersten Zeichnen (CSP: eigene Datei statt Inline-Skript). Wahl in localStorage `ppm.theme`
 * (`light`, `dark`, `system`); ohne Wahl gilt das System. Setzt `data-theme` an <html>; src/ui/theme.ts hält es danach
 * aktuell.
 */
(function () {
  var mode = 'system';
  try { mode = window.localStorage.getItem('ppm.theme') || 'system'; } catch (e) { /* Speicher gesperrt */ }
  var dark = mode === 'dark' || (mode !== 'light' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
