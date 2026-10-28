/**
 * Seite «Szenarien» (UI-22, Seitentyp Arbeitsfläche; BC PP.03.01–03, UC-008 Schritte 5–6, K5 Schritte 5–6): Szenario
 * anlegen (Kopie des Ist-Stands), Reihenfolge und Start durchspielen mit live gerechneter Wasserlinie gegen Budget und
 * Kapazität und den Engpässen je Quartal und Rolle, Szenarien vergleichen (`?vergleich=`), als Antrag wählen
 * (Entscheidungsvorlage als Vorschau). Zustände: leer (Z2), teilweise (Z4: ohne Budgetrahmen, Bedarf nur als Grösse),
 * Konflikt (Z7: Bedarf geändert, 412), nur lesen (Gremium), mobil nur lesend (K5 «Mobil»).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { isConflict, newIdempotencyKey } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Confirm, Dialog, Empty, ErrorState, fmtDatum, Hinweis, Icon, Skelett, Stand, useToast, useVerzoegert, type StandFamilie } from '../../ui/index.ts';
import { usePortfolios } from './api.ts';
import { useBreit } from './breite.ts';
import { Kopf, PFAD, type Reiter } from './Kopf.tsx';
import { useRollen, useSzenarien, useSzenario, useSzenarioMutations, useVergleich } from './SzenarioApi.ts';
import { SzenarioListe, type Reihe } from './SzenarioListe.tsx';
import type { SetSzenarioSearch, SzenarioSearch } from './SzenarioSearch.ts';
import { fmtQuartalVon, TS } from './SzenarioTexte.ts';
import { SzenarioVergleich } from './SzenarioVergleich.tsx';
import './priorisierung.css';
import './Szenario.css';

const SPEICHERN_NACH = 250;
const FAMILIE: Record<string, StandFamilie> = { entwurf: 'entwurf', beantragt: 'wartet', entschieden: 'positiv', verworfen: 'ruhend' };

export function SzenarioPage({ search, setSearch, navigieren }: { search: SzenarioSearch; setSearch: SetSzenarioSearch; navigieren(pfad: string): void }) {
  const { can } = useSession();
  const selId = useId();
  const szId = useId();
  const toast = useToast();
  const breit = useBreit();
  const orgLesen = can('priorisierung:read');
  const portfolios = usePortfolios();
  const pf = portfolios.data ? (search.portfolio ? portfolios.data.find(p => p.schluessel === search.portfolio) : portfolios.data[0]) : undefined;
  const liste = useSzenarien(pf?.id ?? null);
  const items = liste.data?.items ?? [];
  const aktivId = search.s && items.some(s => s.id === search.s) ? search.s : items[0]?.id ?? null;
  const vergleichIds = search.vergleich ? search.vergleich.split(',') : [];
  const m = useSzenarioMutations(pf?.id ?? null);
  const [anlegen, setAnlegen] = useState(false);
  const skelett = useVerzoegert(portfolios.isPending || (!!pf && liste.isPending));
  const darfAnlegen = !!liste.data?.can.write && breit;

  const reiter: Reiter[] = orgLesen ? ['bewertung', 'matrix', 'szenarien', 'modell'] : ['bewertung', 'matrix', 'szenarien'];
  const query = new URLSearchParams(pf ? { portfolio: pf.schluessel } : {}).toString();

  return (
    <section aria-labelledby="page-title" className="pr sz">
      <Kopf reiter="szenarien" reiterSichtbar={reiter} navigieren={navigieren} query={query} sub={TS.sub}
        aktionen={<>
          {items.length && !vergleichIds.length ? (
            <button type="button" className="btn" onClick={() => setSearch({ vergleich: items.slice(0, 3).map(s => s.id).join(',') })}><Icon name="columns" />{TS.vergleichen}</button>
          ) : null}
          {darfAnlegen ? <button type="button" className="btn primary" onClick={() => setAnlegen(true)}><Icon name="plus" />{TS.anlegen}</button> : null}
        </>} />
      <div className="toolbar">
        <label htmlFor={selId} className="pr-l">{TS.portfolio}</label>
        <select id={selId} className="pr-in" value={pf?.schluessel ?? ''} disabled={!portfolios.data?.length}
          onChange={e => setSearch({ portfolio: e.target.value, s: undefined, vergleich: undefined })}>
          {(portfolios.data ?? []).map(p => <option key={p.id} value={p.schluessel}>{`${p.kategorie} · ${p.name}`}</option>)}
        </select>
        {items.length && !vergleichIds.length ? (
          <>
            <label htmlFor={szId} className="pr-l">{TS.szenario}</label>
            <select id={szId} className="pr-in" value={aktivId ?? ''} onChange={e => setSearch({ s: e.target.value })}>
              {items.map(s => <option key={s.id} value={s.id}>{`${s.name} (${TS.stand[s.stand] ?? s.stand})`}</option>)}
            </select>
          </>
        ) : null}
      </div>
      <div className="body pr-body">
        {portfolios.error || liste.error ? <ErrorState error={portfolios.error ?? liste.error} onRetry={() => { void portfolios.refetch(); void liste.refetch(); }} /> : null}
        {skelett ? <Skelett zeilen={8} /> : null}
        {portfolios.data && !portfolios.data.length ? <Empty>{TS.keinPortfolio}</Empty> : null}
        {portfolios.data && search.portfolio && !pf ? <Empty>{TS.portfolioUnbekannt}</Empty> : null}
        {liste.data && !items.length ? (
          <Empty action={darfAnlegen ? <button type="button" className="btn primary" onClick={() => setAnlegen(true)}><Icon name="plus" />{TS.anlegen}</button> : undefined}>{TS.leer}</Empty>
        ) : null}
        {search.s && liste.data && !items.some(s => s.id === search.s) && !vergleichIds.length ? <Hinweis stufe="hinweis">{TS.unbekannt}</Hinweis> : null}
        {vergleichIds.length && items.length ? (
          <VergleichAnsicht ids={vergleichIds} items={items} darf={!!liste.data?.can.write && breit} setSearch={setSearch}
            onAntrag={(id, andere) => m.beantragen.mutate({ id, vergleich: andere }, {
              onSuccess: s => { toast.show(TS.antragGewaehlt(s.name)); setSearch({ s: s.id, vergleich: undefined }); },
              onError: e => toast.error(e),
            })} busy={m.beantragen.isPending} />
        ) : aktivId ? (
          <Detail key={aktivId} id={aktivId} breit={breit} portfolioName={pf?.name ?? ''} onVerworfen={() => setSearch({ s: undefined })}
            onBewerten={() => navigieren(`${PFAD.bewertung}?${query}`)} />
        ) : null}
      </div>
      {anlegen && pf ? (
        <AnlegenDialog vorschlag={TS.nameVorschlag(items.length)} busy={m.anlegen.isPending} onClose={() => setAnlegen(false)}
          onAnlegen={(name, key) => m.anlegen.mutate({ name, key }, {
            onSuccess: s => { setAnlegen(false); toast.show(TS.angelegt(s.name)); setSearch({ s: s.id, vergleich: undefined }); },
            onError: e => toast.error(e),
          })} />
      ) : null}
    </section>
  );
}

function AnlegenDialog({ vorschlag, busy, onClose, onAnlegen }: { vorschlag: string; busy: boolean; onClose(): void; onAnlegen(name: string, key: string): void }) {
  const id = useId();
  const [name, setName] = useState(vorschlag);
  const [key] = useState(newIdempotencyKey);
  const [fehler, setFehler] = useState(false);
  const senden = () => { if (!name.trim()) { setFehler(true); return; } onAnlegen(name.trim(), key); };
  return (
    <Dialog title={TS.anlegen} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{TS.abbrechen}</button>
      <button type="button" className="btn primary" onClick={senden} disabled={busy}>{TS.anlegen}</button>
    </>}>
      <form className="form" onSubmit={e => { e.preventDefault(); senden(); }}>
        <div className="field">
          <label htmlFor={id}>{TS.name}</label>
          <input id={id} value={name} maxLength={100} data-autofocus aria-invalid={fehler || undefined} aria-describedby={fehler ? `${id}-h` : undefined}
            onChange={e => { setName(e.target.value); setFehler(false); }} />
          {fehler ? <div id={`${id}-h`} className="ferr">{TS.nameFehlt}</div> : null}
        </div>
      </form>
    </Dialog>
  );
}

/** Ein Szenario: Rangliste mit Wasserlinie, Engpässe, Vorlage (wenn als Antrag gewählt). */
function Detail({ id, breit, portfolioName, onVerworfen, onBewerten }: { id: string; breit: boolean; portfolioName: string; onVerworfen(): void; onBewerten(): void }) {
  const q = useSzenario(id);
  const rollen = useRollen();
  const toast = useToast();
  const s = q.data;
  const m = useSzenarioMutations(s?.portfolioId ?? null);
  const [reihe, setReihe] = useState<Reihe[] | null>(null);
  const [konflikt, setKonflikt] = useState(false);
  const [fehler, setFehler] = useState(false);
  const [ansage, setAnsage] = useState('');
  const [verwerfen, setVerwerfen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offen = useRef<{ liste: Reihe[]; ansage: { projektId: string; rang: number } | null } | null>(null);
  const skelett = useVerzoegert(q.isPending);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (q.isPending) return skelett ? <Skelett zeilen={8} /> : null;
  if (q.error || !s) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;

  const darf = s.can.write && breit;
  const server: Reihe[] = s.positionen.map(p => ({ projektId: p.projektId, aktiv: p.aktiv, startMonat: p.startMonat }));
  const sicht = reihe ?? server;
  const label = (r: string) => rollen.data?.find(x => x.schluessel === r)?.label ?? r;
  const w = s.rechnung.wasserlinie;
  const linieText = w.grund === 'budget' && s.rechnung.budget.rahmen !== null && s.rechnung.budget.bedarf !== null
    ? TS.budget(s.rechnung.budget.bedarf, s.rechnung.budget.rahmen, portfolioName, s.rechnung.unter)
    : w.grund === 'kapazitaet' && w.kapazitaet
      ? TS.kapazitaet(w.kapazitaet.monat, w.kapazitaet.bedarf, label(w.kapazitaet.rolle), w.kapazitaet.angebot, w.kapazitaet.projekte)
      : null;

  const speichern = () => {
    const x = offen.current;
    if (!x) return;
    offen.current = null;
    m.positionen.mutate({ s, liste: x.liste }, {
      onSuccess: neu => {
        if (!offen.current) setReihe(null);
        if (x.ansage) {
          const p = neu.positionen.find(y => y.projektId === x.ansage!.projektId);
          if (p) setAnsage(TS.verschoben(p.nummer, p.rang, p.ueberWasserlinie));
        }
      },
      onError: e => { setReihe(null); if (isConflict(e)) setKonflikt(true); else setFehler(true); },
    });
  };
  const aendern = (neu: Reihe[], a: { projektId: string; rang: number } | null) => {
    setReihe(neu);
    setFehler(false);
    offen.current = { liste: neu, ansage: a ?? offen.current?.ansage ?? null };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(speichern, SPEICHERN_NACH);
  };

  const vorlage = s.vorlage;
  return (
    <>
      <div className="notice" role="status"><Icon name="info" /> <p>{TS.banner(s.name)}</p><Stand familie={FAMILIE[s.stand] ?? 'entwurf'} label={TS.stand[s.stand] ?? s.stand} /></div>
      {s.can.write && s.stand === 'entwurf' ? (
        <div className="sz-acts">
          <button type="button" className="btn sm" onClick={() => setVerwerfen(true)}><Icon name="trash" />{TS.verwerfen}</button>
        </div>
      ) : null}
      {!s.can.write ? <Hinweis stufe="hinweis">{TS.nurLesen}</Hinweis> : !breit ? <Hinweis stufe="hinweis">{TS.schmal}</Hinweis> : null}
      {s.rechnung.hinweise.map(h => <Hinweis key={h} stufe="hinweis">{h}</Hinweis>)}
      {konflikt ? <Hinweis stufe="warnung" live aktion={<button type="button" className="btn" onClick={() => { setKonflikt(false); void q.refetch(); }}>{TS.neuLaden}</button>}>{TS.konflikt}</Hinweis> : null}
      {fehler ? <Hinweis stufe="sperre" live>{TS.fehler}</Hinweis> : null}
      {linieText ? <Hinweis stufe="warnung" live aktion={<span className="muted small">{TS.ausweg[w.grund!]}</span>}>{linieText}</Hinweis> : null}
      {darf ? <p className="pr-legende">{TS.tastatur} <span className="pr-status" role="status" aria-live="polite">{m.positionen.isPending || reihe ? TS.speichert : ansage}</span></p> : null}
      <SzenarioListe positionen={s.positionen} reihe={sicht} beiRang={w.beiRang} darf={darf && s.stand === 'entwurf'} kostenSichtbar={s.kostenSichtbar}
        linieText={linieText} onAendern={aendern} />
      <section className="sz-engpaesse" aria-labelledby={`${id}-e`}>
        <h2 id={`${id}-e`} className="grp-h"><Icon name="users" /> {TS.engpaesse}</h2>
        {s.rechnung.engpaesse.length ? (
          <ul>
            {s.rechnung.engpaesse.map(e => (
              <li key={`${e.quartal}-${e.rolle}`}>
                <Icon name="warn" /> {e.angebot > 0
                  ? TS.engpass(fmtQuartalVon(e.monat), e.bedarf, label(e.rolle), e.angebot, e.projekte)
                  : `${fmtQuartalVon(e.monat)}: ${label(e.rolle)}, ${TS.ohneAngebot}.`}
              </li>
            ))}
          </ul>
        ) : <p className="note">{TS.keineEngpaesse}</p>}
      </section>
      {vorlage ? (
        <section className="sz-vorlage" aria-labelledby={`${id}-v`}>
          <h2 id={`${id}-v`} className="grp-h"><Icon name="doc" /> {TS.vorlage} <span className="muted small">{TS.vorlageSeit(fmtDatum(vorlage.erstelltAt))}</span></h2>
          {vorlage.nichtBewertet.length ? (
            <Hinweis stufe="warnung" aktion={<button type="button" className="btn sm" onClick={onBewerten}>{TS.bewerten}</button>}>{TS.nichtBewertet(vorlage.nichtBewertet)}</Hinweis>
          ) : null}
          <SzenarioVergleich v={vorlage.vergleich} rollen={rollen.data ?? []} />
        </section>
      ) : null}
      {verwerfen ? (
        <Confirm title={TS.verwerfenFrage(s.name)} text={TS.verwerfenWirkung} confirm={TS.verwerfen} busy={m.verwerfen.isPending} onClose={() => setVerwerfen(false)}
          onConfirm={() => m.verwerfen.mutate(s, {
            onSuccess: x => { setVerwerfen(false); toast.show(TS.verworfen(x.name)); onVerworfen(); },
            onError: e => { setVerwerfen(false); toast.error(e); },
          })} />
      ) : null}
    </>
  );
}

/** Vergleich (K5 Schritt 6): Auswahl bis drei Szenarien, «Als Antrag wählen» je Szenario im Entwurf. */
function VergleichAnsicht({ ids, items, darf, setSearch, onAntrag, busy }: {
  ids: string[]; items: readonly { id: string; name: string; stand: string }[]; darf: boolean; setSearch: SetSzenarioSearch;
  onAntrag(id: string, andere: string[]): void; busy: boolean;
}) {
  const gueltig = ids.filter(x => items.some(s => s.id === x));
  const v = useVergleich(gueltig);
  const rollen = useRollen();
  const [frage, setFrage] = useState<{ id: string; name: string } | null>(null);
  const umschalten = (id: string, an: boolean) => {
    const neu = an ? [...gueltig, id].slice(0, 3) : gueltig.filter(x => x !== id);
    setSearch({ vergleich: neu.length ? neu.join(',') : undefined, s: neu.length ? undefined : id });
  };
  return (
    <>
      <fieldset className="sz-auswahl">
        <legend>{TS.vergleichAuswahl}</legend>
        {items.map(s => (
          <label key={s.id}>
            <input type="checkbox" checked={gueltig.includes(s.id)} disabled={!gueltig.includes(s.id) && gueltig.length >= 3} onChange={e => umschalten(s.id, e.target.checked)} />
            {` ${s.name}`}
          </label>
        ))}
        <button type="button" className="btn sm" onClick={() => setSearch({ vergleich: undefined, s: gueltig[0] })}>{TS.zurueck}</button>
      </fieldset>
      <p className="note">{TS.vergleichSub}</p>
      {v.isPending ? <Skelett zeilen={6} /> : v.error ? <ErrorState error={v.error} onRetry={() => void v.refetch()} /> : (
        <>
          {v.data.hinweise.map(h => <Hinweis key={h} stufe="hinweis">{h}</Hinweis>)}
          <SzenarioVergleich v={v.data} rollen={rollen.data ?? []}
            kopf={x => (darf && x.stand === 'entwurf'
              ? <button type="button" className="btn sm primary" onClick={() => setFrage({ id: x.id, name: x.name })}>{TS.alsAntrag}</button>
              : <Stand familie={FAMILIE[x.stand] ?? 'entwurf'} label={TS.stand[x.stand] ?? x.stand} />)} />
        </>
      )}
      {frage ? (
        <Dialog title={TS.alsAntragFrage(frage.name)} onClose={() => setFrage(null)} footer={<>
          <button type="button" className="btn" onClick={() => setFrage(null)} data-autofocus>{TS.abbrechen}</button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => { onAntrag(frage.id, gueltig.filter(x => x !== frage.id)); setFrage(null); }}>{TS.alsAntrag}</button>
        </>}>
          <p>{TS.alsAntragWirkung(gueltig.length)}</p>
        </Dialog>
      ) : null}
    </>
  );
}
