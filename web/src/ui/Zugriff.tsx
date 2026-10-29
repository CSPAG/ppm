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
 * Was eine Rolle am Projekt bzw. an den Projekten des Portfolios darf, aus ihren Rechten im Katalog; leer für Rollen
 * ausserhalb des Katalogs (z. B. Mitgliedschaft des Baukastens).
 */
export function zugriffDarf(authz: Authz, relation: string): string {
  const rolle = authz.catalog?.roles.find(r => r.key === relation);
  if (!rolle) return '';
  const p = new Set<string>(rolle.permissions);
  const d = T.zugriff.darf;
  const stufe = p.has('projekt:write') ? d.bearbeiten : p.has('projekt:read') ? d.lesen : p.has('projekt:list') ? d.auflisten : '';
  return stufe && p.has('access:admin') ? `${stufe}, ${d.verwalten}` : stufe;
}

/** Stufe des Objekts als Satz (Z-3): vertraulich oder Kopfdaten für alle Mitglieder. */
export function zugriffStufe(ort: ZugriffOrt, vertraulich?: boolean): string {
  if (ort.type === 'portfolio') return T.zugriff.stufe.offenPortfolio;
  return vertraulich ? T.zugriff.stufe.vertraulichProjekt : T.zugriff.stufe.offenProjekt;
}

/** Was alle Mitglieder ohne weitere Rolle hier dürfen (Master Entscheide 13, 14). */
export function zugriffMitglieder(ort: ZugriffOrt, vertraulich?: boolean): string {
  if (ort.type === 'portfolio') return T.zugriff.mitgliederPortfolio;
  return vertraulich ? T.zugriff.mitgliederVertraulich : T.zugriff.mitgliederProjekt;
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
    return T.zugriff.grund(authz.relationLabel(r.relation), h === 'hier' ? T.zugriff.wo[ort.type] : T.zugriff.wo[h]);
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
                          <span className="zk-rolle">{authz.relationLabel(rel)}</span>
                          {darf ? <span className="muted"> · {darf}</span> : null}
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
