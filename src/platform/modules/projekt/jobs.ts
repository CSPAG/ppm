/** Jobs des Moduls «projekt» (registriert in modules/jobs.ts). */
import type { JobDefinition } from '../../worker/queue.ts';
import { projekte } from './store.ts';

/** Kennzahlen der Organisation berechnen (langer Lauf, Ergebnis unter /v1/vorgaenge/{id}). */
export const SUMMARY_JOB: JobDefinition<Record<string, never>> = {
  kind: 'projekt.summary',
  maxAttempts: 3,
  handle: async tx => ({ ...(await projekte.summary(tx)), computedAt: new Date().toISOString() }),
};
