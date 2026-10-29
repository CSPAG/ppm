/**
 * Schublade eines Portfolios (`?o=<schlüssel>`) bzw. zum Anlegen (`?o=neu`): Kategorie und Pflichten (A-07, A-08),
 * Gremien (öffnen über `&g=`), Gremienweg je Gate mit «via SNS-VR» (Q8 Kap. 5.1, UC-006 A1) und dessen Bearbeitung;
 * Ändern mit `If-Match` (412: Hinweis und neu laden), Löschen mit Rückfrage.
 */
import { describeError } from '@vollholz/iam-web';
import { Fragment, useId, useState, type FormEvent } from 'react';
import { isConflict, isGone, newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Confirm, Drawer, Empty, ErrorState, fmtGate, Icon, Loading, T, useToast, ZugriffKurz } from '../../ui/index.ts';
import {
  GATES, useGremien, useGremienweg, usePortfolio, usePortfolioMutations, type GateCode, type Gremienweg, type Gremium, type Loaded, type Portfolio,
} from './api.ts';
import { TP } from './texte.ts';

type Kategorie = Portfolio['kategorie'];
const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Feldfehler des Servers (422) nach erstem Pfadteil. */
const serverFields = (e: unknown) => Object.fromEntries(describeError(e).fields.map(x => [x.path.replace(/^\//, '').split('/')[0], x.message])) as Record<string, string | undefined>;

export function PortfolioCreateDrawer({ onClose, onCreated }: { onClose(): void; onCreated(p: Portfolio): void }) {
  const id = useId();
  const toast = useToast();
  // Ein Schlüssel je geöffnetes Formular: Doppelklick oder Wiederholung nach Netzfehler legt nicht doppelt an
  const [key] = useState(newIdempotencyKey);
  const { create } = usePortfolioMutations();
  const [v, setV] = useState({ kategorie: 'A' as Kategorie, schluessel: '', name: '' });
  const [touched, setTouched] = useState(false);
  const local = touched ? {
    name: v.name.trim() ? undefined : TP.nameMissing,
    schluessel: KEY.test(v.schluessel) ? undefined : TP.schluesselInvalid,
  } : {};
  const errors = { ...serverFields(create.error), ...Object.fromEntries(Object.entries(local).filter(([, x]) => x)) } as Record<string, string | undefined>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!v.name.trim() || !KEY.test(v.schluessel)) return;
    create.mutate({ body: { kategorie: v.kategorie, schluessel: v.schluessel, name: v.name.trim() }, key }, {
      onSuccess: l => { toast.show(TP.created); onCreated(l.item); },
    });
  };
  const err = (k: string) => errors[k] ? <p id={`${id}-${k}-e`} className="ferr">{errors[k]}</p> : null;
  return (
    <Drawer title={TP.create} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={`${id}-f`} className="btn primary" disabled={create.isPending}>{T.common.save}</button>
    </>}>
      {create.error && statusOf(create.error) !== 422 ? <ErrorState error={create.error} /> : null}
      <form id={`${id}-f`} className="form" onSubmit={submit} noValidate aria-busy={create.isPending}>
        <div className="field">
          <label htmlFor={`${id}-name`}>{TP.name}</label>
          <input id={`${id}-name`} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} maxLength={200} autoComplete="off" data-autofocus
            aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? `${id}-name-e` : undefined} />
          {err('name')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-kat`}>{TP.kategorie}</label>
          <select id={`${id}-kat`} className="inp" value={v.kategorie} onChange={e => setV({ ...v, kategorie: e.target.value as Kategorie })} aria-describedby={`${id}-kat-h`}>
            {(['A', 'B', 'C'] as const).map(k => <option key={k} value={k}>{TP.kategorien[k]}</option>)}
          </select>
          <p id={`${id}-kat-h`} className="hint">{TP.kategorieHint}</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-key`}>{TP.schluessel}</label>
          <input id={`${id}-key`} value={v.schluessel} onChange={e => setV({ ...v, schluessel: e.target.value.trim().toLowerCase() })} maxLength={40} autoComplete="off"
            aria-invalid={errors.schluessel ? true : undefined} aria-describedby={[`${id}-key-h`, errors.schluessel ? `${id}-schluessel-e` : ''].filter(Boolean).join(' ')} />
          <p id={`${id}-key-h`} className="hint">{TP.schluesselHint}</p>
          {err('schluessel')}
        </div>
      </form>
    </Drawer>
  );
}

export function PortfolioDrawer({ id, onClose, onGremium }: { id: string; onClose(): void; onGremium(kuerzel: string): void }) {
  const q = usePortfolio(id);
  const [mode, setMode] = useState<'view' | 'edit' | 'weg'>('view');
  if (q.isPending) return <Drawer title={TP.one} onClose={onClose}><Loading /></Drawer>;
  if (q.error) {
    return (
      <Drawer title={TP.one} onClose={onClose}>
        {isGone(q.error) ? <Empty>{TP.gone}</Empty> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      </Drawer>
    );
  }
  if (mode === 'edit') return <EditDrawer loaded={q.data} onDone={() => setMode('view')} onReload={() => q.refetch()} />;
  if (mode === 'weg') return <WegDrawer loaded={q.data} onDone={() => setMode('view')} onReload={() => q.refetch()} />;
  return <ViewDrawer loaded={q.data} onClose={onClose} onEdit={() => setMode('edit')} onWeg={() => setMode('weg')} onGremium={onGremium} />;
}

/** Anzeige eines Schritts im Gremienweg: «PRAT, via SNS-VR» bzw. «kein Gremium». */
const wegText = (s: Gremienweg['schritte'][number] | undefined) =>
  !s ? <span className="empty">{TP.wegKein}</span> : s.zusaetzlich ? TP.wegVia(s.gremium.name, s.zusaetzlich.name) : s.gremium.name;

function ViewDrawer({ loaded: { item, etag }, onClose, onEdit, onWeg, onGremium }: {
  loaded: Loaded<Portfolio>; onClose(): void; onEdit(): void; onWeg(): void; onGremium(kuerzel: string): void;
}) {
  const toast = useToast();
  const { remove } = usePortfolioMutations();
  const [confirm, setConfirm] = useState(false);
  const gremien = useGremien();
  const weg = useGremienweg(item.id);
  const eigene = (gremien.data ?? []).filter(g => g.portfolioId === item.id);
  return (
    <Drawer title={item.name} onClose={onClose} actions={<>
      {item.can.admin ? <>
        <button type="button" className="btn sm" onClick={onEdit}><Icon name="edit" />{T.common.edit}</button>
        <button type="button" className="btn sm danger" onClick={() => setConfirm(true)}><Icon name="trash" />{T.common.delete}</button>
      </> : null}
      {/* Zugriff auf einen Blick, verwaltet unter Portfolio › Zugriff (docs/ux/zugriff.md, UI-51) */}
      <ZugriffKurz ort={{ type: 'portfolio', id: item.id }} label={item.name} bereich={`/portfolio/zugriff?portfolio=${encodeURIComponent(item.schluessel)}`} />
    </>}>
      <dl className="attrs">
        <dt>{TP.kategorie}</dt><dd>{TP.kategorien[item.kategorie]}</dd>
        <dt>{TP.pflichten}</dt><dd className="wrap">{item.pflichten ? TP.mitPflichten : TP.freiwillig}</dd>
        <dt>{TP.schluessel}</dt><dd className="mono">{item.schluessel}</dd>
      </dl>
      {!item.can.admin ? <p className="note">{TP.noRight}</p> : null}

      <section aria-labelledby={`g-${item.id}`} className="grp">
        <h3 id={`g-${item.id}`} className="grp-h"><Icon name="gavel" /> {TP.gremien}</h3>
        {gremien.isPending ? <Loading /> : gremien.error ? <ErrorState error={gremien.error} onRetry={() => void gremien.refetch()} /> : eigene.length ? (
          <dl className="attrs">
            {eigene.map(g => (
              <Fragment key={g.id}>
                <dt><button type="button" className="rowlink" onClick={() => onGremium(g.kuerzel)}>{g.name}</button></dt>
                <dd>{TP.arten[g.art]}{g.rhythmus ? ` · ${g.rhythmus}` : ''}</dd>
              </Fragment>
            ))}
          </dl>
        ) : <p className="empty">{TP.keineGremien}</p>}
        {item.can.admin ? <button type="button" className="btn sm" onClick={() => onGremium('neu')}><Icon name="plus" />{TP.gremiumCreate}</button> : null}
      </section>

      <section aria-labelledby={`w-${item.id}`} className="grp">
        <h3 id={`w-${item.id}`} className="grp-h"><Icon name="layers" /> {TP.gremienweg}</h3>
        <p className="small">{TP.gremienwegSub}</p>
        {weg.isPending ? <Loading /> : weg.error ? <ErrorState error={weg.error} onRetry={() => void weg.refetch()} /> : (
          <dl className="attrs">
            {GATES.map(g => (
              <Fragment key={g.code}>
                <dt>{fmtGate(g.von, g.zu)}</dt>
                <dd>{wegText(weg.data.schritte.find(s => s.gate === g.code))}</dd>
              </Fragment>
            ))}
          </dl>
        )}
        {item.can.admin ? <button type="button" className="btn sm" onClick={onWeg}><Icon name="edit" />{TP.gremienwegBearbeiten}</button> : null}
      </section>

      {confirm ? (
        <Confirm title={T.common.delete} text={TP.confirmDelete(item.name)} confirm={T.common.delete} busy={remove.isPending}
          onClose={() => setConfirm(false)}
          // mutateAsync: nach dem Löschen verschwindet diese Ansicht (siehe Handlungsfelder)
          onConfirm={() => void remove.mutateAsync({ id: item.id, etag }).then(
            () => { toast.show(TP.deleted); onClose(); },
            (e: unknown) => { setConfirm(false); toast.error(e, isConflict(e) ? TP.conflict : undefined); },
          )} />
      ) : null}
    </Drawer>
  );
}

function ConflictNotice({ text, onReload }: { text: string; onReload(): void }) {
  return (
    <div className="notice" role="alert">
      <p>{text}</p>
      <button type="button" className="btn" onClick={onReload}>{T.common.reload}</button>
    </div>
  );
}

function EditDrawer({ loaded, onDone, onReload }: { loaded: Loaded<Portfolio>; onDone(): void; onReload(): Promise<unknown> }) {
  const id = useId();
  const toast = useToast();
  const { update } = usePortfolioMutations();
  const [name, setName] = useState(loaded.item.name);
  const [touched, setTouched] = useState(false);
  const conflict = isConflict(update.error);
  const error = (touched && !name.trim() ? TP.nameMissing : undefined) ?? serverFields(update.error).name;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim()) return;
    update.mutate({ id: loaded.item.id, etag: loaded.etag, body: { name: name.trim() } }, { onSuccess: () => { toast.show(TP.saved); onDone(); } });
  };
  return (
    <Drawer title={`${T.common.edit}: ${loaded.item.name}`} onClose={onDone} footer={<>
      <button type="button" className="btn" onClick={onDone}>{T.common.cancel}</button>
      <button type="submit" form={`${id}-f`} className="btn primary" disabled={update.isPending || conflict}>{T.common.save}</button>
    </>}>
      {conflict ? <ConflictNotice text={TP.conflict} onReload={async () => { await onReload(); update.reset(); }} />
        : update.error && statusOf(update.error) !== 422 ? <ErrorState error={update.error} /> : null}
      <form id={`${id}-f`} className="form" onSubmit={submit} noValidate aria-busy={update.isPending}>
        <div className="field">
          <label htmlFor={`${id}-name`}>{TP.name}</label>
          <input id={`${id}-name`} value={name} onChange={e => setName(e.target.value)} maxLength={200} autoComplete="off" data-autofocus
            aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-name-e` : undefined} />
          {error ? <p id={`${id}-name-e`} className="ferr">{error}</p> : null}
        </div>
      </form>
    </Drawer>
  );
}

/** Wert der Auswahl je Gate: '' = kein Gremium, 'e' = entscheidendes Gremium, 'e+<id>' = zusätzlich über das externe Gremium. */
const wahl = (s: Gremienweg['schritte'][number] | undefined) => (!s ? '' : s.zusaetzlich ? `e+${s.zusaetzlich.id}` : 'e');

function WegDrawer({ loaded, onDone, onReload }: { loaded: Loaded<Portfolio>; onDone(): void; onReload(): Promise<unknown> }) {
  const weg = useGremienweg(loaded.item.id);
  const gremien = useGremien();
  if (weg.isPending || gremien.isPending) return <Drawer title={TP.gremienwegBearbeiten} onClose={onDone}><Loading /></Drawer>;
  if (weg.error || gremien.error) return <Drawer title={TP.gremienwegBearbeiten} onClose={onDone}><ErrorState error={weg.error ?? gremien.error} /></Drawer>;
  const eigene = gremien.data.filter(g => g.portfolioId === loaded.item.id);
  return <WegForm key={weg.data.version} loaded={loaded} weg={weg.data} gremien={eigene} onDone={onDone} onReload={async () => { await Promise.all([onReload(), weg.refetch()]); }} />;
}

function WegForm({ loaded, weg, gremien, onDone, onReload }: {
  loaded: Loaded<Portfolio>; weg: Gremienweg; gremien: readonly Gremium[]; onDone(): void; onReload(): Promise<void>;
}) {
  const id = useId();
  const toast = useToast();
  const { weg: save } = usePortfolioMutations();
  const entscheidend = gremien.find(g => g.art === 'entscheidend');
  const extern = gremien.filter(g => g.art === 'extern');
  const [werte, setWerte] = useState<Record<GateCode, string>>(() =>
    Object.fromEntries(GATES.map(g => [g.code, wahl(weg.schritte.find(s => s.gate === g.code))])) as Record<GateCode, string>);
  const conflict = isConflict(save.error);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!entscheidend) return;
    const schritte = GATES.filter(g => werte[g.code]).map(g => {
      const w = werte[g.code];
      return { gate: g.code, gremiumId: entscheidend.id, zusaetzlichGremiumId: w.startsWith('e+') ? w.slice(2) : null };
    });
    // ETag = Version des Portfolios (der Gremienweg gehört zum Portfolio)
    // mutateAsync: Nach dem Speichern trägt der Hook die neue Version ein, das Formular baut sich neu auf (Schlüssel =
    // Version); Rückrufe von mutate() kämen dann nicht mehr an (keine Meldung, Schublade bliebe im Bearbeiten)
    save.mutateAsync({ id: loaded.item.id, etag: loaded.etag, body: { schritte } })
      .then(() => { toast.show(TP.gremienwegSaved); onDone(); }, () => undefined);
  };
  return (
    <Drawer title={`${TP.gremienweg}: ${loaded.item.name}`} onClose={onDone} footer={<>
      <button type="button" className="btn" onClick={onDone}>{T.common.cancel}</button>
      {entscheidend ? <button type="submit" form={`${id}-f`} className="btn primary" disabled={save.isPending || conflict}>{T.common.save}</button> : null}
    </>}>
      {conflict ? <ConflictNotice text={TP.conflict} onReload={async () => { await onReload(); save.reset(); }} />
        : save.error ? <ErrorState error={save.error} /> : null}
      <p className="small">{TP.gremienwegSub}</p>
      {!entscheidend ? <Empty>{TP.gremienwegOhneGremium}</Empty> : (
        <form id={`${id}-f`} className="form" onSubmit={submit} noValidate aria-busy={save.isPending}>
          {GATES.map(g => (
            <div className="field" key={g.code}>
              <label htmlFor={`${id}-${g.code}`}>{fmtGate(g.von, g.zu)}</label>
              <select id={`${id}-${g.code}`} className="inp" value={werte[g.code]} onChange={e => setWerte({ ...werte, [g.code]: e.target.value })}>
                <option value="">{TP.wegKein}</option>
                <option value="e">{entscheidend.name}</option>
                {extern.map(x => <option key={x.id} value={`e+${x.id}`}>{TP.wegVia(entscheidend.name, x.name)}</option>)}
              </select>
            </div>
          ))}
        </form>
      )}
    </Drawer>
  );
}
