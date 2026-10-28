/**
 * Wasserlinie eines Szenarios (BC PP.03.02, UC-008 Schritt 5; K5 Schritt 5 und Regeln): Die Projekte des Szenarios werden
 * in der Reihenfolge ihres Rangs aufgenommen; die Wasserlinie liegt beim ersten Projekt, mit dem der kumulierte Bedarf den
 * Rahmen übersteigt – beim Budget die Summe der Kosten gegen den Budgetrahmen des Portfolios (A-18; ohne Rahmen nur die
 * Kapazität), bei der Kapazität der Bedarf je Rolle und Monat gegen das Angebot (Auslastung aus dem Modul ressource, A-20).
 * Dieses und alle folgenden Projekte liegen unter der Wasserlinie. Reine Rechnung ohne Datenbank (K5-1: ≤ 1 s bei 60
 * Projekten).
 *
 * Kapazität: Den Grundbedarf bilden die Projekte ausserhalb des Szenarios (wie geplant). Ein Monat ohne Angebot für die
 * Rolle zieht keine Wasserlinie (es gibt keinen Rahmen), erscheint aber als Engpass der Auslastung. Bedarf nur als Grösse
 * S/M/L zählt nicht (wie in der Auslastung; Annahme AP-E5-3, Richtwerte je Grösse offen, K5 Z4).
 */

/** Position in der Reihenfolge des Szenarios (Rang aufsteigend). */
export interface RechenPosition { projektId: string; aktiv: boolean; kosten: number | null }

/** Zelle der Auslastung: Angebot und Beiträge je Projekt (aus `ressource`, nach Szenario verschoben). */
export interface RechenZelle { rolle: string; monat: string; angebot: number | null; beitraege: readonly { projektId: string; fte: number }[] }

export interface Durchbruch { rolle: string; monat: string; bedarf: number; angebot: number }

export interface Wasserlinie {
  /** Projekt, bei dem die Wasserlinie liegt (es und alle folgenden enthaltenen liegen darunter); null = alle darüber. */
  beiProjektId: string | null;
  grund: 'budget' | 'kapazitaet' | null;
  /** Je enthaltenes Projekt: über der Wasserlinie? */
  ueber: Map<string, boolean>;
  /** Kumulierte Kosten je enthaltenes Projekt (null, sobald Kosten fehlen oder nicht sichtbar sind). */
  kumuliert: Map<string, number | null>;
  /** Rolle und Monat, in denen das Projekt an der Wasserlinie die Kapazität übersteigt. */
  durchbruch: Durchbruch | null;
  budget: { rahmen: number | null; bedarf: number | null };
}

const EPS = 1e-9;
const rund = (x: number) => Math.round(x * 100) / 100;

export function wasserlinie(positionen: readonly RechenPosition[], zellen: readonly RechenZelle[], rahmen: number | null): Wasserlinie {
  const enthalten = positionen.filter(p => p.aktiv);
  const imSzenario = new Set(enthalten.map(p => p.projektId));
  // Grundlast je Zelle (Projekte ausserhalb des Szenarios) und Beiträge der Szenario-Projekte je Projekt
  const last = zellen.map(z => z.beitraege.reduce((s, b) => s + (imSzenario.has(b.projektId) ? 0 : b.fte), 0));
  const jeProjekt = new Map<string, { i: number; fte: number }[]>();
  zellen.forEach((z, i) => {
    for (const b of z.beitraege) {
      if (!imSzenario.has(b.projektId)) continue;
      let l = jeProjekt.get(b.projektId);
      if (!l) jeProjekt.set(b.projektId, l = []);
      l.push({ i, fte: b.fte });
    }
  });

  const out: Wasserlinie = {
    beiProjektId: null, grund: null, ueber: new Map(), kumuliert: new Map(), durchbruch: null,
    budget: { rahmen, bedarf: enthalten.every(p => p.kosten !== null) ? rund(enthalten.reduce((s, p) => s + p.kosten!, 0)) : null },
  };
  let summe: number | null = 0;
  for (const p of enthalten) {
    summe = summe === null || p.kosten === null ? null : summe + p.kosten;
    out.kumuliert.set(p.projektId, summe === null ? null : rund(summe));
    if (out.beiProjektId) { out.ueber.set(p.projektId, false); continue; }
    const budgetReisst = rahmen !== null && summe !== null && summe > rahmen + EPS;
    let durch: Durchbruch | null = null;
    for (const { i, fte } of jeProjekt.get(p.projektId) ?? []) {
      last[i]! += fte;
      const z = zellen[i]!;
      if (z.angebot !== null && last[i]! > z.angebot + EPS && (!durch || last[i]! - z.angebot > durch.bedarf - durch.angebot)) {
        durch = { rolle: z.rolle, monat: z.monat, bedarf: rund(last[i]!), angebot: z.angebot };
      }
    }
    if (budgetReisst || durch) {
      out.beiProjektId = p.projektId;
      out.grund = budgetReisst ? 'budget' : 'kapazitaet';
      out.durchbruch = durch;
      out.ueber.set(p.projektId, false);
    } else {
      out.ueber.set(p.projektId, true);
    }
  }
  return out;
}

/**
 * Verletzte Abhängigkeiten (K5 Regel «Abhängigkeit verletzt»; PP.02.03): Ein enthaltenes Projekt braucht ein anderes
 * enthaltenes, liegt aber im Rang davor oder startet früher.
 */
export function abhaengigkeitVerletzt(
  a: { rang: number; start: string | null }, b: { rang: number; start: string | null },
): 'rang' | 'start' | null {
  if (a.rang < b.rang) return 'rang';
  if (a.start && b.start && a.start < b.start) return 'start';
  return null;
}
