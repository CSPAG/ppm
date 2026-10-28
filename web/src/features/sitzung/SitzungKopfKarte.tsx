/**
 * Kopfkarte «Nächste Sitzung» auf der Startseite (fachmodell.md 4.1; informationsarchitektur.md «Startseite je Rolle»:
 * UE «PRAT Mi 12.11. · Versand bis Mi 5.11. · 4 von 6 Traktanden mit Unterlagen», PRAT und GLPA mit Anzahl Traktanden und Stand der Unterlagen; K3): je
 * Gremium die nächste Sitzung, die die Person sieht, höchstens drei. Ohne Sitzung entfällt die Karte.
 */
import { useIamConfig } from '@vollholz/iam-web';
import { ErrorState, fmtFrist } from '../../ui/index.ts';
import { useSitzungKopf } from './api.ts';
import { sitzungPfad } from './search.ts';
import { TS } from './texte.ts';

const MAX = 3;

export function SitzungKopfKarte() {
  const { router: { Link } } = useIamConfig();
  const q = useSitzungKopf();
  if (q.isPending) return <span className="sk" aria-hidden="true" />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  // Die API liefert nach Datum; die erste je Gremium ist dessen nächste Sitzung
  const naechste = q.data.filter((s, i, a) => a.findIndex(x => x.gremium.id === s.gremium.id) === i).slice(0, MAX);
  if (!naechste.length) return null;
  return (
    <>
      <h2>{TS.kopfkarte.titel(naechste.length)}</h2>
      <ul>
        {naechste.map(s => {
          // Vor dem Versand zählen Unterlagen und Versandfrist, danach der Stand der Sitzung
          const vorVersand = s.stand === 'geplant' || s.stand === 'in_vorbereitung';
          return (
            <li key={s.id}>
              <Link to={sitzungPfad(s.gremium.kuerzel, s.datum)}>{TS.kopfkarte.sitzung(s.gremium.kuerzel.toUpperCase(), fmtFrist(s.datum))}</Link>
              <span className="muted small">
                {(vorVersand
                  ? [TS.kopfkarte.traktanden(s.traktanden), s.traktanden ? TS.kopfkarte.unterlagen(s.unterlagenBereit, s.traktanden) : '', s.versandBis ? TS.kopfkarte.versandBis(fmtFrist(s.versandBis)) : '']
                  : [TS.kopfkarte.traktanden(s.traktanden), TS.stand[s.stand]]).filter(Boolean).join(' · ')}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
