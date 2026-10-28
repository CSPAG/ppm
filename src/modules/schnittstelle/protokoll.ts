/**
 * Änderungsprotokoll (BC AM.03.03; UC-018 Schritt 5): liest das Audit des Baukastens (`audit_log`, Hash-Kette, nur
 * anhängen) – keine eigene Kopie. Je Eintrag Person, Zeitpunkt, alter und neuer Wert; filterbar nach Objekt (Typ und
 * Kennung) und Zeitraum (Kalendertage Europe/Zurich). Alter und neuer Wert stammen aus `data`: Änderungen der Module
 * halten `{ before, after }` fest, Anlegen und Löschen den Stand.
 */
import type { Tx } from '@vollholz/platform';
import { csv, SCHEMA } from '../../platform.ts';

export interface Filter { objekt?: string; objektId?: string; von?: string; bis?: string; nach?: string; limit: number }

interface AuditRow {
  id: string; ts: Date; actor_kind: string; actor_id: string | null; actor_name: string | null; source: string; action: string;
  resource_type: string | null; resource_id: string | null; data: Record<string, unknown>;
}

export type Art = 'angelegt' | 'geaendert' | 'geloescht' | 'sonstig';
export interface Aenderung { feld: string; vorher: unknown; nachher: unknown }
export interface Eintrag {
  id: string; zeit: Date; person: { id: string | null; name: string | null; art: string } | null; quelle: string; aktion: string; art: Art;
  objekt: { typ: string | null; id: string | null }; aenderungen: Aenderung[];
}

/** Steuerfelder ohne fachliche Aussage (Version, Zeitstempel der Zeile). */
const STEUER = new Set(['version', 'updatedAt', 'updatedBy', 'updated_at', 'updated_by', 'createdAt', 'createdBy', 'created_at', 'created_by']);
const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const istObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function artVon(action: string): Art {
  if (/\.(created|angelegt)$/.test(action)) return 'angelegt';
  if (/\.(updated|geaendert)$/.test(action)) return 'geaendert';
  if (/\.(deleted|geloescht)$/.test(action)) return 'geloescht';
  return 'sonstig';
}

/** Alter und neuer Wert je Feld, nach Feldname (jsonb hält die Reihenfolge der Felder nicht). */
export function aenderungen(art: Art, data: Record<string, unknown>): Aenderung[] {
  const felder = (o: Record<string, unknown>) => Object.keys(o).filter(k => !STEUER.has(k) && k !== 'id').sort();
  if (istObjekt(data.before) && istObjekt(data.after)) {
    const b = data.before, a = data.after;
    return [...new Set([...felder(b), ...felder(a)])].sort().filter(k => !gleich(b[k], a[k])).map(k => ({ feld: k, vorher: b[k] ?? null, nachher: a[k] ?? null }));
  }
  if (art === 'geloescht') return felder(data).map(k => ({ feld: k, vorher: data[k], nachher: null }));
  return felder(data).map(k => ({ feld: k, vorher: null, nachher: data[k] }));
}

const eintragVon = (r: AuditRow): Eintrag => {
  const art = artVon(r.action);
  return {
    id: String(r.id), zeit: r.ts, quelle: r.source, aktion: r.action, art,
    person: r.actor_kind === 'system' && !r.actor_id ? null : { id: r.actor_id, name: r.actor_name, art: r.actor_kind },
    objekt: { typ: r.resource_type, id: r.resource_id },
    aenderungen: aenderungen(art, r.data ?? {}),
  };
};

/** Einträge, neueste zuerst; `nach` = Kennung des letzten Eintrags der vorherigen Seite. */
export async function liste(tx: Tx, f: Filter): Promise<Eintrag[]> {
  const rows = (await tx.query<AuditRow>(
    `SELECT id, ts, actor_kind, actor_id, actor_name, source, action, resource_type, resource_id, data FROM ${SCHEMA}.audit_log
     WHERE ($1::text IS NULL OR resource_type = $1) AND ($2::uuid IS NULL OR resource_id = $2)
       AND ($3::date IS NULL OR ts >= $3::date::timestamp AT TIME ZONE 'Europe/Zurich')
       AND ($4::date IS NULL OR ts < ($4::date + 1)::timestamp AT TIME ZONE 'Europe/Zurich')
       AND ($5::bigint IS NULL OR id < $5)
     ORDER BY id DESC LIMIT $6`,
    [f.objekt ?? null, f.objektId ?? null, f.von ?? null, f.bis ?? null, f.nach ?? null, f.limit + 1])).rows;
  return rows.map(eintragVon);
}

/** Objekttypen mit Einträgen (für den Filter), über den Index je Typ statt über alle Einträge. */
export async function objekte(tx: Tx): Promise<string[]> {
  return (await tx.query<{ t: string }>(
    `WITH RECURSIVE t AS (
       (SELECT resource_type AS t FROM ${SCHEMA}.audit_log WHERE resource_type IS NOT NULL ORDER BY resource_type LIMIT 1)
       UNION ALL
       SELECT (SELECT resource_type FROM ${SCHEMA}.audit_log WHERE resource_type > t.t ORDER BY resource_type LIMIT 1) FROM t WHERE t.t IS NOT NULL
     ) SELECT t FROM t WHERE t IS NOT NULL`)).rows.map(r => r.t);
}

const ART_LABEL: Record<Art, string> = { angelegt: 'angelegt', geaendert: 'geändert', geloescht: 'gelöscht', sonstig: 'Aktion' };
const QUELLE_LABEL: Record<string, string> = { ui: 'Oberfläche', api: 'API', mcp: 'Assistent (MCP)', worker: 'Hintergrund', webhook: 'Webhook', system: 'System' };
const zeitpunkt = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Europe/Zurich' });
const wert = (v: unknown): string | null => (v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v));

/** Export (UI-50, Seitentyp Bericht): eine Zeile je geändertes Feld, Einträge ohne Felder als eine Zeile. */
export function alsCsv(eintraege: readonly Eintrag[]): string {
  const kopf = ['Zeitpunkt', 'Quelle', 'Person', 'Objekt', 'Kennung', 'Art', 'Aktion', 'Feld', 'Vorher', 'Nachher'];
  const zeilen = eintraege.flatMap(e => {
    const basis = [zeitpunkt(e.zeit), QUELLE_LABEL[e.quelle] ?? e.quelle, e.person ? (e.person.name ?? e.person.id) : 'System', e.objekt.typ, e.objekt.id, ART_LABEL[e.art], e.aktion];
    return e.aenderungen.length ? e.aenderungen.map(a => [...basis, a.feld, wert(a.vorher), wert(a.nachher)]) : [[...basis, null, null, null]];
  });
  return csv([kopf, ...zeilen]);
}
