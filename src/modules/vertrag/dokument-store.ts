/**
 * Bezüge für die Dokumentausgabe des Projektvertrags (DM.02.07, AP-E3-5), nur lesend. Projekte und Personen unter der
 * Lesesicht der Person; Bezeichnungen der Konfiguration (Handlungsfelder, Ziele, Codewerte) in voller Sicht, damit
 * das Dokument für alle, die den Vertrag lesen, gleich aussieht.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';

export interface Kopf { nummer: string; name: string; vertraulich: boolean; portfolio_id: string }

/** Projekt (Lesesicht); null = nicht sichtbar. */
export async function kopf(tx: Tx, projektId: string): Promise<Kopf | null> {
  return (await tx.query<Kopf>(`SELECT nummer, name, vertraulich, portfolio_id FROM ${SCHEMA}.projekt WHERE id = $1`, [projektId])).rows[0] ?? null;
}

/** Anzeigenamen der Personen (Lesesicht). */
export async function personen(tx: Tx, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  return new Map((await tx.query<{ id: string; name: string | null }>(
    `SELECT id, display_name AS name FROM ${SCHEMA}.principal WHERE id = ANY ($1::uuid[])`, [ids])).rows.map(r => [r.id, r.name ?? '']));
}

/** Nummer und Name sichtbarer Projekte (Abhängigkeiten in Kap. 6). */
export async function projekte(tx: Tx, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  return new Map((await tx.query<{ id: string; t: string }>(
    `SELECT id, nummer || ' ' || name AS t FROM ${SCHEMA}.projekt WHERE id = ANY ($1::uuid[])`, [ids])).rows.map(r => [r.id, r.t]));
}

export interface Bezeichnungen { kategorie: string | null; handlungsfeld: string | null; ziel: string | null; jahresziel: string | null; rollen: Map<string, string> }

/**
 * Bezeichnungen aus der Konfiguration (volle Sicht): Kategorie des Portfolios (Deckblatt «Projektkategorie»),
 * Handlungsfeld, Ziele (Nummer und Text), Rollen des Ressourcenbedarfs.
 */
export async function bezeichnungen(tx: Tx, o: { portfolioId: string; handlungsfeldId: string | null; zielId: string | null; jahreszielId: string | null }): Promise<Bezeichnungen> {
  const eins = async (sql: string, id: string | null) => (id ? (await tx.query<{ t: string }>(sql, [id])).rows[0]?.t ?? null : null);
  return {
    kategorie: await eins(`SELECT kategorie AS t FROM ${SCHEMA}.portfolio WHERE id = $1`, o.portfolioId),
    handlungsfeld: await eins(`SELECT label AS t FROM ${SCHEMA}.handlungsfeld WHERE id = $1`, o.handlungsfeldId),
    ziel: await eins(`SELECT nummer || ' ' || text AS t FROM ${SCHEMA}.strategisches_ziel WHERE id = $1`, o.zielId),
    jahresziel: await eins(`SELECT nummer || ' ' || text || ' (' || jahr || ')' AS t FROM ${SCHEMA}.jahresziel WHERE id = $1`, o.jahreszielId),
    rollen: new Map((await tx.query<{ schluessel: string; label: string }>(
      `SELECT schluessel, label FROM ${SCHEMA}.codewert WHERE codetabelle = 'ressourcenrolle'`)).rows.map(r => [r.schluessel, r.label])),
  };
}
