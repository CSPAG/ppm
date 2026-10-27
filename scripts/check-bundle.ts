/**
 * Start-Bundle der Oberfläche (Q-L6, docs/ux/rahmen/qualitaetsziele.md): was der Browser vor dem ersten Zeichnen lädt,
 * komprimiert (gzip) höchstens 250 kB. Gezählt werden `index.html` und alles, was sie selbst einbindet (Skripte,
 * `modulepreload`, Stylesheets); Arbeitsflächen, Schriften und Symbole laden erst bei Bedarf und zählen nicht.
 * Schreibt die Teile ins Log und, in GitHub Actions, in die Zusammenfassung des Jobs.
 *
 *   npm run web:build && node scripts/check-bundle.ts
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'web/dist';
/** Q-L6: 250 kB komprimiert (1 kB = 1000 Byte). */
const ZIEL = 250_000;

const index = join(DIST, 'index.html');
if (!existsSync(index)) {
  console.error(`check-bundle: ${index} fehlt (npm run web:build)`);
  process.exit(78);
}
const html = readFileSync(index, 'utf8');

/** Lokale Adressen aus `<script src>` und `<link rel="modulepreload|stylesheet" href>`. */
const teile = new Set<string>();
for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) teile.add(m[1]!);
for (const m of html.matchAll(/<link\b[^>]*>/g)) {
  const rel = /\brel="([^"]+)"/.exec(m[0])?.[1] ?? '';
  const href = /\bhref="([^"]+)"/.exec(m[0])?.[1];
  if (href && /\b(modulepreload|stylesheet)\b/.test(rel)) teile.add(href);
}

const gz = (b: Buffer) => gzipSync(b, { level: 9 }).length;
const zeilen: { datei: string; roh: number; gzip: number }[] = [{ datei: 'index.html', roh: Buffer.byteLength(html), gzip: gz(Buffer.from(html)) }];
for (const t of teile) {
  if (/^[a-z]+:|^\/\//i.test(t)) {
    console.error(`check-bundle: externe Adresse im Start-Bundle: ${t}`);
    process.exit(1);
  }
  const b = readFileSync(join(DIST, t.replace(/^\//, '')));
  zeilen.push({ datei: t, roh: b.length, gzip: gz(b) });
}
const summe = zeilen.reduce((s, z) => s + z.gzip, 0);
const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`;

for (const z of zeilen) console.log(`${z.datei.padEnd(48)} ${kb(z.roh).padStart(10)} ${kb(z.gzip).padStart(10)} gzip`);
const ok = summe <= ZIEL;
console.log(`Q-L6 Start-Bundle: ${kb(summe)} gzip, Ziel ≤ ${kb(ZIEL)} – ${ok ? 'erreicht' : 'verfehlt'}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    '### Q-L6 Start-Bundle',
    '',
    '| Datei | roh | gzip |',
    '|---|---:|---:|',
    ...zeilen.map(z => `| \`${z.datei}\` | ${kb(z.roh)} | ${kb(z.gzip)} |`),
    `| **Summe** | | **${kb(summe)}** |`,
    '',
    `Ziel ≤ ${kb(ZIEL)}: ${ok ? 'erreicht' : '**verfehlt**'}`,
    '',
  ].join('\n'));
}
if (!ok) {
  console.error(`::error::Q-L6: Start-Bundle ${kb(summe)} gzip über dem Ziel ${kb(ZIEL)}`);
  process.exit(1);
}
