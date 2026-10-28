/**
 * Modul Projektvertrag (docs/fachmodell.md 1.1, 2.10; AP-E3-1): Versionen mit Kapiteln 1–13 nach der Vorlage (Q7),
 * erster Entwurf, Pflichtangaben je Phase, Einreichen zur Prüfung (DM.02.01–03; UC-002 Schritte 1–8) und Baseline mit
 * Übernahme der Listen ins Register (PS.02.04, PC.01.01, PC.02.04, PC.03.01, PS.05.01–02, RK.02.01).
 *
 * Erweiterungspakete (AP-E3-2 bis AP-E3-5) hängen eigene Dateien (`routes-<teil>.ts`, `pruefung*`, `gate*`,
 * `aenderung*`, `vergleich*`, `dokument*`) mit je einer Zeile in `register` bzw. bei den Exporten ein; Anlässe eines
 * Entwurfs registrieren sie mit `entwurfsanlass.registrieren` (fachmodell.md 7.2).
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { baselineSetzen } from './baseline.ts';
import { registerDokumentRoutes } from './dokument-routes.ts';
import { entwurfsanlass } from './entwurf.ts';
import { registriereGate } from './gate.ts';
import { gateTask } from './gate-job.ts';
import { registerGateRoutes } from './gate-routes.ts';
import { vertragTools } from './mcp.ts';
import { registerPruefungRoutes } from './pruefung-routes.ts';
import { registerRoutes, TAG } from './routes.ts';
import * as store from './store.ts';
import { registerZielauswahl } from './zielauswahl.ts';

registriereGate(); // Anlass, Traktandum und Art `gate` (AP-E3-3)

export const vertragModule = defineModule({
  name: 'vertrag',
  tags: [{ name: TAG, description: 'Projektvertrag: Versionen mit Kapiteln 1–13, Entwurf, Pflichtangaben je Phase, Einreichen zur Prüfung, Baseline.' }],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
    registerZielauswahl(app, deps, TAG); // Ziele zur Wahl in Kap. 2 (PP.02.05)
    registerPruefungRoutes(app, deps);
    registerDokumentRoutes(app, deps); // Dokumentausgabe Word/PDF (AP-E3-5)
    registerGateRoutes(app, deps); // Gate-Modus (AP-E3-3)
  },
  tasks: [gateTask], // Aufgabe «Gate vorbereiten» (AP-E3-3)
  mcpTools: { ...vertragTools },
});

/** Für Erweiterungspakete und obere Module (in deren Transaktion; Rechte prüft der Aufrufer). */
export const vertrag = {
  baselineSetzen,
  entwurfsanlass,
  versionen: store.versionen,
  version: store.version,
  kapitel: store.kapitel,
};
export { unterzeichnung } from './pruefung.ts';
export { gateEntscheid, type GateEntscheid } from './gate.ts';
export { KAPITEL, titel as kapitelTitel, type Inhalt as KapitelInhalt } from './kapitel.ts';
export type { Anlass, Stand, VersionRow } from './store.ts';
