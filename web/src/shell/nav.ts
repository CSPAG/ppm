/**
 * Navigation nach Arbeitsräumen (docs/ux/informationsarchitektur.md, UX-E2; I-N1 bis I-N4). Die sechs Arbeitsräume und
 * ihre Reihenfolge stehen hier fest; was darin erscheint, trägt die App ein (`src/nav.ts`: Bereiche, Aktionen, Suchen),
 * die Shell kennt keine Features. Sichtbar ist ein Arbeitsraum nur mit mindestens einem Bereich, den die Person sehen
 * darf (I-N2, keine leeren Seiten). Bereiche prüfen mit `canSomewhere` (Navigation), Aktionen ohne Ressource mit `can`.
 */
import { useIam, useIamNav } from '@vollholz/iam-web';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AppPermission } from '../auth/permissions.ts';
import { T, type IconName } from '../ui/index.ts';

export type ArbeitsraumId = 'eingang' | 'projekte' | 'portfolio' | 'gremien' | 'ziele' | 'administration';

export interface Arbeitsraum { id: ArbeitsraumId; label: string; icon: IconName }

/** Reihenfolge wie in der Tabelle «Arbeitsräume» (Leiste links, I-N3). */
export const ARBEITSRAEUME: readonly Arbeitsraum[] = [
  { id: 'eingang', label: T.arbeitsraum.eingang, icon: 'inbox' },
  { id: 'projekte', label: T.arbeitsraum.projekte, icon: 'folder' },
  { id: 'portfolio', label: T.arbeitsraum.portfolio, icon: 'grid' },
  { id: 'gremien', label: T.arbeitsraum.gremien, icon: 'gavel' },
  { id: 'ziele', label: T.arbeitsraum.ziele, icon: 'target' },
  { id: 'administration', label: T.arbeitsraum.administration, icon: 'cog' },
];

/** Telefon: die ersten drei sichtbaren in dieser Reihenfolge unten, die übrigen unter «Mehr» (IA «Navigation»). */
export const UNTEN_VORRANG: readonly ArbeitsraumId[] = ['eingang', 'projekte', 'gremien', 'portfolio', 'ziele', 'administration'];
export const UNTEN_ANZAHL = 3;

/** Bereich eines Arbeitsraums (I-N5: `/<arbeitsraum>/<bereich>`), sichtbar mit dem Recht irgendwo. */
export interface BereichEintrag {
  raum: ArbeitsraumId; pfad: string; label: string;
  /** Recht oder Liste von Rechten, von denen eines genügt. */
  recht: AppPermission | readonly AppPermission[];
  /** Adressen mit Parametern, unter denen der Bereich aktiv ist (z. B. `/ziele/2026` für den Zielzyklus); ersetzt `pfad` als Prüfung. */
  muster?: RegExp;
}

/** Häufige Aktion für die Befehlspalette (I-N4), sichtbar mit dem Recht an der Organisation. */
export interface AktionEintrag { id: string; label: string; icon: IconName; pfad: string; recht: AppPermission }

export interface Treffer { id: string; label: string; detail?: string; icon: IconName; pfad: string }

/** Suche nach Objekten für die Befehlspalette, nur mit dem Recht irgendwo; die Antwort der API filtert je Objekt. */
export interface SucheEintrag { id: string; recht: AppPermission; suchen(q: string, signal: AbortSignal): Promise<Treffer[]> }

/**
 * Zähler an einem Arbeitsraum (I-N3: offene Aufgaben an «Eingang»), sichtbar mit dem Recht irgendwo. `queryKey` teilt
 * das Feature mit seinen eigenen Abfragen, damit der Zähler nach einer Änderung dort mit neu lädt.
 */
export interface ZaehlerEintrag {
  raum: ArbeitsraumId; recht: AppPermission; queryKey: readonly unknown[];
  laden(signal: AbortSignal): Promise<number>;
  /** Text für Bildschirmleser, z. B. «3 offene Aufgaben». */
  text(n: number): string;
}

/** Persönliche Seite im Kontomenü und unter «Mehr» (IA: Profil und Stellvertretung), sichtbar mit dem Recht irgendwo. */
export interface KontoEintrag { id: string; label: string; icon: IconName; pfad: string; recht: AppPermission }

export interface NavRegistrierung {
  bereiche: readonly BereichEintrag[]; aktionen: readonly AktionEintrag[]; suchen: readonly SucheEintrag[];
  zaehler?: readonly ZaehlerEintrag[]; konto?: readonly KontoEintrag[];
}

export interface Bereich { pfad: string; label: string; aktiv: boolean }
export interface SichtbarerRaum extends Arbeitsraum { pfad: string; bereiche: Bereich[]; aktiv: boolean }

/** Pfad liegt in `pfad` (gleich oder darunter). */
export const liegtIn = (path: string, pfad: string) => path === pfad || path.startsWith(`${pfad}/`);

/**
 * Sichtbare Arbeitsräume in fester Reihenfolge, je mit ihren erlaubten Bereichen (Ziel des Arbeitsraums ist sein erster
 * Bereich). Die Verwalten-Seiten des Baukastens sind die ersten Bereiche der Administration (IA: «Benutzer und Rollen»
 * zuerst, dann Organisation, Codetabellen …; bereits nach Recht gefiltert).
 */
export function sichtbareRaeume(
  reg: Pick<NavRegistrierung, 'bereiche'>, darf: (p: AppPermission) => boolean, path: string,
  verwalten: readonly { path: string; title: string }[] = [],
): SichtbarerRaum[] {
  const alle: { raum: ArbeitsraumId; pfad: string; label: string; muster?: RegExp }[] = [
    ...verwalten.map(v => ({ raum: 'administration' as const, pfad: v.path, label: v.title })),
    ...reg.bereiche.filter(b => (typeof b.recht === 'string' ? [b.recht] : b.recht).some(darf)),
  ];
  return ARBEITSRAEUME.flatMap(r => {
    const bereiche = alle.filter(b => b.raum === r.id).map(b => ({ pfad: b.pfad, label: b.label, aktiv: b.muster ? b.muster.test(path) : liegtIn(path, b.pfad) }));
    if (!bereiche.length) return [];
    return [{ ...r, pfad: bereiche[0]!.pfad, bereiche, aktiv: bereiche.some(b => b.aktiv) }];
  });
}

/** Aufteilung für das Telefon: unten höchstens drei, der Rest unter «Mehr» (Reihenfolge wie in der Leiste). */
export function aufteilenUnten(raeume: SichtbarerRaum[]): { unten: SichtbarerRaum[]; mehr: SichtbarerRaum[] } {
  const ids = UNTEN_VORRANG.filter(id => raeume.some(r => r.id === id)).slice(0, UNTEN_ANZAHL);
  return {
    unten: ids.map(id => raeume.find(r => r.id === id)!),
    mehr: raeume.filter(r => !ids.includes(r.id)),
  };
}

/** Sichtbare Arbeitsräume und erlaubte Aktionen der angemeldeten Person für den aktuellen Pfad. */
export function useNavigation(reg: NavRegistrierung, path: string) {
  const { can, canSomewhere } = useIam();
  const verwalten = useIamNav();
  return useMemo(() => ({
    raeume: sichtbareRaeume(reg, canSomewhere, path, verwalten),
    aktionen: reg.aktionen.filter(a => can(a.recht)),
    suchen: reg.suchen.filter(s => canSomewhere(s.recht)),
  }), [reg, can, canSomewhere, path, verwalten]);
}

/** Zähler je Arbeitsraum (nur mit Recht und Wert über 0); lädt jede Minute und beim Zurückkehren ins Fenster neu. */
export type Zaehler = Partial<Record<ArbeitsraumId, { n: number; text: string }>>;

export function useZaehler(reg: Pick<NavRegistrierung, 'zaehler'>): Zaehler {
  const { canSomewhere } = useIam();
  const eintraege = (reg.zaehler ?? []).filter(z => canSomewhere(z.recht));
  const q = useQueries({
    queries: eintraege.map(z => ({ queryKey: z.queryKey, queryFn: ({ signal }: { signal: AbortSignal }) => z.laden(signal), refetchInterval: 60_000 })),
  });
  const out: Zaehler = {};
  eintraege.forEach((z, i) => {
    const n = q[i]?.data;
    if (typeof n === 'number' && n > 0) out[z.raum] = { n, text: z.text(n) };
  });
  return out;
}
