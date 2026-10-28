/**
 * Idee prüfen (K4 Prüfen 6–8, UI-04; AP-E4-2; BC DM.01.02–04, PP.02.04; UC-001 Schritte 3–5, A1–A3): links die Idee mit
 * Leitfragen zum Eintritt P0, Kriterienraster mit Vorschlag (G11) und Kategorie mit Wirkung, rechts ähnliche Ideen (nur
 * `idee:write`, A-32) mit «Zusammenführen». Rückfrage, Zurückweisen und Zusammenführen als Dialog mit Wirkung (I-R1).
 * Zustände: Z1, Z5, Z7 (412 → neu laden), Z8 (Gremium liest), Z9 (zusammengeführt, zurückgewiesen, in Ergänzung).
 */
import { PersonName, PersonPick } from '@vollholz/iam-web';
import { useId, useState } from 'react';
import { isConflict } from '../../api/index.ts';
import { useSession } from '../../auth/index.ts';
import { Dialog, ErrorState, fmtDatum, Hinweis, Icon, Loading, T, useToast } from '../../ui/index.ts';
import { useAuswahl, type Idee, type Rueckfrage } from './api.ts';
import { FreigabeAbschnitt } from './FreigabeAbschnitt.tsx';
import {
  useAehnliche, useIdeeNummer, usePortfolios, usePruefung, usePruefungMutations, type Aehnlich, type Kategorie, type Pruefung,
} from './PruefungApi.ts';
import { TP } from './PruefungTexte.ts';
import { ideePfad, IdeeStandBadge, Verweis, type Gehe } from './stand.tsx';
import { TI } from './texte.ts';
import './idee.css';
import './Pruefung.css';

type Stufe = 'hoch' | 'mittel' | 'tief';
const STUFEN: readonly Stufe[] = ['hoch', 'mittel', 'tief'];
const FELDER = ['titel', 'ausgangslage', 'zielsetzung', 'handlungsfeld', 'strategischesZiel', 'bereiche', 'nutzen', 'aufwand', 'relevanz', 'herkunft'] as const;

export function PruefungPage({ idee, gehe }: { idee: Idee; gehe: Gehe }) {
  const titleId = useId();
  const { can, canSomewhere } = useSession();
  const toast = useToast();
  const p = usePruefung(idee.id);
  const write = can('idee:write');
  const aehnliche = useAehnliche(idee.id, write);
  const auswahl = useAuswahl(can('idee:create') || canSomewhere('idee:read')).data;
  const m = usePruefungMutations(idee.id);
  const [dialog, setDialog] = useState<null | 'rueckfrage' | 'zurueckweisen' | { mit: Aehnlich }>(null);
  const fuehrendeNr = useIdeeNummer(idee.stand === 'zusammengefuehrt' ? idee.fuehrendeIdeeId : null).data;

  if (p.isPending) return <Loading />;
  if (p.error) return <ErrorState error={p.error} onRetry={() => void p.refetch()} />;
  const { item, etag } = p.data;
  const fehler = (e: unknown) => {
    if (isConflict(e)) { toast.error(e, TP.konflikt); void p.refetch(); } else toast.error(e);
  };
  const feld = auswahl?.handlungsfelder.find(h => h.id === idee.handlungsfeldId);
  const ziel = feld?.ziele.find(z => z.id === idee.strategischesZielId);
  const stufe = (s: string | null, t: string) => (s ? `${TI.stufen[s]}${t ? ` – ${t}` : ''}` : '');
  const angaben: [string, string][] = [
    [TI.ausgangslage, idee.ausgangslage], [TI.zielsetzung, idee.zielsetzung],
    [TI.handlungsfeld, feld?.label ?? ''], [TI.ziel, ziel ? `${ziel.nummer} ${ziel.text}` : ''],
    [TI.bereiche, auswahl?.bereiche.filter(b => idee.bereiche.includes(b.id)).map(b => b.name).join(', ') ?? ''],
    [TI.herkunft, auswahl?.herkunft.find(h => h.schluessel === idee.herkunft)?.label ?? ''],
    [TI.nutzen, stufe(idee.nutzen, idee.nutzenText)], [TI.aufwand, stufe(idee.aufwand, idee.aufwandText)], [TI.relevanz, stufe(idee.relevanz, idee.relevanzText)],
    [TI.eingereichtAm, idee.eingereichtAt ? fmtDatum(idee.eingereichtAt) : ''],
  ];
  const offeneAehnliche = (aehnliche.data ?? []).filter(a => !['zurueckgewiesen', 'zusammengefuehrt', 'freigegeben'].includes(a.idee.stand));
  return (
    <section aria-labelledby={titleId} className="idee-pruefung">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="grid" /></div>
            <div className="minw0">
              <h1 id={titleId}>{TI.idee(idee.nummer)} · {idee.titel || TI.ohneTitel}</h1>
              <div className="sub idee-stand">
                <IdeeStandBadge stand={idee.stand} standAt={idee.standAt} updatedAt={idee.updatedAt} />
                <span>{TP.eingereichtVon} <PersonName id={idee.erfasstVon} /></span>
              </div>
            </div>
          </div>
          <div className="acts">
            {item.can.pruefen && ['eingereicht', 'in_pruefung'].includes(idee.stand) ? <button type="button" className="btn" onClick={() => setDialog('rueckfrage')}>{TP.rueckfrage}</button> : null}
            {item.can.abschliessen ? <button type="button" className="btn danger" onClick={() => setDialog('zurueckweisen')}>{TP.zurueckweisen}</button> : null}
          </div>
        </div>
      </header>
      <div className="body idee-pruefung-body">
        <div className="idee-pruefung-main">
          {idee.stand === 'zusammengefuehrt' ? (
            <Hinweis stufe="hinweis" aktion={fuehrendeNr ? <Verweis pfad={ideePfad(fuehrendeNr)} gehe={gehe} className="btn sm">{TP.zurFuehrenden}</Verweis> : undefined}>{TP.bannerZusammengefuehrt}</Hinweis>
          ) : idee.stand === 'zurueckgewiesen' ? <Hinweis stufe="hinweis">{TP.bannerZurueckgewiesen(idee.begruendung)}</Hinweis>
            : idee.stand === 'in_ergaenzung' ? <Hinweis stufe="hinweis">{TP.bannerErgaenzung}</Hinweis>
              : !write ? <Hinweis stufe="hinweis">{TP.nurLesen}</Hinweis> : null}
          {write && offeneAehnliche.length ? <Hinweis stufe="hinweis">{TP.aehnlicheHinweis(offeneAehnliche.length, feld?.label ?? '')}</Hinweis> : null}

          <section aria-labelledby={`${titleId}-a`} className="idee-abschnitt">
            <h2 id={`${titleId}-a`}>{TP.angaben}</h2>
            <dl className="attrs idee-attrs">
              {angaben.map(([label, wert]) => (
                <div key={label} className="idee-attr"><dt>{label}</dt><dd>{wert ? <span className="idee-wert">{wert}</span> : <span className="muted">{TI.leerWert}</span>}</dd></div>
              ))}
            </dl>
            {(idee.rueckfragen as Rueckfrage[]).length ? (
              <div className="idee-fragen">
                <h3>{TI.rueckfragenTitel}</h3>
                {(idee.rueckfragen as Rueckfrage[]).map(q => <p key={q.id}><strong>{q.text}</strong><br />{q.antwort ?? <span className="muted">{TI.leerWert}</span>}</p>)}
              </div>
            ) : null}
          </section>

          <Leitfragen pruefung={item} etag={etag} titleId={titleId} speichern={(body, ok) => m.leitfragen.mutate({ etag, body }, { onSuccess: ok, onError: fehler })} busy={m.leitfragen.isPending} />
          <Raster key={JSON.stringify(item.raster)} pruefung={item} titleId={titleId} setzen={(kriterium, einschaetzung) => m.raster.mutate({ etag, body: { raster: [{ kriterium, einschaetzung }] } }, { onError: fehler })} />
          <KategorieWahl pruefung={item} titleId={titleId} busy={m.kategorie.isPending}
            zuordnen={body => m.kategorie.mutate({ etag, body }, { onSuccess: () => toast.show(TP.gespeichert), onError: fehler })} />
          <FreigabeAbschnitt idee={idee} gehe={gehe} titleId={titleId} />
        </div>
        {write ? (
          <aside className="idee-pruefung-aside" aria-labelledby={`${titleId}-s`}>
            <h2 id={`${titleId}-s`}>{TP.aehnliche}</h2>
            {aehnliche.isPending ? <p role="status" className="muted">…</p> : (aehnliche.data ?? []).length ? (
              <ul className="idee-aehnlich">
                {aehnliche.data!.map(a => (
                  <li key={a.idee.id}>
                    <Verweis pfad={ideePfad(a.idee.nummer)} gehe={gehe}>{TI.idee(a.idee.nummer)} · {a.idee.titel || TI.ohneTitel}</Verweis>
                    <IdeeStandBadge stand={a.idee.stand} standAt={a.idee.standAt} updatedAt={a.idee.standAt} />
                    <span className="muted small">{[a.gleichesHandlungsfeld ? TP.gleichesFeld : '', a.gemeinsameBereiche ? TP.gemeinsameBereiche(a.gemeinsameBereiche) : ''].filter(Boolean).join(' · ')}</span>
                    {item.can.abschliessen && !['zurueckgewiesen', 'zusammengefuehrt', 'freigegeben', 'traktandiert'].includes(a.idee.stand)
                      ? <button type="button" className="btn sm" onClick={() => setDialog({ mit: a })}>{TP.zusammenfuehrenMit(a.idee.nummer)}</button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="muted">{TP.keineAehnlichen}</p>}
          </aside>
        ) : null}
      </div>
      {dialog === 'rueckfrage' ? (
        <RueckfrageDialog busy={m.rueckfragen.isPending} onClose={() => setDialog(null)}
          stellen={fragen => m.rueckfragen.mutate({ etag, body: { fragen } }, { onSuccess: () => { setDialog(null); toast.show(TP.rueckfrageGestellt); }, onError: e => { setDialog(null); fehler(e); } })} />
      ) : null}
      {dialog === 'zurueckweisen' ? (
        <ZurueckweisenDialog titel={idee.titel || TI.ohneTitel} busy={m.zurueckweisen.isPending} onClose={() => setDialog(null)}
          zurueckweisen={begruendung => m.zurueckweisen.mutate({ etag, begruendung }, { onSuccess: () => { setDialog(null); toast.show(TP.zurueckgewiesen); }, onError: e => { setDialog(null); fehler(e); } })} />
      ) : null}
      {dialog && typeof dialog === 'object' ? (
        <ZusammenfuehrenDialog diese={idee} andere={dialog.mit} busy={m.zusammenfuehren.isPending} onClose={() => setDialog(null)}
          fuehren={fuehrendeDiese => m.zusammenfuehren.mutate(
            fuehrendeDiese ? { schliessen: dialog.mit.idee.id, fuehrendeIdeeId: idee.id } : { schliessen: idee.id, etag, fuehrendeIdeeId: dialog.mit.idee.id },
            { onSuccess: () => { setDialog(null); toast.show(TP.zusammengefuehrt); void p.refetch(); }, onError: e => { setDialog(null); fehler(e); } },
          )} />
      ) : null}
    </section>
  );
}

function Leitfragen({ pruefung, titleId, speichern, busy }: {
  pruefung: Pruefung; etag: string; titleId: string; busy: boolean;
  speichern(body: { antworten: { position: number; antwort: string }[]; vorgesehenerSponsor?: string | null }, ok: () => void): void;
}) {
  const id = useId();
  const toast = useToast();
  const [antworten, setAntworten] = useState<Record<number, string>>(() => Object.fromEntries(pruefung.leitfragen.map(l => [l.position, l.antwort])));
  const [sponsor, setSponsor] = useState<string | null>(pruefung.vorgesehenerSponsor);
  const darf = pruefung.can.pruefen;
  return (
    <section aria-labelledby={`${titleId}-l`} className="idee-abschnitt">
      <h2 id={`${titleId}-l`}>{TP.leitfragen}</h2>
      <p className="hint">{TP.leitfragenSub}</p>
      {!pruefung.leitfragen.length ? <Hinweis stufe="warnung">{TP.keinPhasenmodell}</Hinweis> : null}
      <form className="form idee-form" onSubmit={e => {
        e.preventDefault();
        speichern({ antworten: pruefung.leitfragen.map(l => ({ position: l.position, antwort: antworten[l.position] ?? '' })), vorgesehenerSponsor: sponsor }, () => toast.show(TP.gespeichert));
      }}>
        {pruefung.leitfragen.map(l => (
          <div key={l.position} className="field">
            <label htmlFor={`${id}-${l.position}`}>{l.frage}</label>
            <textarea id={`${id}-${l.position}`} rows={2} maxLength={4000} value={antworten[l.position] ?? ''} readOnly={!darf}
              onChange={e => setAntworten(a => ({ ...a, [l.position]: e.target.value }))} />
          </div>
        ))}
        <div className="field">
          <label htmlFor={`${id}-sp`}>{TP.sponsor} <span className="muted">({TI.optional})</span></label>
          {darf ? <PersonPick id={`${id}-sp`} value={sponsor ?? ''} onChange={v => setSponsor(v || null)} /> : <p id={`${id}-sp`}>{sponsor ? <PersonName id={sponsor} /> : <span className="muted">{TI.leerWert}</span>}</p>}
          <p className="hint">{TP.sponsorHilfe}</p>
        </div>
        {darf ? <div className="acts"><button type="submit" className="btn" aria-busy={busy}>{TP.antwortenSpeichern}</button></div> : null}
      </form>
    </section>
  );
}

function Raster({ pruefung, titleId, setzen }: { pruefung: Pruefung; titleId: string; setzen(kriterium: Pruefung['raster'][number]['kriterium'], e: Stufe | null): void }) {
  const id = useId();
  const darf = pruefung.can.pruefen;
  // Wahl sofort anzeigen (I-R2 optimistisch); die Antwort des Servers setzt den Abschnitt neu (Schlüssel im Aufruf)
  const [wahl, setWahl] = useState<Record<string, Stufe | null>>(() => Object.fromEntries(pruefung.raster.map(r => [r.kriterium, r.einschaetzung])));
  return (
    <section aria-labelledby={`${titleId}-r`} className="idee-abschnitt">
      <h2 id={`${titleId}-r`}>{TP.raster}</h2>
      <p className="hint">{TP.rasterSub}</p>
      <div className="idee-raster">
        {pruefung.raster.map(r => (
          <fieldset key={r.kriterium} className="idee-gruppe idee-raster-z">
            <legend>{TP.kriterien[r.kriterium]}</legend>
            <div className="idee-stufen" role="radiogroup" aria-label={TP.kriterien[r.kriterium]}>
              {STUFEN.map(s => (
                <label key={s} className="idee-wahl">
                  <input type="radio" name={`${id}-${r.kriterium}`} value={s} checked={wahl[r.kriterium] === s} disabled={!darf} onChange={() => { setWahl(w => ({ ...w, [r.kriterium]: s })); setzen(r.kriterium, s); }} />
                  <span>{TP.stufen[s]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p role="status" className="idee-vorschlag">{pruefung.vorschlag ? <><Icon name="info" /> {TP.vorschlag(pruefung.vorschlag)}</> : <span className="muted">{TP.vorschlagFehlt}</span>}</p>
    </section>
  );
}

function KategorieWahl({ pruefung, titleId, zuordnen, busy }: {
  pruefung: Pruefung; titleId: string; busy: boolean; zuordnen(body: { kategorie: Kategorie; portfolioId?: string; begruendung?: string }): void;
}) {
  const id = useId();
  const darf = pruefung.can.pruefen;
  const [kategorie, setKategorie] = useState<Kategorie | null>(pruefung.kategorie);
  const [portfolio, setPortfolio] = useState<string>(pruefung.portfolioId ?? '');
  const [begruendung, setBegruendung] = useState(pruefung.kategorieBegruendung);
  const portfolios = usePortfolios(darf).data ?? [];
  const derKategorie = portfolios.filter(p => p.kategorie === kategorie);
  const abweichung = pruefung.vorschlag && kategorie && kategorie !== pruefung.vorschlag.kategorie;
  return (
    <section aria-labelledby={`${titleId}-k`} className="idee-abschnitt">
      <h2 id={`${titleId}-k`}>{TP.kategorie}</h2>
      {pruefung.kategorie ? <p className="idee-wirkung"><Icon name="check" /> {TP.wirkung(pruefung.kategorie, pruefung.zustaendig?.kuerzel.toUpperCase() ?? null)}</p> : null}
      {darf ? (
        <form className="form idee-form" onSubmit={e => {
          e.preventDefault();
          if (!kategorie) return;
          zuordnen({ kategorie, ...(derKategorie.length > 1 && portfolio ? { portfolioId: portfolio } : {}), begruendung });
        }}>
          <fieldset className="idee-gruppe">
            <legend>{TP.kategorie}</legend>
            <div className="idee-liste" role="radiogroup" aria-label={TP.kategorie}>
              {(['A', 'B', 'C'] as const).map(k => (
                <label key={k} className="idee-wahl">
                  <input type="radio" name={`${id}-k`} checked={kategorie === k} onChange={() => { setKategorie(k); setPortfolio(''); }} />
                  <span>{TP.kategorien[k]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {derKategorie.length > 1 ? (
            <div className="field">
              <label htmlFor={`${id}-p`}>{TP.portfolio}</label>
              <select id={`${id}-p`} className="idee-select" value={portfolio} onChange={e => setPortfolio(e.target.value)}>
                <option value="">{TP.portfolioWaehlen}</option>
                {derKategorie.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          ) : null}
          {abweichung ? <Hinweis stufe="hinweis" live>{TP.abweichung(pruefung.vorschlag!, kategorie!)}</Hinweis> : null}
          <div className="field">
            <label htmlFor={`${id}-b`}>{TP.kategorieBegruendung} <span className="muted">({TI.optional})</span></label>
            <textarea id={`${id}-b`} rows={2} maxLength={2000} value={begruendung} onChange={e => setBegruendung(e.target.value)} />
          </div>
          <div className="acts"><button type="submit" className="btn primary" disabled={!kategorie} aria-busy={busy}>{TP.zuordnen}</button></div>
        </form>
      ) : !pruefung.kategorie ? <p className="muted">{TI.leerWert}</p> : null}
    </section>
  );
}

function RueckfrageDialog({ stellen, onClose, busy }: { stellen(f: { feld: (typeof FELDER)[number] | null; text: string }[]): void; onClose(): void; busy: boolean }) {
  const id = useId();
  const [feld, setFeld] = useState('');
  const [text, setText] = useState('');
  const [fehlt, setFehlt] = useState(false);
  return (
    <Dialog title={TP.rueckfrage} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="button" className="btn primary" disabled={busy} onClick={() => {
        if (!text.trim()) { setFehlt(true); return; }
        stellen([{ feld: (feld || null) as (typeof FELDER)[number] | null, text: text.trim() }]);
      }}>{TP.rueckfrage}</button>
    </>}>
      <div className="form">
        <div className="field">
          <label htmlFor={`${id}-f`}>{TP.rueckfrageFeld}</label>
          <select id={`${id}-f`} className="idee-select" value={feld} onChange={e => setFeld(e.target.value)} data-autofocus>
            <option value="">{TP.rueckfrageAllgemein}</option>
            {FELDER.map(f => <option key={f} value={f}>{TP.felder[f]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-t`}>{TP.rueckfrageText}</label>
          <textarea id={`${id}-t`} rows={3} maxLength={2000} value={text} onChange={e => { setText(e.target.value); setFehlt(false); }}
            aria-invalid={fehlt || undefined} aria-describedby={fehlt ? `${id}-e` : undefined} />
          {fehlt ? <p id={`${id}-e`} className="ferr" role="alert">{TP.rueckfrageText}</p> : null}
        </div>
        <p className="hint">{TP.rueckfrageWirkung(TP.person)}</p>
      </div>
    </Dialog>
  );
}

function ZurueckweisenDialog({ titel, zurueckweisen, onClose, busy }: { titel: string; zurueckweisen(b: string): void; onClose(): void; busy: boolean }) {
  const id = useId();
  const [begruendung, setBegruendung] = useState('');
  const [fehlt, setFehlt] = useState(false);
  return (
    <Dialog title={TP.zurueckweisenFrage(titel)} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="button" className="btn danger solid" disabled={busy} onClick={() => {
        if (!begruendung.trim()) { setFehlt(true); return; }
        zurueckweisen(begruendung.trim());
      }}>{TP.zurueckweisen}</button>
    </>}>
      <div className="form">
        <div className="field">
          <label htmlFor={`${id}-b`}>{TP.begruendung}</label>
          <textarea id={`${id}-b`} rows={3} maxLength={4000} value={begruendung} data-autofocus onChange={e => { setBegruendung(e.target.value); setFehlt(false); }}
            aria-invalid={fehlt || undefined} aria-describedby={fehlt ? `${id}-e` : undefined} />
          {fehlt ? <p id={`${id}-e`} className="ferr" role="alert">{TP.begruendungFehlt(TP.person)}</p> : null}
        </div>
        <p className="hint">{TP.zurueckweisenWirkung(TP.person.charAt(0).toUpperCase() + TP.person.slice(1))}</p>
      </div>
    </Dialog>
  );
}

function ZusammenfuehrenDialog({ diese, andere, fuehren, onClose, busy }: { diese: Idee; andere: Aehnlich; fuehren(fuehrendeDiese: boolean): void; onClose(): void; busy: boolean }) {
  const id = useId();
  const [fuehrendDiese, setFuehrendDiese] = useState(true);
  const [fuehrende, geschlossen] = fuehrendDiese ? [diese.nummer, andere.idee.nummer] : [andere.idee.nummer, diese.nummer];
  return (
    <Dialog title={TP.zusammenfuehrenFrage} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="button" className="btn primary" disabled={busy} onClick={() => fuehren(fuehrendDiese)}>{TP.zusammenfuehren}</button>
    </>}>
      <fieldset className="idee-gruppe">
        <legend>{TP.fuehrend}</legend>
        <div className="idee-liste">
          <label className="idee-wahl"><input type="radio" name={`${id}-f`} checked={fuehrendDiese} onChange={() => setFuehrendDiese(true)} data-autofocus /><span>{TI.idee(diese.nummer)} · {diese.titel || TI.ohneTitel}</span></label>
          <label className="idee-wahl"><input type="radio" name={`${id}-f`} checked={!fuehrendDiese} onChange={() => setFuehrendDiese(false)} /><span>{TI.idee(andere.idee.nummer)} · {andere.idee.titel || TI.ohneTitel}</span></label>
        </div>
      </fieldset>
      <p>{TP.zusammenfuehrenVorschau(geschlossen, fuehrende)}</p>
      <p className="hint">{TP.zusammenfuehrenWirkung}</p>
    </Dialog>
  );
}
