/**
 * Portfolio › Monatsabschluss (UI-15, UI-16; Kernablauf K1 «Prüfen», UC-005; BC PS.01.02–04): Kopf der Periode mit
 * Anzahlen und Fristen, Posteingang der Berichte (auffällige zuerst), Bericht in der Schublade, Terminabweichungen als
 * Ansicht «Termine» und «Periode abschliessen» mit Wirkungsvorschau. Nach dem Abschluss gesperrt (Z9).
 * Adresse: `/portfolio/monatsabschluss?periode=2026-10&stand=eingereicht` (I-N5).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { isConflict } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Empty, ErrorState, fmtDatum, fmtPeriode, Hinweis, Icon, Skelett, useToast, useVerzoegert } from '../../ui/index.ts';
import { AbschlussDialog } from './AbschlussDialog.tsx';
import { useKopf, useMonatsabschlussAktionen, usePeriode, type Zeile } from './api.ts';
import { BerichtDrawer } from './BerichtDrawer.tsx';
import { Posteingang } from './Posteingang.tsx';
import { SammelDialog, type Vorschau } from './SammelDialog.tsx';
import { berichtO, nummerAusO, nummerAusTermineO, periodePlus, termineO, type MonatsabschlussSearch, type SetMonatsabschlussSearch, type ZeilenStand } from './search.ts';
import { Termine } from './Termine.tsx';
import { TM } from './texte.ts';
import './monatsabschluss.css';

const RANG: Record<ZeilenStand, number> = { eingereicht: 1, zurueckgegeben: 2, ausstehend: 3, nicht_gemeldet: 4, geprueft: 5 };
const rang = (z: Zeile) => (z.stand === 'eingereicht' && z.auffaelligkeiten.length ? 0 : RANG[z.stand]);
const FILTER_STAENDE: ZeilenStand[] = ['eingereicht', 'zurueckgegeben', 'ausstehend', 'geprueft'];

/** Filter und Sortierung wie die API (`GET /v1/perioden/:periode`), hier auf der ganzen Periode (Kopf zählt alles). */
function filtern(items: Zeile[], s: MonatsabschlussSearch): Zeile[] {
  let r = items;
  if (s.stand) r = r.filter(z => z.stand === s.stand);
  if (s.portfolio) r = r.filter(z => z.portfolioId === s.portfolio);
  if (s.auffaellig) r = r.filter(z => z.auffaelligkeiten.length > 0);
  return [...r].sort(s.sort === 'nummer' ? (a, b) => a.projektNummer.localeCompare(b.projektNummer) : (a, b) => rang(a) - rang(b) || a.projektNummer.localeCompare(b.projektNummer));
}

export function MonatsabschlussPage({ search, setSearch, heute = new Date() }: { search: MonatsabschlussSearch; setSearch: SetMonatsabschlussSearch; heute?: Date }) {
  const { canSomewhere, can } = useSession();
  const darf = canSomewhere('statusbericht:review');
  const kopfQ = useKopf(darf && !search.periode);
  const periode = search.periode ?? kopfQ.data?.pruefen?.periode;
  // Ohne Periode in der Adresse: die Periode in Arbeit übernehmen (ohne neuen Verlaufseintrag)
  useEffect(() => { if (!search.periode && kopfQ.data?.pruefen) setSearch({ periode: kopfQ.data.pruefen.periode }, { replace: true }); }, [search.periode, kopfQ.data, setSearch]);

  if (!darf) return <section aria-labelledby="page-title"><Kopfzeile /><div className="body"><Empty>{TM.keinRecht}</Empty></div></section>;
  if (!periode) {
    return (
      <section aria-labelledby="page-title">
        <Kopfzeile />
        <div className="body">{kopfQ.error ? <ErrorState error={kopfQ.error} onRetry={() => void kopfQ.refetch()} /> : <Laden />}</div>
      </section>
    );
  }
  return <Periode periode={periode} search={search} setSearch={setSearch} heute={heute} darfAbschliessen={can('periode:close')} />;
}

function Kopfzeile({ unter, aktionen }: { unter?: ReactNode; aktionen?: ReactNode }) {
  return (
    <header className="mh">
      <div className="mh-row">
        <div className="mh-title">
          <div className="type-ico neutral"><Icon name="inbox" /></div>
          <div className="minw0">
            <h1 id="page-title">{TM.title}</h1>
            <div className="sub">{unter ?? TM.sub}</div>
          </div>
        </div>
        {aktionen ? <div className="acts">{aktionen}</div> : null}
      </div>
    </header>
  );
}

function Laden() {
  const skelett = useVerzoegert(true);
  return <div aria-busy="true"><span className="sr" role="status">{TM.title}</span>{skelett ? <Skelett /> : null}</div>;
}

function Periode({ periode, search, setSearch, heute, darfAbschliessen }: { periode: string; search: MonatsabschlussSearch; setSearch: SetMonatsabschlussSearch; heute: Date; darfAbschliessen: boolean }) {
  const q = usePeriode(periode, {});
  const toast = useToast();
  const m = useMonatsabschlussAktionen(periode);
  const [ansage, setAnsage] = useState('');
  const [dialog, setDialog] = useState(false);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const kopf = q.data?.kopf;
  const alle = useMemo(() => q.data?.items ?? [], [q.data]);
  const zeilen = useMemo(() => filtern(alle, search), [alle, search]);
  const portfolios = useMemo(() => [...new Map(alle.map(z => [z.portfolioId, z.portfolioName])).entries()], [alle]);
  const beschaeftigt = m.bestaetigen.isPending || m.zuruecknehmen.isPending || m.rueckfrage.isPending || m.sammelBestaetigen.isPending || m.sammelZuruecknehmen.isPending || m.einfordern.isPending || m.abschliessen.isPending;
  const offenZ = search.o?.startsWith('bericht:') ? alle.find(z => z.projektNummer === nummerAusO(search.o!)) : undefined;
  const pLabel = fmtPeriode(periode);
  const melden = (text: string, o?: Parameters<typeof toast.show>[1]) => { setAnsage(text); toast.show(text, o); };
  const fehler = (e: unknown) => toast.error(e, isConflict(e) ? TM.konflikt : undefined);

  const aktionen = {
    bestaetigen: (z: Zeile) => m.bestaetigen.mutate(z, {
      onSuccess: neu => melden(TM.toast.bestaetigt(z.projektNummer), {
        action: { label: TM.aktion.zuruecknehmen, run: () => m.zuruecknehmen.mutate(neu, { onSuccess: () => melden(TM.toast.zurueckgenommen(z.projektNummer)), onError: fehler }) },
      }),
      onError: fehler,
    }),
    zuruecknehmen: (z: Zeile) => m.zuruecknehmen.mutate(z, { onSuccess: () => melden(TM.toast.zurueckgenommen(z.projektNummer)), onError: fehler }),
    rueckfrage: (z: Zeile, text: string, fertig: () => void) => m.rueckfrage.mutate({ z, text }, { onSuccess: () => { fertig(); melden(TM.toast.rueckfrage(z.projektNummer)); }, onError: fehler }),
    // Wirkt auf andere: erst Vorschau, dann bewusster Klick (I-R1 Stufe 3)
    einfordern: (zs: Zeile[]) => setVorschau({ art: 'einfordern', zeilen: zs }),
    sammelBestaetigen: (zs: Zeile[]) => setVorschau({ art: 'bestaetigen', zeilen: zs }),
  };
  const ausfuehren = (v: Vorschau, zs: Zeile[]) => {
    const ids = zs.map(z => z.projektId);
    if (v.art === 'einfordern') {
      m.einfordern.mutate(ids, { onSuccess: r => { setVorschau(null); melden(TM.toast.eingefordert(r.erledigt.length, r.uebersprungen.length)); }, onError: e => { setVorschau(null); fehler(e); } });
      return;
    }
    m.sammelBestaetigen.mutate(ids, {
      onSuccess: r => {
        setVorschau(null);
        const text = TM.toast.sammel(r.erledigt.length, r.uebersprungen.filter(u => u.grund === 'auffaellig').length, r.uebersprungen.filter(u => u.grund === 'stand').length);
        melden(text, r.erledigt.length ? {
          action: { label: TM.aktion.zuruecknehmen, run: () => m.sammelZuruecknehmen.mutate(r.erledigt, { onSuccess: x => melden(TM.toast.sammelZurueckgenommen(x.ok, x.nicht)), onError: fehler }) },
        } : undefined);
      },
      onError: e => { setVorschau(null); fehler(e); },
    });
  };

  const unter = kopf ? [
    pLabel,
    TM.kopf.eingereicht(kopf.anzahl.eingereicht + kopf.anzahl.zurueckgegeben + kopf.anzahl.geprueft, kopf.anzahl.projekte),
    TM.kopf.geprueft(kopf.anzahl.geprueft),
    kopf.stand === 'offen' ? TM.kopf.ausstehend(kopf.anzahl.ausstehend) : TM.kopf.nichtGemeldet(kopf.anzahl.nichtGemeldet),
    kopf.fristen.stichtag ? TM.kopf.stichtag(fmtDatum(kopf.fristen.stichtag, heute)) : '',
    kopf.stand === 'offen' ? TM.kopf.abschlussBis(fmtDatum(kopf.fristen.abschlussBis, heute)) : '',
  ].filter(Boolean).join(' · ') : pLabel;

  const nav = (
    <>
      <div className="seg ma-perioden" role="group" aria-label={pLabel}>
        <button type="button" onClick={() => setSearch({ periode: periodePlus(periode, -1), o: undefined })} aria-label={TM.periodeVor}><Icon name="chev" className="ma-zurueck" /></button>
        <button type="button" onClick={() => setSearch({ periode: periodePlus(periode, 1), o: undefined })} aria-label={TM.periodeNach}><Icon name="chev" /></button>
      </div>
      {darfAbschliessen && kopf?.stand === 'offen' ? (
        <button type="button" className="btn primary" onClick={() => setDialog(true)}><Icon name="calendar-check" />{TM.aktion.abschliessen}</button>
      ) : null}
    </>
  );

  const eingereichtGesamt = kopf ? kopf.anzahl.eingereicht + kopf.anzahl.zurueckgegeben + kopf.anzahl.geprueft : 0;
  const gefiltert = !!(search.stand || search.auffaellig || search.portfolio);

  return (
    <section aria-labelledby="page-title">
      <Kopfzeile unter={unter} aktionen={nav} />
      <span className="sr" role="status" aria-live="polite">{ansage}</span>
      {kopf?.stand === 'abgeschlossen' && kopf.abgeschlossenAt ? (
        <div className="ma-banner"><Hinweis stufe="hinweis">{TM.gesperrt(pLabel.split(' ')[0]!, fmtDatum(kopf.abgeschlossenAt.slice(0, 10), heute), kopf.abgeschlossenBy?.name ?? null)}</Hinweis></div>
      ) : null}
      <div className="tabs ma-tabs" role="navigation" aria-label={TM.title}>
        <button type="button" className={`tab${search.ansicht ? '' : ' on'}`} aria-current={search.ansicht ? undefined : 'page'} onClick={() => setSearch({ ansicht: undefined })}>{TM.ansicht.berichte}</button>
        <button type="button" className={`tab${search.ansicht === 'termine' ? ' on' : ''}`} aria-current={search.ansicht === 'termine' ? 'page' : undefined} onClick={() => setSearch({ ansicht: 'termine', o: undefined })}>{TM.ansicht.termine}</button>
      </div>
      {search.ansicht === 'termine' ? (
        <div className="body">
          <Termine periode={periode} projektLink={nr => `/projekte/${nr}`} offen={nummerAusTermineO(search.o)}
            oeffnen={nr => setSearch({ o: termineO(nr) })} schliessen={() => setSearch({ o: undefined })} />
        </div>
      ) : (
        <>
          <div className="toolbar" role="search" aria-label={TM.filter.stand}>
            <div className="seg" role="group" aria-label={TM.filter.stand}>
              <button type="button" className={search.stand ? '' : 'on'} aria-pressed={!search.stand} onClick={() => setSearch({ stand: undefined })}>{TM.filter.alle}</button>
              {[...FILTER_STAENDE, ...(kopf?.stand === 'abgeschlossen' ? ['nicht_gemeldet' as const] : [])].map(s => (
                <button key={s} type="button" className={search.stand === s ? 'on' : ''} aria-pressed={search.stand === s} onClick={() => setSearch({ stand: s })}>{TM.stand[s]}</button>
              ))}
            </div>
            <label className="ma-check"><input type="checkbox" checked={!!search.auffaellig} onChange={e => setSearch({ auffaellig: e.target.checked ? '1' : undefined })} />{TM.filter.nurAuffaellige}</label>
            {portfolios.length > 1 ? (
              <label className="ma-select">
                <span className="sr">{TM.filter.portfolio}</span>
                <select value={search.portfolio ?? ''} onChange={e => setSearch({ portfolio: e.target.value || undefined })}>
                  <option value="">{TM.filter.allePortfolios}</option>
                  {portfolios.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </label>
            ) : null}
            <label className="ma-select">
              <span className="sr">{TM.filter.sortierung}</span>
              <select value={search.sort ?? ''} onChange={e => setSearch({ sort: e.target.value || undefined })}>
                <option value="">{TM.filter.auffaelligZuerst}</option>
                <option value="nummer">{TM.filter.nachNummer}</option>
              </select>
            </label>
          </div>
          <div className="body">
            {q.isPending ? <Laden /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
              <>
                {kopf && !eingereichtGesamt && kopf.stand === 'offen' ? (
                  <p className="ma-leer" role="status">{TM.leer(pLabel.split(' ')[0]!, kopf.fristen.berichtAufgabe ? fmtDatum(kopf.fristen.berichtAufgabe, heute) : null)}</p>
                ) : null}
                {zeilen.length ? (
                  <Posteingang zeilen={zeilen} aktuell={offenZ?.projektNummer} oeffnen={z => setSearch({ o: berichtO(z.projektNummer) })}
                    beschaeftigt={beschaeftigt} bestaetigen={aktionen.bestaetigen} rueckfrage={aktionen.rueckfrage}
                    einfordern={aktionen.einfordern} sammelBestaetigen={aktionen.sammelBestaetigen} />
                ) : search.stand === 'eingereicht' && !search.auffaellig && !search.portfolio ? (
                  <Empty><span role="status">{TM.leerEingereicht(kopf?.anzahl.ausstehend ?? 0)}</span></Empty>
                ) : gefiltert ? (
                  <Empty action={<button type="button" className="btn" onClick={() => setSearch({ stand: undefined, auffaellig: undefined, portfolio: undefined })}>{TM.filter.alle}</button>}>
                    <span role="status">{TM.leerFilter}</span>
                  </Empty>
                ) : null}
                {zeilen.length && kopf?.stand === 'offen' ? <p className="note ma-tasten">{TM.tasten}</p> : null}
              </>
            )}
          </div>
        </>
      )}
      {offenZ ? (
        <BerichtDrawer z={offenZ} periode={periode} onClose={() => setSearch({ o: undefined })} beschaeftigt={beschaeftigt}
          bestaetigen={aktionen.bestaetigen} zuruecknehmen={aktionen.zuruecknehmen} rueckfrage={aktionen.rueckfrage} einfordern={z => aktionen.einfordern([z])} />
      ) : null}
      {vorschau ? <SammelDialog vorschau={vorschau} onClose={() => setVorschau(null)} beschaeftigt={beschaeftigt} ausfuehren={zs => ausfuehren(vorschau, zs)} /> : null}
      {dialog && kopf ? (
        <AbschlussDialog kopf={kopf} onClose={() => setDialog(false)} beschaeftigt={beschaeftigt}
          eingereichteZeigen={() => { setDialog(false); setSearch({ stand: 'eingereicht', auffaellig: undefined, portfolio: undefined, ansicht: undefined }); }}
          abschliessen={() => m.abschliessen.mutate(kopf.version, { onSuccess: () => { setDialog(false); melden(TM.toast.abgeschlossen(pLabel)); }, onError: e => { setDialog(false); fehler(e); } })} />
      ) : null}
    </section>
  );
}
