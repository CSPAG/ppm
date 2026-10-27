/** Hilfen der Prüfskripte (ohne Abhängigkeiten). */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = join(import.meta.dirname, '..');

/** Dateien unter `dir` (relativ zur Wurzel) mit passender Endung, ohne node_modules und dist. */
export function files(dir: string, exts: string[]): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (exts.some(x => e.endsWith(x))) out.push(relative(ROOT, p).split('\\').join('/'));
    }
  };
  walk(abs);
  return out.sort();
}

export const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** Zeilennummer eines Treffers. */
export const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

/** Kommentare entfernen (Zeilen bleiben erhalten), damit Hinweise in Kommentaren nicht als Code zählen. */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p: string) => p + ' '.repeat(m.length - p.length));
}

/** Ergebnis melden und mit 1 enden, falls es Befunde gibt. */
export function report(name: string, problems: string[]): void {
  if (problems.length) {
    console.error(`${name}: ${problems.length} Befund(e)\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(`${name}: ok`);
}
