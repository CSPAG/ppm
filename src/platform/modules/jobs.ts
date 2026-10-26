/**
 * Register der Jobs (`JOBS`) und festen Aufgaben der Module (`TASKS`) für den Worker. Fachjobs gehören als
 * `JobDefinition` ins Modul und werden hier eingetragen.
 */
import type { PlatformConfig } from '../config/env.ts';
import type { JobDefinition, PeriodicTask } from '../worker/queue.ts';
import { PROJEKT_JOBS } from './projekt/index.ts';
import { webhookJobs } from './webhooks/index.ts';

export function JOBS(cfg: PlatformConfig): JobDefinition[] {
  return [
    ...PROJEKT_JOBS,
    ...webhookJobs({ keys: cfg.iam.encryptionKeys, timeoutMs: cfg.webhooks.timeoutMs, maxResponseBytes: cfg.webhooks.maxResponseBytes, allowPrivate: cfg.webhooks.allowPrivate }),
  ];
}

/** Feste Aufgaben der Module (die der Plattform setzt main/worker.ts dazu). */
export const TASKS: readonly PeriodicTask[] = [];
