/**
 * Sprache (Leitentscheidung L10): Texte der Oberfläche und `HttpError`-Texte in Du-Form, ohne «Sie»-Anrede; das
 * Eszett ist in jeder Datei verboten, auch in Kommentaren und Tests (dort als Escape `\u00df`). Teil von `npm run arch`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report', 'anhang', '.terraform']);
const TEXT = /\.(ts|tsx|js|cjs|mjs|json|md|yml|yaml|sql|css|html|sh|tf|txt|example)$/;

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (SKIP.has(n) || n === 'package-lock.json') return [];
    return statSync(p).isDirectory() ? files(p) : TEXT.test(n) || n === 'Dockerfile' || n === 'Caddyfile' ? [p] : [];
  });
}

const problems: string[] = [];
const ESZETT = String.fromCharCode(0xdf);
const SIE = /\b(Sie|Ihnen|Ihre[mnrs]?|Ihr)\b/;
// Texte der Oberfläche (JSX-Text, Strings in web/src) und Fehlertexte (HttpError, invalid, conflict …)
const UI_FILE = /^web\/src\/.*\.tsx?$/;
const ERR_LINE = /new HttpError\(|\b(notFound|forbidden|conflict|invalid)\(/;

for (const f of files(root)) {
  const rel = relative(root, f);
  // Kundenmaterial und Fachspezifikation unter docs/ (ausser den Doku-Dateien der App) nicht prüfen
  if (rel.startsWith('docs/anhang/') || rel === 'docs/PPM-Master.md') continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes(ESZETT)) problems.push(`${rel}:${i + 1}: Eszett (Schweizer Rechtschreibung: ss)`);
    const ui = UI_FILE.test(rel) && !/\.test\.tsx?$/.test(rel) && !/^\s*(\*|\/\/|import )/.test(line);
    const err = rel.startsWith('src/') && ERR_LINE.test(line);
    if ((ui || err) && SIE.test(line.replace(/\/\/.*$/, ''))) problems.push(`${rel}:${i + 1}: Du-Form statt «Sie»`);
  });
}

if (problems.length) {
  console.error(`check-address: ${problems.length} Befund(e)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('check-address: ok');
