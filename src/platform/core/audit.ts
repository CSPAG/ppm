/**
 * Audit: jede schreibende Aktion mit Principal, Mandant, Client, Quelle (ui|api|mcp|worker|system) und Korrelations-ID
 * in `ppm.audit_log` (Hash-Kette per Trigger, iam_007), in derselben Transaktion. Aktionen der Plattform-Administration
 * stehen zusätzlich in `ppm.platform_audit_log`.
 */
import { pgAudit, withPlatformAudit, type Actor, type AuditEntry, type AuditPort, type Source } from '@vollholz/iam';
import { SCHEMA } from '../config/env.ts';

export type { Actor, AuditEntry, AuditPort, Source };

export const audit: AuditPort = withPlatformAudit(pgAudit({ schema: SCHEMA }));

/** Handelnder für Hintergrundarbeit (Worker, Skripte). */
export const systemActor = (source: Source = 'system', correlationId: string | null = null): Actor => ({ principal: null, source, correlationId });
