/**
 * Kopfkarte «Meine Projekte» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle»:
 * PL, CTL, SP «je eigenes Projekt: Phase, Status und Trend, nächste Frist»; SP «kritische zuerst» mit Grund): laufende
 * Projekte, in denen die Person eine Funktion hat, mit Phase, Rolle, dem letzten gemeldeten Status und nächstem
 * Meilenstein, dem nächsten Geschäft im Gremium («Gate im PRAT Mi 10.12.», CTL «Du stellst am … vor»); solange der
 * Bericht der laufenden Periode aussteht, die Frist mit Sprung zum Bericht (K1). Kritische stehen zuerst. Ohne eigenes
 * Projekt entfällt die Karte.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState, fmtDatum, fmtFrist, fmtPhase, Status, T, type Trend } from '../../ui/index.ts';
import { useBerichtStand, useNaechsteTraktanden, useProjektKopf } from './api.ts';
import { TP } from './texte.ts';

const MAX = 5;
const TREND: Record<string, Trend> = { aufwaerts: 'auf', gleichbleibend: 'gleich', abwaerts: 'ab' };
const monat = (periode: string) => T.format.monate[Number(periode.slice(5, 7)) - 1]!;

export function ProjektKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useProjektKopf();
  const ids = (q.data?.projekte ?? []).map(p => p.id);
  const stand = useBerichtStand(ids);
  const traktanden = useNaechsteTraktanden(ids);
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const { projekte, anzahl } = q.data;
  if (!anzahl) return null;
  const je = new Map((stand.data ?? []).map(s => [s.projektId, s]));
  const gremium = new Map((traktanden.data ?? []).map(t => [t.projektId, t]));
  // Kritische zuerst (SP), sonst in der Reihenfolge der API (Nummer)
  const liste = [...projekte].sort((a, b) => Number(je.get(b.id)?.letzter?.status === 'kritisch') - Number(je.get(a.id)?.letzter?.status === 'kritisch'));
  return (
    <>
      <h2><Link to="/projekte">{TP.kopfkarte.titel}</Link></h2>
      <ul>
        {liste.slice(0, MAX).map(p => {
          const s = je.get(p.id);
          const l = s?.letzter;
          const g = gremium.get(p.id);
          const offen = s?.laufend && (s.laufend.stand === null || s.laufend.stand === 'entwurf' || s.laufend.stand === 'zurueckgegeben') ? s.laufend : null;
          return (
            <li key={p.id}>
              <Link to={`/projekte/${encodeURIComponent(p.nummer)}`}>{`${p.nummer} ${p.name}`}</Link>
              <span className="muted small">
                {[fmtPhase(p.phase), p.lebenszyklus === 'sistiert' ? TP.lebenszyklus.sistiert : '', p.rollen.map(r => TP.funktion[r]).join(', ')].filter(Boolean).join(' · ')}
              </span>
              {l?.status ? (
                <span className="small">
                  <Status status={l.status === 'im_plan' ? 'im-plan' : 'kritisch'} trend={l.trend ? TREND[l.trend] : undefined} />
                  {l.status === 'kritisch' && l.begruendung ? <span className="muted"> · {TP.kopfkarte.kritischGrund(l.begruendung)}</span> : null}
                </span>
              ) : null}
              {l?.naechsterMeilenstein ? <span className="muted small">{TP.kopfkarte.meilenstein(l.naechsterMeilenstein)}</span> : null}
              {g ? (
                <Link to={`/gremien/${encodeURIComponent(g.sitzung.gremium.kuerzel)}/sitzungen/${g.sitzung.datum}`} className="small">
                  {p.rollen.includes('ctl')
                    ? TP.kopfkarte.vorstellen(fmtDatum(g.sitzung.datum), g.sitzung.gremium.kuerzel.toUpperCase())
                    : TP.kopfkarte.traktandum(g.artLabel, g.sitzung.gremium.kuerzel.toUpperCase(), fmtDatum(g.sitzung.datum))}
                </Link>
              ) : null}
              {offen ? (
                <Link to={`/projekte/${encodeURIComponent(p.nummer)}/bericht?periode=${offen.periode}`} className="small">
                  {offen.stichtag ? TP.kopfkarte.berichtFaellig(monat(offen.periode), fmtFrist(offen.stichtag)) : TP.kopfkarte.berichtOffen(monat(offen.periode))}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
      {anzahl > MAX ? <Link to="/projekte" className="small">{TP.kopfkarte.alle(anzahl)}</Link> : null}
    </>
  );
}
