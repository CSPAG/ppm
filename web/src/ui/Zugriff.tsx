/**
 * Zugriff auf einen Blick (docs/ux/zugriff.md, Ergänzung zu UX-E14 und UI-51; Master Entscheide 13, 16, 18): Schaltfläche
 * «Zugriff» im Kopf von Projektakte und Portfolio, bei vertraulichen Objekten mit Schloss. Sie öffnet eine Kurzübersicht
 * mit dem eigenen Zugriff und seinem Grund, der Stufe, den Rollen mit Anzahl und Namen (Z-4) und den Mitgliedern;
 * verwaltet wird im Bereich «Zugriff». `zugriffDarf` übersetzt eine Rolle in auflisten, lesen, bearbeiten und «verwaltet
 * Zugriff» (Spalte «Darf»). Daten über `/v1/access` und `/v1/access/explain` des Baukastens.
 */
import { useAccessList, useAuthz, useExplain, useIamConfig, type AccessEntry, type Authz, type Explain } from '@vollholz/iam-web';
import { useState } from 'react';
import { Icon } from './Icon.tsx';
import { Dialog } from './Overlay.tsx';
import { ErrorState, Skelett } from './states.tsx';
import { T } from './texte/index.ts';

export interface ZugriffOrt { type: 'projekt' | 'portfolio'; id: string }

/** Herkunft eines Eintrags: am Ort selbst, über das Portfolio oder für alle Portfolios (Rolle an der Organisation). */
export type ZugriffHerkunft = 'hier' | 'ueberPortfolio' | 'org';

export function zugriffHerkunft(e: Pick<AccessEntry, 'place'>, ort: ZugriffOrt): ZugriffHerkunft {
  if (e.place.type === ort.type) return 'hier';
  return e.place.type === 'portfolio' ? 'ueberPortfolio' : 'org';
}

/**
 * Was jemand mit einer Rolle darf, als Auswahl «darf …» (Master Entscheid 22): vorgegebene Rollen nach ihrer Wirkung,
 * eigene Rollen der Organisation mit ihrem Namen; leer ausserhalb des Katalogs (z. B. Mitgliedschaft des Baukastens).
 */
export function zugriffDarf(authz: Authz, relation: string): string {
  if (Object.hasOwn(T.zugriff.darf, relation)) return T.zugriff.darf[relation]!;
  return authz.catalog?.roles.some(r => r.key === relation) ? authz.relationLabel(relation) : '';
}

/** Stufe des Objekts als Satz (Z-3): vertraulich (auch geerbt vom Portfolio) oder Kopfdaten für alle Mitglieder. */
export function zugriffStufe(ort: ZugriffOrt, vertraulich?: boolean, geerbt?: boolean): string {
  const s = T.zugriff.stufe;
  if (ort.type === 'portfolio') return vertraulich ? s.vertraulichPortfolio : s.offenPortfolio;
  return geerbt ? s.geerbtProjekt : vertraulich ? s.vertraulichProjekt : s.offenProjekt;
}

/** Was alle Mitglieder ohne weitere Rolle hier dürfen (Master Entscheide 13, 14, 22). */
export function zugriffMitglieder(ort: ZugriffOrt, vertraulich?: boolean): string {
  if (vertraulich) return T.zugriff.mitgliederVertraulich;
  return ort.type === 'portfolio' ? T.zugriff.mitgliederPortfolio : T.zugriff.mitgliederProjekt;
}

/** Schaltfläche im Kopf; `bereich` ist die Adresse des Bereichs «Zugriff» (UI-51). */
export function ZugriffKurz({ ort, label, vertraulich, bereich }: { ort: ZugriffOrt; label: string; vertraulich?: boolean; bereich: string }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button type="button" className="btn sm" aria-haspopup="dialog" onClick={() => setOffen(true)}>
        <Icon name={vertraulich ? 'lock' : 'users'} />{vertraulich ? T.zugriff.schaltflaecheVertraulich : T.zugriff.schaltflaeche}
      </button>
      {offen ? <KurzUebersicht ort={ort} label={label} vertraulich={vertraulich} bereich={bereich} onClose={() => setOffen(false)} /> : null}
    </>
  );
}

function KurzUebersicht({ ort, label, vertraulich, bereich, onClose }: { ort: ZugriffOrt; label: string; vertraulich?: boolean; bereich: string; onClose(): void }) {
  const authz = useAuthz();
  const { router } = useIamConfig();
  const liste = useAccessList(ort);
  const schreiben = useExplain(ort, { permission: 'projekt:write' });
  const lesen = useExplain(ort);

  const grund = (x: Explain) => {
    const r = x.reasons[0];
    if (!r) return '.';
    const h = zugriffHerkunft(r, ort);
    return T.zugriff.grund(h === 'hier' ? T.zugriff.wo[ort.type] : T.zugriff.wo[h]);
  };
  const du = schreiben.data?.allowed ? `${T.zugriff.duBearbeiten[ort.type]}${grund(schreiben.data)}`
    : lesen.data?.allowed ? `${T.zugriff.duLesen[ort.type]}${grund(lesen.data)}`
      : schreiben.isPending || lesen.isPending ? T.common.loading : T.zugriff.duKeiner;

  // je Herkunft die Rollen mit ihren Einträgen; die Mitglieder stehen in einer eigenen letzten Zeile
  const gruppen = (['hier', 'ueberPortfolio', 'org'] as const).map(h => {
    const rollen = new Map<string, AccessEntry[]>();
    for (const e of liste.data?.items ?? []) {
      if (e.subject.kind === 'members' || zugriffHerkunft(e, ort) !== h) continue;
      rollen.set(e.relation, [...(rollen.get(e.relation) ?? []), e]);
    }
    return { h, titel: h === 'hier' ? T.zugriff.gruppe[ort.type] : T.zugriff.gruppe[h], rollen: [...rollen] };
  });

  const alleAnzeigen = () => { onClose(); router.navigate(bereich); };
  return (
    <Dialog title={T.zugriff.titel(label)} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose} data-autofocus>{T.common.close}</button>
      <button type="button" className="btn primary" onClick={alleAnzeigen}>{T.zugriff.alleAnzeigen}</button>
    </>}>
      <div className="zk">
        <p className="zk-du">{du}</p>
        <p className="zk-stufe"><Icon name={vertraulich ? 'lock' : 'users'} />{zugriffStufe(ort, vertraulich)}</p>
        {liste.isPending ? <Skelett zeilen={3} /> : liste.error ? <ErrorState error={liste.error} onRetry={() => void liste.refetch()} /> : <>
          {gruppen.every(g => g.rollen.length === 0) ? <p className="muted">{T.zugriff.niemand}</p> : null}
          {gruppen.filter(g => g.rollen.length > 0).map(g => (
            <section key={g.h} aria-label={g.titel}>
              <h3 className="grp-h">{g.titel}</h3>
              <ul className="zk-rollen">
                {g.rollen.map(([rel, es]) => {
                  const darf = zugriffDarf(authz, rel);
                  return (
                    <li key={rel}>
                      <details>
                        <summary>
                          <span className="zk-rolle">{darf || authz.relationLabel(rel)}</span>
                          <span className="zk-n" aria-hidden="true">{es.length}</span><span className="sr"> ({T.zugriff.anzahl(es.length)})</span>
                        </summary>
                        <ul className="zk-namen">{es.map(e => <li key={e.id ?? `${e.subject.ref}:${e.place.type}`}>{e.subject.name}</li>)}</ul>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <section aria-label={T.zugriff.mitglieder}>
            <h3 className="grp-h">{T.zugriff.mitglieder}</h3>
            <p className="zk-mitglieder">{zugriffMitglieder(ort, vertraulich)}</p>
          </section>
        </>}
      </div>
    </Dialog>
  );
}
