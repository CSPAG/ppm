/**
 * Pflichtangaben je Phase (UC-002 Schritt 8, A3; UC-003 A1, A3; K2 «Regeln»): welche Angaben für die Zielphase der
 * Version fehlen. Welche verlangt sind, legt die UE im Phasenmodell fest (`pflichtangabe` am Gate in die Zielphase und an
 * der Zielphase, K13 offen, A-12). Jede Angabe nennt Kapitel und Feld, damit die Oberfläche mit einem Klick dorthin springt
 * (K2-4).
 */
import { ausgefuellt, felder, PHASEN, type Phase } from './kapitel.ts';

export interface Pflichtangabe { kapitel: number; feld: string; text: string }
export interface Modell {
  phasen: { code: string; pflichtangaben: Pflichtangabe[] }[];
  gates: { code: string; name: string; pflichtangaben: Pflichtangabe[] }[];
}
export interface Pruefung extends Pflichtangabe {
  /** Woher die Angabe verlangt ist: Gate in die Zielphase oder die Zielphase selbst. */
  quelle: { art: 'gate' | 'phase'; code: string };
  erfuellt: boolean;
  /** Warum sie fehlt, in Worten (Sie-Form). */
  grund: string | null;
}

/** Gate, das in die Phase führt (P0_P1 → P1); fest wie im Phasenmodell. */
const GATE_IN: Record<Phase, string> = { P0: 'EINTRITT_P0', P1: 'P0_P1', P2: 'P1_P2', P3: 'P2_P3', P4: 'P3_P4' };

const ab = (p: Phase, von: Phase) => PHASEN.indexOf(p) >= PHASEN.indexOf(von);

type Kapitel = Record<number, Record<string, unknown>>;

/**
 * Regeln je Feld, die über «ausgefüllt» hinausgehen (Quelle im Kommentar). Liefert den Grund, wenn die Angabe fehlt.
 * Personal und Kosten ab Gate P1–P2: in FTE und Monaten bzw. für jede Phase bis P4 (UC-003 A1, K2 «Am Gate P1–P2 lässt
 * sich nicht mit Grösse S/M/L einreichen»).
 */
function regel(kapitel: number, feld: string, wert: unknown, zielphase: Phase): string | null {
  if (kapitel === 9 && feld === 'personal' && ab(zielphase, 'P2')) {
    const zeilen = (wert ?? []) as { fte: number | null; vonMonat: string | null; bisMonat: string | null }[];
    if (!zeilen.length) return 'Es ist noch kein Personal geplant.';
    const n = zeilen.filter(z => z.fte === null || !z.vonMonat || !z.bisMonat).length;
    if (n) return `${n} ${n === 1 ? 'Zeile ist' : 'Zeilen sind'} nur als Grösse S/M/L geplant; ab dem Gate P1–P2 braucht es FTE und Monate je Rolle und Phase.`;
    return null;
  }
  if (kapitel === 9 && feld === 'kosten' && ab(zielphase, 'P2')) {
    const zeilen = (wert ?? []) as { phase: Phase; betrag: number | null }[];
    const fehlt = PHASEN.filter(p => ab(p, zielphase) && !zeilen.some(z => z.phase === p && z.betrag !== null));
    return fehlt.length ? `Kosten fehlen für ${fehlt.join(', ')}.` : null;
  }
  return ausgefuellt(wert) ? null : 'Die Angabe ist leer.';
}

/**
 * Alle verlangten Angaben mit Stand (erfüllt oder nicht), in der Reihenfolge der Kapitel. Ein Feld, das das Kapitel
 * nicht kennt, verlangt das ganze Kapitel (mindestens eine Angabe), damit eine Pflichtangabe nie unerfüllbar ist.
 * Änderungen (UC-007) haben kein Gate: nur die Angaben der Phase gelten.
 */
export function pruefen(modell: Modell | null, v: { zielphase: Phase; anlass: string }, kapitel: Kapitel): Pruefung[] {
  if (!modell) return [];
  const gate = v.anlass === 'aenderung' ? undefined : modell.gates.find(g => g.code === GATE_IN[v.zielphase]);
  const phase = modell.phasen.find(p => p.code === v.zielphase);
  const verlangt = [
    ...(gate?.pflichtangaben ?? []).map(a => ({ ...a, quelle: { art: 'gate' as const, code: gate!.code } })),
    ...(phase?.pflichtangaben ?? []).map(a => ({ ...a, quelle: { art: 'phase' as const, code: phase!.code } })),
  ];
  // dieselbe Angabe am Gate und an der Phase nur einmal
  const gesehen = new Set<string>();
  const out: Pruefung[] = [];
  for (const roh of verlangt) {
    // Schlüssel im Phasenmodell klein mit Unterstrich («strategisches_ziel_id»), im Kapitel camelCase
    const a = { ...roh, feld: roh.feld.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()) };
    const k = `${a.kapitel}.${a.feld}`;
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    const inhalt = kapitel[a.kapitel] ?? {};
    const grund = felder(a.kapitel).includes(a.feld)
      ? regel(a.kapitel, a.feld, inhalt[a.feld], v.zielphase)
      : (Object.values(inhalt).some(ausgefuellt) ? null : 'Das Kapitel ist leer.');
    out.push({ kapitel: a.kapitel, feld: a.feld, text: a.text, quelle: a.quelle, erfuellt: grund === null, grund });
  }
  return out.sort((x, y) => x.kapitel - y.kapitel);
}
