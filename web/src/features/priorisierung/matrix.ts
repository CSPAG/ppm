/**
 * Einordnung und Rangfolge in der Matrix (UI-21, K5 Schritt 4; PP.03.04, PP.02.02): Lage der Projekte je Ansicht,
 * Position als Text (K5 Barrierefreiheit), Verschieben in der Rangfolge (Alt+↑/↓) und verletzte Abhängigkeiten
 * (UC-008 Schritt 3: «‹A› braucht ‹B›, liegt aber vor ‹B›»).
 */
import type { MatrixProjekt } from './matrix-api.ts';

export type Ansicht = 'risiko' | 'ressourcen';

/** Richtwert der Grösse auf der Ressourcenachse (Anteil der Achse), wenn nur die Grösse bekannt ist (gekennzeichnet «geschätzt»). */
const GROESSE = { S: 1 / 6, M: 1 / 2, L: 5 / 6 } as const;

/** Achse 1–3 (tief–hoch) auf 0–1. */
const anteil = (wert: number) => (wert - 1) / 2;

/**
 * Lage im Diagramm (x nach rechts, y nach oben, je 0–1) oder null, wenn das Projekt auf einer Achse nicht eingeordnet ist.
 * Nutzen × Risiko: x = Risiko, y = Nutzen. Ressourcen × Nutzen: x = FTE-Monate relativ zum grössten Bedarf, sonst Grösse.
 */
export function lage(p: MatrixProjekt, ansicht: Ansicht, maxFteMonate: number): { x: number; y: number; geschaetzt: boolean } | null {
  if (p.nutzen.wert === null) return null;
  const y = anteil(p.nutzen.wert);
  if (ansicht === 'risiko') return p.risiko.wert === null ? null : { x: anteil(p.risiko.wert), y, geschaetzt: false };
  if (p.ressourcen.fteMonate !== null && maxFteMonate > 0) return { x: p.ressourcen.fteMonate / maxFteMonate, y, geschaetzt: false };
  return p.ressourcen.groesse ? { x: GROESSE[p.ressourcen.groesse], y, geschaetzt: true } : null;
}

/** Neue Reihenfolge nach Verschieben um `schritt` (−1 hinauf, +1 hinunter); unverändert am Rand. */
export function verschieben<T>(liste: readonly T[], index: number, schritt: -1 | 1): T[] {
  const ziel = index + schritt;
  if (ziel < 0 || ziel >= liste.length) return [...liste];
  const neu = [...liste];
  [neu[index], neu[ziel]] = [neu[ziel]!, neu[index]!];
  return neu;
}

/** Paare (A braucht B), bei denen A in der Reihenfolge vor B liegt; nur Projekte der Liste. */
export function verletzt(reihenfolge: readonly string[], projekte: readonly MatrixProjekt[]): { projekt: string; braucht: string }[] {
  const rang = new Map(reihenfolge.map((id, i) => [id, i]));
  const out: { projekt: string; braucht: string }[] = [];
  for (const p of projekte) {
    const a = rang.get(p.id);
    if (a === undefined) continue;
    for (const b of p.abhaengigVon) {
      const rb = rang.get(b);
      if (rb !== undefined && a < rb) out.push({ projekt: p.id, braucht: b });
    }
  }
  return out;
}

/** Ausgangsreihenfolge: Entwurf, sonst entschiedene Rangfolge, danach die übrigen Projekte in der Reihenfolge der Matrix. */
export function ausgangsreihenfolge(projekte: readonly MatrixProjekt[]): string[] {
  const entwurf = projekte.some(p => p.rangEntwurf !== null);
  const rang = (p: MatrixProjekt) => (entwurf ? p.rangEntwurf : p.rang) ?? Number.POSITIVE_INFINITY;
  return [...projekte].map((p, i) => ({ p, i })).sort((a, b) => rang(a.p) - rang(b.p) || a.i - b.i).map(x => x.p.id);
}
