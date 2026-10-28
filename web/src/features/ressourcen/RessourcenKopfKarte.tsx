/**
 * Kopfkarte «Ressourcen» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle», RM:
 * «offene Bedarfe, Konflikte, Auslastung der nächsten drei Monate»; UC-009): Bedarfe nach Stand, Konflikte und Engpässe
 * im Zeitraum ab diesem Monat bis drei Monate später, mit Sprung zu «Bedarf decken».
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState } from '../../ui/index.ts';
import { useAuslastung } from './api.ts';
import { useBedarfe, useKonflikte } from './BedarfApi.ts';
import { TB } from './BedarfTexte.ts';
import { PFAD } from './Kopf.tsx';
import { dieserMonat, plusMonate } from './zeitraum.ts';

export function RessourcenKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const von = dieserMonat();
  const z = { von, bis: plusMonate(von, 2) };
  const bedarfe = useBedarfe(z);
  const konflikte = useKonflikte(z);
  const auslastung = useAuslastung(z);
  if (bedarfe.isPending) return <span className="sk" aria-hidden="true" />;
  if (bedarfe.error) return <ErrorState error={bedarfe.error} onRetry={() => void bedarfe.refetch()} />;
  const a = bedarfe.data.anzahl;
  const offen = a.offen + a.teilweise;
  const nKonflikte = konflikte.data?.items.length ?? 0;
  const engpaesse = auslastung.data?.engpaesse.length;
  return (
    <>
      <h2><Link to={PFAD.bedarf}>{TB.kopfkarte.titel}</Link></h2>
      <p>{[TB.kopfkarte.offen(offen), a.ungedeckt ? TB.kopfkarte.ungedeckt(a.ungedeckt) : '', nKonflikte ? TB.kopfkarte.konflikte(nKonflikte) : ''].filter(Boolean).join(' · ')}</p>
      {engpaesse !== undefined ? (
        <Link to={PFAD.auslastung} className="small">{engpaesse ? TB.kopfkarte.engpaesse(engpaesse) : TB.kopfkarte.keinEngpass}</Link>
      ) : null}
      {offen ? <Link to={PFAD.bedarf} className="btn primary sm">{TB.kopfkarte.bedarfDecken}</Link> : null}
    </>
  );
}
