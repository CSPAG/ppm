/** Datenzugriff der Finanzen (UC-010) unter der Lesesicht; die Abfragen kennen keine Rechte. */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Art } from './rechnen.ts';

const S = SCHEMA;

export interface ProjektRow { id: string; nummer: string; name: string; phase: string; lebenszyklus: string; portfolio_id: string; phasenmodell_id: string | null; vertraulich: boolean }

/**
 * Projekte des Portfolios (bzw. alle sichtbaren) mit sichtbaren Beträgen; das Modul projekt bietet (noch) keine Abfrage
 * über `index.ts` (wie priorisierung, ressource). Ohne `alle` nur aktive Projekte.
 */
export async function projekte(tx: Tx, o: { portfolioId?: string; alle?: boolean } = {}): Promise<ProjektRow[]> {
  return (await tx.query<ProjektRow>(
    `SELECT id, nummer, name, phase, lebenszyklus, portfolio_id, phasenmodell_id, vertraulich FROM ${S}.projekt p
     WHERE ($1::uuid IS NULL OR p.portfolio_id = $1) AND ($2 OR p.lebenszyklus = 'aktiv') AND ${S}.betrag_sichtbar(p.id)
     ORDER BY nummer`, [o.portfolioId ?? null, !!o.alle])).rows;
}

export async function projekt(tx: Tx, id: string): Promise<ProjektRow | null> {
  return (await tx.query<ProjektRow>(`SELECT id, nummer, name, phase, lebenszyklus, portfolio_id, phasenmodell_id, vertraulich FROM ${S}.projekt WHERE id = $1`, [id])).rows[0] ?? null;
}

// Kostenträger (A-16)

export async function kostentraeger(tx: Tx, projektIds: readonly string[]): Promise<Map<string, { nummer: string; version: number }>> {
  if (!projektIds.length) return new Map();
  const r = await tx.query<{ projekt_id: string; nummer: string; version: number }>(
    `SELECT projekt_id, nummer, version FROM ${S}.kostentraeger WHERE projekt_id = ANY ($1::uuid[])`, [projektIds]);
  return new Map(r.rows.map(x => [x.projekt_id, { nummer: x.nummer, version: x.version }]));
}

/** Kostenträger zuordnen bzw. ändern; `null` hebt die Zuordnung auf. Liefert false, wenn die Nummer schon vergeben ist. */
export async function kostentraegerSetzen(tx: Tx, projektId: string, nummer: string | null): Promise<boolean> {
  if (nummer === null) {
    await tx.query(`DELETE FROM ${S}.kostentraeger WHERE projekt_id = $1`, [projektId]);
    return true;
  }
  // Vergeben an ein anderes Projekt? Eine gleichzeitige Zuordnung derselben Nummer fängt der Savepoint ab (sonst bräche
  // der Fehler der Eindeutigkeit die Transaktion ab)
  const andere = await tx.query(`SELECT 1 FROM ${S}.kostentraeger WHERE nummer = $1 AND projekt_id <> $2`, [nummer, projektId]);
  if (andere.rowCount) return false;
  await tx.query('SAVEPOINT kostentraeger');
  try {
    await tx.query(
      `INSERT INTO ${S}.kostentraeger (tenant_id, projekt_id, nummer) VALUES (app.tenant_id(), $1, $2)
       ON CONFLICT (tenant_id, projekt_id) DO UPDATE SET nummer = EXCLUDED.nummer WHERE ${S}.kostentraeger.nummer <> EXCLUDED.nummer`, [projektId, nummer]);
  } catch (e) {
    if ((e as { code?: string }).code !== '23505') throw e;
    await tx.query('ROLLBACK TO SAVEPOINT kostentraeger');
    return false;
  }
  await tx.query('RELEASE SAVEPOINT kostentraeger');
  return true;
}

// Ist-Kosten (UC-010 Schritt 1)

export interface IstRow { projekt_id: string; monat: string; art: Art; betrag: number; uebernommen_at: Date }

/** Ist-Kosten der Projekte über ihren Kostenträger, nach Monat. */
export async function ist(tx: Tx, projektIds: readonly string[]): Promise<IstRow[]> {
  if (!projektIds.length) return [];
  return (await tx.query<IstRow>(
    `SELECT k.projekt_id, i.monat, i.art, i.betrag::float8 AS betrag, i.uebernommen_at
     FROM ${S}.ist_kosten i JOIN ${S}.kostentraeger k ON k.nummer = i.kostentraeger
     WHERE k.projekt_id = ANY ($1::uuid[]) ORDER BY k.projekt_id, i.monat, i.art`, [projektIds])).rows;
}

export interface Buchung { kostentraeger: string; monat: string; art: Art; betrag: number }

/** Lieferung des ERP übernehmen: die gelieferten Monate je Kostenträger ersetzen (wiederholbar). */
export async function istErsetzen(tx: Tx, buchungen: readonly Buchung[]): Promise<void> {
  const monate = [...new Set(buchungen.map(b => `${b.kostentraeger}|${b.monat}`))].map(x => x.split('|') as [string, string]);
  if (monate.length) {
    await tx.query(
      `DELETE FROM ${S}.ist_kosten i USING unnest($1::text[], $2::text[]) AS m(kt, monat) WHERE i.kostentraeger = m.kt AND i.monat = m.monat`,
      [monate.map(m => m[0]), monate.map(m => m[1])]);
  }
  if (buchungen.length) {
    await tx.query(
      `INSERT INTO ${S}.ist_kosten (tenant_id, kostentraeger, monat, art, betrag)
       SELECT app.tenant_id(), kt, monat, art, betrag FROM unnest($1::text[], $2::text[], $3::text[], $4::numeric[]) AS b(kt, monat, art, betrag)`,
      [buchungen.map(b => b.kostentraeger), buchungen.map(b => b.monat), buchungen.map(b => b.art), buchungen.map(b => b.betrag)]);
  }
}

/** Kostenträger mit Ist-Kosten, aber ohne Projekt (UC-010 A1: Zuordnung im ERP klären). */
export async function ohneProjekt(tx: Tx): Promise<{ kostentraeger: string; betrag: number; bis: string }[]> {
  return (await tx.query<{ kostentraeger: string; betrag: number; bis: string }>(
    `SELECT i.kostentraeger, sum(i.betrag)::float8 AS betrag, max(i.monat) AS bis FROM ${S}.ist_kosten i
     WHERE NOT EXISTS (SELECT 1 FROM ${S}.kostentraeger k WHERE k.nummer = i.kostentraeger)
     GROUP BY i.kostentraeger ORDER BY i.kostentraeger`)).rows;
}

// Begründungen (UC-010 Schritt 4)

export interface BegruendungRow { id: string; projekt_id: string; periode: string; text: string; version: number; updated_at: Date; updated_by: string | null }
const BEGR = 'id, projekt_id, periode, text, version, updated_at, updated_by';

export async function begruendungen(tx: Tx, projektIds: readonly string[]): Promise<BegruendungRow[]> {
  if (!projektIds.length) return [];
  return (await tx.query<BegruendungRow>(`SELECT ${BEGR} FROM ${S}.abweichung_begruendung WHERE projekt_id = ANY ($1::uuid[]) ORDER BY projekt_id, periode DESC`, [projektIds])).rows;
}

export async function begruendung(tx: Tx, projektId: string, periode: string): Promise<BegruendungRow | null> {
  return (await tx.query<BegruendungRow>(`SELECT ${BEGR} FROM ${S}.abweichung_begruendung WHERE projekt_id = $1 AND periode = $2`, [projektId, periode])).rows[0] ?? null;
}

/** Begründung festhalten; mit `version` nur, wenn sie noch gilt (sonst null). */
export async function begruendungSetzen(tx: Tx, projektId: string, periode: string, text: string, version: number | null): Promise<BegruendungRow | null> {
  if (version === null) {
    return (await tx.query<BegruendungRow>(
      `INSERT INTO ${S}.abweichung_begruendung (tenant_id, projekt_id, periode, text) VALUES (app.tenant_id(), $1, $2, btrim($3))
       ON CONFLICT (tenant_id, projekt_id, periode) DO NOTHING RETURNING ${BEGR}`, [projektId, periode, text])).rows[0] ?? null;
  }
  return (await tx.query<BegruendungRow>(
    `UPDATE ${S}.abweichung_begruendung SET text = btrim($3) WHERE projekt_id = $1 AND periode = $2 AND version = $4 RETURNING ${BEGR}`,
    [projektId, periode, text, version])).rows[0] ?? null;
}

// Budgetübergabe (A-17)

export interface Korrektur { projektId: string; capex: number | null; opex: number | null; bemerkung: string }
export interface UebergabeRow { jahr: number; stand: 'entwurf' | 'uebergeben'; inhalt: { korrekturen?: Korrektur[]; positionen?: unknown[]; summe?: unknown }; uebergeben_at: Date | null; version: number; updated_at: Date }
const UEB = 'jahr, stand, inhalt, uebergeben_at, version, updated_at';

export async function uebergabe(tx: Tx, jahr: number): Promise<UebergabeRow | null> {
  return (await tx.query<UebergabeRow>(`SELECT ${UEB} FROM ${S}.budgetuebergabe WHERE jahr = $1`, [jahr])).rows[0] ?? null;
}

/** Zuletzt übergebene Übergabe (ausgehende Schnittstelle «Jahresbedarf»). */
export async function letzteUebergabe(tx: Tx): Promise<UebergabeRow | null> {
  return (await tx.query<UebergabeRow>(`SELECT ${UEB} FROM ${S}.budgetuebergabe WHERE stand = 'uebergeben' ORDER BY uebergeben_at DESC LIMIT 1`)).rows[0] ?? null;
}

/** Korrekturen des Entwurfs setzen (anlegen mit Version 0). Liefert null bei veralteter Version. */
export async function korrekturenSetzen(tx: Tx, jahr: number, version: number, korrekturen: readonly Korrektur[]): Promise<UebergabeRow | null> {
  if (version === 0) {
    return (await tx.query<UebergabeRow>(
      `INSERT INTO ${S}.budgetuebergabe (tenant_id, jahr, inhalt) VALUES (app.tenant_id(), $1, jsonb_build_object('korrekturen', $2::jsonb))
       ON CONFLICT (tenant_id, jahr) DO NOTHING RETURNING ${UEB}`, [jahr, JSON.stringify(korrekturen)])).rows[0] ?? null;
  }
  return (await tx.query<UebergabeRow>(
    `UPDATE ${S}.budgetuebergabe SET inhalt = jsonb_build_object('korrekturen', $2::jsonb) WHERE jahr = $1 AND version = $3 AND stand = 'entwurf' RETURNING ${UEB}`,
    [jahr, JSON.stringify(korrekturen), version])).rows[0] ?? null;
}

/** Übergeben mit dem exportierten Inhalt (danach unveränderlich). */
export async function uebergeben(tx: Tx, jahr: number, version: number, inhalt: unknown): Promise<UebergabeRow | null> {
  if (version === 0) {
    return (await tx.query<UebergabeRow>(
      `INSERT INTO ${S}.budgetuebergabe (tenant_id, jahr, stand, inhalt, uebergeben_at, uebergeben_by) VALUES (app.tenant_id(), $1, 'uebergeben', $2::jsonb, now(), app.principal_id())
       ON CONFLICT (tenant_id, jahr) DO NOTHING RETURNING ${UEB}`, [jahr, JSON.stringify(inhalt)])).rows[0] ?? null;
  }
  return (await tx.query<UebergabeRow>(
    `UPDATE ${S}.budgetuebergabe SET stand = 'uebergeben', inhalt = $2::jsonb, uebergeben_at = now(), uebergeben_by = app.principal_id()
     WHERE jahr = $1 AND version = $3 AND stand = 'entwurf' RETURNING ${UEB}`, [jahr, JSON.stringify(inhalt), version])).rows[0] ?? null;
}
