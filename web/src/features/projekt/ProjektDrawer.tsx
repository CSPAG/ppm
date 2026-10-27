/**
 * Schublade eines Projekts in «Meine Projekte» (`?o=<nr>`): das Wichtigste auf einen Blick und der Weg in die Projektakte.
 */
import { PersonName } from '@vollholz/iam-web';
import { Drawer, Empty, ErrorState, fmtPhase, Icon, Loading } from '../../ui/index.ts';
import { useProjektNachNummer } from './api.ts';
import { ProjektStand } from './ProjektStand.tsx';
import { TP } from './texte.ts';

export function ProjektDrawer({ nummer, onClose, oeffnen }: { nummer: string; onClose(): void; oeffnen(nr: string): void }) {
  const q = useProjektNachNummer(nummer);
  if (q.isPending) return <Drawer title={nummer} onClose={onClose}><Loading /></Drawer>;
  if (q.error) return <Drawer title={nummer} onClose={onClose}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Drawer>;
  const p = q.data;
  if (!p) return <Drawer title={nummer} onClose={onClose}><Empty>{TP.akte.nichtGefunden}</Empty></Drawer>;
  return (
    <Drawer title={`${p.nummer} · ${p.name}`} onClose={onClose} actions={<ProjektStand projekt={p} />} footer={
      <button type="button" className="btn primary" data-autofocus onClick={() => oeffnen(p.nummer)}><Icon name="folder" />{TP.oeffnen}</button>
    }>
      <dl className="attrs">
        <dt>{TP.uebersicht.portfolio}</dt><dd>{p.portfolio ? `${p.portfolio.name} · ${TP.uebersicht.kategorie(p.portfolio.kategorie)}` : ''}</dd>
        <dt>{TP.uebersicht.phase}</dt><dd>{fmtPhase(p.phase)}</dd>
        <dt>{TP.uebersicht.handlungsfeld}</dt><dd>{p.handlungsfeld ?? <span className="empty">{TP.uebersicht.keinHandlungsfeld}</span>}</dd>
        <dt>{TP.funktion.sp}</dt><dd>{p.sponsor ? <PersonName id={p.sponsor} /> : '–'}</dd>
        <dt>{TP.funktion.pl}</dt><dd>{p.projektleitung ? <PersonName id={p.projektleitung} /> : '–'}</dd>
        {p.rollen.length ? <><dt>{TP.spalte.rollen}</dt><dd>{p.rollen.map(r => TP.funktion[r]).join(', ')}</dd></> : null}
      </dl>
    </Drawer>
  );
}
