/**
 * Datenzugriff der Register. Läuft immer in einer Transaktion mit Mandantenkontext; was die Person nicht sehen darf,
 * filtert die Lesesicht (RLS) – die Abfragen hier kennen keine Rechte. Die Register sind gleich gebaut und werden über
 * eine Beschreibung (`Register`) gelesen und geschrieben; Spalten und Felder sind fest im Code, nie aus Eingaben.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Phase } from './schemas.ts';

/** Feld der API (camelCase) → Spalte; `typ` für Umwandlungen beim Lesen. */
interface Spalte { col: string; typ?: 'datum' | 'betrag' }

export interface Register {
  /** Ressource in Audit und Ereignis (`<name>.created`). */
  name: string;
  /** Bezeichnung in Fehlermeldungen. */
  label: string;
  tabelle: string;
  /** Alle gelesenen Felder ausser id, projektId, version, createdAt, updatedAt. */
  felder: Record<string, Spalte>;
  /** Über die Routen schreibbare Felder (Teilmenge von `felder`). */
  schreibbar: readonly string[];
  /** Sortierung (Spalten der Tabelle `t`). */
  ordnung: string;
  /** Felder, die nicht ins Ereignis (Outbox) gehen (Beträge, A-33). */
  vertraulich?: readonly string[];
}

const d = (col: string): Spalte => ({ col, typ: 'datum' });
const b = (col: string): Spalte => ({ col, typ: 'betrag' });
const c = (col: string): Spalte => ({ col });

/** Reihenfolge der Phasen und Arten für Listen. */
const PHASE = 't.phase';

export const REGISTER = {
  meilenstein: {
    name: 'meilenstein', label: 'Meilenstein', tabelle: 'meilenstein',
    felder: {
      phase: c('phase'), art: c('art'), text: c('text'), adressat: c('adressat'), ziel: c('ziel'), terminBaseline: d('termin_baseline'),
      terminAktuell: d('termin_aktuell'), erreichtAm: d('erreicht_am'), abnahme: c('abnahme'), abgenommenAm: d('abgenommen_am'),
    },
    schreibbar: ['phase', 'art', 'text', 'adressat', 'ziel', 'terminAktuell', 'erreichtAm', 'abnahme'],
    ordnung: `${PHASE}, coalesce(t.termin_aktuell, t.termin_baseline) NULLS LAST, t.created_at, t.id`,
  },
  kosten: {
    name: 'kosten', label: 'Kostenposition', tabelle: 'kosten',
    felder: {
      phase: c('phase'), art: c('art'), text: c('text'), lieferant: c('lieferant'), offerte: c('offerte'),
      budgetBaseline: b('budget_baseline'), prognose: b('prognose'), ist: b('ist'),
    },
    schreibbar: ['phase', 'art', 'text', 'lieferant', 'offerte', 'prognose'],
    ordnung: `${PHASE}, t.art, t.created_at, t.id`,
    vertraulich: ['budgetBaseline', 'prognose', 'ist'],
  },
  risiko: {
    name: 'risiko', label: 'Risiko', tabelle: 'risiko',
    felder: {
      portfolioId: c('portfolio_id'), text: c('text'), wahrscheinlichkeit: c('wahrscheinlichkeit'), auswirkung: c('auswirkung'),
      massnahme: c('massnahme'), massnahmeStand: c('massnahme_stand'), verantwortlich: c('verantwortlich'),
    },
    schreibbar: ['text', 'wahrscheinlichkeit', 'auswirkung', 'massnahme', 'massnahmeStand', 'verantwortlich'],
    // hoch vor mittel vor tief, zuerst die Auswirkung
    ordnung: "array_position(ARRAY['hoch', 'mittel', 'tief'], t.auswirkung), array_position(ARRAY['hoch', 'mittel', 'tief'], t.wahrscheinlichkeit), t.created_at, t.id",
  },
  kpi: {
    name: 'kpi', label: 'KPI', tabelle: 'kpi',
    felder: { art: c('art'), text: c('text'), einheit: c('einheit'), zielwert: c('zielwert') },
    schreibbar: ['art', 'text', 'einheit', 'zielwert'],
    ordnung: "array_position(ARRAY['klinisch', 'nicht_klinisch', 'projekt'], t.art), t.created_at, t.id",
  },
  stakeholder: {
    name: 'stakeholder', label: 'Stakeholder', tabelle: 'stakeholder',
    felder: { gruppe: c('gruppe'), interesse: c('interesse'), einfluss: c('einfluss'), massnahmen: c('massnahmen') },
    schreibbar: ['gruppe', 'interesse', 'einfluss', 'massnahmen'],
    ordnung: 't.created_at, t.id',
  },
  abhaengigkeit: {
    name: 'abhaengigkeit', label: 'Abhängigkeit', tabelle: 'abhaengigkeit',
    felder: { zuProjektId: c('zu_projekt_id'), text: c('text'), ansprechperson: c('ansprechperson') },
    schreibbar: ['zuProjektId', 'text', 'ansprechperson'],
    ordnung: 't.created_at, t.id',
  },
  ressourcenbedarf: {
    name: 'ressourcenbedarf', label: 'Ressourcenbedarf', tabelle: 'ressourcenbedarf',
    felder: {
      phase: c('phase'), rolle: c('rolle'), groesse: c('groesse'), fte: b('fte'), vonMonat: c('von_monat'), bisMonat: c('bis_monat'),
      bemerkung: c('bemerkung'), gedeckt: c('gedeckt'),
    },
    schreibbar: ['phase', 'rolle', 'groesse', 'fte', 'vonMonat', 'bisMonat', 'bemerkung'],
    ordnung: `${PHASE}, t.rolle, t.id`,
  },
} as const satisfies Record<string, Register>;

export type RegisterName = keyof typeof REGISTER;

/** Eintrag eines Registers mit den Feldern der API. */
export type Eintrag = { id: string; projektId: string | null; version: number; createdAt: Date; updatedAt: Date } & Record<string, unknown>;

const T = (r: Register) => `${SCHEMA}.${r.tabelle}`;

function auswahl(r: Register): string {
  const felder = Object.entries(r.felder).map(([k, s]) => `t.${s.col} AS "${k}"`);
  return `t.id, t.projekt_id AS "projektId", ${felder.join(', ')}, t.version, t.created_at AS "createdAt", t.updated_at AS "updatedAt"`;
}

/** Datum als «JJJJ-MM-TT» (ohne Zeitzone), Beträge als Zahl. */
function wandle(r: Register, row: Record<string, unknown>): Eintrag {
  for (const [k, s] of Object.entries(r.felder)) {
    const v = row[k];
    if (v === null || v === undefined) continue;
    if (s.typ === 'datum') row[k] = v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v).slice(0, 10);
    else if (s.typ === 'betrag') row[k] = Number(v);
  }
  return row as Eintrag;
}

export interface ListFilter {
  /** Projekt oder (nur Risiken) Portfolio. */
  projektId?: string; portfolioId?: string;
  /** Nur diese Werte (Feld der API → Wert), z. B. phase, art. */
  gleich?: Record<string, string | undefined>;
  offset: number; limit: number;
}

/** Seite eines Registers (limit + 1 Zeilen, damit die Route erkennt, ob es weitergeht). */
export async function list(tx: Tx, r: Register, f: ListFilter): Promise<Eintrag[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  const arg = (v: unknown) => { args.push(v); return `$${args.length}`; };
  if (f.projektId) where.push(`t.projekt_id = ${arg(f.projektId)}`);
  if (f.portfolioId) where.push(`t.portfolio_id = ${arg(f.portfolioId)}`);
  for (const [k, v] of Object.entries(f.gleich ?? {})) {
    const s = r.felder[k];
    if (v !== undefined && s) where.push(`t.${s.col} = ${arg(v)}`);
  }
  const rows = (await tx.query<Record<string, unknown>>(
    `SELECT ${auswahl(r)} FROM ${T(r)} t WHERE ${where.join(' AND ')} ORDER BY ${r.ordnung} OFFSET ${arg(f.offset)} LIMIT ${arg(f.limit + 1)}`, args)).rows;
  return rows.map(x => wandle(r, x));
}

/** Eintrag eines Projekts (bzw. Portfolios bei Portfoliorisiken); null, wenn unbekannt oder nicht sichtbar. */
export async function get(tx: Tx, r: Register, id: string, besitzer: { projektId?: string; portfolioId?: string }): Promise<Eintrag | null> {
  const [col, wert] = besitzer.portfolioId ? ['portfolio_id', besitzer.portfolioId] : ['projekt_id', besitzer.projektId];
  const row = (await tx.query<Record<string, unknown>>(`SELECT ${auswahl(r)} FROM ${T(r)} t WHERE t.id = $1 AND t.${col} = $2`, [id, wert])).rows[0];
  return row ? wandle(r, row) : null;
}

/** Werte für INSERT/UPDATE: nur schreibbare Felder; Texte ohne Leerraum am Rand. */
function werte(r: Register, input: Record<string, unknown>, extra: Record<string, unknown> = {}): [string[], unknown[]] {
  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const k of [...r.schreibbar, ...Object.keys(extra)]) {
    const v = k in extra ? extra[k] : input[k];
    if (v === undefined) continue;
    cols.push(k in extra ? k : r.felder[k as keyof typeof r.felder]!.col);
    vals.push(typeof v === 'string' ? v.trim() : v);
  }
  return [cols, vals];
}

/** Legt an und liefert die ID (ohne RETURNING: Lesen danach unter der Lesesicht). */
export async function create(tx: Tx, r: Register, besitzer: { projektId?: string; portfolioId?: string }, input: Record<string, unknown>): Promise<string> {
  const [cols, vals] = werte(r, input, besitzer.portfolioId ? { portfolio_id: besitzer.portfolioId } : { projekt_id: besitzer.projektId });
  const id = (await tx.query<{ id: string }>('SELECT gen_random_uuid() AS id')).rows[0]!.id;
  await tx.query(
    `INSERT INTO ${T(r)} (tenant_id, id, ${cols.join(', ')}) VALUES (app.tenant_id(), $1, ${vals.map((_, i) => `$${i + 2}`).join(', ')})`, [id, ...vals]);
  return id;
}

/** Ändert nur bei passender Version; false, wenn nicht (mehr) vorhanden oder Version abweicht. */
export async function update(tx: Tx, r: Register, id: string, version: number, patch: Record<string, unknown>): Promise<boolean> {
  const [cols, vals] = werte(r, patch);
  if (!cols.length) return true;
  const sets = cols.map((col, i) => `${col} = $${i + 3}`);
  return ((await tx.query(`UPDATE ${T(r)} SET ${sets.join(', ')} WHERE id = $1 AND version = $2`, [id, version, ...vals])).rowCount ?? 0) > 0;
}

export async function remove(tx: Tx, r: Register, id: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${T(r)} WHERE id = $1 AND version = $2`, [id, version])).rowCount ?? 0) > 0;
}

/** Spalten setzen, die nur obere Module schreiben (Baseline, Ist, Abnahme, gedeckt); false, wenn nicht sichtbar. */
export async function setzen(tx: Tx, r: Register, id: string, werte: Record<string, unknown>): Promise<boolean> {
  const cols = Object.keys(werte).map(k => r.felder[k as keyof typeof r.felder]?.col ?? '');
  if (cols.some(col => !col)) throw new Error(`Unbekanntes Feld in ${r.name}`);
  const sets = cols.map((col, i) => `${col} = $${i + 2}`);
  return ((await tx.query(`UPDATE ${T(r)} SET ${sets.join(', ')} WHERE id = $1`, [id, ...Object.values(werte)])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Projekt (Tabelle aus 010, Modul projekt)

export interface ProjektKopf { id: string; nummer: string; name: string; phase: Phase; lebenszyklus: string; portfolio_id: string }

/**
 * Kopf des Projekts unter der Lesesicht (null = unbekannt oder nicht sichtbar). Nur lesend und nur die Spalten der
 * Kerntabelle aus 010 (fachmodell.md 2.5); das Modul projekt bietet dafür (noch) keine Abfrage über `index.ts`.
 */
export async function projekt(tx: Tx, id: string): Promise<ProjektKopf | null> {
  return (await tx.query<ProjektKopf>(`SELECT id, nummer, name, phase, lebenszyklus, portfolio_id FROM ${SCHEMA}.projekt WHERE id = $1`, [id])).rows[0] ?? null;
}

// ---------------------------------------------------------------- Abhängigkeiten (beidseitig)

export interface AbhaengigkeitRow extends Eintrag {
  richtung: 'ausgehend' | 'eingehend';
  anderesId: string; anderesNummer: string | null; anderesName: string | null;
}

const ABHAENGIGKEIT = `
  SELECT ${auswahl(REGISTER.abhaengigkeit)},
         CASE WHEN t.projekt_id = $1 THEN 'ausgehend' ELSE 'eingehend' END AS richtung,
         x.id AS "anderesId", p.nummer AS "anderesNummer", p.name AS "anderesName"
    FROM ${SCHEMA}.abhaengigkeit t
   CROSS JOIN LATERAL (SELECT CASE WHEN t.projekt_id = $1 THEN t.zu_projekt_id ELSE t.projekt_id END AS id) x
    LEFT JOIN ${SCHEMA}.projekt p ON p.tenant_id = t.tenant_id AND p.id = x.id`;

/**
 * Abhängigkeiten, die bei diesem Projekt erfasst sind, und solche anderer Projekte zu diesem (UC-002 Schritt 5). Das
 * andere Projekt (Nummer, Name) nur, wenn die Lesesicht es zeigt.
 */
export async function abhaengigkeiten(tx: Tx, projektId: string, offset: number, limit: number): Promise<AbhaengigkeitRow[]> {
  const rows = (await tx.query<Record<string, unknown>>(
    `${ABHAENGIGKEIT} WHERE t.projekt_id = $1 OR t.zu_projekt_id = $1 ORDER BY (t.projekt_id = $1) DESC, t.created_at, t.id OFFSET $2 LIMIT $3`,
    [projektId, offset, limit + 1])).rows;
  return rows.map(x => wandle(REGISTER.abhaengigkeit, x) as AbhaengigkeitRow);
}

/** Eine bei diesem Projekt erfasste Abhängigkeit (nur diese pflegt das Projekt). */
export async function abhaengigkeit(tx: Tx, projektId: string, id: string): Promise<AbhaengigkeitRow | null> {
  const row = (await tx.query<Record<string, unknown>>(`${ABHAENGIGKEIT} WHERE t.projekt_id = $1 AND t.id = $2`, [projektId, id])).rows[0];
  return row ? wandle(REGISTER.abhaengigkeit, row) as AbhaengigkeitRow : null;
}

/** Portfolio unter der Lesesicht sichtbar (Tabelle aus 010, nur lesend). */
export async function portfolioSichtbar(tx: Tx, id: string): Promise<boolean> {
  return ((await tx.query(`SELECT 1 FROM ${SCHEMA}.portfolio WHERE id = $1`, [id])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- KPI-Werte (PC.03.03)

export interface KpiWertRow { kpi_id: string; periode: string; wert: string; kommentar: string; version: number; updated_at: Date }

export async function kpiWerte(tx: Tx, kpiId: string, offset: number, limit: number): Promise<KpiWertRow[]> {
  return (await tx.query<KpiWertRow>(
    `SELECT kpi_id, periode, wert, kommentar, version, updated_at FROM ${SCHEMA}.kpi_wert WHERE kpi_id = $1 ORDER BY periode DESC OFFSET $2 LIMIT $3`,
    [kpiId, offset, limit + 1])).rows;
}

export async function kpiWert(tx: Tx, kpiId: string, periode: string): Promise<KpiWertRow | null> {
  return (await tx.query<KpiWertRow>(
    `SELECT kpi_id, periode, wert, kommentar, version, updated_at FROM ${SCHEMA}.kpi_wert WHERE kpi_id = $1 AND periode = $2`, [kpiId, periode])).rows[0] ?? null;
}

/** Wert anlegen (version 0) bzw. bei passender Version ändern; false bei abweichender Version. */
export async function kpiWertSetzen(tx: Tx, projektId: string, kpiId: string, periode: string, version: number, wert: number, kommentar: string): Promise<boolean> {
  if (version === 0) {
    const r = await tx.query(
      `INSERT INTO ${SCHEMA}.kpi_wert (tenant_id, projekt_id, kpi_id, periode, wert, kommentar) VALUES (app.tenant_id(), $1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, kpi_id, periode) DO NOTHING`, [projektId, kpiId, periode, wert, kommentar]);
    return (r.rowCount ?? 0) > 0;
  }
  return ((await tx.query(`UPDATE ${SCHEMA}.kpi_wert SET wert = $4, kommentar = $5 WHERE kpi_id = $1 AND periode = $2 AND version = $3`,
    [kpiId, periode, version, wert, kommentar])).rowCount ?? 0) > 0;
}

export async function kpiWertLoeschen(tx: Tx, kpiId: string, periode: string, version: number): Promise<boolean> {
  return ((await tx.query(`DELETE FROM ${SCHEMA}.kpi_wert WHERE kpi_id = $1 AND periode = $2 AND version = $3`, [kpiId, periode, version])).rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------- Meldungen (RK.02.06)

export interface MeldungRow { id: string; projekt_id: string; stelle: 'dti' | 'dbi'; text: string; gemeldet_at: Date; gemeldet_by: string | null }

export async function meldungen(tx: Tx, projektId: string, offset: number, limit: number): Promise<MeldungRow[]> {
  return (await tx.query<MeldungRow>(
    `SELECT id, projekt_id, stelle, text, gemeldet_at, gemeldet_by FROM ${SCHEMA}.meldung WHERE projekt_id = $1 ORDER BY gemeldet_at DESC, id OFFSET $2 LIMIT $3`,
    [projektId, offset, limit + 1])).rows;
}

export async function melden(tx: Tx, projektId: string, stelle: 'dti' | 'dbi', text: string): Promise<MeldungRow> {
  return (await tx.query<MeldungRow>(
    `INSERT INTO ${SCHEMA}.meldung (tenant_id, projekt_id, stelle, text) VALUES (app.tenant_id(), $1, $2, btrim($3))
     RETURNING id, projekt_id, stelle, text, gemeldet_at, gemeldet_by`, [projektId, stelle, text])).rows[0]!;
}

// ---------------------------------------------------------------- Ressourcenbedarf über Projekte (Modul ressource)

/** Bedarf in FTE aller sichtbaren Projekte, der den Zeitraum «JJJJ-MM» von–bis berührt (UC-009, A-20). */
export async function bedarfImZeitraum(tx: Tx, von: string, bis: string): Promise<Eintrag[]> {
  const r = REGISTER.ressourcenbedarf;
  const rows = (await tx.query<Record<string, unknown>>(
    `SELECT ${auswahl(r)} FROM ${T(r)} t WHERE t.fte IS NOT NULL AND t.von_monat <= $2 AND t.bis_monat >= $1 ORDER BY t.projekt_id, ${r.ordnung}`, [von, bis])).rows;
  return rows.map(x => wandle(r, x));
}
