/** Suchparameter der Seiten «Auslastung» und «Kapazität» (I-N5: Zeitraum und geöffnete Zelle in der Adresse). */

export interface AuslastungSearch {
  von?: string;
  bis?: string;
  /** Szenario der Priorisierung (UC-008 Schritt 5), z. B. aus der Szenarioansicht verlinkt. */
  szenario?: string;
  /** Geöffnete Zelle `<rolle>:<JJJJ-MM>`. */
  o?: string;
}
export interface KapazitaetSearch { von?: string; bis?: string }

export type SetAuslastungSearch = (next: Partial<AuslastungSearch>, o?: { replace?: boolean }) => void;
export type SetKapazitaetSearch = (next: Partial<KapazitaetSearch>, o?: { replace?: boolean }) => void;

const MONAT = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZELLE = /^[A-Za-z0-9_]{1,40}:[0-9]{4}-(0[1-9]|1[0-2])$/;
const text = (v: unknown, re: RegExp) => (typeof v === 'string' && re.test(v) ? v : undefined);

export function validateKapazitaetSearch(raw: Record<string, unknown>): KapazitaetSearch {
  const s: KapazitaetSearch = {};
  const von = text(raw.von, MONAT); const bis = text(raw.bis, MONAT);
  if (von) s.von = von;
  if (bis) s.bis = bis;
  return s;
}

export function validateAuslastungSearch(raw: Record<string, unknown>): AuslastungSearch {
  const s: AuslastungSearch = validateKapazitaetSearch(raw);
  const szenario = text(raw.szenario, UUID); const o = text(raw.o, ZELLE);
  if (szenario) s.szenario = szenario;
  if (o) s.o = o;
  return s;
}

export const zelleO = (rolle: string, monat: string) => `${rolle}:${monat}`;
export function zelleAusO(o: string): { rolle: string; monat: string } {
  const i = o.lastIndexOf(':');
  return { rolle: o.slice(0, i), monat: o.slice(i + 1) };
}
