/**
 * Zielbaum des Zielzyklus (UI-38, K6 Schritt 1): Handlungsfeld › Strategisches Ziel › Jahresziel › Hauptaktivität und
 * Projekt, als Baum nach WAI-ARIA (K6 «Barrierefreiheit»): ein Tabstopp, Pfeiltasten bewegen und klappen auf und zu,
 * Pos1/Ende springen, Enter öffnet; die Ebene wird angesagt. Jahresziele ohne Metrik sind markiert (G4, I-P3 «vorher»).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '../../ui/index.ts';
import type { HandlungsfeldKurz } from './api.ts';
import type { Zielzyklus } from './ZielzyklusApi.ts';
import { TZZ } from './ZielzyklusTexte.ts';

type Ebene = keyof typeof TZZ.ebene;

export interface Knoten {
  key: string;
  ebene: Ebene;
  label: string;
  kinder: Knoten[];
  /** Nummer des Ziels, das «Öffnen» wählt (Hauptaktivitäten öffnen ihr Jahresziel). */
  ziel?: string;
  /** Projektnummer: «Öffnen» führt in die Projektakte (K6-2). */
  projekt?: string;
  /** Markierung (z. B. «Metrik fehlt»). */
  markierung?: string;
}

const ICON: Record<Ebene, IconName> = { handlungsfeld: 'target', strategisch: 'target', jahresziel: 'calendar', hauptaktivitaet: 'check', projekt: 'folder' };

/** Baum aus dem Zielzyklus; strategische Ziele unter ihrem Handlungsfeld in der Reihenfolge der Handlungsfelder. */
export function baumAus(z: Zielzyklus, felder: HandlungsfeldKurz[]): Knoten[] {
  const projekt = (p: Zielzyklus['strategischeZiele'][number]['projekte'][number]): Knoten => ({
    key: `pr:${p.zuordnungId}`, ebene: 'projekt', label: `${p.nummer} ${p.name}`, kinder: [], projekt: p.nummer,
  });
  const ohneMetrik = new Set(z.pruefung.ohneMetrik.map(x => x.id));
  const strategisch = (s: Zielzyklus['strategischeZiele'][number]): Knoten => ({
    key: `sz:${s.nummer}`, ebene: 'strategisch', label: `${s.nummer} ${s.text}`, ziel: s.nummer,
    kinder: [
      ...s.jahresziele.map((j): Knoten => ({
        key: `jz:${j.nummer}`, ebene: 'jahresziel', label: `${j.nummer} ${j.text}`, ziel: j.nummer,
        markierung: ohneMetrik.has(j.id) ? TZZ.metrikFehlt : undefined,
        kinder: [
          ...j.hauptaktivitaeten.map((h): Knoten => ({ key: `ha:${h.id}`, ebene: 'hauptaktivitaet', label: h.text, kinder: [], ziel: j.nummer })),
          ...j.projekte.map(projekt),
        ],
      })),
      ...s.projekte.map(projekt),
    ],
  });
  const bekannte = new Set(felder.map(f => f.id));
  const gruppen: Knoten[] = felder
    .map(f => ({ key: `hf:${f.id}`, ebene: 'handlungsfeld' as const, label: f.label, kinder: z.strategischeZiele.filter(s => s.handlungsfeldId === f.id).map(strategisch) }))
    .filter(g => g.kinder.length > 0);
  const rest = z.strategischeZiele.filter(s => !bekannte.has(s.handlungsfeldId));
  if (rest.length) gruppen.push({ key: 'hf:-', ebene: 'handlungsfeld', label: TZZ.ohneHandlungsfeld, kinder: rest.map(strategisch) });
  return gruppen;
}

interface Zeile { k: Knoten; level: number; parent: string | null }

/** Sichtbare Knoten in Lesereihenfolge (zugeklappte ohne Kinder). */
function sichtbar(knoten: Knoten[], zu: Set<string>, level = 1, parent: string | null = null, out: Zeile[] = []): Zeile[] {
  for (const k of knoten) {
    out.push({ k, level, parent });
    if (k.kinder.length && !zu.has(k.key)) sichtbar(k.kinder, zu, level + 1, k.key, out);
  }
  return out;
}

export function ZielzyklusBaum({ knoten, aktiv, onWaehlen, onProjekt }: {
  knoten: Knoten[];
  /** Nummer des gewählten Ziels (`?o=ziel:<nummer>`). */
  aktiv?: string;
  onWaehlen(nummer: string): void;
  onProjekt(nummer: string): void;
}) {
  const [zu, setZu] = useState<Set<string>>(() => new Set());
  const zeilen = useMemo(() => sichtbar(knoten, zu), [knoten, zu]);
  const aktivKey = zeilen.find(z => z.k.ziel === aktiv && (z.k.ebene === 'strategisch' || z.k.ebene === 'jahresziel'))?.k.key;
  const [fokus, setFokus] = useState<string | undefined>(undefined);
  // Tabstopp: zuletzt fokussierter, sonst gewählter, sonst erster sichtbarer Knoten
  const tabstopp = (fokus && zeilen.some(z => z.k.key === fokus) ? fokus : undefined) ?? aktivKey ?? zeilen[0]?.k.key;
  const refs = useRef(new Map<string, HTMLLIElement>());
  const bewegt = useRef(false);
  useEffect(() => {
    if (bewegt.current && tabstopp) refs.current.get(tabstopp)?.focus();
    bewegt.current = false;
  }, [tabstopp, zeilen]);

  const gehe = (key: string | undefined) => { if (key) { bewegt.current = true; setFokus(key); } };
  const umschalten = (key: string, auf: boolean) => setZu(s => { const n = new Set(s); if (auf) n.delete(key); else n.add(key); return n; });
  const oeffnen = (k: Knoten) => { if (k.projekt) onProjekt(k.projekt); else if (k.ziel) onWaehlen(k.ziel); else if (k.kinder.length) umschalten(k.key, zu.has(k.key)); };

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    // nur der fokussierte Knoten (nicht die Eltern, durch die das Ereignis aufsteigt)
    e.stopPropagation();
    const i = zeilen.findIndex(z => z.k.key === tabstopp);
    const z = zeilen[i];
    if (!z) return;
    const offen = z.k.kinder.length > 0 && !zu.has(z.k.key);
    const tasten: Record<string, () => void> = {
      ArrowDown: () => gehe(zeilen[i + 1]?.k.key),
      ArrowUp: () => gehe(zeilen[i - 1]?.k.key),
      Home: () => gehe(zeilen[0]?.k.key),
      End: () => gehe(zeilen[zeilen.length - 1]?.k.key),
      ArrowRight: () => { if (!z.k.kinder.length) return; if (offen) gehe(zeilen[i + 1]?.k.key); else umschalten(z.k.key, true); },
      ArrowLeft: () => { if (offen) umschalten(z.k.key, false); else gehe(z.parent ?? undefined); },
      Enter: () => oeffnen(z.k),
    };
    const t = tasten[e.key];
    if (t) { e.preventDefault(); t(); }
  };

  const render = (liste: Knoten[], level: number) => liste.map(k => {
    const hatKinder = k.kinder.length > 0;
    const offen = hatKinder && !zu.has(k.key);
    const gewaehlt = k.key === aktivKey;
    return (
      <li key={k.key} role="treeitem" aria-level={level} aria-expanded={hatKinder ? offen : undefined} aria-selected={gewaehlt}
        tabIndex={k.key === tabstopp ? 0 : -1} ref={el => { if (el) refs.current.set(k.key, el); else refs.current.delete(k.key); }}
        className={`zz-k zz-${k.ebene}`} data-key={k.key} onKeyDown={onKeyDown}
        onFocus={e => { if (e.target === e.currentTarget) setFokus(k.key); }}
        onClick={e => { e.stopPropagation(); setFokus(k.key); oeffnen(k); }}>
        <div className={`zz-z${gewaehlt ? ' on' : ''}`}>
          {hatKinder ? (
            <span className={`zz-t${offen ? ' auf' : ''}`} aria-hidden="true" onClick={e => { e.stopPropagation(); umschalten(k.key, !offen); }}>
              <Icon name="chev" />
            </span>
          ) : <span className="zz-t" aria-hidden="true" />}
          <Icon name={ICON[k.ebene]} />
          <span className="sr">{TZZ.ebene[k.ebene]}: </span>
          <span className="zz-l">{k.label}</span>
          {k.markierung ? <span className="zz-m"><Icon name="warn" />{k.markierung}</span> : null}
          {k.projekt ? <Icon name="arrow" /> : null}
        </div>
        {offen ? <ul role="group">{render(k.kinder, level + 1)}</ul> : null}
      </li>
    );
  });

  return <ul role="tree" aria-label={TZZ.baum} className="zz-baum">{render(knoten, 1)}</ul>;
}
