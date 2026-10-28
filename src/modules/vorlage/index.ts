/**
 * Modul Vorlagen (docs/fachmodell.md 1.1; AM.03.01, DM.02.07): Vorlagen je Dokumentart mit Versionen und Feldzuordnung
 * und die Dokumentausgabe (Word, PDF). AP-E3-5: Grundbestand (Projektvertrag nach Q7) und Ausgabe; AP-E7-7: eigene
 * Word-Vorlagen hochladen, Platzhalter den Datenfeldern zuordnen, aktiv setzen. Fachmodule registrieren ihren
 * Feldkatalog (`felder.registrieren`), bauen ihr Dokument als `Dokument` (`modell.ts`) und lassen es mit `ausgeben`
 * erzeugen; Rechte prüft der Aufrufer.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { ausgeben } from './ausgabe.ts';
import { docx } from './docx.ts';
import { registrieren } from './felder.ts';
import { aktuell, PERSONENDATEN, titelVon } from './grundbestand.ts';
import type { Dokument, Format } from './modell.ts';
import { pdf } from './pdf.ts';
import { registerRoutes, TAG } from './routes.ts';

export const vorlageModule = defineModule({
  name: 'vorlage',
  tags: [{ name: TAG, description: 'Vorlagen je Dokumentart mit Versionen und Zuordnung der Platzhalter zu den Daten (UC-018); Dokumentausgabe in Word und PDF.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
  },
});

/** Für Fachmodule: Grundbestand, Feldkatalog und Ausgabe. */
export const vorlage = {
  aktuell,
  titelVon,
  /** Feldkatalog einer Dokumentart registrieren (beim Laden des erzeugenden Moduls). */
  felderRegistrieren: registrieren,
  /** Dokument mit der gültigen Vorlage erzeugen (in voller Sicht, siehe `ausgabe.ts`). */
  ausgeben,
  /** Dokument im Layout des Grundbestands setzen. */
  setzen: (d: Dokument, format: Format): Buffer => (format === 'pdf' ? pdf(d) : docx(d)),
};
export { FORMATE, MIME, type Block, type Dokument, type Format } from './modell.ts';
export { PERSONENDATEN };
export type { Art as VorlageArt } from './arten.ts';
export type { Feld as VorlageFeld } from './felder.ts';
export type { Vorlage } from './grundbestand.ts';
