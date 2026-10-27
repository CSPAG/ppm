/**
 * Seiten einer Idee (K4, Adressen `/portfolio/ideen/neu` und `/portfolio/ideen/<nr>`): neue Idee mit Vorbelegung und
 * Angebot des offenen Entwurfs (K4 Abnahme «abgebrochener Assistent bietet den Entwurf an»); eine bestehende Idee
 * öffnet den Assistenten, solange die Person sie bearbeiten darf (Entwurf, in Ergänzung), sonst die Ansicht (Z8).
 * Unbekannte Nummer und fehlender Zugriff: dieselbe Meldung (Z10).
 */
import { useMemo, useState } from 'react';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtDatum, Hinweis, Loading } from '../../ui/index.ts';
import { useAuswahl, useEigeneEntwuerfe, useIdeeNachNummer } from './api.ts';
import { IdeeAnsicht } from './IdeeAnsicht.tsx';
import { PruefungPage } from './PruefungPage.tsx';
import { IdeeAssistent, type Werte } from './IdeeAssistent.tsx';
import type { IdeeNeuSearch, IdeeSearch, SetIdeeSearch } from './search.ts';
import { ideePfad, MEINE_IDEEN, Verweis, type Gehe } from './stand.tsx';
import { TI } from './texte.ts';

export function IdeeNeuPage({ search, gehe }: { search: IdeeNeuSearch; gehe: Gehe }) {
  const [neu, setNeu] = useState(false);
  const entwuerfe = useEigeneEntwuerfe(!neu);
  // Den Entwurf nur beim ersten Laden anbieten: Der Entwurf, den dieser Assistent beim Speichern anlegt, unterbricht ihn nicht
  if (!neu && entwuerfe.data && !entwuerfe.data.length) setNeu(true);
  const vorbelegt = !!(search.ziel || search.herkunft);
  const auswahl = useAuswahl(vorbelegt);
  const vorbelegung = useMemo((): Partial<Werte> => {
    const v: Partial<Werte> = {};
    const nummer = search.ziel?.slice('ziel:'.length);
    for (const h of auswahl.data?.handlungsfelder ?? []) {
      const z = h.ziele.find(x => x.nummer === nummer);
      if (z) { v.handlungsfeldId = h.id; v.strategischesZielId = z.id; }
    }
    if (search.herkunft && auswahl.data?.herkunft.some(h => h.schluessel === search.herkunft)) v.herkunft = search.herkunft;
    return v;
  }, [auswahl.data, search.ziel, search.herkunft]);

  if ((!neu && entwuerfe.isPending) || (vorbelegt && auswahl.isPending)) return <Loading />;
  const entwurf = !neu && !vorbelegt ? entwuerfe.data?.[0] : undefined;
  if (entwurf) {
    return (
      <section aria-labelledby="idee-entwurf" className="idee-assistent">
        <header className="mh"><div className="mh-row"><div className="mh-title"><h1 id="idee-entwurf">{TI.neu}</h1></div></div></header>
        <div className="body idee-body">
          <Hinweis stufe="hinweis" aktion={<>
            <Verweis pfad={ideePfad(entwurf.nummer)} gehe={gehe} className="btn primary sm">{TI.entwurfFortsetzen}</Verweis>
            <button type="button" className="btn sm" onClick={() => setNeu(true)}>{TI.neuBeginnen}</button>
          </>}>
            {TI.entwurfVorhanden} «{entwurf.titel || TI.ohneTitel}», {TI.zuletzt(fmtDatum(entwurf.updatedAt))}
          </Hinweis>
        </div>
      </section>
    );
  }
  return <IdeeAssistent start={null} vorbelegung={vorbelegung} gehe={gehe} />;
}

export function IdeePage({ nummer, search, setSearch, gehe }: { nummer: number | null; search: IdeeSearch; setSearch: SetIdeeSearch; gehe: Gehe }) {
  const q = useIdeeNachNummer(nummer);
  const { canSomewhere } = useSession();
  if (nummer === null) return <NichtGefunden gehe={gehe} />;
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <NichtGefunden gehe={gehe} />;
  if (q.data.item.can.bearbeiten) {
    return <IdeeAssistent key={q.data.item.id} start={q.data} schritt={search.schritt} onSchritt={n => setSearch({ schritt: n }, { replace: true })} gehe={gehe} />;
  }
  return canSomewhere('idee:read') ? <PruefungPage idee={q.data.item} gehe={gehe} /> : <IdeeAnsicht idee={q.data.item} gehe={gehe} />;
}

function NichtGefunden({ gehe }: { gehe: Gehe }) {
  return (
    <section className="body">
      <Empty action={<Verweis pfad={MEINE_IDEEN} gehe={gehe} className="btn">{TI.zurListe}</Verweis>}>{TI.nichtGefunden}</Empty>
    </section>
  );
}
