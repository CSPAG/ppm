/**
 * Vorschläge der Sitzung (K3 Schritt 1): gruppiert nach Art in der Reihenfolge des Ablaufs (Portfoliobericht,
 * Gate-Reviews, Meilensteinabnahmen, Eskalationen, Änderungen …), verschobene Traktanden der letzten Sitzung zuerst.
 * «Aufnehmen» setzt Zeitbedarf und Eingeladene vor (UC-006 Schritt 2). «Gate-Review einplanen» traktandiert das Gate
 * eines Projekts des Portfolios direkt (PP.04.05).
 */
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { api, type Schemas } from '../../api/index.ts';
import { ErrorState, Icon, Loading, Stand, fmtDatum } from '../../ui/index.ts';
import { useVorschlaege, type Sitzung } from './api.ts';
import { TS } from './texte.ts';

const UNTERLAGEN = { bereit: 'positiv', quality_check_offen: 'wartet', fehlt: 'negativ', keine: 'ruhend' } as const;

/** Aktive Projekte des Portfolios der Sitzung (für das Einplanen). */
function useProjekteDesPortfolios(portfolioId: string) {
  return useQuery({
    queryKey: ['sitzung', 'projekte', portfolioId],
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte', { params: { query: { limit: 200 } }, signal })).data!.items
      .filter(p => p.portfolioId === portfolioId && p.lebenszyklus === 'aktiv'),
  });
}

function Einplanen({ sitzung, busy, onEinplanen }: { sitzung: Sitzung; busy: boolean; onEinplanen(body: Schemas['TraktandumCreate']): void }) {
  const id = useId();
  const p = useProjekteDesPortfolios(sitzung.portfolioId);
  const [projekt, setProjekt] = useState('');
  if (!p.data?.length) return null;
  return (
    <form className="sz-einplanen" onSubmit={e => { e.preventDefault(); if (projekt) onEinplanen({ art: 'gate', projektId: projekt }); }}>
      <label htmlFor={id} className="sz-sub">{TS.einplanen}</label>
      <div className="sz-einplanen-r">
        <select id={id} className="sz-in" value={projekt} onChange={e => setProjekt(e.target.value)}>
          <option value="">–</option>
          {p.data.map(x => <option key={x.id} value={x.id}>{`${x.nummer} ${x.name} · ${x.phase}`}</option>)}
        </select>
        <button type="submit" className="btn" disabled={busy || !projekt}><Icon name="plus" />{TS.aufnehmen}</button>
      </div>
    </form>
  );
}

export function Vorschlagsliste({ sitzung, busy, onAufnehmen, onEinplanen }: {
  sitzung: Sitzung; busy: boolean; onAufnehmen(id: string): void; onEinplanen(body: Schemas['TraktandumCreate']): void;
}) {
  const v = useVorschlaege(sitzung.id, true);
  return (
    <aside className="sz-panel" aria-labelledby="sz-vorschlaege">
      <h2 id="sz-vorschlaege" className="sz-h">{TS.vorschlaege}</h2>
      {v.isPending ? <Loading /> : v.error ? <ErrorState error={v.error} onRetry={() => void v.refetch()} /> : !v.data.gruppen.length ? (
        <p className="empty">{TS.keineVorschlaege}</p>
      ) : v.data.gruppen.map(g => (
        <section key={g.art} className="sz-gruppe" aria-label={g.label}>
          <h3 className="sz-h3">{g.label} <span className="sz-sub">{g.traktanden.length}</span></h3>
          <ul className="sz-vl">
            {g.traktanden.map(t => (
              <li key={t.id} className="sz-v">
                <div className="minw0">
                  <div className="sz-v-t">{t.projekt ? <span className="sz-pnr">{t.projekt.nummer}</span> : null}{t.titel}</div>
                  <div className="sz-merk">
                    <Stand familie={UNTERLAGEN[t.unterlagen.stand]} label={TS.unterlagen[t.unterlagen.stand] ?? t.unterlagen.stand} />
                    {t.verschobenVon ? <span className="pill st-idle">{TS.verschobenVon(fmtDatum(t.verschobenVon))}</span> : null}
                  </div>
                </div>
                <button type="button" className="btn" disabled={busy} onClick={() => onAufnehmen(t.id)} aria-label={TS.aufnehmenName(t.titel)}>
                  <Icon name="plus" />{TS.aufnehmen}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Einplanen sitzung={sitzung} busy={busy} onEinplanen={onEinplanen} />
    </aside>
  );
}
