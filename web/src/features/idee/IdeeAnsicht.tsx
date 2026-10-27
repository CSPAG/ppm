/**
 * Ansicht einer Idee, die die Person nicht (mehr) bearbeitet (Z8 nur lesen, K4): Stand mit letztem Ereignis, alle
 * Angaben, Rückfragen mit Antworten; zusammengeführt bzw. zurückgewiesen mit Banner und Begründung (nur Betroffene,
 * UE und Gremium sehen sie). Bewertung und Kriterienraster der UE erscheinen hier nie (darstellung.md, sensible Daten).
 */
import { useId } from 'react';
import { useSession } from '../../auth/index.ts';
import { fmtDatum, Hinweis, Icon } from '../../ui/index.ts';
import { useAuswahl, type Idee, type Rueckfrage } from './api.ts';
import { IdeeStandBadge, MEINE_IDEEN, Verweis, type Gehe } from './stand.tsx';
import { TI } from './texte.ts';
import './idee.css';

export function IdeeAnsicht({ idee, gehe }: { idee: Idee; gehe: Gehe }) {
  const titleId = useId();
  const { can } = useSession();
  // Bezeichnungen des Strategiebezugs aus der Auswahl des Assistenten (auch ohne Leserecht auf Ziele)
  const auswahl = useAuswahl(can('idee:create')).data;
  const feld = auswahl?.handlungsfelder.find(h => h.id === idee.handlungsfeldId);
  const ziel = feld?.ziele.find(z => z.id === idee.strategischesZielId);
  const stufe = (s: string | null, t: string) => (s ? `${TI.stufen[s]}${t ? ` – ${t}` : ''}` : '');
  const zeilen: [string, string][] = [
    [TI.ausgangslage, idee.ausgangslage],
    [TI.zielsetzung, idee.zielsetzung],
    [TI.handlungsfeld, feld?.label ?? ''],
    [TI.ziel, ziel ? `${ziel.nummer} ${ziel.text}` : ''],
    [TI.bereiche, auswahl?.bereiche.filter(b => idee.bereiche.includes(b.id)).map(b => b.name).join(', ') ?? ''],
    [TI.herkunft, auswahl?.herkunft.find(h => h.schluessel === idee.herkunft)?.label ?? ''],
    [TI.nutzen, stufe(idee.nutzen, idee.nutzenText)],
    [TI.aufwand, stufe(idee.aufwand, idee.aufwandText)],
    [TI.relevanz, stufe(idee.relevanz, idee.relevanzText)],
    [TI.eingereichtAm, idee.eingereichtAt ? fmtDatum(idee.eingereichtAt) : ''],
  ];
  const fragen = idee.rueckfragen as Rueckfrage[];
  return (
    <section aria-labelledby={titleId}>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="grid" /></div>
            <div className="minw0">
              <h1 id={titleId}>{TI.idee(idee.nummer)} · {idee.titel || TI.ohneTitel}</h1>
              <div className="sub"><IdeeStandBadge stand={idee.stand} standAt={idee.standAt} updatedAt={idee.updatedAt} /></div>
            </div>
          </div>
          <div className="acts"><Verweis pfad={MEINE_IDEEN} gehe={gehe} className="btn">{TI.zurListe}</Verweis></div>
        </div>
      </header>
      <div className="body idee-body">
        {idee.stand === 'zusammengefuehrt' ? <Hinweis stufe="hinweis">{TI.zusammengefuehrt}</Hinweis>
          : idee.stand === 'zurueckgewiesen' ? <Hinweis stufe="hinweis">{TI.zurueckgewiesen}{idee.begruendung ? ` ${TI.begruendungZurueckweisung}: ${idee.begruendung}` : ''}</Hinweis>
            : idee.eigene ? <Hinweis stufe="hinweis">{TI.nurLesen}</Hinweis> : null}
        <dl className="attrs idee-attrs">
          {zeilen.map(([label, wert]) => (
            <div key={label} className="idee-attr">
              <dt>{label}</dt>
              <dd>{wert ? <span className="idee-wert">{wert}</span> : <span className="muted">{TI.leerWert}</span>}</dd>
            </div>
          ))}
        </dl>
        {fragen.length ? (
          <section className="idee-fragen" aria-labelledby={`${titleId}-f`}>
            <h2 id={`${titleId}-f`}>{TI.rueckfragenTitel}</h2>
            {fragen.map(q => <p key={q.id}><strong>{q.text}</strong><br />{q.antwort ?? <span className="muted">{TI.leerWert}</span>}</p>)}
          </section>
        ) : null}
      </div>
    </section>
  );
}
