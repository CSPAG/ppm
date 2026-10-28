/**
 * Netz-Grenze (Leitentscheidung L9, Spezifikation 5.6): Ausgehende Verbindungen und eigene Server nur in den
 * aufgeführten Netz-Adaptern. Die Webapp spricht nur same-origin; ihr Build lädt nichts von fremden Hosts.
 *
 *   node scripts/check-network.ts
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { files, lineOf, read, report, ROOT, stripComments } from './lib.ts';

/**
 * Dateien, die das Netz direkt nutzen dürfen – jede mit Begründung. Die Netz-Adapter des Querschnitts (SSRF-Schutz
 * `safeRequest`, Betriebs-Endpunkt, HTTP- und MCP-Server) liegen in @vollholz/platform; die App hat nur die folgenden.
 */
export const NETWORK_ADAPTERS: Record<string, string> = {
  // AP-E7-3 (BC AM.03.02, UC-018): Abruf bei und Lieferung an Umsysteme (ERP, HR-System, Budgetprozess) an der
  // konfigurierten Adresse, nur über safeRequest (SSRF-Schutz, Zeit- und Grössenlimit, keine Weiterleitungen)
  'src/modules/schnittstelle/transport.ts': 'Schnittstellen zu Umsystemen (UC-018 Schritte 3–4), über safeRequest',
};

const FORBIDDEN_IMPORT = /\bfrom\s+['"](node:)?(http|https|net|tls|http2|dgram|undici)['"]|import\(\s*['"](node:)?(http|https|net|tls|http2|dgram|undici)['"]\s*\)/g;
const GLOBAL_FETCH = /(^|[^.\w])fetch\s*\(/g;

const problems: string[] = [];
for (const f of Object.keys(NETWORK_ADAPTERS)) if (!existsSync(join(ROOT, f))) problems.push(`${f}: als Netz-Adapter eingetragen, existiert aber nicht`);

for (const file of files('src', ['.ts'])) {
  if (NETWORK_ADAPTERS[file]) continue;
  const src = stripComments(read(file));
  for (const m of src.matchAll(FORBIDDEN_IMPORT)) problems.push(`${file}:${lineOf(src, m.index)}: Netzmodul «${m[0].trim()}» nur in Netz-Adaptern (scripts/check-network.ts)`);
  for (const m of src.matchAll(GLOBAL_FETCH)) problems.push(`${file}:${lineOf(src, m.index)}: globales fetch nur in Netz-Adaptern; Abrufe an Adressen aus Daten über safeRequest (@vollholz/platform)`);
}

// Webapp: keine absoluten Adressen in fetch, EventSource, WebSocket, sendBeacon
const ABSOLUTE = /\b(fetch|EventSource|WebSocket|sendBeacon)\s*\(\s*[`'"](https?:|wss?:)?\/\/[^`'"]*/g;
for (const file of files('web/src', ['.ts', '.tsx'])) {
  const src = stripComments(read(file));
  for (const m of src.matchAll(ABSOLUTE)) problems.push(`${file}:${lineOf(src, m.index)}: Browser nur same-origin («${m[0]}»)`);
}

// Build der Webapp: keine externen src/href
const index = 'web/dist/index.html';
if (existsSync(join(ROOT, index))) {
  const html = read(index);
  for (const m of html.matchAll(/\b(src|href)\s*=\s*["']((https?:)?\/\/[^"']+)["']/g)) problems.push(`${index}:${lineOf(html, m.index)}: externe Quelle ${m[2]}`);
}

report('check-network', problems);
