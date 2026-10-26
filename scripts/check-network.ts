/**
 * Netz nur über erlaubte Adapter (Leitentscheidung L9): Globales `fetch` und `node:http(s)`, `node:net`, `node:tls`,
 * `undici` stehen nur in den Dateien aus NETWORK_ADAPTERS. Die Webapp spricht nur die eigene Herkunft an (keine
 * absoluten Adressen in `fetch`, `EventSource`, `WebSocket`, `sendBeacon`), und `web/dist/index.html` lädt nichts von
 * aussen. Teil von `npm run arch`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');

/** Netz-Adapter mit Begründung. Neue Einträge nur mit Begründung und Eintrag in docs/zielarchitektur.md. */
export const NETWORK_ADAPTERS: Record<string, string> = {
};

const SKIP = new Set(['node_modules', 'dist', '.git', 'test-results', 'playwright-report']);
function files(dir: string, ext: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (SKIP.has(n)) return [];
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(n) ? [p] : [];
  });
}

const problems: string[] = [];
for (const [f] of Object.entries(NETWORK_ADAPTERS)) if (!existsSync(join(root, f))) problems.push(`${f}: als Netz-Adapter eingetragen, Datei fehlt`);

const NET = /from\s+['"](node:)?(https?|net|tls|http2|dgram|undici)['"]|require\(['"](node:)?(https?|net|tls|undici)['"]\)|(?<![\w.])fetch\s*\(|globalThis\.fetch/;
for (const f of files(join(root, 'src'), /\.ts$/)) {
  const rel = relative(root, f);
  if (NETWORK_ADAPTERS[rel]) continue;
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(\*|\/\/)/.test(line)) return;
    if (NET.test(line)) problems.push(`${rel}:${i + 1}: Netzzugriff ausserhalb der Netz-Adapter (scripts/check-network.ts › NETWORK_ADAPTERS)`);
  });
}

const ABS = /(fetch|EventSource|WebSocket|sendBeacon)\s*\(\s*[`'"](https?:|wss?:)?\/\//;
for (const f of files(join(root, 'web', 'src'), /\.tsx?$/)) {
  const rel = relative(root, f);
  if (/\.test\.tsx?$|\/test\//.test(rel)) continue;
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (ABS.test(line)) problems.push(`${rel}:${i + 1}: Webapp nur same-origin (keine absolute Adresse)`);
  });
}

const index = join(root, 'web', 'dist', 'index.html');
if (existsSync(index)) {
  for (const m of readFileSync(index, 'utf8').matchAll(/\s(src|href)=["']((https?:)?\/\/[^"']+)/g)) problems.push(`web/dist/index.html: externe Adresse ${m[2]}`);
}

if (problems.length) {
  console.error(`check-network: ${problems.length} Befund(e)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('check-network: ok');
