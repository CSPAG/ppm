/**
 * Modul Finanzen (docs/fachmodell.md 1.1, 2.13; BC PC.01.02, PC.01.04, PC.01.05; UC-010; AP-E7-4): Ist-Kosten aus dem ERP
 * über einen Kostenträger je Projekt (A-16), Finanzübersicht und Budgetabweichungen mit Toleranz (A-10) und Begründung,
 * Jahresbedarf zeitanteilig nach den Phasenterminen mit Korrektur durch FI und Übergabe an den Budgetprozess (A-17).
 * Budget und Prognose stehen im Register `kosten` von `projektdaten`; ERP und Budgetprozess laufen über `schnittstelle`.
 */
import { defineModule, type Deps } from '@vollholz/platform';
import type { FastifyInstance } from 'fastify';
import { abweichungTask } from './aufgaben.ts';
import { finanzenTools } from './mcp.ts';
import { registerRoutes, TAG } from './routes.ts';
// Verarbeitung der Daten für die Schnittstellen ERP und Budgetprozess (registriert sich selbst)
import './erp.ts';

export const finanzenModule = defineModule({
  name: 'finanzen',
  tags: [{ name: TAG, description: 'Ist-Kosten aus dem ERP, Finanzübersicht und Budgetabweichungen mit Begründung, Jahresbedarf und Übergabe an den Budgetprozess.' }],
  register: (app: FastifyInstance, deps: Deps) => registerRoutes(app, deps),
  mcpTools: { ...finanzenTools },
  tasks: [abweichungTask],
});
