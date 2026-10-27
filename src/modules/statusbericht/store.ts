/**
 * Datenzugriff des Statusberichts (BC PS.01.01, UC-004). Läuft immer in einer Transaktion mit Mandantenkontext; was die
 * Person nicht sehen darf, filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { AbweichungIn, Stand, StatusberichtPutIn } from './schemas.ts';

export interface Row {
  id: string; projekt_id: string; periode: string; anlass: 'monatlich' | 'ausserordentlich'; stand: Stand;
  status: 'im_plan' | 'kritisch' | null; trend: string | null; phase: string; abschluss_per: string | null;
  naechster_meilenstein: string; abweichung: Partial<AbweichungIn>; abhaengigkeiten: string; entscheide: string;
  begruendung: string; massnahme: string; entscheid_noetig: boolean;
  eingereicht_at: Date | null; eingereicht_by: string | null; geprueft_at: Date | null; geprueft_by: string | null;
  version: number; created_at: Date; updated_at: Date;
}

const T = `${SCHEMA}.statusbericht`;
const COLS = `id, projekt_id, periode, anlass, stand, status, trend, phase, to_char(abschluss_per, 'YYYY-MM-DD') AS abschluss_per,
  naechster_meilenstein, abweichung, abhaengigkeiten, entscheide, begruendung, massnahme, entscheid_noetig,
  eingereicht_at, eingereicht_by, geprueft_at, geprueft_by, version, created_at, updated_at`;

/** Projekt, soweit der Bericht es braucht (Kopf, Phase, Lebenszyklus); Tabelle aus 010_portfolio_projekt. */
export interface ProjektRow { id: string; nummer: string; name: string; phase: string; lebenszyklus: string; portfolio_id: string }

export async function projekt(tx: Tx, id: string): Promise<ProjektRow | null> {
  return (await tx.query<ProjektRow>(`SELECT id, nummer, name, phase, lebenszyklus, portfolio_id FROM ${SCHEMA}.projekt WHERE id = $1`, [id])).rows[0] ?? null;
}

/** Stand der Periode; ohne Zeile ist sie offen (entsteht mit dem ersten Bericht). */
export async function periodeStand(tx: Tx, periode: string): Promise<'offen' | 'abgeschlossen'> {
  return (await tx.query<{ stand: 'offen' | 'abgeschlossen' }>(`SELECT stand FROM ${SCHEMA}.periode WHERE periode = $1`, [periode])).rows[0]?.stand ?? 'offen';
}

/** Periode offen anlegen, falls es sie noch nicht gibt; liefert ihren Stand. */
export async function periodeSichern(tx: Tx, periode: string): Promise<'offen' | 'abgeschlossen'> {
  await tx.query(`INSERT INTO ${SCHEMA}.periode (tenant_id, periode) VALUES (app.tenant_id(), $1) ON CONFLICT DO NOTHING`, [periode]);
  return (await tx.query<{ stand: 'offen' | 'abgeschlossen' }>(`SELECT stand FROM ${SCHEMA}.periode WHERE periode = $1`, [periode])).rows[0]!.stand;
}

export async function get(tx: Tx, projektId: string, periode: string, o: { sperren?: boolean } = {}): Promise<Row | null> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} WHERE projekt_id = $1 AND periode = $2${o.sperren ? ' FOR UPDATE' : ''}`, [projektId, periode])).rows[0] ?? null;
}

/** Letzter eingereichter Bericht vor der Periode (Vorbelegung, UC-004 Schritt 1). */
export async function vorperiode(tx: Tx, projektId: string, periode: string): Promise<Row | null> {
  return (await tx.query<Row>(
    `SELECT ${COLS} FROM ${T} WHERE projekt_id = $1 AND periode < $2 AND stand <> 'entwurf' ORDER BY periode DESC LIMIT 1`, [projektId, periode])).rows[0] ?? null;
}

/** Berichte eines Projekts, neueste Periode zuerst. */
export async function list(tx: Tx, projektId: string): Promise<Row[]> {
  return (await tx.query<Row>(`SELECT ${COLS} FROM ${T} WHERE projekt_id = $1 ORDER BY periode DESC`, [projektId])).rows;
}

const COLUMN = {
  anlass: 'anlass', status: 'status', trend: 'trend', abschlussPer: 'abschluss_per', naechsterMeilenstein: 'naechster_meilenstein',
  abweichung: 'abweichung', abhaengigkeiten: 'abhaengigkeiten', entscheide: 'entscheide', begruendung: 'begruendung',
  massnahme: 'massnahme', entscheidNoetig: 'entscheid_noetig',
} as const satisfies Record<keyof StatusberichtPutIn, string>;

const wert = (k: keyof StatusberichtPutIn, v: unknown) => (k === 'abweichung' ? JSON.stringify(v) : typeof v === 'string' && k !== 'abschlussPer' ? v.trim() : v);

/** Neuer Entwurf mit den Feldern (Vorbelegung und Eingaben). */
export async function create(tx: Tx, projektId: string, periode: string, phase: string, felder: StatusberichtPutIn): Promise<Row> {
  const cols = ['tenant_id', 'projekt_id', 'periode', 'phase'];
  const vals = ['app.tenant_id()', '$1', '$2', '$3'];
  const args: unknown[] = [projektId, periode, phase];
  for (const k of Object.keys(COLUMN) as (keyof typeof COLUMN)[]) {
    if (felder[k] === undefined) continue;
    args.push(wert(k, felder[k]));
    cols.push(COLUMN[k]);
    vals.push(`$${args.length}`);
  }
  return (await tx.query<Row>(`INSERT INTO ${T} (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING ${COLS}`, args)).rows[0]!;
}

/** Entwurf ändern, nur bei passender Version; null sonst. */
export async function update(tx: Tx, id: string, version: number, phase: string, felder: StatusberichtPutIn): Promise<Row | null> {
  const args: unknown[] = [id, version, phase];
  const sets = ['phase = $3'];
  for (const k of Object.keys(COLUMN) as (keyof typeof COLUMN)[]) {
    if (felder[k] === undefined) continue;
    args.push(wert(k, felder[k]));
    sets.push(`${COLUMN[k]} = $${args.length}`);
  }
  return (await tx.query<Row>(`UPDATE ${T} SET ${sets.join(', ')} WHERE id = $1 AND version = $2 RETURNING ${COLS}`, args)).rows[0] ?? null;
}

/** Übergang des Bearbeitungsstands (Einreichen, Zurückziehen); null bei abweichender Version. */
export async function stand(tx: Tx, id: string, version: number, nach: 'eingereicht' | 'entwurf', phase: string): Promise<Row | null> {
  const eingereicht = nach === 'eingereicht';
  return (await tx.query<Row>(
    `UPDATE ${T} SET stand = $3, phase = $4,
       eingereicht_at = CASE WHEN $5 THEN now() END, eingereicht_by = CASE WHEN $5 THEN app.principal_id() END
     WHERE id = $1 AND version = $2 RETURNING ${COLS}`, [id, version, nach, phase, eingereicht])).rows[0] ?? null;
}

/** Sekunden seit dem Einreichen nach der Uhr der Datenbank (Rückgängig, G6). */
export async function sekundenSeitEinreichen(tx: Tx, id: string): Promise<number | null> {
  return (await tx.query<{ s: number | null }>(`SELECT extract(epoch FROM clock_timestamp() - eingereicht_at)::float8 AS s FROM ${T} WHERE id = $1`, [id])).rows[0]?.s ?? null;
}
