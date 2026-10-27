/**
 * Darstellung im Monatsabschluss mit den gemeinsamen Bausteinen (docs/ux/darstellung.md): Status und Trend (Kreis mit
 * Symbol, Wechsel «Im Plan → Kritisch»), Bearbeitungsstand als Badge, Auffälligkeiten als Badge mit Text (Q-B5).
 */
import { fmtAbweichungWochen, fmtDatum, fmtProzent, Icon, Stand, Status, type Projektstatus, type StandFamilie, type Trend } from '../../ui/index.ts';
import type { Auffaelligkeit, Zeile } from './api.ts';
import { TM } from './texte.ts';

const STATUS: Record<string, Projektstatus> = { im_plan: 'im-plan', kritisch: 'kritisch' };
const TREND: Record<string, Trend> = { aufwaerts: 'auf', gleichbleibend: 'gleich', abwaerts: 'ab' };

export const statusVon = (s: string | null | undefined): Projektstatus | undefined => (s ? STATUS[s] : undefined);
export const trendVon = (t: string | null | undefined): Trend | undefined => (t ? TREND[t] : undefined);

/** Status mit Vorperiode und Trend; «Nicht gemeldet» mit dem Status der Vorperiode (A-11). */
export function StatusZelle({ z }: { z: Zeile }) {
  const vor = statusVon(z.vorperiode?.status);
  if (z.stand === 'nicht_gemeldet') return <Status status="nicht-gemeldet" vorperiode={vor} />;
  const jetzt = statusVon(z.status);
  if (!jetzt) return <span className="empty">–</span>;
  return <Status status={jetzt} vorperiode={vor} trend={trendVon(z.trend)} />;
}

const FAMILIE: Record<Zeile['stand'], StandFamilie> = {
  eingereicht: 'wartet', zurueckgegeben: 'wartet', geprueft: 'positiv', ausstehend: 'ruhend', nicht_gemeldet: 'ruhend',
};

export function StandZelle({ z, heute }: { z: Zeile; heute?: Date }) {
  const detail = z.stand === 'eingereicht'
    ? (z.nachRueckfrage ? TM.nachRueckfrage : undefined)
    : z.stand === 'zurueckgegeben' ? TM.standDetail.zurueckgegeben
      : z.stand === 'ausstehend' && z.eingefordertAt ? TM.eingefordert(fmtDatum(z.eingefordertAt.slice(0, 10), heute))
        : z.stand === 'ausstehend' && z.entwurf ? TM.standDetail.entwurf : undefined;
  return <Stand familie={FAMILIE[z.stand]} label={TM.stand[z.stand]!} detail={detail} />;
}

/** «+3 Wochen» ab 7 Tagen, darunter «+4 Tage». */
export const verschiebung = (tage: number) => (Math.abs(tage) >= 7 ? fmtAbweichungWochen(Math.round(tage / 7)) : TM.tage(tage));

export function auffText(a: Auffaelligkeit): string {
  switch (a.art) {
    case 'status': return TM.auff.status;
    case 'termin': return TM.auff.termin(verschiebung(a.tage));
    case 'budget': return TM.auff.budget(fmtProzent(a.prozent));
  }
}

function auffDetail(a: Auffaelligkeit): string {
  switch (a.art) {
    case 'status': return '';
    case 'termin': return TM.auff.terminDetail(a.text, a.bezug);
    case 'budget': return TM.auff.budgetDetail(a.phase);
  }
}

/** Auffälligkeiten als Badges mit Symbol und Text; Detail als Tooltip und für Bildschirmleser. */
export function Auffaelligkeiten({ liste }: { liste: Auffaelligkeit[] }) {
  if (!liste.length) return null;
  return (
    <ul className="ma-auff">
      {liste.map(a => {
        const d = auffDetail(a);
        return (
          <li key={a.art} className="ma-badge" title={d || undefined}>
            <Icon name="warn" /><span>{auffText(a)}</span>{d ? <span className="sr"> ({d})</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
