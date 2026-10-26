/**
 * Sprache der Oberfläche (Leitentscheidung L10, Spezifikation 6): in keiner Datei unter src das Eszett (hier als
 * Escape geschrieben), in sichtbaren Texten (JSX-Text, Zeichenketten, Vorlagen) kein «Mandant»/«Tenant» (Begriff:
 * Organisation) und keine Sie-Form (Du-Form).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');
const ESZETT = '\u00df';
const TENANT = /\b(Mandant\w*|Tenant\w*)\b/i;
const SIE = /\b(Sie|Ihnen|Ihre[mnrs]?|Ihr)\b/;
/** Technische Zeichenketten, die nie sichtbar sind (Header-Namen u. ä.). */
const TECHNICAL = new Set(['X-Tenant', 'x-tenant']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** Alle Texte einer Quelldatei: Zeichenketten, Vorlagen und JSX-Text, mit Zeile. */
function texts(file: string): { text: string; line: number }[] {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { text: string; line: number }[] = [];
  const visit = (n: ts.Node) => {
    // Importpfade und Typen sind keine Texte der Oberfläche
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isLiteralTypeNode(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      const text = ts.isJsxText(n) ? n.text : (n as ts.LiteralLikeNode).text;
      if (text.trim()) out.push({ text, line: src.getLineAndCharacterOfPosition(n.getStart(src)).line + 1 });
    }
    n.forEachChild(visit);
  };
  visit(src);
  return out;
}

const all = files(SRC);
const code = all.filter(f => /\.tsx?$/.test(f) && !f.endsWith('.d.ts') && !/\.test\.tsx?$/.test(f) && !f.startsWith(join(SRC, 'test')));

describe('Texte der Oberfläche', () => {
  it('findet die Dateien', () => {
    expect(code.length).toBeGreaterThan(10);
  });

  it('kein Eszett in irgendeiner Datei unter src (auch Kommentare, Tests, CSS)', () => {
    const found = all.flatMap(f => readFileSync(f, 'utf8').split('\n').flatMap((l, i) => (l.includes(ESZETT) ? [`${relative(SRC, f)}:${i + 1}`] : [])));
    expect(found).toEqual([]);
  });

  it('sichtbar «Organisation», nie «Mandant» oder «Tenant»', () => {
    const found = code.flatMap(f => texts(f).filter(t => !TECHNICAL.has(t.text) && TENANT.test(t.text)).map(t => `${relative(SRC, f)}:${t.line}: ${t.text}`));
    expect(found).toEqual([]);
  });

  it('Du-Form, keine Sie-Form', () => {
    const found = code.flatMap(f => texts(f).filter(t => SIE.test(t.text)).map(t => `${relative(SRC, f)}:${t.line}: ${t.text}`));
    expect(found).toEqual([]);
  });

  it('die Prüfungen schlagen an', () => {
    expect(SIE.test('Melden Sie sich an')).toBe(true);
    expect(SIE.test('Melde dich an')).toBe(false);
    expect(TENANT.test('Mandanten wechseln')).toBe(true);
    expect(`Gro${ESZETT}`.includes(ESZETT)).toBe(true);
  });
});
