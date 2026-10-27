/**
 * Bedarfsliste, Zuteilung und Konflikte (BC RK.02.02, RK.02.03; UC-009 Schritte 3–4, A1, A2; AP-E7-2). Der Bedarf kommt
 * aus dem Register des Moduls projektdaten (nur über dessen `index.ts`, nur Bedarf in FTE × Monate: eine Grösse S/M/L
 * lässt sich nicht zuteilen, A-20). Deckung, Konflikte und Aufgaben rechnet dieses Modul.
 *
 * Priorität (UC-009 A1.1): Die Priorisierung nutzt dieses Modul, nicht umgekehrt (fachmodell.md 1.1); sie meldet ihre
 * Rangfolge hier an (`prioritaetQuelleSetzen` beim Laden ihres Moduls, wie die Szenarien). Ohne Quelle ist die
 * Priorität offen und Konflikte sind nach Projektnummer geordnet.
 */
import type { Actor, Tx } from '@vollholz/platform';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { projektdaten } from '../projektdaten/index.ts';
import { record } from '../../platform.ts';
import { monate, plusMonate } from './rechnung.ts';
import * as store from './store.ts';
import * as zs from './zuteilung-store.ts';

/** Rang eines Projekts (1 = höchste Priorität) und Bezeichnung der Rangfolge. */
export interface Prioritaet { rang: number; quelle: string }
export type PrioritaetQuelle = (tx: Tx, projektIds: readonly string[]) => Promise<Map<string, Prioritaet>>;
let prioritaetQuelle: PrioritaetQuelle | null = null;
export function prioritaetQuelleSetzen(q: PrioritaetQuelle | null): void { prioritaetQuelle = q; }
const prioritaeten = (tx: Tx, ids: readonly string[]) => (prioritaetQuelle && ids.length ? prioritaetQuelle(tx, ids) : Promise.resolve(new Map<string, Prioritaet>()));

/** Eine Person hat höchstens eine volle Stelle (Beschäftigungsgrad aus dem HR-System offen, RK.01.02, K23). */
export const STELLE = 1;
const EPS = 1e-9;
const rund = (x: number) => Math.round(x * 100) / 100;

export type Stand = 'offen' | 'teilweise' | 'gedeckt' | 'ungedeckt';

export interface BedarfZeile {
  id: string; projektId: string; projekt: { nummer: string; name: string } | null; phase: string; rolle: string; fte: number;
  vonMonat: string; bisMonat: string; bemerkung: string;
  /** «gedeckt» im Register (nachgeführt von `nachfuehren`). */
  gedeckt: boolean;
  /** Bedarf und Zuteilung in FTE-Monaten. */
  benoetigt: number; zugeteilt: number; stand: Stand; prioritaet: Prioritaet | null;
  luecke: zs.LueckeRow | null;
}

type Register = Awaited<ReturnType<typeof projektdaten.bedarfImZeitraum>>[number];

function zeile(b: Register): Omit<BedarfZeile, 'projekt' | 'benoetigt' | 'zugeteilt' | 'stand' | 'prioritaet' | 'luecke'> {
  return {
    id: b.id, projektId: b.projektId!, phase: String(b.phase), rolle: String(b.rolle), fte: Number(b.fte), vonMonat: String(b.vonMonat),
    bisMonat: String(b.bisMonat), bemerkung: String(b.bemerkung ?? ''), gedeckt: Boolean(b.gedeckt),
  };
}

/** Deckung je Monat: Bedarf gegen Summe der Zuteilungen. */
function deckung(b: { fte: number; vonMonat: string; bisMonat: string }, summe: Map<string, number>) {
  const ms = monate(b.vonMonat, b.bisMonat);
  const zugeteilt = ms.reduce((s, m) => s + Math.min(summe.get(m) ?? 0, b.fte), 0);
  return { benoetigt: rund(b.fte * ms.length), zugeteilt: rund(zugeteilt), voll: ms.every(m => (summe.get(m) ?? 0) >= b.fte - EPS) };
}

function stand(gedeckt: boolean, zugeteilt: number, luecke: boolean): Stand {
  if (gedeckt) return 'gedeckt';
  if (luecke) return 'ungedeckt';
  return zugeteilt > 0 ? 'teilweise' : 'offen';
}

/** Alle sichtbaren Bedarfe in FTE mit Deckung, Lücke und Priorität (UC-009 Schritt 3). */
export async function bedarfe(tx: Tx): Promise<BedarfZeile[]> {
  const register = (await projektdaten.bedarfImZeitraum(tx, '0001-01', '9999-12')).map(zeile);
  const ids = register.map(b => b.id);
  const summen = new Map<string, Map<string, number>>();
  for (const z of await zs.list(tx, { bedarfIds: ids })) {
    const m = summen.get(z.ressourcenbedarf_id) ?? new Map<string, number>();
    m.set(z.monat, (m.get(z.monat) ?? 0) + z.fte);
    summen.set(z.ressourcenbedarf_id, m);
  }
  const luecken = await zs.luecken(tx, ids);
  const projektIds = [...new Set(register.map(b => b.projektId))];
  const projekte = new Map((await store.projekte(tx, projektIds)).map(p => [p.id, { nummer: p.nummer, name: p.name }]));
  const prio = await prioritaeten(tx, projektIds);
  return register.map(b => {
    const d = deckung(b, summen.get(b.id) ?? new Map());
    const luecke = luecken.get(b.id) ?? null;
    // `gedeckt` bleibt der Stand im Register; `stand` ist die Rechnung aus den Zuteilungen
    return {
      ...b, projekt: projekte.get(b.projektId) ?? null, benoetigt: d.benoetigt, zugeteilt: d.zugeteilt, stand: stand(d.voll, d.zugeteilt, !!luecke),
      prioritaet: prio.get(b.projektId) ?? null, luecke,
    };
  });
}

export async function bedarf(tx: Tx, id: string): Promise<BedarfZeile | null> {
  return (await bedarfe(tx)).find(b => b.id === id) ?? null;
}

/**
 * Nach jeder Änderung: «gedeckt» im Register nachführen (RK.02.04), eine gemeldete Lücke entfällt, sobald der Bedarf
 * gedeckt ist; Sammelaufgaben der RM nachführen.
 */
export async function nachfuehren(tx: Tx, who: Actor, bedarfId: string): Promise<BedarfZeile> {
  const b = (await bedarf(tx, bedarfId))!;
  if (b.gedeckt !== (b.stand === 'gedeckt')) await projektdaten.bedarfGedeckt(tx, who, b.id, b.stand === 'gedeckt');
  if (b.stand === 'gedeckt' && b.luecke) await zs.lueckeEntfernen(tx, b.id);
  await aufgabenNachfuehren(tx);
  return (await bedarf(tx, bedarfId))!;
}

// ---------------------------------------------------------------- Konflikte (UC-009 A1)

export interface Beteiligt { zuteilungId: string; projektId: string; projekt: { nummer: string; name: string } | null; personId: string; personName: string | null; rolle: string; fte: number; version: number; prioritaet: Prioritaet | null }
export interface Konflikt {
  art: 'person' | 'pool'; monat: string; personId: string | null; personName: string | null; rolle: string | null;
  summe: number; grenze: number; beteiligte: Beteiligt[];
}

/**
 * Überbuchungen im Zeitraum: eine Person mit mehr als einer Stelle oder eine Rolle (Pool) mit mehr Zuteilung als
 * erfasstem Angebot (Monate ohne Angebot zeigt die Auslastung als «ohne Angebot»). Beteiligte nach Priorität (höchste zuerst; ohne Priorität nach Projektnummer).
 */
export async function konflikte(tx: Tx, von: string, bis: string): Promise<Konflikt[]> {
  const out: Konflikt[] = [];
  for (const p of await zs.belegungJePerson(tx, von, bis)) {
    if (p.fte > STELLE + EPS) out.push({ art: 'person', monat: p.monat, personId: p.person_id, personName: p.person_name, rolle: null, summe: rund(p.fte), grenze: STELLE, beteiligte: [] });
  }
  const angebot = new Map((await store.list(tx, von, bis)).map(a => [`${a.rolle}|${a.monat}`, a.fte]));
  for (const r of await zs.belegungJeRolle(tx, von, bis)) {
    // Ohne erfasstes Angebot keine Grenze (die Auslastung zeigt «ohne Angebot»)
    const a = angebot.get(`${r.rolle}|${r.monat}`);
    if (a !== undefined && r.fte > a + EPS) out.push({ art: 'pool', monat: r.monat, personId: null, personName: null, rolle: r.rolle, summe: rund(r.fte), grenze: a, beteiligte: [] });
  }
  const rows = new Map<Konflikt, Awaited<ReturnType<typeof zs.beteiligte>>>();
  for (const k of out) rows.set(k, await zs.beteiligte(tx, k.monat, k.art === 'person' ? { personId: k.personId! } : { rolle: k.rolle! }));
  const ids = [...new Set([...rows.values()].flat().map(z => z.projekt_id))];
  const projekte = new Map((await store.projekte(tx, ids)).map(p => [p.id, { nummer: p.nummer, name: p.name }]));
  const prio = await prioritaeten(tx, ids);
  for (const [k, zs_] of rows) {
    k.beteiligte = zs_.map(z => ({
      zuteilungId: z.id, projektId: z.projekt_id, projekt: projekte.get(z.projekt_id) ?? null, personId: z.person_id, personName: z.person_name,
      rolle: z.rolle, fte: z.fte, version: z.version, prioritaet: prio.get(z.projekt_id) ?? null,
    })).sort((a, b) => (a.prioritaet?.rang ?? Infinity) - (b.prioritaet?.rang ?? Infinity) || (a.projekt?.nummer ?? '').localeCompare(b.projekt?.nummer ?? ''));
  }
  return out.sort((a, b) => a.monat.localeCompare(b.monat) || a.art.localeCompare(b.art) || (a.personName ?? a.rolle ?? '').localeCompare(b.personName ?? b.rolle ?? ''));
}

/** Konflikte, die eine Zuteilung berühren (Warnung nach dem Speichern, UC-009 A1.1). */
export async function konflikteFuer(tx: Tx, personId: string, rolle: string, ms: readonly string[]): Promise<Konflikt[]> {
  if (!ms.length) return [];
  const alle = await konflikte(tx, ms[0]!, ms[ms.length - 1]!);
  return alle.filter(k => ms.includes(k.monat) && (k.personId === personId || k.rolle === rolle));
}

// ---------------------------------------------------------------- Aufgaben (fachmodell.md 4.2) und Mitteilungen

const LINK = '/portfolio/ressourcen/bedarf';
const BEZUG = { typ: 'ressourcen', id: 'bedarf' };
const KONFLIKT_BEZUG = { typ: 'ressourcen', id: 'konflikte' };

/** Laufender Monat «JJJJ-MM» (Zeitzone der Organisation). */
async function laufenderMonat(tx: Tx): Promise<string> {
  return (await tx.query<{ m: string }>("SELECT to_char(now() AT TIME ZONE 'Europe/Zurich', 'YYYY-MM') AS m")).rows[0]!.m;
}

/**
 * Sammelaufgaben an alle mit `ressource:write`: «Bedarf decken» für offene und teilweise gedeckte Bedarfe ab dem
 * laufenden Monat, «Konflikte auflösen» für Überbuchungen der nächsten 24 Monate. Ohne Anlass erledigt. Idempotent.
 */
export async function aufgabenNachfuehren(tx: Tx): Promise<{ offen: number; konflikte: number }> {
  const jetzt = await laufenderMonat(tx);
  const offen = (await bedarfe(tx)).filter(b => (b.stand === 'offen' || b.stand === 'teilweise') && b.bisMonat >= jetzt).length;
  const empfaenger = { recht: 'ressource:write' } as const;
  if (offen) {
    await aufgabe.oeffnen(tx, { art: 'bedarf.decken', bezug: BEZUG, empfaenger, titel: offen === 1 ? '1 Ressourcenbedarf decken' : `${offen} Ressourcenbedarfe decken`, link: `${LINK}?stand=offen` });
  } else {
    await aufgabe.erledigen(tx, { art: 'bedarf.decken', bezug: BEZUG });
  }
  const k = (await konflikte(tx, jetzt, plusMonate(jetzt, 23))).length;
  if (k) {
    await aufgabe.oeffnen(tx, { art: 'konflikt.aufloesen', bezug: KONFLIKT_BEZUG, empfaenger, titel: k === 1 ? '1 Überbuchung auflösen' : `${k} Überbuchungen auflösen`, link: `${LINK}?ansicht=konflikte` });
  } else {
    await aufgabe.erledigen(tx, { art: 'konflikt.aufloesen', bezug: KONFLIKT_BEZUG });
  }
  return { offen, konflikte: k };
}

const fmtFte = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')} FTE`;

/**
 * Zugeteilte Person und Projektleitung informieren (UC-009 Schritt 4, A1.2), ohne sensible Inhalte (I-B4). Die Person
 * erhält keine zweite Mitteilung, wenn sie selbst die Projektleitung ist.
 */
export async function informieren(tx: Tx, b: BedarfZeile, personId: string, was: string, monat: { von: string; bis: string }): Promise<void> {
  const projekt = b.projekt ? `${b.projekt.nummer} ${b.projekt.name}` : 'Projekt';
  const zeitraum = monat.von === monat.bis ? monat.von : `${monat.von} bis ${monat.bis}`;
  const link = b.projekt ? `/projekte/${b.projekt.nummer}` : LINK;
  const bezug = { typ: 'ressourcenbedarf', id: b.id };
  await mitteilung.senden(tx, { an: personId, bezug, text: `Ressourcen: ${was} – ${projekt}, Rolle ${b.rolle}, ${zeitraum}.`, link });
  const personName = (await zs.personen(tx, undefined, [personId], 1))[0]?.name ?? 'Eine Person';
  for (const pl of await zs.projektleitung(tx, [b.projektId])) {
    if (pl.person_id === personId) continue;
    await mitteilung.senden(tx, { an: pl.person_id, bezug, text: `Ressourcen: ${personName} – ${was}, Rolle ${b.rolle}, ${zeitraum}.`, link });
  }
}

/** Daten für Audit und Ereignis. */
export const snapshot = (z: zs.ZuteilungRow) => ({ id: z.id, ressourcenbedarfId: z.ressourcenbedarf_id, projektId: z.projekt_id, personId: z.person_id, monat: z.monat, fte: z.fte, version: z.version });

export { fmtFte };

/** Audit und Ereignis einer Zuteilung in derselben Transaktion. */
export const protokoll = (tx: Tx, who: Actor, action: 'zuteilung.created' | 'zuteilung.updated' | 'zuteilung.deleted', id: string, data: Record<string, unknown>, event: Record<string, unknown>) =>
  record(tx, who, { action, resourceType: 'zuteilung', resourceId: id, data, event });
