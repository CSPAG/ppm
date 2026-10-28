/**
 * Dokumentarten mit Vorlage (UC-018 Schritt 1; docs/fachmodell.md 2.13): Reihenfolge wie im Use Case. Welche Art Daten
 * liefert, bestimmt das erzeugende Modul, indem es seinen Feldkatalog registriert (`felder.ts`); Arten ohne Katalog
 * sind als Zuordnungsziel vorbereitet (Vorlage hochladen und ansehen), werden aber erst mit ihrem Modul aktiv.
 */
export const ARTEN = [
  'projektidee', 'vorstudie', 'business_case', 'projektvertrag', 'loesungskonzept', 'abschlussbericht', 'statusbericht', 'portfoliobericht',
  'quartalsreporting',
] as const;
export type Art = (typeof ARTEN)[number];

export const ART_NAME: Record<Art, string> = {
  projektidee: 'Projektidee', vorstudie: 'Vorstudie', business_case: 'Business Case', projektvertrag: 'Projektvertrag',
  loesungskonzept: 'Lösungskonzept', abschlussbericht: 'Abschlussbericht', statusbericht: 'Statusbericht', portfoliobericht: 'Portfoliobericht',
  quartalsreporting: 'Quartalsreporting',
};

export const istArt = (s: string): s is Art => (ARTEN as readonly string[]).includes(s);
