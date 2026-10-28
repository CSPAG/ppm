/**
 * Dokumentausgabe mit der gültigen Vorlage (DM.02.07; UC-018 Schritt 2 «verwendet sie für künftige Dokumentausgaben»):
 * Word mit der aktiven eigenen Version der Art, deren Platzhalter mit den Werten des erzeugenden Moduls gefüllt werden;
 * sonst und für PDF der Grundbestand im Layout aus `docx.ts`/`pdf.ts` (Annahme AP-E7-7: PDF aus eigener Word-Vorlage
 * bräuchte einen Word-Renderer im Betrieb).
 */
import type { Tx } from '@vollholz/platform';
import type { Art } from './arten.ts';
import { docx } from './docx.ts';
import { werte as werteAus, type Dokument, type Format } from './modell.ts';
import { pdf } from './pdf.ts';
import * as store from './store.ts';
import { fuellen } from './wordvorlage.ts';

export interface Ausgabe { datei: Buffer; /** «Grundbestand» oder «Version 3» (Audit). */ vorlage: string }

/**
 * Dokument erzeugen. `tx` liest die aktive Vorlage und muss die volle Sicht haben (Konfiguration der Organisation; wer
 * das Dokument lesen darf, braucht kein Recht auf Vorlagen). Die Werte der Datenfelder kommen aus dem Dokument
 * (`werte` in `modell.ts`), damit Grundbestand und eigene Vorlage dasselbe zeigen.
 */
export async function ausgeben(tx: Tx, o: { art: Art; format: Format; dokument: Dokument }): Promise<Ausgabe> {
  if (o.format === 'docx') {
    const aktiv = await store.aktiveDatei(tx, o.art);
    if (aktiv) {
      const daten = werteAus(o.dokument);
      const werte = new Map(Object.entries(aktiv.zuordnung).flatMap(([p, f]) => (f ? [[p, daten[f] ?? '']] : [])));
      return { datei: fuellen(aktiv.datei, werte), vorlage: `Version ${aktiv.version}` };
    }
  }
  return { datei: o.format === 'pdf' ? pdf(o.dokument) : docx(o.dokument), vorlage: 'Grundbestand' };
}
