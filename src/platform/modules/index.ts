/**
 * Register der Module (Kompositionswurzel der Fachlichkeit): Routen (`MODULES`), Abnehmer der Outbox
 * (`OUTBOX_CONSUMERS`) und Schlüsselrotationen (`ROTATIONS`). Ein neues Modul trägt sich hier ein (Checkliste
 * «Neues Modul anlegen», docs/zielarchitektur.md); die Webapp-Auslieferung bleibt zuletzt (SPA-Fallback).
 */
import type { OutboxConsumer } from '../core/events.ts';
import type { Module } from '../http/app.ts';
import type { Rotation } from '../ops/rotation.ts';
import { uiModule } from './auth/index.ts';
import { projektModule } from './projekt/index.ts';
import { vorgaengeModule } from './vorgaenge/index.ts';
import { webhookConsumer, webhookRotation, webhooksModule } from './webhooks/index.ts';

export const MODULES: readonly Module[] = [projektModule, vorgaengeModule, webhooksModule, uiModule];
export const OUTBOX_CONSUMERS: readonly OutboxConsumer[] = [webhookConsumer];
export const ROTATIONS: readonly Rotation[] = [webhookRotation];
