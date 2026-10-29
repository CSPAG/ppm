/**
 * Rahmen der Projektakte (`/projekte/<nr>/…`, fachmodell.md 1.2): Kopf mit Nummer, Name, Portfolio, Phase, Stand und «Zugriff»,
 * Banner bei sistierten und beendeten Projekten (Z9), Reiter der Projektakte und darunter der Inhalt des Reiters. Die
 * Reiter anderer Features hängt der Router ein (`reiter`, Kinder); der Rahmen importiert keine Features (I-N6: Projekt ›
 * Reiter statt tieferer Ebenen). Unbekannt und ohne Zugriff zeigen dieselbe Meldung (Z10).
 */
import { useIamConfig } from '@vollholz/iam-web';
import type { ReactNode } from 'react';
import { useSession } from '../../auth/index.ts';
import type { AppPermission } from '../../auth/permissions.ts';
import { Empty, ErrorState, fmtPhase, GeaendertNach, Hinweis, Icon, Skelett, T, useVerzoegert, ZugriffKurz } from '../../ui/index.ts';
import { useProjektNachNummer } from './api.ts';
import { ProjektStand } from './ProjektStand.tsx';
import { TP } from './texte.ts';
import './projekt.css';

/** Reiter der Projektakte: `pfad` relativ zu `/projekte/<nr>` ('' = Übersicht), sichtbar mit `recht` irgendwo. */
export interface Reiter { pfad: string; label: string; recht?: AppPermission }

export function ProjektAkte({ nummer, reiter, children }: { nummer: string; reiter: readonly Reiter[]; children: ReactNode }) {
  const { router: { Link, usePathname } } = useIamConfig();
  const path = usePathname();
  const { canSomewhere } = useSession();
  const q = useProjektNachNummer(nummer);
  const skelett = useVerzoegert(q.isPending);
  const basis = `/projekte/${nummer}`;
  const zurueck = <Link to="/projekte" className="btn sm"><Icon name="arrow" />{TP.akte.zurueck}</Link>;

  if (q.isPending) return <div aria-busy="true"><span className="sr" role="status">{T.common.loading}</span>{skelett ? <Skelett zeilen={3} /> : null}</div>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const p = q.data;
  if (!p) return <Empty action={zurueck}>{TP.akte.nichtGefunden}</Empty>;

  const sichtbar = reiter.filter(r => !r.recht || canSomewhere(r.recht));
  const aktiv = (r: Reiter) => (r.pfad ? path === `${basis}/${r.pfad}` || path.startsWith(`${basis}/${r.pfad}/`) : path === basis || path === `${basis}/`);
  // zurückgezogen ist lesend; abgeschlossen und abgebrochen bleiben änderbar, markiert (UC-015 Schritt 6, A-75)
  const beendet = p.lebenszyklus === 'abgebrochen' || p.lebenszyklus === 'abgeschlossen';
  return (
    <section aria-labelledby="page-title" className="pj-akte">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="folder" /></div>
            <div className="minw0">
              <h1 id="page-title"><span className="mono pj-nr">{p.nummer}</span> {p.name}</h1>
              <div className="sub">{[p.portfolio?.name, fmtPhase(p.phase)].filter(Boolean).join(' · ')} <ProjektStand projekt={p} />
                {p.geaendertNachAbschluss ? <> <GeaendertNach text={TP.akte.geaendertNachAbschluss} at={p.geaendertNachAbschluss} /></> : null}</div>
            </div>
          </div>
          <div className="acts">
            {/* Zugriff auf einen Blick, mit Schloss bei vertraulichen Projekten (docs/ux/zugriff.md, UX-E14) */}
            {p.can.read ? <ZugriffKurz ort={{ type: 'projekt', id: p.id }} label={`${p.nummer} ${p.name}`} vertraulich={p.vertraulich} bereich={`${basis}/zugriff`} /> : null}
            {zurueck}
          </div>
        </div>
        {sichtbar.length > 1 ? (
          <nav className="tabs" aria-label={TP.akte.reiter}>
            {sichtbar.map(r => (
              <Link key={r.pfad} to={r.pfad ? `${basis}/${r.pfad}` : basis} className={`tab${aktiv(r) ? ' on' : ''}`} aria-current={aktiv(r) ? 'page' : undefined}>{r.label}</Link>
            ))}
          </nav>
        ) : null}
      </header>
      {p.lebenszyklus === 'zurueckgezogen' ? <div className="pj-banner"><Hinweis stufe="hinweis">{TP.akte.beendet(TP.lebenszyklus[p.lebenszyklus])}</Hinweis></div> : null}
      {beendet ? <div className="pj-banner"><Hinweis stufe="hinweis">{TP.akte.nachAbschluss(TP.lebenszyklus[p.lebenszyklus])}</Hinweis></div> : null}
      {p.lebenszyklus === 'sistiert' ? <div className="pj-banner"><Hinweis stufe="hinweis">{TP.akte.sistiert}</Hinweis></div> : null}
      {/* scrollbarer Bereich mit der Tastatur erreichbar (axe scrollable-region-focusable) */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- beschriftete, scrollbare Region (WCAG 2.1.1) */}
      <div className="body pj-inhalt" tabIndex={0} role="region" aria-label={TP.akte.inhalt}>{children}</div>
    </section>
  );
}
