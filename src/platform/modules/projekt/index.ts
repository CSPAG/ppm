/**
 * Modul «projekt» (Beispielmodul): öffentliche Schnittstelle. Andere Teile nutzen das Modul nur über diese Datei
 * (Modulgrenzen, .dependency-cruiser.cjs).
 */
import type { Module } from '../../http/app.ts';
import { SUMMARY_JOB } from './jobs.ts';
import { registerProjektRoutes } from './routes.ts';

export const projektModule: Module = { name: 'projekt', register: registerProjektRoutes };
export const PROJEKT_JOBS = [SUMMARY_JOB];
export { projekte } from './store.ts';
