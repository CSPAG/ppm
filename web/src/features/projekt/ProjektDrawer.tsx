/**
 * Schublade eines Projekts in «Meine Projekte» (`?o=<nr>`): das Wichtigste auf einen Blick und der Weg in die Projektakte.
 * Ohne Leserecht (Alle Projekte, UI-52) nur die Kopfdaten und kein Weg in die Akte (Master Entscheid 14, A-73).
 */
import { PersonName } from '@vollholz/iam-web';
import { Drawer, Empty, ErrorState, fmtPhase, Icon, Loading } from '../../ui/index.ts';
import { useProjektNachNummer } from './api.ts';
import { ProjektStand } from './ProjektStand.tsx';
import { TP } from './texte.ts';

export function ProjektDrawer({ nummer, alle = false, onClose, oeffnen }: { nummer: string; alle?: boolean; onClose(): void; oeffnen(nr: string): void }) {
  const q = useProjektNachNummer(nummer, alle);
  if (q.isPending) return <Drawer title={nummer} onClose={onClose}><Loading /></Drawer>;
  if (q.error) return <Drawer title={nummer} onClose={onClose}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Drawer>;
  const p = q.data;
  if (!p) return <Drawer title={nummer} onClose={onClose}><Empty>{TP.akte.nichtGefunden}</Empty></Drawer>;
  return (
    <Drawer title={`${p.nummer} · ${p.name}`} onClose={onClose} actions={<ProjektStand projekt={p} />} footer={p.can.read ? (
      <button type="button" className="btn primary" data-autofocus onClick={() => oeffnen(p.nummer)}><Icon name="folder" />{TP.oeffnen}</button>
    ) : undefined}>
      <dl className="attrs">
        <dt>{TP.uebersicht.portfolio}</dt><dd>{p.portfolio ? `${p.portfolio.name} · ${TP.uebersicht.kategorie(p.portfolio.kategorie)}` : ''}</dd>
        <dt>{TP.uebersicht.phase}</dt><dd>{fmtPhase(p.phase)}</dd>
        {p.can.read ? <><dt>{TP.uebersicht.handlungsfeld}</dt><dd>{p.handlungsfeld ?? <span className="empty">{TP.uebersicht.keinHandlungsfeld}</span>}</dd></> : null}
        <dt>{TP.funktion.sp}</dt><dd>{p.sponsor ? <PersonName id={p.sponsor} /> : '–'}</dd>
        <dt>{TP.funktion.pl}</dt><dd>{p.projektleitung ? <PersonName id={p.projektleitung} /> : '–'}</dd>
        {p.rollen.length ? <><dt>{TP.spalte.rollen}</dt><dd>{p.rollen.map(r => TP.funktion[r]).join(', ')}</dd></> : null}
      </dl>
      {p.can.read ? null : <p className="muted">{TP.alle.nurKopf}</p>}
    </Drawer>
  );
}
