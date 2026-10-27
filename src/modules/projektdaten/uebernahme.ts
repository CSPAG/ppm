/**
 * Übernahme aus dem abgenommenen Projektvertrag (AP-E3-1, fachmodell.md 2.6, UC-002 Schritt 11, UC-003 Schritt 10):
 * Das Modul vertrag schreibt die geplanten Einträge eines Kapitels ins Register – bestehende (mit ID) werden nachgeführt,
 * neue angelegt – samt den Baseline-Spalten. In der Transaktion des Aufrufers; die Rechte prüft der Aufrufer, die
 * Lesesicht (RLS) gilt zusätzlich. Einträge, die der Vertrag nicht mehr nennt, bleiben im Register (Verlauf der Berichte).
 */
import type { Actor, Tx } from '@vollholz/platform';
import { record } from '../../platform.ts';
import * as store from './store.ts';

/** Felder, die die Übernahme setzt: die schreibbaren und die Baseline (nie Ist, Abnahme, gedeckt). */
const BASELINE = { meilenstein: ['terminBaseline'], kosten: ['budgetBaseline'] } as Partial<Record<store.RegisterName, string[]>>;

/** Eindeutigkeit im Register, über die ein Eintrag ohne ID wiedergefunden wird (Ressourcenbedarf je Rolle und Phase). */
const SCHLUESSEL = { ressourcenbedarf: ['phase', 'rolle'] } as Partial<Record<store.RegisterName, string[]>>;

export type UebernahmeEintrag = { id?: string | null } & Record<string, unknown>;

/** Einträge eines Registers übernehmen; liefert die IDs im Register in der Reihenfolge der Eingabe. */
export async function uebernehmen(tx: Tx, who: Actor, projektId: string, register: store.RegisterName, eintraege: UebernahmeEintrag[]): Promise<string[]> {
  const r: store.Register = store.REGISTER[register];
  const erlaubt = new Set([...r.schreibbar, ...(BASELINE[register] ?? [])]);
  const bestehend = await store.list(tx, r, { projektId, offset: 0, limit: 100000 });
  const ids: string[] = [];
  for (const e of eintraege) {
    const werte = Object.fromEntries(Object.entries(e).filter(([k, v]) => erlaubt.has(k) && v !== undefined));
    const schluessel = SCHLUESSEL[register];
    const vorhanden = bestehend.find(b => (e.id && b.id === e.id) || (!e.id && schluessel && schluessel.every(k => b[k] === e[k])));
    if (vorhanden) {
      await store.setzen(tx, r, vorhanden.id, werte);
      await record(tx, who, { action: `${r.name}.updated`, resourceType: r.name, resourceId: vorhanden.id, data: { quelle: 'vertrag', ...werte }, event: { id: vorhanden.id, projektId, quelle: 'vertrag' } });
      ids.push(vorhanden.id);
    } else {
      const schreibbar = Object.fromEntries(Object.entries(werte).filter(([k]) => r.schreibbar.includes(k)));
      const id = await store.create(tx, r, { projektId }, schreibbar);
      const baseline = Object.fromEntries(Object.entries(werte).filter(([k]) => !r.schreibbar.includes(k)));
      if (Object.keys(baseline).length) await store.setzen(tx, r, id, baseline);
      await record(tx, who, { action: `${r.name}.created`, resourceType: r.name, resourceId: id, data: { quelle: 'vertrag', ...werte }, event: { id, projektId, quelle: 'vertrag' } });
      ids.push(id);
    }
  }
  return ids;
}
