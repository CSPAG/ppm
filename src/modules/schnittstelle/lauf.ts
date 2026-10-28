/**
 * Läufe der Schnittstellen (BC AM.03.02; UC-018 Schritte 3–4, A1): Testlauf beim Einrichten, geplant nach Rhythmus,
 * von Hand gestartet. Je Lauf Zeitpunkt, Umfang und Fehler; ein Fehler öffnet im Eingang die Sammelaufgabe
 * «Schnittstelle prüfen» an alle mit `schnittstelle:admin` (fachmodell.md 4.2), ein erfolgreicher Lauf schliesst sie.
 * Der Netzverkehr läuft ausserhalb der Transaktion; Übernahme und Abschluss eingehender Daten in einer Transaktion.
 */
import type { Db, PeriodicTask, Tx } from '@vollholz/platform';
import { aufgabe } from '../eingang/index.ts';
import { fullTx } from '../../platform.ts';
import { eintrag, nameVon, verarbeitung } from './katalog.ts';
import * as store from './store.ts';
import { abrufen, liefern, TransportFehler, type Optionen } from './transport.ts';

/** Transaktion im Kontext des Aufrufers (Anfrage: `req.tx`, Hintergrund: volle Sicht der Organisation). */
export type TxRunner = <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;

export const TIMEOUT_MS = 30_000;
export const LINK = '/administration/schnittstellen';

export class LaeuftSchon extends Error {}

const bezug = (id: string) => ({ typ: 'schnittstelle', id });

/** Sammelaufgabe nach dem Ergebnis eines Laufs öffnen oder schliessen (in der Transaktion des Abschlusses). */
async function aufgabeNachfuehren(tx: Tx, s: store.Row, fehler: string | null, art: store.LaufArt): Promise<void> {
  if (fehler === null) {
    await aufgabe.erledigen(tx, { art: 'schnittstelle.fehler', bezug: bezug(s.id) });
  } else if (art !== 'test') {
    // Den Testlauf sieht die Person beim Einrichten selbst (UC-018 Schritt 3); Fehler der übrigen Läufe meldet der Eingang
    await aufgabe.oeffnen(tx, {
      art: 'schnittstelle.fehler', bezug: bezug(s.id), empfaenger: { recht: 'schnittstelle:admin' },
      titel: `Schnittstelle «${nameVon(s.umsystem, s.daten)}» prüfen: Lauf fehlgeschlagen`, link: `${LINK}?o=${s.id}`,
    });
  }
}

const kurz = (t: string) => (t.length > 1000 ? `${t.slice(0, 997)}…` : t);
const text = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Lauf ausführen und protokollieren. Testlauf: nur die Verbindung (Abruf bei der Adresse). Sonst eingehend abrufen und
 * übernehmen, ausgehend liefern; ohne registrierte Verarbeitung schlägt der Lauf fehl («noch nicht verfügbar»).
 * Liefert den abgeschlossenen Lauf; `null`, wenn die Schnittstelle nicht sichtbar ist. Wirft `LaeuftSchon`.
 */
export async function ausfuehren(run: TxRunner, id: string, art: store.LaufArt, o: Optionen): Promise<store.LaufRow | null> {
  const start = await run(async tx => {
    const s = await store.get(tx, id);
    if (!s) return null;
    const laufId = await store.laufBeginnen(tx, id, art);
    if (!laufId) throw new LaeuftSchon();
    return { s, laufId };
  });
  if (!start) return null;
  const { s, laufId } = start;
  const abschliessen = (tx: Tx, umfang: number | null, fehler: string | null) =>
    store.laufAbschliessen(tx, laufId, { umfang, fehler: fehler === null ? null : kurz(fehler) }).then(() => aufgabeNachfuehren(tx, s, fehler, art));

  let fehler: string | null = null;
  try {
    const v = verarbeitung(s.daten);
    const name = eintrag(s.umsystem, s.daten)?.datenLabel ?? s.daten;
    if (art === 'test') {
      await abrufen(s.adresse, o);
      await run(tx => abschliessen(tx, 0, null));
    } else if (s.richtung === 'eingehend') {
      if (!v?.uebernehmen) throw new TransportFehler(`Die Verarbeitung der Daten «${name}» ist noch nicht verfügbar.`);
      const antwort = await abrufen(s.adresse, o);
      await run(async tx => {
        let umfang: number;
        try { umfang = await v.uebernehmen!(tx, antwort); } catch (e) { throw new TransportFehler(`Antwort des Umsystems nicht verarbeitbar: ${text(e)}`); }
        await abschliessen(tx, umfang, null);
      });
    } else {
      if (!v?.liefern) throw new TransportFehler(`Die Verarbeitung der Daten «${name}» ist noch nicht verfügbar.`);
      const { inhalt, umfang } = await run(tx => v.liefern!(tx));
      await liefern(s.adresse, inhalt, o);
      await run(tx => abschliessen(tx, umfang, null));
    }
  } catch (e) {
    fehler = e instanceof TransportFehler ? e.message : `Unerwarteter Fehler: ${text(e)}`;
  }
  if (fehler !== null) await run(tx => abschliessen(tx, null, fehler));
  return run(tx => store.lauf(tx, laufId));
}

/** Je Organisation: hängende Läufe abbrechen, fällige Läufe nach Rhythmus ausführen. */
export async function faelligeAusfuehren(db: Db, tenantId: string, o: Optionen): Promise<{ abgebrochen: number; gelaufen: number; fehlgeschlagen: number }> {
  const run: TxRunner = fn => fullTx(db, tenantId, fn);
  const abgebrochen = await run(async tx => {
    // Ein Lauf ohne Rückmeldung nach einer Stunde gilt als abgebrochen (Absturz des Prozesses)
    const ids = await store.haengendeAbbrechen(tx);
    for (const id of new Set(ids)) {
      const s = await store.get(tx, id);
      if (s) await aufgabeNachfuehren(tx, s, 'abgebrochen', 'geplant');
    }
    return ids.length;
  });
  let gelaufen = 0, fehlgeschlagen = 0;
  for (const id of await run(tx => store.faellige(tx))) {
    try {
      const l = await ausfuehren(run, id, 'geplant', o);
      gelaufen++;
      if (l?.stand === 'fehlgeschlagen') fehlgeschlagen++;
    } catch (e) {
      if (!(e instanceof LaeuftSchon)) throw e;
    }
  }
  return { abgebrochen, gelaufen, fehlgeschlagen };
}

/** Stündlich je aktiver Organisation (geplante Läufe nach Rhythmus, UC-018 Schritt 4). */
export const laufTask: PeriodicTask = {
  name: 'schnittstelle.laeufe',
  intervalMs: () => 60 * 60_000,
  async run({ db, cfg, log }) {
    const o = { timeoutMs: TIMEOUT_MS, allowPrivate: cfg.app.events.allowPrivate };
    const orgs = (await db.query<{ id: string }>("SELECT id FROM app.platform_tenants() WHERE status = 'active'")).rows;
    for (const org of orgs) {
      try {
        const n = await faelligeAusfuehren(db, org.id, o);
        if (n.abgebrochen || n.gelaufen) log.info({ tenantId: org.id, ...n }, 'Schnittstellen: Läufe ausgeführt');
      } catch (e) {
        log.error({ tenantId: org.id, err: e }, 'Schnittstellen: Fehler in der Organisation');
      }
    }
  },
};
