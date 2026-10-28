/**
 * Versionsvergleich und Hauptänderungen (AP-E3-4; PS.03.04, UC-007 Schritt 2, UC-003 Schritt 5; K2 Schritt 5, UI-10):
 * Je Kapitel die Unterschiede zwischen zwei Versionen – Texte alt und neu, Listeneinträge «neu» / «entfernt» /
 * «geändert» (Q-B5), Zahlen mit Differenz. Aus dem Vergleich zur Basisversion erzeugt das System die Hauptänderungen in
 * den Rubriken Scope, Zeitplan, Ressourcen/Budget, Annahmen und Key-Risiken; die PL kann jede Rubrik umformulieren und
 * ergänzt «Andere» (gespeichert in `vertrag_version.hauptaenderungen` und `andere`).
 *
 * Welche Kapitel eine Rubrik speisen, legt die Vorlage nicht fest (Q7 nennt nur die Rubriken). Zuordnung hier:
 * Scope = Kap. 3 Ziele, Kap. 4 Lösungsansatz, Kap. 5 Abgrenzung; Zeitplan = Kap. 7; Ressourcen/Budget = Kap. 9;
 * Annahmen = Kap. 4 Annahmen; Key-Risiken = Kap. 10. Übrige Kapitel erscheinen im Vergleich, nicht in den Rubriken.
 *
 * Beträge (Kap. 9) vergleicht nur, wer sie sehen darf (A-33): ohne Recht sind sie auf beiden Seiten null.
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import { ANZAHL_KAPITEL, KAPITEL, ohneBetraege, titel } from './kapitel.ts';
import * as store from './store.ts';

export const RUBRIKEN = ['scope', 'zeitplan', 'ressourcen_budget', 'annahmen', 'key_risiken'] as const;
export type Rubrik = (typeof RUBRIKEN)[number];
export const RUBRIK_TEXT: Record<Rubrik, string> = {
  scope: 'Scope', zeitplan: 'Zeitplan', ressourcen_budget: 'Ressourcen/Budget', annahmen: 'Annahmen', key_risiken: 'Key-Risiken',
};

export type Art = 'neu' | 'entfernt' | 'geaendert';
export interface Unterschied {
  /** Feld im Kapitel (z. B. `kosten`, `termine.projektabschluss`) */
  feld: string;
  /** Bezeichnung des Felds bzw. der Liste */
  label: string;
  /** Listeneintrag (Bezeichnung) oder null bei einem Feld des Kapitels */
  eintrag: string | null;
  /** Feld im Listeneintrag, das sich geändert hat (z. B. `termin`), sonst null */
  eintragFeld: string | null;
  art: Art;
  alt: unknown;
  neu: unknown;
  /** neu − alt bei Zahlen */
  differenz: number | null;
}
export interface KapitelVergleich { kapitel: number; titel: string; geaendert: boolean; unterschiede: Unterschied[] }

type Obj = Record<string, unknown>;

// ---------------------------------------------------------------- Bezeichnungen

/** Bezeichnungen der Felder für Vergleich und Hauptänderungen (Q7); fehlt eine, gilt die Beschreibung des Schemas. */
const LABEL: Record<string, string> = {
  ausgangslage: 'Ausgangslage', problemstellung: 'Problemstellung', ohneProjekt: 'Ohne Projekt', vorprojekte: 'Vorprojekte',
  rahmenbedingungen: 'Rahmenbedingungen', handlungsfeldId: 'Handlungsfeld', strategischesZielId: 'Strategisches Ziel',
  jahreszielId: 'Jahresziel', beitrag: 'Beitrag zum Ziel', ziele: 'Ziele', nutzen: 'Nutzenbeitrag', businessCase: 'Business Case',
  kpis: 'KPIs', loesungsansatz: 'Lösungsansatz', annahmen: 'Annahmen', bearbeitet: 'Im Projekt bearbeitet',
  nichtBearbeitet: 'Nicht bearbeitet', abhaengigkeiten: 'Abhängigkeiten', schnittstellen: 'Schnittstellen', vorgehen: 'Vorgehen',
  meilensteine: 'Meilensteine und Lieferergebnisse', 'termine.projektStart': 'Projektstart', 'termine.phasenStart': 'Phasenstart',
  'termine.phasenExit': 'Phasenexit', 'termine.projektabschluss': 'Projektabschluss', toleranzen: 'Toleranzen', mitglieder: 'Projektorganisation',
  kosten: 'Kosten', personal: 'Personal', risiken: 'Risiken', stakeholder: 'Stakeholder', kommunikation: 'Kommunikation',
  bemerkung: 'Bemerkung', beilagen: 'Beilagen',
  // Felder in Listeneinträgen
  termin: 'Termin', phase: 'Phase', art: 'Art', text: 'Bezeichnung', betrag: 'Betrag', lieferant: 'Lieferant', offerte: 'Offerte',
  rolle: 'Rolle', groesse: 'Grösse', fte: 'FTE', vonMonat: 'von', bisMonat: 'bis', wahrscheinlichkeit: 'EW', auswirkung: 'AW',
  massnahme: 'Massnahme', verantwortlich: 'Verantwortlich', einheit: 'Einheit', zielwert: 'Zielwert', zuProjektId: 'Projekt',
  ansprechperson: 'Ansprechperson', personId: 'Person', funktion: 'Funktion', akv: 'AKV', gruppe: 'Stakeholder',
  interesse: 'Interesse', einfluss: 'Einfluss', massnahmen: 'Massnahmen', adressat: 'Adressat', ziel: 'Ziel',
  bezeichnung: 'Bezeichnung', version: 'Version', inhalt: 'Inhalt', dimension: 'Dimension', wert: 'Wert',
};
const label = (feld: string) => LABEL[feld] ?? feld;
const TOLERANZ: Record<string, string> = { termin: 'Termin', kosten: 'Kosten', umfang: 'Umfang' };

/** Wie Einträge einer Liste ohne `registerId` wiedergefunden werden (natürlicher Schlüssel). */
const SCHLUESSEL: Record<string, (e: Obj) => string> = {
  kpis: e => String(e.text), abhaengigkeiten: e => String(e.zuProjektId), meilensteine: e => `${e.phase}:${e.text}`,
  mitglieder: e => `${e.funktion}:${e.personId}`, kosten: e => `${e.phase}:${e.art}:${e.text}`, personal: e => `${e.phase}:${e.rolle}`,
  risiken: e => String(e.text), stakeholder: e => String(e.gruppe), kommunikation: e => `${e.phase}:${e.text}`,
  beilagen: e => String(e.bezeichnung), toleranzen: e => String(e.dimension),
};

/** Bezeichnung eines Listeneintrags für Vergleich und Hauptänderungen. */
function eintragText(liste: string, e: Obj): string {
  if (liste === 'personal') return `${e.phase} ${e.rolle}`;
  if (liste === 'kosten') return `${e.phase} ${e.text}`;
  if (liste === 'mitglieder') return `${String(e.funktion).toUpperCase()} ${e.personId}`;
  if (liste === 'abhaengigkeiten') return String(e.text);
  if (liste === 'toleranzen') return `Toleranz ${TOLERANZ[String(e.dimension)] ?? e.dimension}`;
  return String(e.text ?? e.gruppe ?? e.bezeichnung ?? '');
}

// ---------------------------------------------------------------- Vergleich

const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const leer = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
const zahl = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const diff = (alt: unknown, neu: unknown) => (zahl(alt) && zahl(neu) ? Math.round((neu - alt) * 100) / 100 : null);
/** Felder ohne fachliche Bedeutung im Vergleich (Verweis ins Register setzt das System). */
const OHNE = new Set(['registerId']);

/** Listen paaren: zuerst über `registerId`, dann über den natürlichen Schlüssel, dann über gleichen Inhalt. */
function paaren(liste: string, alt: Obj[], neu: Obj[]): { paare: [Obj, Obj][]; entfernt: Obj[]; hinzu: Obj[] } {
  const offenA = [...alt], offenN = [...neu];
  const paare: [Obj, Obj][] = [];
  const nimm = (pruef: (a: Obj, n: Obj) => boolean) => {
    for (const n of [...offenN]) {
      const i = offenA.findIndex(a => pruef(a, n));
      if (i < 0) continue;
      paare.push([offenA[i]!, n]);
      offenA.splice(i, 1);
      offenN.splice(offenN.indexOf(n), 1);
    }
  };
  nimm((a, n) => !!a.registerId && a.registerId === n.registerId);
  const k = SCHLUESSEL[liste];
  if (k) nimm((a, n) => k(a) === k(n));
  nimm((a, n) => gleich({ ...a, registerId: null }, { ...n, registerId: null }));
  return { paare, entfernt: offenA, hinzu: offenN };
}

function feldVergleich(feld: string, alt: unknown, neu: unknown, out: Unterschied[]): void {
  if (Array.isArray(alt) || Array.isArray(neu)) {
    const { paare, entfernt, hinzu } = paaren(feld, (alt ?? []) as Obj[], (neu ?? []) as Obj[]);
    const basis = { feld, label: label(feld), differenz: null };
    for (const [a, n] of paare) {
      for (const f of [...new Set([...Object.keys(a), ...Object.keys(n)])].filter(x => !OHNE.has(x))) {
        if (!gleich(a[f], n[f])) out.push({ ...basis, eintrag: eintragText(feld, n), eintragFeld: f, art: 'geaendert', alt: a[f] ?? null, neu: n[f] ?? null, differenz: diff(a[f], n[f]) });
      }
    }
    for (const a of entfernt) out.push({ ...basis, eintrag: eintragText(feld, a), eintragFeld: null, art: 'entfernt', alt: a, neu: null });
    for (const n of hinzu) out.push({ ...basis, eintrag: eintragText(feld, n), eintragFeld: null, art: 'neu', alt: null, neu: n });
    return;
  }
  const istObjekt = (v: unknown) => v !== null && typeof v === 'object';
  if (istObjekt(alt) || istObjekt(neu)) {
    const a = (alt ?? {}) as Obj, n = (neu ?? {}) as Obj;
    for (const f of [...new Set([...Object.keys(a), ...Object.keys(n)])]) feldVergleich(`${feld}.${f}`, a[f], n[f], out);
    return;
  }
  if (gleich(alt, neu) || (leer(alt) && leer(neu))) return;
  out.push({
    feld, label: label(feld), eintrag: null, eintragFeld: null, art: leer(alt) ? 'neu' : leer(neu) ? 'entfernt' : 'geaendert',
    alt: alt ?? null, neu: neu ?? null, differenz: diff(alt, neu),
  });
}

/** Unterschiede eines Kapitels (Reihenfolge der Felder nach dem Schema). */
export function kapitelVergleichen(nr: number, alt: Obj | null, neu: Obj | null): Unterschied[] {
  const out: Unterschied[] = [];
  const felder = Object.keys(KAPITEL[nr - 1]!.properties);
  for (const f of felder) feldVergleich(f, alt?.[f], neu?.[f], out);
  return out;
}

/**
 * Zwei Versionen vergleichen (`alt` → `neu`); ohne Recht auf Beträge ohne Beträge (A-33). Fehlt ein Kapitel in einer
 * Version, gilt es als leer.
 */
export async function vergleichen(tx: Tx, altId: string, neuId: string, betraege: boolean): Promise<KapitelVergleich[]> {
  const [a, n] = [await store.kapitel(tx, altId), await store.kapitel(tx, neuId)];
  const sicht = (nr: number, x: Obj | undefined) => (x ? (betraege ? x : ohneBetraege(nr, x)) : null);
  const out: KapitelVergleich[] = [];
  for (let nr = 1; nr <= ANZAHL_KAPITEL; nr++) {
    const unterschiede = kapitelVergleichen(nr, sicht(nr, a.find(k => k.kapitel === nr)?.inhalt), sicht(nr, n.find(k => k.kapitel === nr)?.inhalt));
    out.push({ kapitel: nr, titel: titel(nr), geaendert: unterschiede.length > 0, unterschiede });
  }
  return out;
}

// ---------------------------------------------------------------- Hauptänderungen

const NB = ' ';
const tausender = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
/** Betrag wie in der Oberfläche (darstellung.md): ab 1 Mio. «CHF 2,40 Mio.», sonst «CHF 380'000». */
export function chf(n: number): string {
  const a = Math.abs(n), v = n < 0 ? '−' : '';
  if (a >= 999_500) return `${v}CHF${NB}${(a / 1_000_000).toFixed(2).replace('.', ',')}${NB}Mio.`;
  return `${v}CHF${NB}${tausender(a)}`;
}
const prozent = (alt: number, neu: number) => (alt > 0 ? ` (${neu >= alt ? '+' : '−'}${Math.round(Math.abs(neu - alt) / alt * 100)}${NB}%)` : '');
const datum = (d: unknown) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').map(Number).reverse().join('.') : null);

/** Wert eines Felds für einen Satz: Datum «31.3.2027», FTE, Text gekürzt; leer «–». */
function wert(feld: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '–';
  const d = datum(v);
  if (d) return d;
  if (feld === 'fte' && zahl(v)) return `${String(v).replace('.', ',')}${NB}FTE`;
  if (feld === 'betrag' && zahl(v)) return chf(v);
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length > 80 ? `${s.slice(0, 79)}…` : s;
}

/** Ein Satz je Unterschied (für die Rubriken). */
function satz(u: Unterschied): string {
  if (u.eintrag === null) {
    if (u.feld.startsWith('termine.')) return `${u.label}: ${wert(u.feld, u.neu)} statt ${wert(u.feld, u.alt)}`;
    return u.art === 'neu' ? `${u.label} ergänzt` : u.art === 'entfernt' ? `${u.label} entfernt` : `${u.label} geändert`;
  }
  const was = u.feld === 'risiken' ? 'Risiko' : u.feld === 'meilensteine' ? 'Meilenstein' : u.label;
  if (u.art === 'neu') {
    const n = u.neu as Obj;
    const extra = u.feld === 'risiken' ? ` (EW ${n.wahrscheinlichkeit}, AW ${n.auswirkung})` : u.feld === 'meilensteine' && n.termin ? ` (${wert('termin', n.termin)})` : '';
    return `Neu: ${was} «${u.eintrag}»${extra}`;
  }
  if (u.art === 'entfernt') return `Entfernt: ${was} «${u.eintrag}»`;
  return `${was} «${u.eintrag}»: ${label(u.eintragFeld!)} ${wert(u.eintragFeld!, u.neu)} statt ${wert(u.eintragFeld!, u.alt)}`;
}

/** Budget je Phase und gesamt mit altem und neuem Wert (K2-Abnahme: «nach einer Budgeterhöhung alter und neuer Wert»). */
function budget(alt: Obj | null, neu: Obj | null): string[] {
  const summe = (k: Obj | null) => {
    const s = new Map<string, number>();
    for (const x of ((k?.kosten ?? []) as { phase: string; betrag: number | null }[])) s.set(x.phase, (s.get(x.phase) ?? 0) + (x.betrag ?? 0));
    return s;
  };
  const [a, n] = [summe(alt), summe(neu)];
  const out: string[] = [];
  let ta = 0, tn = 0;
  for (const p of [...new Set([...a.keys(), ...n.keys()])].sort()) {
    const [x, y] = [a.get(p) ?? 0, n.get(p) ?? 0];
    ta += x; tn += y;
    if (Math.abs(x - y) >= 0.005) out.push(`Budget ${p}: ${chf(y)} statt ${chf(x)}${prozent(x, y)}`);
  }
  if (out.length > 1 || (out.length === 1 && a.size + n.size > 2)) out.push(`Budget gesamt: ${chf(tn)} statt ${chf(ta)}${prozent(ta, tn)}`);
  return out;
}

/** Rubriken aus dem Vergleich: welches Kapitel und Feld wohin gehört (Zuordnung im Kopf der Datei). */
function rubrikVon(nr: number, feld: string): Rubrik | null {
  if (nr === 4) return feld === 'annahmen' ? 'annahmen' : 'scope';
  if (nr === 3 || nr === 5) return 'scope';
  if (nr === 7) return 'zeitplan';
  if (nr === 9) return 'ressourcen_budget';
  if (nr === 10) return 'key_risiken';
  return null;
}

/**
 * Hauptänderungen erzeugen (UC-007 Schritt 2): Sätze je Rubrik aus dem Vergleich. In Ressourcen/Budget stehen die
 * Beträge als Summen je Phase mit altem und neuem Wert (nur mit Recht auf Beträge), dazu die Änderungen am Personal.
 */
export function hauptaenderungenErzeugen(vergleich: KapitelVergleich[], k9: { alt: Obj | null; neu: Obj | null }, betraege: boolean): Record<Rubrik, string[]> {
  const out = Object.fromEntries(RUBRIKEN.map(r => [r, [] as string[]])) as Record<Rubrik, string[]>;
  for (const k of vergleich) {
    for (const u of k.unterschiede) {
      const r = rubrikVon(k.kapitel, u.feld);
      // Kosten fasst `budget` je Phase zusammen; einzelne Positionen nur, wenn sie neu, entfernt oder umbenannt sind
      if (!r || (u.feld === 'kosten' && u.eintragFeld === 'betrag')) continue;
      out[r].push(satz(u));
    }
  }
  if (betraege) out.ressourcen_budget.unshift(...budget(k9.alt, k9.neu));
  for (const r of RUBRIKEN) out[r] = [...new Set(out[r])];
  return out;
}

// ---------------------------------------------------------------- gespeicherte Umformulierungen

export interface Gespeichert { rubriken: Partial<Record<Rubrik, string>>; andere: string }

export async function gespeichert(tx: Tx, versionId: string): Promise<Gespeichert | null> {
  const r = (await tx.query<{ hauptaenderungen: Record<string, unknown>; andere: string }>(
    `SELECT hauptaenderungen, andere FROM ${SCHEMA}.vertrag_version WHERE id = $1`, [versionId])).rows[0];
  if (!r) return null;
  const rubriken: Partial<Record<Rubrik, string>> = {};
  for (const x of RUBRIKEN) if (typeof r.hauptaenderungen[x] === 'string') rubriken[x] = r.hauptaenderungen[x] as string;
  return { rubriken, andere: r.andere };
}

/** Umformulierungen und «Andere» speichern (Entwurf in Arbeit, If-Match); false bei fremder Änderung. */
export async function speichern(tx: Tx, versionId: string, version: number, g: Gespeichert): Promise<boolean> {
  return ((await tx.query(
    `UPDATE ${SCHEMA}.vertrag_version SET hauptaenderungen = $3, andere = btrim($4) WHERE id = $1 AND version = $2 AND stand = 'in_arbeit'`,
    [versionId, version, JSON.stringify(g.rubriken), g.andere])).rowCount ?? 0) > 0;
}

export interface Hauptaenderungen {
  versionId: string;
  basisVersionId: string | null;
  rubriken: { rubrik: Rubrik; label: string; erzeugt: string[]; text: string | null }[];
  andere: string;
}

/**
 * Hauptänderungen einer Version gegenüber ihrer Basis: erzeugte Sätze je Rubrik und die Umformulierung der PL. Ohne
 * Recht auf Beträge zeigt «Ressourcen/Budget» nur die erzeugten Sätze ohne Beträge (die Umformulierung kann Beträge
 * enthalten, A-33).
 */
export async function hauptaenderungen(tx: Tx, v: store.VersionRow, betraege: boolean): Promise<Hauptaenderungen> {
  const g = (await gespeichert(tx, v.id)) ?? { rubriken: {}, andere: '' };
  let erzeugt = Object.fromEntries(RUBRIKEN.map(r => [r, [] as string[]])) as Record<Rubrik, string[]>;
  if (v.basis_version_id) {
    const vergleich = await vergleichen(tx, v.basis_version_id, v.id, betraege);
    const k9 = async (id: string) => (await store.einKapitel(tx, id, 9))?.inhalt ?? null;
    erzeugt = hauptaenderungenErzeugen(vergleich, { alt: await k9(v.basis_version_id), neu: await k9(v.id) }, betraege);
  }
  return {
    versionId: v.id, basisVersionId: v.basis_version_id, andere: g.andere,
    rubriken: RUBRIKEN.map(r => ({
      rubrik: r, label: RUBRIK_TEXT[r], erzeugt: erzeugt[r],
      text: r === 'ressourcen_budget' && !betraege ? null : g.rubriken[r] ?? null,
    })),
  };
}
