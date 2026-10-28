/**
 * Schublade einer Schnittstelle (`?o=<id>`) bzw. zum Einrichten (`?o=neu`), UC-018 Schritte 3–4, A1: Umsystem und Daten
 * aus dem Katalog, Rhythmus, Adresse, aktiv; nach dem Speichern prüft ein Testlauf die Verbindung (Ergebnis inline).
 * Ansicht mit «Lauf starten» (auch erneut nach Fehler, A1.1) und Laufprotokoll (Zeitpunkt, Umfang, Fehler). Bearbeiten
 * mit `If-Match` (412: Hinweis und neu laden, Z7); deaktivieren statt löschen.
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useState, type FormEvent } from 'react';
import { isConflict, isGone, newIdempotencyKey } from '../../api/index.ts';
import { Drawer, Empty, ErrorState, fmtDateTime, fmtZeitpunkt, Hinweis, Icon, Loading, T, useToast } from '../../ui/index.ts';
import { useLaeufe, useSchnittstelle, useSchnittstellenMutationen, type Geladen, type Katalogeintrag, type Lauf, type Schnittstelle } from './api.ts';
import { LaufStand } from './LaufStand.tsx';
import { TX } from './texte.ts';

type Rhythmus = Schnittstelle['rhythmus'];

export function SchnittstelleDrawer({ id, schnittstellen, katalog, laedt, onClose, onOpen }: {
  id: string; schnittstellen: Schnittstelle[]; katalog: Katalogeintrag[]; laedt: boolean; onClose(): void; onOpen(id: string): void;
}) {
  if (id !== 'neu') return <DetailDrawer id={id} onClose={onClose} />;
  if (laedt) return <Drawer title={TX.s.create} onClose={onClose}><Loading /></Drawer>;
  return <CreateDrawer schnittstellen={schnittstellen} katalog={katalog} onClose={onClose} onCreated={onOpen} />;
}

/** Ergebnis des Testlaufs bzw. eines Laufs als Rückmeldung: Erfolg als Toast, Fehler inline in der Schublade (I-R). */
function meldeLauf(toast: ReturnType<typeof useToast>, l: Lauf | null, test: boolean) {
  if (l?.stand === 'erfolgreich') toast.show(test ? TX.s.testOk : TX.s.laufOk(TX.s.datensaetze(l.umfang ?? 0)));
}

function CreateDrawer({ schnittstellen, katalog, onClose, onCreated }: { schnittstellen: Schnittstelle[]; katalog: Katalogeintrag[]; onClose(): void; onCreated(id: string): void }) {
  const formId = useId();
  const toast = useToast();
  const [key] = useState(newIdempotencyKey);
  const { einrichten } = useSchnittstellenMutationen();
  const frei = katalog.filter(k => !schnittstellen.some(s => s.umsystem === k.umsystem && s.daten === k.daten));
  return (
    <Drawer title={TX.s.create} onClose={onClose} footer={frei.length ? <>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={einrichten.isPending}>{T.common.save}</button>
    </> : undefined}>
      {einrichten.error ? <ErrorState error={einrichten.error} /> : null}
      {frei.length ? (
        <SchnittstelleForm formId={formId} katalog={katalog} frei={frei} initial={{ wahl: frei.length === 1 ? schluessel(frei[0]!) : '', rhythmus: 'monatlich', adresse: 'https://', aktiv: true }}
          busy={einrichten.isPending} serverErrors={describeError(einrichten.error).fields}
          onSubmit={v => {
            const k = katalog.find(x => schluessel(x) === v.wahl)!;
            einrichten.mutate({ key, body: { umsystem: k.umsystem, daten: k.daten, rhythmus: v.rhythmus, adresse: v.adresse.trim(), aktiv: v.aktiv } }, {
              onSuccess: r => { toast.show(TX.s.eingerichtet); meldeLauf(toast, r.testlauf, true); onCreated(r.schnittstelle.id); },
            });
          }} />
      ) : <Empty>{TX.s.alleBelegt}</Empty>}
    </Drawer>
  );
}

function DetailDrawer({ id, onClose }: { id: string; onClose(): void }) {
  const q = useSchnittstelle(id);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  if (q.isPending) return <Drawer title={TX.s.one} onClose={onClose}><Loading /></Drawer>;
  if (q.error) {
    return (
      <Drawer title={TX.s.one} onClose={onClose}>
        {isGone(q.error) ? <Empty>{TX.s.gone}</Empty> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      </Drawer>
    );
  }
  return mode === 'edit'
    ? <EditDrawer geladen={q.data} onDone={() => setMode('view')} onReload={() => q.refetch()} />
    : <ViewDrawer geladen={q.data} onClose={onClose} onEdit={() => setMode('edit')} />;
}

function ViewDrawer({ geladen: { item }, onClose, onEdit }: { geladen: Geladen; onClose(): void; onEdit(): void }) {
  const toast = useToast();
  const { starten } = useSchnittstellenMutationen();
  const [key, setKey] = useState(newIdempotencyKey);
  const letzter = starten.data ?? item.letzterLauf;
  const start = () => starten.mutate({ id: item.id, key }, {
    onSuccess: l => { meldeLauf(toast, l, false); setKey(newIdempotencyKey()); },
    onError: () => setKey(newIdempotencyKey()),
  });
  return (
    <Drawer title={item.name} onClose={onClose} actions={
      <button type="button" className="btn sm" onClick={onEdit}><Icon name="edit" />{T.common.edit}</button>
    }>
      <dl className="attrs">
        <dt>{TX.s.spalte.richtung}</dt><dd>{TX.s.richtung[item.richtung]}</dd>
        <dt>{TX.s.rhythmusLabel}</dt><dd>{TX.s.rhythmus[item.rhythmus]}</dd>
        <dt>{TX.s.adresse}</dt><dd className="mono wrap">{item.adresse}</dd>
        <dt>{TX.s.aktiv}</dt><dd>{item.aktiv ? TX.s.aktivJa : TX.s.inaktiv}</dd>
        <dt>{TX.s.spalte.lauf}</dt><dd aria-live="polite"><LaufStand l={letzter} /></dd>
        <dt>{TX.s.geaendert}</dt><dd>{fmtDateTime(item.updatedAt)}</dd>
      </dl>
      {!item.verfuegbar ? <Hinweis stufe="hinweis">{TX.s.nichtVerfuegbarHinweis}</Hinweis> : null}
      {letzter?.stand === 'fehlgeschlagen' && letzter.fehler ? (
        <div className="notice" role="alert"><p>{(letzter.art === 'test' ? TX.s.testFehler : TX.s.laufFehler)(letzter.fehler)}</p></div>
      ) : null}
      {starten.error ? <ErrorState error={starten.error} /> : null}
      <div className="sx-acts">
        {item.aktiv ? (
          <button type="button" className="btn" onClick={start} disabled={starten.isPending} aria-busy={starten.isPending}>
            <Icon name="bolt" />{starten.isPending ? TX.s.laeuft : TX.s.starten}
          </button>
        ) : <p className="note">{TX.s.startenGesperrt}</p>}
      </div>
      <Laufprotokoll id={item.id} />
    </Drawer>
  );
}

function Laufprotokoll({ id }: { id: string }) {
  const q = useLaeufe(id);
  const hId = useId();
  const items = q.data?.pages.flatMap(p => p.items) ?? [];
  return (
    <section aria-labelledby={hId} className="grp">
      <h3 id={hId} className="grp-h"><Icon name="clock" /> {TX.s.laufe}</h3>
      {q.isPending ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !items.length ? <p className="empty">{TX.s.laufeLeer}</p> : (
        <table className="sx-tab">
          <caption className="sr">{TX.s.laufe}</caption>
          <thead><tr><th scope="col">{TX.s.start}</th><th scope="col">{TX.s.spalte.lauf}</th><th scope="col" className="num">{TX.s.umfang}</th></tr></thead>
          <tbody>
            {items.map(l => (
              <tr key={l.id}>
                <th scope="row">
                  {fmtZeitpunkt(l.start)}
                  <div className="muted small">{TX.s.art[l.art]}{l.gestartetVon?.name ? ` · ${TX.s.gestartetVon} ${l.gestartetVon.name}` : ''}{l.ende ? ` · ${TX.s.sekunden((Date.parse(l.ende) - Date.parse(l.start)) / 1000)}` : ''}</div>
                </th>
                <td>
                  <LaufStand l={l} />
                  {l.fehler ? <div className="small wrap">{l.fehler}</div> : null}
                </td>
                <td className="num">{l.umfang ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {q.hasNextPage ? <button type="button" className="btn sm" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>{T.common.more}</button> : null}
    </section>
  );
}

function EditDrawer({ geladen, onDone, onReload }: { geladen: Geladen; onDone(): void; onReload(): Promise<unknown> }) {
  const formId = useId();
  const toast = useToast();
  const { aendern } = useSchnittstellenMutationen();
  const conflict = isConflict(aendern.error);
  const { item, etag } = geladen;
  return (
    <Drawer title={`${T.common.edit}: ${item.name}`} onClose={onDone} footer={<>
      <button type="button" className="btn" onClick={onDone}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={aendern.isPending || conflict}>{T.common.save}</button>
    </>}>
      {conflict ? (
        <div className="notice" role="alert">
          <p>{TX.s.conflict}</p>
          <button type="button" className="btn" onClick={async () => { await onReload(); aendern.reset(); }}>{T.common.reload}</button>
        </div>
      ) : aendern.error ? <ErrorState error={aendern.error} /> : null}
      <SchnittstelleForm key={item.version} formId={formId} fest={item.name} initial={{ wahl: '', rhythmus: item.rhythmus, adresse: item.adresse, aktiv: item.aktiv }}
        busy={aendern.isPending} serverErrors={describeError(aendern.error).fields}
        onSubmit={v => aendern.mutate({ id: item.id, etag, body: { rhythmus: v.rhythmus, adresse: v.adresse.trim(), aktiv: v.aktiv } }, {
          onSuccess: r => { toast.show(TX.s.gespeichert); meldeLauf(toast, r.testlauf, true); onDone(); },
        })} />
    </Drawer>
  );
}

// --- Formular

interface Werte { wahl: string; rhythmus: Rhythmus; adresse: string; aktiv: boolean }
const schluessel = (k: Pick<Katalogeintrag, 'umsystem' | 'daten'>) => `${k.umsystem}/${k.daten}`;
const ADRESSE = /^https?:\/\/[^\s/]+/;

function pruefen(v: Werte, mitWahl: boolean): Partial<Record<keyof Werte, string>> {
  const e: Partial<Record<keyof Werte, string>> = {};
  if (mitWahl && !v.wahl) e.wahl = TX.s.umsystemFehlt;
  if (!ADRESSE.test(v.adresse.trim())) e.adresse = TX.s.adresseUngueltig;
  return e;
}

function SchnittstelleForm({ formId, katalog, frei, fest, initial, onSubmit, busy, serverErrors }: {
  formId: string; katalog?: Katalogeintrag[]; frei?: Katalogeintrag[]; fest?: string; initial: Werte; busy: boolean; onSubmit(v: Werte): void;
  serverErrors?: { path: string; message: string }[];
}) {
  const id = useId();
  const [v, setV] = useState(initial);
  const [touched, setTouched] = useState(false);
  const mitWahl = !fest;
  const errors = {
    ...Object.fromEntries((serverErrors ?? []).map(x => [x.path.replace(/^\//, '').split('/')[0], x.message])),
    ...(touched ? pruefen(v, mitWahl) : {}),
  } as Partial<Record<string, string>>;
  const gewaehlt = katalog?.find(k => schluessel(k) === v.wahl);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const f = pruefen(v, mitWahl);
    if (!Object.keys(f).length) onSubmit(v);
    else document.getElementById(`${id}-${Object.keys(f)[0]}`)?.focus();
  };
  const describedBy = (k: keyof Werte, hint = true) => [hint ? `${id}-${k}-h` : '', errors[k] ? `${id}-${k}-e` : ''].filter(Boolean).join(' ') || undefined;
  const fehler = (k: keyof Werte) => (errors[k] ? <p id={`${id}-${k}-e`} className="ferr">{errors[k]}</p> : null);
  return (
    <form id={formId} className="form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="field">
        <label htmlFor={`${id}-wahl`}>{TX.s.umsystem}</label>
        {fest ? <p id={`${id}-wahl`}>{fest}</p> : (
          <>
            <select id={`${id}-wahl`} value={v.wahl} onChange={e => setV({ ...v, wahl: e.target.value })} data-autofocus
              aria-invalid={errors.wahl ? true : undefined} aria-describedby={describedBy('wahl')}>
              <option value="">–</option>
              {katalog!.map(k => {
                const belegt = !frei!.some(f => schluessel(f) === schluessel(k));
                return (
                  <option key={schluessel(k)} value={schluessel(k)} disabled={belegt}>
                    {`${k.umsystemLabel} · ${k.datenLabel} (${TX.s.richtung[k.richtung]})${belegt ? ` – ${TX.s.belegt}` : !k.verfuegbar ? ` – ${TX.s.nichtVerfuegbar}` : ''}`}
                  </option>
                );
              })}
            </select>
            <p id={`${id}-wahl-h`} className="hint">{gewaehlt ? `${TX.s.quelle}: ${gewaehlt.quelle}` : TX.s.umsystemHint}</p>
            {fehler('wahl')}
          </>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${id}-rhythmus`}>{TX.s.rhythmusLabel}</label>
        <select id={`${id}-rhythmus`} value={v.rhythmus} onChange={e => setV({ ...v, rhythmus: e.target.value as Rhythmus })} aria-describedby={describedBy('rhythmus')}>
          {(['monatlich', 'woechentlich', 'taeglich', 'manuell'] as const).map(r => <option key={r} value={r}>{TX.s.rhythmus[r]}</option>)}
        </select>
        <p id={`${id}-rhythmus-h`} className="hint">{TX.s.rhythmusHint}</p>
      </div>
      <div className="field">
        <label htmlFor={`${id}-adresse`}>{TX.s.adresse}</label>
        <input id={`${id}-adresse`} type="url" inputMode="url" value={v.adresse} onChange={e => setV({ ...v, adresse: e.target.value })} maxLength={2000} autoComplete="off"
          className="mono" onBlur={() => setTouched(true)} aria-invalid={errors.adresse ? true : undefined} aria-describedby={describedBy('adresse')} />
        <p id={`${id}-adresse-h`} className="hint">{TX.s.adresseHint}</p>
        {fehler('adresse')}
      </div>
      <div className="field">
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={v.aktiv} onChange={e => setV({ ...v, aktiv: e.target.checked })} aria-describedby={`${id}-aktiv-h`} />
          {TX.s.aktiv}
        </label>
        <p id={`${id}-aktiv-h`} className="hint">{TX.s.aktivHint}</p>
      </div>
    </form>
  );
}
