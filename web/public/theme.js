// Vor dem ersten Zeichnen: gespeichertes Farbschema (hell, dunkel, System) setzen, damit nichts aufblitzt.
// Als eigene Datei statt Inline-Skript (CSP ohne 'unsafe-inline').
(function () {
  var mode = 'system';
  try { mode = localStorage.getItem('ppm.theme') || 'system'; } catch { /* ohne Speicher: System */ }
  var dark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
