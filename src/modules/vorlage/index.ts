/**
 * Modul Vorlagen (docs/fachmodell.md 1.1; AM.03.01, DM.02.07): Vorlagen je Art mit Fassung und die Dokumentausgabe
 * (Word, PDF) im Layout der Vorlage. AP-E3-5 legt den Grundbestand (Projektvertrag nach Q7) und die Ausgabe an;
 * Hochladen eigener Fassungen und Feldzuordnung folgen mit AP-E7-7. Fachmodule bauen ihr Dokument als `Dokument`
 * (`modell.ts`) und lassen es hier setzen; Rechte prüft der Aufrufer.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { docx } from './docx.ts';
import { aktuell, PERSONENDATEN, titelVon } from './grundbestand.ts';
import type { Dokument, Format } from './modell.ts';
import { pdf } from './pdf.ts';
import { registerRoutes, TAG } from './routes.ts';

export const vorlageModule = defineModule({
  name: 'vorlage',
  tags: [{ name: TAG, description: 'Vorlagen je Art mit Fassung (Grundbestand: Projektvertrag nach Q7); Dokumentausgabe in Word und PDF.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
  },
});

/** Für Fachmodule: gültige Vorlage und Dokument setzen. */
export const vorlage = {
  aktuell,
  titelVon,
  /** Dokument im gewünschten Format setzen. */
  setzen: (d: Dokument, format: Format): Buffer => (format === 'pdf' ? pdf(d) : docx(d)),
};
export { FORMATE, MIME, type Block, type Dokument, type Format } from './modell.ts';
export { PERSONENDATEN };
export type { Art as VorlageArt, Vorlage } from './grundbestand.ts';
