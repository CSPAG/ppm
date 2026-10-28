/**
 * Modul Abschluss (docs/fachmodell.md 1.1, 2.13; AP-E7-1): Abschlussbericht mit Nutzenprüfung am Exit-Gate P4,
 * Sistieren, Abbrechen, Wiederaufnahme (A-09) und Lessons Learned (BC PS.04.01–03, PC.03.02, PC.03.04; UC-015).
 * Registriert die Traktandenart `abschluss` bei `sitzung` und die Folge des Gate-Entscheids bei `vertrag`; die Aufgabe
 * «Abschlussbericht erstellen» öffnet es im Eingang. Obere Module (Jahresrückblick, AP-E7-5) lesen die Lessons Learned
 * über `lessonsLearned`.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { abschlussTask } from './aufgabe-job.ts';
import { registerDokumentRoutes } from './dokument-routes.ts';
import { registriereAbschluss } from './folge.ts';
import { registerLessonsRoutes, TAG_LESSONS } from './lessons-routes.ts';
import { abschlussTools } from './mcp.ts';
import { registerRoutes, TAG } from './routes.ts';
import * as store from './store.ts';

registriereAbschluss(); // Art `abschluss` und Folge des Gate-Entscheids (fachmodell.md 2.9)

export const abschlussModule = defineModule({
  name: 'abschluss',
  tags: [
    { name: TAG, description: 'Abschlussbericht mit Nutzenprüfung und Exit-Gate P4, Bericht zu Sistierung und Abbruch, Wiederaufnahme (UC-015, A-09).' },
    { name: TAG_LESSONS, description: 'Lessons Learned je Projekt für künftige Vorhaben und den Jahresrückblick (PS.04.03).' },
  ],
  register: (app: FastifyInstance, deps: Deps) => {
    registerRoutes(app, deps);
    registerDokumentRoutes(app, deps);
    registerLessonsRoutes(app, deps);
  },
  tasks: [abschlussTask],
  mcpTools: abschlussTools,
});

/** Für obere Module (Jahresrückblick, AP-E7-5), in deren Transaktion unter der Lesesicht; Rechte prüft der Aufrufer. */
export const lessonsLearned = {
  /** Lessons Learned, neueste zuerst (Filter Jahr, Projekt, Kategorie). */
  lesen: (tx: Parameters<typeof store.lessons>[0], f: { jahr?: number; projektId?: string; kategorie?: string }) => store.lessons(tx, { ...f, limit: 100000 }),
};
export type { LessonRow } from './store.ts';
