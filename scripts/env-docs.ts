/**
 * Erzeugt `.env.example` und `docs/konfiguration.md` aus der Variablenliste `VARS` (src/platform/config/env.ts).
 *
 *   node scripts/env-docs.ts            schreiben
 *   node scripts/env-docs.ts --check    nur prüfen (CI): Code 1, wenn eine Datei veraltet ist
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VARS } from '../src/platform/config/env.ts';

const root = join(import.meta.dirname, '..');
const groups = [...new Set(VARS.map(v => v.group))];
const services = (s?: string[]) => (s ? (s.length ? s.join(', ') : 'nur Skripte') : 'alle');
const pflicht = (v: (typeof VARS)[number]) => (v.required ? 'ja' : v.requiredIn?.length ? `in ${v.requiredIn.join(', ')}` : '–');
const cell = (s: string) => s.replaceAll('|', '\\|').replaceAll('\n', ' ');

let env = '# Erzeugt von `npm run env:docs` aus src/platform/config/env.ts – nicht von Hand ändern.\n# Lokal erzeugt `npm run dev:env` eine .env mit Zufallsgeheimnissen.\n';
let md = `# Konfiguration

Erzeugt von \`npm run env:docs\` aus [\`src/platform/config/env.ts\`](../src/platform/config/env.ts) – nicht von Hand
ändern. Geheimnisse (🔒) auch als \`<NAME>_FILE\` mit Pfad zu einer Datei (Docker/Kubernetes Secrets). Ungültige
Konfiguration beendet jeden Prozess mit allen Meldungen und Exit 78. Spalte «Dienste»: wer die Variable liest; nur
dieser Dienst bekommt das Geheimnis (docs/betrieb.md › Geheimnisse je Dienst).
`;
for (const g of groups) {
  env += `\n# --- ${g}\n`;
  md += `\n## ${g}\n\n| Variable | Standard | Pflicht | Dienste | Beschreibung |\n|---|---|---|---|---|\n`;
  for (const v of VARS.filter(x => x.group === g)) {
    env += `# ${v.description.replaceAll('`', '').replaceAll('\n', ' ')}\n#${v.name}=${v.default ?? v.example ?? ''}\n`;
    md += `| \`${v.name}\`${v.secret ? ' 🔒' : ''} | ${v.default ? `\`${cell(v.default)}\`` : '–'} | ${pflicht(v)} | ${services(v.services)} | ${cell(v.description)}${v.values ? ` Werte: ${v.values.map(x => `\`${x}\``).join(', ')}.` : ''} |\n`;
  }
}

const out: [string, string][] = [['.env.example', env], ['docs/konfiguration.md', md]];
if (process.argv.includes('--check')) {
  const stale = out.filter(([f, c]) => { try { return readFileSync(join(root, f), 'utf8') !== c; } catch { return true; } }).map(([f]) => f);
  if (stale.length) { console.error(`env:docs: veraltet: ${stale.join(', ')} – npm run env:docs`); process.exit(1); }
  console.log('env:docs: aktuell');
} else {
  for (const [f, c] of out) writeFileSync(join(root, f), c);
  console.log(`env:docs: ${out.map(([f]) => f).join(', ')} geschrieben (${VARS.length} Variablen)`);
}
