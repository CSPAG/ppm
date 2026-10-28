/**
 * Daten der Schnittstellen (AP-E7-3) für die Finanzen: Ist-Kosten aus dem ERP übernehmen (PC.01.02, A-16,
 * UC-010 Schritt 1) und den übergebenen Jahresbedarf an den Budgetprozess liefern (PC.01.05, A-17). Registrierung beim
 * Modul `schnittstelle` (`verarbeitungSetzen`), damit dieses die Finanzen nicht importiert.
 *
 * Format der Lieferung des ERP (Annahme AP-E7-4; Adresse und Protokoll stehen nicht in docs/): JSON, eine Liste von
 * Buchungen `{ kostentraeger, monat: "JJJJ-MM", art: "capex" | "opex", betrag }` oder `{ buchungen: [...] }`. Mehrere
 * Buchungen desselben Kostenträgers, Monats und derselben Art werden summiert; ein Lauf ersetzt die gelieferten Monate.
 */
import type { Tx } from '@vollholz/platform';
import { verarbeitungSetzen } from '../schnittstelle/index.ts';
import type { Art } from './rechnen.ts';
import * as store from './store.ts';

const KT = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$/;
const MONAT = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/** Lieferung prüfen und zusammenfassen; wirft mit Text für das Laufprotokoll. */
export function buchungenLesen(antwort: string): store.Buchung[] {
  let daten: unknown;
  try { daten = JSON.parse(antwort); } catch { throw new Error('keine gültige JSON-Antwort'); }
  const liste = Array.isArray(daten) ? daten : (daten as { buchungen?: unknown })?.buchungen;
  if (!Array.isArray(liste)) throw new Error('erwartet eine Liste von Buchungen');
  const summe = new Map<string, store.Buchung>();
  liste.forEach((x: unknown, i) => {
    const b = x as Record<string, unknown>;
    const kt = typeof b?.kostentraeger === 'string' ? b.kostentraeger.trim() : '';
    const monat = b?.monat, art = b?.art, betrag = typeof b?.betrag === 'string' ? Number(b.betrag) : b?.betrag;
    if (!KT.test(kt)) throw new Error(`Buchung ${i + 1}: Kostenträger fehlt oder ist ungültig`);
    if (typeof monat !== 'string' || !MONAT.test(monat)) throw new Error(`Buchung ${i + 1}: Monat «JJJJ-MM» fehlt`);
    if (art !== 'capex' && art !== 'opex') throw new Error(`Buchung ${i + 1}: Art «capex» oder «opex» fehlt`);
    if (typeof betrag !== 'number' || !Number.isFinite(betrag) || Math.abs(betrag) >= 1e12) throw new Error(`Buchung ${i + 1}: Betrag fehlt`);
    const key = `${kt}|${monat}|${art}`;
    const alt = summe.get(key);
    summe.set(key, { kostentraeger: kt, monat, art: art as Art, betrag: Math.round(((alt?.betrag ?? 0) + betrag) * 100) / 100 });
  });
  return [...summe.values()];
}

/** Ist-Kosten übernehmen (in der Transaktion des Laufs); liefert die Zahl der Buchungen. */
export async function istUebernehmen(tx: Tx, antwort: string): Promise<number> {
  const b = buchungenLesen(antwort);
  await store.istErsetzen(tx, b);
  return b.length;
}

/** Zuletzt übergebener Jahresbedarf für den Budgetprozess. */
export async function bedarfLiefern(tx: Tx): Promise<{ inhalt: unknown; umfang: number }> {
  const u = await store.letzteUebergabe(tx);
  if (!u) throw new Error('Es ist noch kein Jahresbedarf übergeben.');
  return { inhalt: { jahr: u.jahr, uebergebenAt: u.uebergeben_at?.toISOString() ?? null, ...u.inhalt }, umfang: Array.isArray(u.inhalt.positionen) ? u.inhalt.positionen.length : 0 };
}

verarbeitungSetzen('ist_kosten', { uebernehmen: istUebernehmen });
verarbeitungSetzen('jahresbedarf', { liefern: bedarfLiefern });
