/**
 * Prüfbericht des Phasenmodells (I-P1–I-P4): Hinweise und Warnungen am Objekt und gesammelt vor dem In-Kraft-Setzen.
 * Keine Sperren: Die Struktur ist fest, die Werte prüft das Schema. Texte nach I-P2 (Regel, Ist, Ausweg).
 */
import type { Dokument, Pruefpunkt } from './schemas.ts';
import { WERTESTROEME, WERTESTROM_LABEL } from './vorgabe.ts';

const EINHEIT_PFLICHT: Record<string, Dokument['fristen'][number]['einheit'][]> = {
  bericht_aufgabe: ['tag_im_monat'], bericht_stichtag: ['tag_im_monat'],
};

/** Regeln der Einheit je Frist: Monatszyklus als Tag im Monat, Sitzung und Gate in Arbeits- oder Kalendertagen (UX-E11). */
export function einheitPasst(f: Dokument['fristen'][number]): boolean {
  const erlaubt = EINHEIT_PFLICHT[f.schluessel];
  return erlaubt ? erlaubt.includes(f.einheit) : f.einheit !== 'tag_im_monat';
}

export function pruefe(d: Dokument): Pruefpunkt[] {
  const out: Pruefpunkt[] = [];
  for (const g of d.gates) {
    const vorhanden = new Set(g.leitfragen.map(l => l.wertestrom));
    // Je Gate Leitfragen entlang der fünf Werteströme (Q6 F6, Q8 Abb. 6)
    const fehlend = WERTESTROEME.filter(w => !vorhanden.has(w)).map(w => WERTESTROM_LABEL[w]);
    if (fehlend.length) {
      out.push({
        stufe: 'warnung', regel: 'leitfragen_je_wertestrom', ort: { art: 'gate', code: g.code },
        text: `Leitfragen je Wertestrom: ${g.name} hat keine Leitfrage für ${fehlend.join(', ')}. Ergänze sie, sonst fehlen sie im Gate-Antrag.`,
      });
    }
  }
  for (const p of d.phasen) {
    if (p.code !== 'PRE_P0' && p.ergebnisse.length === 0) {
      out.push({
        stufe: 'hinweis', regel: 'standard_ergebnisse', ort: { art: 'phase', code: p.code },
        text: `Standard-Ergebnisse: Für ${p.name} ist nichts hinterlegt. Projekte erhalten beim Planen dieser Phase keinen Vorschlag.`,
      });
    }
  }
  const tag = (k: string) => d.fristen.find(f => f.schluessel === k);
  const aufgabe = tag('bericht_aufgabe'), stichtag = tag('bericht_stichtag');
  if (aufgabe && stichtag && aufgabe.wert >= stichtag.wert) {
    out.push({
      stufe: 'warnung', regel: 'bericht_aufgabe_vor_stichtag', ort: { art: 'frist', code: 'bericht_aufgabe' },
      text: `Berichtsaufgabe: am ${aufgabe.wert}. statt vor dem Stichtag am ${stichtag.wert}. Setze die Aufgabe einige Tage vor den Stichtag.`,
    });
  }
  for (const t of d.toleranzen) {
    if (t.wert === null) {
      out.push({
        stufe: 'hinweis', regel: 'toleranz_ohne_wert', ort: { art: 'toleranz', code: t.dimension },
        text: `Toleranz ${TOLERANZ_LABEL[t.dimension]}: kein Standardwert. Ohne Wert warnt PPM nicht vor wesentlichen Abweichungen, ausser der Projektvertrag legt einen fest.`,
      });
    }
  }
  if (d.kapitelWirkung.length === 0) {
    out.push({
      stufe: 'warnung', regel: 'kapitelwirkung', ort: { art: 'wirkung', code: null },
      text: 'Kapitelwirkung: Kein Kapitel wirkt auf Scope, Budget oder Ressourcen. Jede Änderung am Vertrag könnte die Projektauftraggeber:in allein freigeben.',
    });
  }
  return out;
}

const TOLERANZ_LABEL: Record<Dokument['toleranzen'][number]['dimension'], string> = { termin: 'Termin', kosten: 'Kosten', umfang: 'Umfang' };
