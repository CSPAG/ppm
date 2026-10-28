/**
 * PDF-Ausgabe (PDF 1.4) des Dokumentmodells: A4, Schrift Helvetica (eingebaute Standardschrift, WinAnsi), Umbruch nach
 * den Zeichenbreiten der Schrift, Tabellen mit Rahmen und wiederholter Kopfzeile, Kopfzeile (G12) und «Seite n von m»
 * auf jeder Seite. Ohne Fremdbibliothek und ohne eingebettete Dateien.
 */
import { deflateSync } from 'node:zlib';
import { seiteVon, type Block, type Dokument } from './modell.ts';

// ---------------------------------------------------------------- Schrift

/** Breiten von Helvetica (AFM, 1/1000 em) für ASCII 32–126. */
const ASCII = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667,
  611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,
  556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
/** Fett: nur abweichende Breiten (sonst wie normal). */
const ASCII_FETT = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667,
  611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889,
  611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Unicode → WinAnsi (cp1252) für die Zeichen ausserhalb von Latin-1. */
const WIN: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '‹': 0x8b, '›': 0x9b,
};

/** Zeichen in WinAnsi; Unbekanntes wird «?». Typografische Zeichen ohne Gegenstück werden angenähert. */
function code(ch: string): number {
  const c = ch.codePointAt(0)!;
  if (c === 0x2212) return 0x2d; // Minus → Bindestrich
  if (c === 0x2009 || c === 0x202f || c === 0x00a0) return 0x20; // schmale bzw. feste Leerzeichen
  if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) return c;
  return WIN[ch] ?? 0x3f;
}

function breite(c: number, fett: boolean): number {
  if (c >= 0x20 && c <= 0x7e) return (fett ? ASCII_FETT : ASCII)[c - 0x20]!;
  if (c === 0x96 || c === 0x80) return 556; // – €
  if (c === 0x97 || c === 0x85) return 1000; // — …
  if (c === 0x95) return 350;
  if (c >= 0x91 && c <= 0x94) return c <= 0x92 ? 222 : 333;
  if (c === 0xab || c === 0xbb) return 556; // « »
  if (c === 0xb7) return 278;
  // Latin-1-Buchstaben: Breite des Grundbuchstabens
  const basis = String.fromCodePoint(c).normalize('NFD').codePointAt(0)!;
  if (basis !== c && basis >= 0x20 && basis <= 0x7e) return breite(basis, fett);
  if (c === 0xdf) return 611; // Eszett (kommt in Schweizer Texten nicht vor)
  return 556;
}

const textBreite = (s: string, groesse: number, fett: boolean) => [...s].reduce((w, ch) => w + breite(code(ch), fett), 0) * groesse / 1000;

/** Text in Zeilen mit höchstens `max` pt; überlange Wörter werden hart getrennt. */
export function umbrechen(text: string, groesse: number, fett: boolean, max: number): string[] {
  const out: string[] = [];
  for (const absatz of text.replace(/\r\n?/g, '\n').split('\n')) {
    let zeile = '';
    for (const wort of absatz.split(/ +/)) {
      const kandidat = zeile ? `${zeile} ${wort}` : wort;
      if (textBreite(kandidat, groesse, fett) <= max) { zeile = kandidat; continue; }
      if (zeile) out.push(zeile);
      zeile = wort;
      while (textBreite(zeile, groesse, fett) > max && zeile.length > 1) {
        let n = zeile.length - 1;
        while (n > 1 && textBreite(zeile.slice(0, n), groesse, fett) > max) n--;
        out.push(zeile.slice(0, n));
        zeile = zeile.slice(n);
      }
    }
    out.push(zeile);
  }
  return out;
}

/** PDF-Zeichenkette (WinAnsi, Klammern und Backslash maskiert). */
function str(s: string): string {
  let o = '(';
  for (const ch of s) {
    const c = code(ch);
    o += c === 0x28 || c === 0x29 || c === 0x5c ? `\\${String.fromCharCode(c)}` : c < 0x80 ? String.fromCharCode(c) : `\\${c.toString(8).padStart(3, '0')}`;
  }
  return `${o})`;
}

// ---------------------------------------------------------------- Satz

const A4 = { w: 595.28, h: 841.89 };
const RAND = { links: 56.7, rechts: 56.7, oben: 70.9, unten: 70.9 };
const SPALTE = A4.w - RAND.links - RAND.rechts;
const GRAU = '0.6 G';

interface Seite { ops: string[] }

class Satz {
  seiten: Seite[] = [];
  y = 0;
  constructor() { this.neueSeite(); }

  get seite(): Seite { return this.seiten[this.seiten.length - 1]!; }
  neueSeite(): void { this.seiten.push({ ops: [] }); this.y = A4.h - RAND.oben; }
  /** Platz für `h` pt, sonst neue Seite. */
  platz(h: number): void { if (this.y - h < RAND.unten) this.neueSeite(); }

  text(x: number, y: number, s: string, groesse: number, fett = false, kursiv = false): void {
    const f = fett ? '/F2' : kursiv ? '/F3' : '/F1';
    this.seite.ops.push(`BT ${f} ${groesse} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${str(s)} Tj ET`);
  }
  linie(x1: number, y1: number, x2: number, y2: number): void {
    this.seite.ops.push(`${GRAU} 0.5 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S 0 G`);
  }
  flaeche(x: number, y: number, w: number, h: number): void {
    this.seite.ops.push(`0.93 g ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f 0 g`);
  }

  absatz(text: string, groesse: number, o: { fett?: boolean; kursiv?: boolean; vorher?: number; nachher?: number; zusammen?: number } = {}): void {
    const zeilen = umbrechen(text, groesse, !!o.fett, SPALTE);
    const lh = groesse * 1.35;
    this.y -= o.vorher ?? 0;
    // Überschrift nicht allein am Seitenende
    this.platz(lh * Math.min(zeilen.length, 1) + (o.zusammen ?? 0));
    for (const z of zeilen) {
      this.platz(lh);
      this.text(RAND.links, this.y - groesse, z, groesse, o.fett, o.kursiv);
      this.y -= lh;
    }
    this.y -= o.nachher ?? 0;
  }

  /** Tabelle; Zeilen, die nicht auf die Seite passen, laufen auf der nächsten weiter (Kopf wird wiederholt). */
  tabelle(kopf: readonly string[] | null, zeilen: readonly (readonly string[])[], anteile: readonly number[]): void {
    const g = 9, lh = g * 1.3, pad = 4;
    const summe = anteile.reduce((s, x) => s + x, 0);
    const breiten = anteile.map(a => (a / summe) * SPALTE);
    const xs = breiten.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? RAND.links) + w], [RAND.links]);
    const zelleZeilen = (z: readonly string[], fett: (i: number) => boolean) => z.map((t, i) => umbrechen(t, g, fett(i), breiten[i]! - 2 * pad));

    const zeichne = (zz: string[][], fett: (i: number) => boolean, grau: boolean) => {
      const n = Math.max(1, ...zz.map(l => l.length));
      const h = n * lh + 2 * pad;
      if (grau) this.flaeche(RAND.links, this.y - h, SPALTE, h);
      zz.forEach((l, i) => l.forEach((t, k) => this.text(xs[i]! + pad, this.y - pad - g - k * lh + 2, t, g, fett(i))));
      this.linie(RAND.links, this.y, RAND.links + SPALTE, this.y);
      this.linie(RAND.links, this.y - h, RAND.links + SPALTE, this.y - h);
      for (const x of xs) this.linie(x, this.y, x, this.y - h);
      this.y -= h;
    };
    const kopfZeichnen = () => { if (kopf) zeichne(zelleZeilen(kopf, () => true), () => true, true); };
    const kopfHoehe = kopf ? Math.max(...zelleZeilen(kopf, () => true).map(l => l.length)) * lh + 2 * pad : 0;

    this.platz(kopfHoehe + lh + 2 * pad);
    kopfZeichnen();
    for (const z of zeilen) {
      const fett = (i: number) => !kopf && i === 0;
      let rest = zelleZeilen(z, fett);
      while (rest.some(l => l.length)) {
        const frei = Math.floor((this.y - RAND.unten - 2 * pad) / lh);
        if (frei < 1) { this.neueSeite(); kopfZeichnen(); continue; }
        zeichne(rest.map(l => l.slice(0, frei)), fett, false);
        rest = rest.map(l => l.slice(frei));
        if (rest.some(l => l.length)) { this.neueSeite(); kopfZeichnen(); }
      }
    }
    this.y -= 8;
  }

  block(b: Block): void {
    switch (b.art) {
      case 'titel':
        this.y -= 120;
        this.absatz(b.text, 22, { fett: true, nachher: 8 });
        if (b.untertitel) this.absatz(b.untertitel, 14, { nachher: 24 });
        return;
      case 'ueberschrift':
        return b.ebene === 1
          ? this.absatz(b.text, 14, { fett: true, vorher: 14, nachher: 4, zusammen: 30 })
          : this.absatz(b.text, 11, { fett: true, vorher: 8, nachher: 2, zusammen: 24 });
      case 'absatz':
        return b.text.trim() ? this.absatz(b.text, 10, { nachher: 6 }) : this.absatz(b.leer ?? '–', 10, { kursiv: true, nachher: 6 });
      case 'felder':
        return this.tabelle(null, b.zeilen, [3, 7]);
      case 'tabelle':
        return b.zeilen.length ? this.tabelle(b.kopf, b.zeilen, b.breiten ?? b.kopf.map(() => 1)) : this.absatz(b.leer ?? '–', 10, { kursiv: true, nachher: 6 });
    }
  }
}

// ---------------------------------------------------------------- Datei

/** PDF-Datei des Dokuments. */
export function pdf(d: Dokument): Buffer {
  const satz = new Satz();
  for (const b of d.bloecke) satz.block(b);
  const m = satz.seiten.length;
  satz.seiten.forEach((s, i) => {
    // Kopfzeile (G12) und Fusszeile mit Seitenzahl
    s.ops.unshift(`BT /F2 8 Tf ${RAND.links} ${(A4.h - 40).toFixed(2)} Td ${str(d.kopfzeile)} Tj ET`);
    s.ops.push(`BT /F1 8 Tf ${RAND.links} 36 Td ${str(`${d.fusszeile} · ${seiteVon(i + 1, m)}`)} Tj ET`);
  });

  const objekte: (string | Buffer)[] = [];
  const neu = (inhalt: string | Buffer) => { objekte.push(inhalt); return objekte.length; };
  const katalog = neu('');
  const seitenBaum = neu('');
  const schrift = (name: string) => neu(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
  const f1 = schrift('Helvetica'), f2 = schrift('Helvetica-Bold'), f3 = schrift('Helvetica-Oblique');
  const kinder = satz.seiten.map(s => {
    const roh = Buffer.from(s.ops.join('\n'), 'latin1');
    const inhalt = deflateSync(roh);
    const strom = neu(Buffer.concat([Buffer.from(`<< /Length ${inhalt.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'), inhalt, Buffer.from('\nendstream', 'latin1')]));
    return neu(`<< /Type /Page /Parent ${seitenBaum} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${strom} 0 R >>`);
  });
  objekte[katalog - 1] = `<< /Type /Catalog /Pages ${seitenBaum} 0 R /Lang (de-CH) >>`;
  objekte[seitenBaum - 1] = `<< /Type /Pages /Kids [${kinder.map(k => `${k} 0 R`).join(' ')}] /Count ${kinder.length} >>`;
  const info = neu(`<< /Title ${str(d.titel)} /Subject ${str(d.kopfzeile)} /Producer (PPM) >>`);

  const teile: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let pos = teile[0]!.length;
  const xref: number[] = [];
  objekte.forEach((o, i) => {
    xref.push(pos);
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), typeof o === 'string' ? Buffer.from(o, 'latin1') : o, Buffer.from('\nendobj\n', 'latin1')]);
    teile.push(b);
    pos += b.length;
  });
  const tabelle = `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n${xref.map(x => `${String(x).padStart(10, '0')} 00000 n \n`).join('')}`;
  teile.push(Buffer.from(`${tabelle}trailer\n<< /Size ${objekte.length + 1} /Root ${katalog} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(teile);
}
