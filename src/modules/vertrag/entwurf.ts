/**
 * Entwurf anlegen (K2 Schritt 1; UX-E5, A-29: höchstens ein Entwurf je Projekt). Der erste Vertrag (Anlass `initial`,
 * UC-002 Schritt 1) gehört diesem Paket; Gate (AP-E3-3, UC-003 Schritt 2) und Änderung (AP-E3-4, UC-007 Schritt 1)
 * registrieren ihren Anlass in ihren Dateien mit `entwurfsanlass.registrieren` (eine Zeile in `index.ts`).
 */
import { conflict, invalid, type Actor, type Tx } from '@vollholz/platform';
import type { aktuellesPhasenmodell } from '../phasenmodell/index.ts';
import { record } from '../../platform.ts';
import { ANZAHL_KAPITEL, leer, PHASEN, type Phase } from './kapitel.ts';
import * as store from './store.ts';

/** Was ein Anlass für den neuen Entwurf festlegt; Kapitel ohne Angabe beginnen leer. */
export interface EntwurfPlan {
  nummer: string;
  zielphase: Phase;
  basisVersionId: string | null;
  kapitel: Partial<Record<number, Record<string, unknown>>>;
}
/** Phasenmodell in Kraft (Konfiguration der Organisation, in voller Sicht gelesen). */
export type Phasenmodell = Awaited<ReturnType<typeof aktuellesPhasenmodell>>;
export interface EntwurfKontext {
  tx: Tx;
  modell: Phasenmodell;
  projekt: store.ProjektKopf;
  /** Alle Versionen des Projekts, neueste zuerst. */
  versionen: store.VersionRow[];
  begruendung: string;
}
export type Anlassregel = {
  /** Ob der Anlass jetzt möglich ist; sonst der Grund (Sie-Form). */
  moeglich: (k: Omit<EntwurfKontext, 'tx' | 'begruendung' | 'modell'>) => string | null;
  plan: (k: EntwurfKontext) => Promise<EntwurfPlan>;
};

const REGELN = new Map<store.Anlass, Anlassregel>();

/** Registry der Anlässe (fachmodell.md 7.2: Erweiterungspakete registrieren sich, statt `routes.ts` zu ändern). */
export const entwurfsanlass = {
  registrieren(anlass: store.Anlass, regel: Anlassregel): void { REGELN.set(anlass, regel); },
  regel: (anlass: store.Anlass) => REGELN.get(anlass),
  anlaesse: () => [...REGELN.keys()],
};

/** Laufender Entwurf des Projekts (höchstens einer). */
export const entwurfVon = (versionen: store.VersionRow[]) => versionen.find(v => store.ENTWURF.includes(v.stand)) ?? null;

const ANLASS_TEXT: Record<store.Anlass, string> = { initial: 'den ersten Vertrag', gate: 'das Gate', aenderung: 'die Änderung' };

/**
 * Entwurf anlegen: prüft den Anlass, legt Version und alle 13 Kapitel an, schreibt Audit und Ereignis. Besteht schon
 * ein Entwurf: 409 mit Verweis auf ihn (K2 «Entwurf vorhanden, anderer Anlass»).
 */
export async function anlegen(tx: Tx, who: Actor, projekt: store.ProjektKopf, anlass: store.Anlass, begruendung: string, modell: Phasenmodell): Promise<store.VersionRow> {
  const regel = REGELN.get(anlass);
  if (!regel) throw conflict(`Einen Entwurf für ${ANLASS_TEXT[anlass]} kann das System noch nicht anlegen.`, { reason: 'anlass' });
  const versionen = await store.versionen(tx, projekt.id);
  const offen = entwurfVon(versionen);
  if (offen) {
    throw conflict(`Es gibt bereits einen Entwurf (Version ${offen.nummer}, ${STAND_TEXT[offen.stand]}). Nehmen Sie die Änderung dort auf.`,
      { reason: 'entwurf', entwurf: { id: offen.id, nummer: offen.nummer, anlass: offen.anlass, stand: offen.stand } });
  }
  const grund = regel.moeglich({ projekt, versionen });
  if (grund) throw conflict(grund, { reason: 'anlass' });
  const plan = await regel.plan({ tx, modell, projekt, versionen, begruendung });
  const id = await store.versionAnlegen(tx, { projektId: projekt.id, nummer: plan.nummer, anlass, zielphase: plan.zielphase, basisVersionId: plan.basisVersionId, begruendung });
  for (let nr = 1; nr <= ANZAHL_KAPITEL; nr++) await store.kapitelAnlegen(tx, projekt.id, id, nr, plan.kapitel[nr] ?? leer(nr), false);
  const v = (await store.version(tx, id))!;
  const daten = { id, projektId: projekt.id, nummer: v.nummer, anlass, zielphase: v.zielphase, basisVersionId: v.basis_version_id };
  await record(tx, who, { action: 'vertrag.drafted', resourceType: 'vertrag_version', resourceId: id, data: { projekt: projekt.nummer, ...daten }, event: daten });
  return v;
}

export const STAND_TEXT: Record<store.Stand, string> = {
  in_arbeit: 'in Arbeit', in_pruefung: 'in Prüfung', zur_unterzeichnung: 'zur Unterzeichnung', unterzeichnet: 'unterzeichnet', traktandiert: 'traktandiert',
  abgenommen: 'abgenommen', abgelehnt: 'abgelehnt', verworfen: 'verworfen', zurueckgezogen: 'zurückgezogen',
};

// ---------------------------------------------------------------- erster Vertrag (UC-002 Schritt 1)

/**
 * Zielphase des ersten Vertrags: in P0 der Vertrag für P1 (Gate P0–P1, UC-002); bei übernommenen Projekten in einer
 * späteren Phase der Vertrag für die laufende Phase (AP-E0-7, fachmodell.md 4.2 `vertrag.erstellen`).
 */
const zielphaseErst = (p: Phase): Phase => (p === 'P0' ? 'P1' : p);

/**
 * Angaben aus der Projektidee (`projekt.herkunft`, UC-002 Schritt 1: Ausgangslage, Zielsetzung, Strategiebezug). Die
 * Freigabe der Initialisierung (AP-E4-3) übergibt sie mit diesen Schlüsseln; fehlende bleiben leer.
 */
function ausHerkunft(p: store.ProjektKopf): Partial<Record<number, Record<string, unknown>>> {
  const h = p.herkunft ?? {};
  const t = (k: string) => (typeof h[k] === 'string' ? (h[k] as string) : '');
  const id = (k: string) => (typeof h[k] === 'string' && /^[0-9a-f-]{36}$/i.test(h[k] as string) ? (h[k] as string) : null);
  return {
    1: { ...leer(1), ausgangslage: t('ausgangslage') },
    2: { ...leer(2), handlungsfeldId: id('handlungsfeldId'), strategischesZielId: id('strategischesZielId') },
    3: { ...leer(3), ziele: t('zielsetzung'), nutzen: t('nutzen') },
  };
}

entwurfsanlass.registrieren('initial', {
  moeglich: ({ projekt, versionen }) => {
    if (projekt.lebenszyklus !== 'aktiv') return `Das Projekt ${projekt.nummer} ist nicht aktiv; ein Vertrag kann nicht entstehen.`;
    if (versionen.length) return 'Das Projekt hat bereits einen Projektvertrag; die nächste Version entsteht am Gate oder als Änderung.';
    return null;
  },
  plan: async ({ modell, projekt }) => {
    const zielphase = zielphaseErst(projekt.phase);
    const kapitel = ausHerkunft(projekt);
    // Meilensteine und Lieferergebnisse der laufenden und der Zielphase aus dem Phasenmodell vorausgefüllt (I-F2, UC-002 Schritt 6)
    const phasen = PHASEN.filter(p => p === projekt.phase || p === zielphase);
    kapitel[7] = {
      ...leer(7),
      meilensteine: phasen.flatMap(p => (modell?.phasen.find(x => x.code === p)?.ergebnisse ?? [])
        .map(e => ({ registerId: null, phase: p, art: e.art, text: e.text, termin: null }))),
    };
    return { nummer: '0.1', zielphase, basisVersionId: null, kapitel };
  },
});

/** Begründung: Pflicht bei einer Änderung (UC-007 Schritt 2); geprüft vor dem Anlegen. */
export function pruefeBegruendung(anlass: store.Anlass, begruendung: string): void {
  if (anlass === 'aenderung' && !begruendung.trim()) {
    throw invalid('Begründung fehlt: Ohne Begründung kann der Sponsor die Änderung nicht beurteilen.', [{ path: '/begruendung', message: 'Pflicht bei einer Änderung.' }]);
  }
}
