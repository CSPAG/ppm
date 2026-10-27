/**
 * Texte (Leitentscheidung L10): Oberfläche und Fehlertexte der API mit Anrede «Sie» (docs/ux/README.md, UX-E7, bis
 * zur Klärung von UX-OF-1), Schweizer Rechtschreibung ohne ß; in sichtbaren Texten der Oberfläche «Organisation» statt
 * «Mandant»/«Tenant».
 *
 *   node scripts/check-address.ts
 */
import { files, lineOf, read, report, stripComments } from './lib.ts';

/** Du-Form in Texten (Pronomen; Imperative wie «Gib» erkennt die Prüfung nicht, sie bleiben dem Review). */
const INFORMAL = /\b([Dd]u|[Dd]ich|[Dd]ir|[Dd]ein(e[mnrs]?)?)\b/;
const SHARP_S = /ß/;
const TENANT = /\b(Mandant(en)?|Tenants?)\b/i;

/** Zeichenketten im Code: '…', "…", `…` (ohne Ausdrücke) und JSX-Text zwischen > und <. */
function texts(src: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) out.push({ text: m[1] ?? m[2] ?? m[3] ?? '', index: m.index });
  for (const m of src.matchAll(/>([^<>{}]*[A-Za-zÄÖÜäöü][^<>{}]*)</g)) out.push({ text: m[1]!, index: m.index });
  return out;
}

const problems: string[] = [];
const check = (file: string, ui: boolean) => {
  const raw = read(file);
  if (SHARP_S.test(raw)) for (const m of raw.matchAll(/ß/g)) problems.push(`${file}:${lineOf(raw, m.index)}: ß (Schweizer Rechtschreibung: ss)`);
  const src = stripComments(raw);
  for (const t of texts(src)) {
    // Nur Texte mit Leerzeichen sind Sätze; Bezeichner, Pfade und Schlüssel bleiben aussen vor
    if (!/\s/.test(t.text.trim())) continue;
    if (INFORMAL.test(t.text)) problems.push(`${file}:${lineOf(src, t.index)}: Du-Form «${t.text.trim().slice(0, 60)}» (Anrede «Sie» verwenden)`);
    if (ui && TENANT.test(t.text)) problems.push(`${file}:${lineOf(src, t.index)}: «Mandant»/«Tenant» in sichtbarem Text «${t.text.trim().slice(0, 60)}» (Begriff «Organisation»)`);
  }
};

for (const file of files('web/src', ['.ts', '.tsx'])) if (!file.endsWith('.d.ts') && !file.includes('.test.')) check(file, true);
// API: Fehlertexte stehen in HttpError-Aufrufen und Schemas; geprüft werden alle Texte im Code
for (const file of files('src', ['.ts'])) check(file, false);

report('check-address', problems);
