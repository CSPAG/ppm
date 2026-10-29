/**
 * Änderungsantrag am Projektvertrag (AP-E3-4; PS.03.01, PS.03.02; UC-007; K2 Schritte 1–5, 9): Die PL legt einen
 * Entwurf mit Anlass «Änderung» aus der Baseline an (Schritt 1), passt Kapitel an und begründet (Schritt 2), reicht beim
 * Sponsor ein (Schritt 3, kein Quality-Check). Der SP gibt frei – die Version wird Baseline (Schritt 4) –, lehnt mit
 * Begründung ab (A2) oder unterstützt den Antrag an den PRAT, wenn die Änderung Scope, Budget oder Ressourcen betrifft (A1).
 * Welche Kapitel diese Wirkung haben, legt die UE im Phasenmodell fest (`kapitel_wirkung`, fachmodell.md 6); das System
 * leitet sie aus den gegenüber der Baseline geänderten Kapiteln ab (K2 Entscheide).
 *
 * Der Antrag an den PRAT ist ein Traktandum der Art `aenderung` (Registry von `sitzung`, fachmodell.md 2.9); bei
 * «Freigegeben» setzt die Folge die Baseline, bei «Abgelehnt» ist der Entwurf abgelehnt (UC-007 A1.2). Die Folge läuft in
 * der Transaktion der UE, die kein `vertrag:write` hat: dafür setzt das Modul `app.vertrag_intern` (200_vertrag_aenderung).
 */
import { conflict, invalid, systemActor, type Actor, type Tx } from '@vollholz/platform';
import { aufgabe, mitteilung } from '../eingang/index.ts';
import { registriereTraktandenart, traktandum, type EntscheidFolge, type FolgeKontext } from '../sitzung/index.ts';
import { record, SCHEMA } from '../../platform.ts';
import { baselineSetzen } from './baseline.ts';
import { entwurfsanlass, type Phasenmodell } from './entwurf.ts';
import { pruefen } from './pflichtangaben.ts';
import { unterzeichnende } from './pruefung.ts';
import * as store from './store.ts';
import { hauptaenderungen } from './vergleich.ts';

export const ART_AUFGABE = 'aenderung.entscheiden';
export const ENTSCHEIDE = ['freigegeben', 'abgelehnt', 'an_prat'] as const;
export type Entscheid = (typeof ENTSCHEIDE)[number];
/** Ergebnisse des Gremiums (K3 Schritt 8: «Änderung (UC-007 A1) · Freigegeben · Abgelehnt»). */
export const ERGEBNISSE = [{ schluessel: 'freigegeben', label: 'Freigegeben' }, { schluessel: 'abgelehnt', label: 'Abgelehnt' }] as const;

export const DIMENSIONEN = ['scope', 'budget', 'ressourcen'] as const;
export type Dimension = (typeof DIMENSIONEN)[number];
const DIMENSION_TEXT: Record<Dimension, string> = { scope: 'Scope', budget: 'Budget', ressourcen: 'Ressourcen' };

const link = (p: store.ProjektKopf) => `/projekte/${p.nummer}/vertrag/aenderung`;
const kontext = (p: store.ProjektKopf, v: store.VersionRow) => `${p.nummer} ${p.name} · Version ${v.nummer}`;
const kurz = (t: string, n = 200) => { const s = t.trim().replace(/\s+/g, ' '); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const und = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} und ${xs.at(-1)}` : xs[0] ?? '');

// ---------------------------------------------------------------- Entwurf (UC-007 Schritt 1)

/** Nächste Nummer nach der Baseline: gleiche Hauptnummer, nächste freie Unternummer («1.0» → «1.1», nach «1.1» abgelehnt «1.2»). */
export function naechsteNummer(baseline: string, versionen: readonly { nummer: string }[]): string {
  const haupt = baseline.split('.')[0]!;
  const unter = versionen.filter(v => v.nummer.split('.')[0] === haupt).map(v => Number(v.nummer.split('.')[1]));
  return `${haupt}.${Math.max(...unter) + 1}`;
}

entwurfsanlass.registrieren('aenderung', {
  moeglich: ({ projekt, versionen }) => {
    if (projekt.lebenszyklus !== 'aktiv' && projekt.lebenszyklus !== 'sistiert') return `Das Projekt ${projekt.nummer} kann nur noch gelesen werden.`;
    if (!versionen.some(v => v.baseline)) return 'Das Projekt hat noch keinen freigegebenen Projektvertrag (Baseline); eine Änderung setzt ihn voraus.';
    return null;
  },
  // Der Entwurf übernimmt die Baseline vollständig (K2-Abnahme), mit den Verweisen ins Register
  plan: async ({ tx, versionen }) => {
    const b = versionen.find(v => v.baseline)!;
    const kapitel = Object.fromEntries((await store.kapitel(tx, b.id)).map(k => [k.kapitel, k.inhalt]));
    return { nummer: naechsteNummer(b.nummer, versionen), zielphase: b.zielphase, basisVersionId: b.id, kapitel };
  },
});

// ---------------------------------------------------------------- Wirkung (UC-007 A1)

export interface Wirkung { prat: boolean; dimensionen: Dimension[]; kapitel: number[]; hinweis: string | null }

/**
 * Wirkung der Änderung: geänderte Kapitel mit Wirkung auf Scope, Budget oder Ressourcen nach dem Phasenmodell in Kraft.
 * Ohne Phasenmodell gibt es keine Zuordnung; dann entscheidet der Sponsor.
 */
export async function wirkung(tx: Tx, versionId: string, modell: Phasenmodell): Promise<Wirkung> {
  const geaendert = new Set((await store.kapitel(tx, versionId)).filter(k => k.geaendert).map(k => k.kapitel));
  const treffer = (modell?.kapitelWirkung ?? []).filter(w => geaendert.has(w.kapitel));
  const dimensionen = DIMENSIONEN.filter(d => treffer.some(w => w.dimension === d));
  const kapitel = [...new Set(treffer.map(w => w.kapitel))].sort((a, b) => a - b);
  return {
    prat: dimensionen.length > 0, dimensionen, kapitel,
    hinweis: dimensionen.length
      ? `Freigabe durch den PRAT: Diese Änderung betrifft ${und(dimensionen.map(d => DIMENSION_TEXT[d]))}. Du kannst sie unterstützen; entscheiden wird der PRAT.`
      : null,
  };
}

// ---------------------------------------------------------------- Entscheid an der Version

export interface EntscheidRow { entscheid: Entscheid | null; entscheid_begruendung: string; entschieden_at: Date | null; entschieden_by: string | null }

export async function entscheidVon(tx: Tx, versionId: string): Promise<EntscheidRow | null> {
  return (await tx.query<EntscheidRow>(
    `SELECT entscheid, entscheid_begruendung, entschieden_at, entschieden_by FROM ${SCHEMA}.vertrag_version WHERE id = $1`, [versionId])).rows[0] ?? null;
}

async function entscheidSetzen(tx: Tx, id: string, version: number, nach: store.Stand, e: { entscheid: Entscheid; begruendung: string; person: string }): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${SCHEMA}.vertrag_version SET stand = $3, entscheid = $4, entscheid_begruendung = btrim($5), entschieden_at = now(), entschieden_by = $6
      WHERE id = $1 AND version = $2 AND stand = 'in_pruefung' AND anlass = 'aenderung'`,
    [id, version, nach, e.entscheid, e.begruendung, e.person])).rowCount ?? 0) > 0;
}

/** Führt `fn` mit `app.vertrag_intern` aus (Folge eines Gremiumsentscheids, 200_vertrag_aenderung) und stellt den Wert wieder her. */
export async function intern<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  const prev = (await tx.query<{ v: string | null }>("SELECT current_setting('app.vertrag_intern', true) AS v")).rows[0]?.v ?? '';
  await tx.query("SELECT set_config('app.vertrag_intern', 'on', true)");
  try {
    return await fn();
  } finally {
    await tx.query("SELECT set_config('app.vertrag_intern', $1, true)", [prev ?? '']).catch(() => undefined);
  }
}

// ---------------------------------------------------------------- Einreichen (UC-007 Schritt 3)

/**
 * Änderung beim Sponsor einreichen: Pflichtangaben der Phase erfüllt, mindestens ein Kapitel geändert, ein Sponsor in der
 * Projektorganisation. Stand «in Prüfung» (beim Sponsor), Aufgabe «Änderung entscheiden» an den SP (fachmodell.md 4.2).
 * In der Transaktion der PL (`vertrag:write` prüft der Aufrufer); liefert false bei fremder Änderung (412).
 */
export async function einreichen(tx: Tx, who: Actor, o: { version: store.VersionRow; projekt: store.ProjektKopf; erwartet: number; modell: Phasenmodell }): Promise<boolean> {
  const { version: v, projekt: p } = o;
  const inhalte = Object.fromEntries((await store.kapitel(tx, v.id)).map(k => [k.kapitel, k.inhalt]));
  const fehlend = pruefen(o.modell, v, inhalte).filter(a => !a.erfuellt);
  if (fehlend.length) {
    throw invalid(`Angaben für Phase ${v.zielphase} fehlen: ${fehlend.map(a => `${a.text} (Kap. ${a.kapitel})`).join(', ')}. Ergänze sie, um einzureichen.`,
      fehlend.map(a => ({ path: `/kapitel/${a.kapitel}/${a.feld}`, message: a.grund ?? a.text })));
  }
  if (!(await store.kapitel(tx, v.id)).some(k => k.geaendert)) {
    throw conflict('Die Änderung enthält noch keine Anpassung gegenüber der Baseline. Passe die betroffenen Kapitel an.', { reason: 'unveraendert' });
  }
  if (!v.begruendung.trim()) throw invalid('Begründung fehlt: Ohne Begründung kann der Sponsor die Änderung nicht beurteilen.', [{ path: '/begruendung', message: 'Pflicht bei einer Änderung.' }]);
  const sp = (await unterzeichnende(tx, p.id)).sp;
  if (!sp.length) throw conflict('Die Projektorganisation hat keinen Sponsor; ohne ihn kann niemand die Änderung entscheiden. Lege die Projektorganisation fest.', { reason: 'organisation', fehlend: ['sp'] });
  if (!(await store.standSetzen(tx, v.id, o.erwartet, ['in_arbeit'], 'in_pruefung', { eingereicht: true }))) return false;
  await aufgabe.erledigen(tx, { art: 'vertrag.ueberarbeiten', bezug: { typ: 'vertrag_version', id: v.id } });
  for (const person of sp) {
    await aufgabe.oeffnen(tx, {
      art: ART_AUFGABE, bezug: { typ: 'vertrag_version', id: v.id }, empfaenger: { person },
      titel: `Änderung am Projektvertrag ${p.name} entscheiden`, kontext: `${kontext(p, v)} · ${kurz(v.begruendung, 140)}`, link: link(p),
    });
  }
  const r = (await store.version(tx, v.id))!;
  const daten = { id: v.id, projektId: p.id, nummer: r.nummer, stand: r.stand };
  await record(tx, who, { action: 'vertrag.change_submitted', resourceType: 'vertrag_version', resourceId: v.id, data: { ...daten, projekt: p.nummer }, event: daten });
  return true;
}

// ---------------------------------------------------------------- Vor dem Entscheid übernehmen (UC-007 A3, A-74)

/**
 * Vorab übernommen: Baseline ohne Entscheid (SP offen: `entscheid` null) bzw. ohne Entscheid des Gremiums (`an_prat`).
 * Der spätere Entscheid ersetzt den Vermerk; eine Ablehnung bleibt an der Baseline sichtbar (UC-007 A3.2).
 */
export const vorabUebernommen = (v: Pick<store.VersionRow, 'anlass' | 'stand' | 'baseline'>, e: EntscheidRow | null) =>
  v.anlass === 'aenderung' && v.stand === 'abgenommen' && v.baseline && (!e?.entscheid || e.entscheid === 'an_prat');

/**
 * Die Projektleitung übernimmt die eingereichte Änderung vor dem Entscheid als Baseline (UC-007 A3.1): Register wie bei
 * der Freigabe; die Aufgabe des SP bzw. das Traktandum bleiben offen. In voller Sicht (`vertrag:write` prüft der Aufrufer).
 */
export async function uebernehmen(tx: Tx, who: Actor, o: { version: store.VersionRow; projekt: store.ProjektKopf; erwartet: number }): Promise<boolean> {
  const { version: v, projekt: p } = o;
  if (v.stand !== 'in_pruefung' && v.stand !== 'traktandiert') throw conflict(`Version ${v.nummer} ist nicht zum Entscheid eingereicht.`, { reason: 'stand', stand: v.stand });
  if (v.version !== o.erwartet) return false;
  await baselineSetzen(tx, who, v.id);
  const r = (await store.version(tx, v.id))!;
  const daten = { id: v.id, projektId: p.id, nummer: r.nummer, stand: r.stand, vorEntscheid: true };
  await record(tx, who, { action: 'vertrag.change_adopted', resourceType: 'vertrag_version', resourceId: v.id, data: { ...daten, projekt: p.nummer }, event: daten });
  return true;
}

/** Entscheid nachtragen an einer vorab übernommenen Änderung (Stand bleibt «abgenommen», Baseline bleibt). */
async function entscheidNachtragen(tx: Tx, id: string, e: { entscheid: Entscheid; begruendung: string; person: string | null }): Promise<void> {
  await tx.query(
    `UPDATE ${SCHEMA}.vertrag_version SET entscheid = $2, entscheid_begruendung = btrim($3), entschieden_at = now(), entschieden_by = $4 WHERE id = $1 AND anlass = 'aenderung'`,
    [id, e.entscheid, e.begruendung, e.person]);
}

// ---------------------------------------------------------------- Entscheid des Sponsors (UC-007 Schritt 4, A1, A2)

/**
 * Entscheid des SP in voller Sicht (der SP hat weder `vertrag:write` noch `projekt:write`; das Recht `vertrag:decide`
 * prüft der Aufrufer): «freigegeben» setzt die Baseline mit Übernahme ins Register – gesperrt, wenn die Änderung Scope,
 * Budget oder Ressourcen betrifft (K2 Regel, Abnahme «SP kann Änderung an Kosten nicht freigeben») –, «abgelehnt» braucht
 * eine Begründung, «an_prat» schlägt das Traktandum dem entscheidenden Gremium vor. Liefert false bei fremder Änderung.
 */
export async function entscheiden(tx: Tx, who: Actor, o: {
  version: store.VersionRow; projekt: store.ProjektKopf; erwartet: number; person: string; modell: Phasenmodell; entscheid: Entscheid; begruendung: string;
}): Promise<boolean> {
  const { version: v, projekt: p } = o;
  if (v.anlass !== 'aenderung') throw conflict('Diese Version ist kein Änderungsantrag.', { reason: 'anlass' });
  const vorab = vorabUebernommen(v, await entscheidVon(tx, v.id)) && !(await entscheidVon(tx, v.id))?.entscheid;
  if (v.stand !== 'in_pruefung' && !vorab) throw conflict(`Version ${v.nummer} ist nicht zum Entscheid eingereicht.`, { reason: 'stand', stand: v.stand });
  const w = await wirkung(tx, v.id, o.modell);
  if (o.entscheid === 'freigegeben' && w.prat) throw conflict(w.hinweis!, { reason: 'prat', dimensionen: w.dimensionen, kapitel: w.kapitel });
  if (o.entscheid === 'an_prat' && !w.prat) {
    throw conflict('Diese Änderung betrifft weder Scope, Budget noch Ressourcen; du entscheidest sie selbst.', { reason: 'kein_prat' });
  }
  if (o.entscheid === 'abgelehnt' && !o.begruendung.trim()) {
    throw invalid('Begründung fehlt: Die Projektleitung erfährt sonst nicht, was zu ändern ist.', [{ path: '/begruendung', message: 'Pflicht beim Ablehnen.' }]);
  }
  const nach: store.Stand = o.entscheid === 'abgelehnt' ? 'abgelehnt' : o.entscheid === 'an_prat' ? 'traktandiert' : 'in_pruefung';
  // vorab übernommen (UC-007 A3.2): nur den Entscheid nachtragen; die Baseline bleibt, auch bei einer Ablehnung
  if (vorab) await entscheidNachtragen(tx, v.id, { entscheid: o.entscheid, begruendung: o.begruendung, person: o.person });
  else if (!(await entscheidSetzen(tx, v.id, o.erwartet, nach, { entscheid: o.entscheid, begruendung: o.begruendung, person: o.person }))) return false;

  const pl = (await unterzeichnende(tx, p.id)).pl;
  if (vorab && o.entscheid === 'abgelehnt') {
    for (const an of pl) await mitteilung.senden(tx, { an, bezug: { typ: 'vertrag_version', id: v.id }, text: `Änderung abgelehnt: Version ${v.nummer} des Projektvertrags ${p.name} ist bereits Baseline. Beantrage eine Gegenänderung; die Begründung steht beim Antrag.`, link: link(p) });
  } else if (vorab && o.entscheid === 'freigegeben') {
    for (const an of pl) await mitteilung.senden(tx, { an, bezug: { typ: 'vertrag_version', id: v.id }, text: `Änderung freigegeben: Version ${v.nummer} des Projektvertrags ${p.name} (bereits Baseline).`, link: link(p) });
  } else if (o.entscheid === 'freigegeben') {
    await baselineSetzen(tx, who, v.id);
    for (const an of pl) await mitteilung.senden(tx, { an, bezug: { typ: 'vertrag_version', id: v.id }, text: `Änderung freigegeben: Version ${v.nummer} des Projektvertrags ${p.name} ist Baseline.`, link: link(p) });
  } else if (o.entscheid === 'abgelehnt') {
    for (const an of pl) await mitteilung.senden(tx, { an, bezug: { typ: 'vertrag_version', id: v.id }, text: `Änderung abgelehnt: Version ${v.nummer} des Projektvertrags ${p.name}; die Baseline bleibt. Die Begründung steht beim Antrag.`, link: link(p) });
  } else {
    await traktandum.vorschlagen(tx, { art: 'aenderung', bezug: { typ: 'vertrag_version', id: v.id }, projektId: p.id, titel: titelVon(p), antrag: antragVon(v) });
  }
  await aufgabe.erledigen(tx, { art: ART_AUFGABE, bezug: { typ: 'vertrag_version', id: v.id } });
  const r = (await store.version(tx, v.id))!;
  const daten = { id: v.id, projektId: p.id, nummer: r.nummer, entscheid: o.entscheid, stand: r.stand, wirkung: w.dimensionen };
  await record(tx, who, { action: 'vertrag.change_decided', resourceType: 'vertrag_version', resourceId: v.id, data: { ...daten, projekt: p.nummer }, event: daten });
  return true;
}

// ---------------------------------------------------------------- Traktandenart «Änderung» (fachmodell.md 2.9)

const titelVon = (p: store.ProjektKopf) => `Änderung Projektvertrag ${p.nummer} ${p.name}`;
const antragVon = (v: store.VersionRow) => `Version ${v.nummer} freigeben: ${kurz(v.begruendung, 240)}`;

async function geschaeft(tx: Tx, bezug: { typ: string; id: string }): Promise<{ v: store.VersionRow; p: store.ProjektKopf } | null> {
  if (bezug.typ !== 'vertrag_version') return null;
  const v = await store.version(tx, bezug.id);
  const p = v && v.anlass === 'aenderung' ? await store.projekt(tx, v.projekt_id) : null;
  return v && p ? { v, p } : null;
}

/**
 * Folge des Gremiumsentscheids (UC-007 A1.2): «Freigegeben» wie Schritt 4 (Baseline), «Abgelehnt» wie A2 (Entwurf
 * abgelehnt, Baseline bleibt). Benachrichtigungen schickt die Sitzung beim Schliessen. Ist die Folge schon eingetreten,
 * bleibt sie: Eine Korrektur des Entscheids (A-30) hebt eine gesetzte Baseline nicht wieder auf (Folgearbeit).
 */
export async function beiEntscheid(tx: Tx, f: EntscheidFolge, k?: FolgeKontext): Promise<void> {
  const g = await geschaeft(tx, f.bezug);
  if (!g) return;
  // Baseline und Register im Audit mit der Person, die den Entscheid erfasst (UE)
  const who = k?.akteur ?? systemActor('system');
  // vorab übernommen (UC-007 A3.2): der Entscheid des Gremiums ersetzt den Vermerk, die Baseline bleibt
  if (vorabUebernommen(g.v, await entscheidVon(tx, g.v.id))) {
    if (f.ergebnis !== 'freigegeben' && f.ergebnis !== 'abgelehnt') return;
    await intern(tx, () => entscheidNachtragen(tx, g.v.id, { entscheid: f.ergebnis as Entscheid, begruendung: f.begruendung, person: k?.principalId ?? null }));
    const daten = { id: g.v.id, projektId: g.p.id, nummer: g.v.nummer, ergebnis: f.ergebnis, traktandumId: f.traktandumId, stand: g.v.stand, nachgetragen: true };
    await record(tx, who, { action: 'vertrag.change_decided', resourceType: 'vertrag_version', resourceId: g.v.id, data: { ...daten, projekt: g.p.nummer, gremium: true }, event: daten });
    return;
  }
  if (g.v.stand !== 'traktandiert') return;
  await intern(tx, async () => {
    if (f.ergebnis === 'freigegeben') await baselineSetzen(tx, who, g.v.id);
    else if (f.ergebnis === 'abgelehnt') await store.standSetzen(tx, g.v.id, null, ['traktandiert'], 'abgelehnt');
    else return;
    const r = (await store.version(tx, g.v.id))!;
    const daten = { id: r.id, projektId: g.p.id, nummer: r.nummer, ergebnis: f.ergebnis, traktandumId: f.traktandumId, stand: r.stand };
    await record(tx, who, { action: 'vertrag.change_decided', resourceType: 'vertrag_version', resourceId: r.id, data: { ...daten, projekt: g.p.nummer, gremium: true }, event: daten });
  });
}

/** Art `aenderung` in der Registry der Sitzung: Antrag mit Begründung und Hauptänderungen als Unterlage. */
export function registriereAenderung(): void {
  registriereTraktandenart({
    art: 'aenderung',
    label: 'Änderung',
    ergebnisse: ERGEBNISSE,
    zusammenfassung: async (tx, bezug) => {
      const g = await geschaeft(tx, bezug);
      return g ? { titel: titelVon(g.p), antrag: antragVon(g.v) } : null;
    },
    unterlagen: async (tx, bezug) => {
      const g = await geschaeft(tx, bezug);
      if (!g) return [];
      // Gremium und UE sehen Beträge (A-33); die Unterlage hält die Hauptänderungen beim Versand fest
      const h = await hauptaenderungen(tx, g.v, true);
      return [{
        art: 'packet', titel: `Änderungsantrag Version ${g.v.nummer}`, bereit: true, hinweis: 'vom Sponsor unterstützt',
        inhalt: {
          versionId: g.v.id, nummer: g.v.nummer, begruendung: g.v.begruendung, andere: h.andere,
          hauptaenderungen: h.rubriken.map(r => ({ rubrik: r.rubrik, label: r.label, text: r.text ?? r.erzeugt.join('\n') })),
        },
      }];
    },
    beiEntscheid,
  });
}
