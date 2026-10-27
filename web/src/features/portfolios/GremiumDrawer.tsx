/**
 * Schublade eines Gremiums (`?o=<portfolio>&g=<kürzel>`) bzw. zum Anlegen (`&g=neu`): Art (entscheidend, genau eines je
 * Portfolio, A-45; extern ohne Benutzer wie der SNS-VR, A-02), Sitzungsrhythmus und geplante Sitzungstermine (UC-006
 * Vorbedingung); Ändern mit `If-Match`, Löschen mit Rückfrage (409, solange es im Gremienweg steht).
 */
import { describeError } from '@vollholz/iam-web';
import { Fragment, useId, useState, type FormEvent } from 'react';
import { isConflict, isGone, newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Confirm, Drawer, Empty, ErrorState, fmtDatum, Icon, Loading, T, useToast } from '../../ui/index.ts';
import { useGremien, useGremium, useGremiumMutations, useTermine, type Gremium, type Loaded, type Portfolio } from './api.ts';
import { TP } from './texte.ts';

type Art = Gremium['art'];
const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

interface Props { portfolio: Portfolio; kuerzel: string; onClose(): void; onBack(): void; onOpen(kuerzel: string): void }

export function GremiumDrawer(p: Props) {
  return p.kuerzel === 'neu' ? <CreateDrawer {...p} /> : <DetailDrawer {...p} />;
}

const Zurueck = ({ portfolio, onBack }: Pick<Props, 'portfolio' | 'onBack'>) =>
  <button type="button" className="btn sm" onClick={onBack}><Icon name="arrow" />{TP.zurueck(portfolio.name)}</button>;

interface Values { kuerzel: string; name: string; art: Art; rhythmus: string }

/** Formular für Anlegen (mit Kürzel) und Bearbeiten (Kürzel fest). */
function GremiumForm({ formId, initial, neu, busy, error, onSubmit }: {
  formId: string; initial: Values; neu: boolean; busy: boolean; error: unknown; onSubmit(v: Values): void;
}) {
  const id = useId();
  const [v, setV] = useState(initial);
  const [touched, setTouched] = useState(false);
  const server = Object.fromEntries(describeError(error).fields.map(x => [x.path.replace(/^\//, '').split('/')[0], x.message])) as Record<string, string | undefined>;
  const local: Record<string, string | undefined> = touched ? {
    name: v.name.trim() ? undefined : TP.nameMissing,
    kuerzel: !neu || KEY.test(v.kuerzel) ? undefined : TP.schluesselInvalid,
  } : {};
  const errors = { ...server, ...Object.fromEntries(Object.entries(local).filter(([, x]) => x)) } as Record<string, string | undefined>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!v.name.trim() || (neu && !KEY.test(v.kuerzel))) return;
    onSubmit({ ...v, name: v.name.trim(), rhythmus: v.rhythmus.trim() });
  };
  const describedBy = (k: string, hint: boolean) => [hint ? `${id}-${k}-h` : '', errors[k] ? `${id}-${k}-e` : ''].filter(Boolean).join(' ') || undefined;
  const err = (k: string) => errors[k] ? <p id={`${id}-${k}-e`} className="ferr">{errors[k]}</p> : null;
  return (
    <form id={formId} className="form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="field">
        <label htmlFor={`${id}-name`}>{TP.name}</label>
        <input id={`${id}-name`} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} maxLength={200} autoComplete="off" data-autofocus
          aria-invalid={errors.name ? true : undefined} aria-describedby={describedBy('name', false)} />
        {err('name')}
      </div>
      {neu ? (
        <div className="field">
          <label htmlFor={`${id}-kuerzel`}>{TP.kuerzel}</label>
          <input id={`${id}-kuerzel`} value={v.kuerzel} onChange={e => setV({ ...v, kuerzel: e.target.value.trim().toLowerCase() })} maxLength={40} autoComplete="off"
            aria-invalid={errors.kuerzel ? true : undefined} aria-describedby={describedBy('kuerzel', true)} />
          <p id={`${id}-kuerzel-h`} className="hint">{TP.kuerzelHint}</p>
          {err('kuerzel')}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}-art`}>{TP.art}</label>
        <select id={`${id}-art`} className="inp" value={v.art} onChange={e => setV({ ...v, art: e.target.value as Art })} aria-describedby={describedBy('art', true)}>
          <option value="entscheidend">{TP.arten.entscheidend}</option>
          <option value="extern">{TP.arten.extern}</option>
        </select>
        <p id={`${id}-art-h`} className="hint">{TP.artHint}</p>
        {err('art')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-rhythmus`}>{TP.rhythmus} <span className="small">(optional)</span></label>
        <input id={`${id}-rhythmus`} value={v.rhythmus} onChange={e => setV({ ...v, rhythmus: e.target.value })} maxLength={200} autoComplete="off"
          aria-describedby={describedBy('rhythmus', true)} />
        <p id={`${id}-rhythmus-h`} className="hint">{TP.rhythmusHint}</p>
        {err('rhythmus')}
      </div>
    </form>
  );
}

/** Fehler beim Speichern: 409 mit fachlichem Text (A-45 bzw. Gremienweg), 422 am Feld, sonst Fehlerzustand. */
function SaveError({ error, conflict }: { error: unknown; conflict: string }) {
  if (!error || statusOf(error) === 422) return null;
  if (statusOf(error) === 409) return <div className="notice" role="alert"><p>{conflict}</p></div>;
  return <ErrorState error={error} />;
}

function CreateDrawer({ portfolio, onClose, onBack, onOpen }: Props) {
  const formId = useId();
  const toast = useToast();
  const [key] = useState(newIdempotencyKey);
  const { create } = useGremiumMutations();
  const gremien = useGremien();
  // Vorbelegung (I-F2): entscheidend, solange das Portfolio noch keines hat
  const hatEntscheidendes = (gremien.data ?? []).some(g => g.portfolioId === portfolio.id && g.art === 'entscheidend');
  if (gremien.isPending) return <Drawer title={TP.gremiumCreate} onClose={onClose}><Loading /></Drawer>;
  return (
    <Drawer title={TP.gremiumCreate} onClose={onClose} actions={<Zurueck portfolio={portfolio} onBack={onBack} />} footer={<>
      <button type="button" className="btn" onClick={onBack}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={create.isPending}>{T.common.save}</button>
    </>}>
      <SaveError error={create.error} conflict={TP.zweitesEntscheidend} />
      <GremiumForm formId={formId} neu busy={create.isPending} error={create.error}
        initial={{ kuerzel: '', name: '', art: hatEntscheidendes ? 'extern' : 'entscheidend', rhythmus: '' }}
        onSubmit={v => create.mutate({ body: { portfolioId: portfolio.id, kuerzel: v.kuerzel, name: v.name, art: v.art, rhythmus: v.rhythmus }, key }, {
          onSuccess: l => { toast.show(TP.gremiumCreated); onOpen(l.item.kuerzel); },
        })} />
    </Drawer>
  );
}

function DetailDrawer({ portfolio, kuerzel, onClose, onBack }: Props) {
  const gremien = useGremien();
  const g = (gremien.data ?? []).find(x => x.kuerzel === kuerzel && x.portfolioId === portfolio.id);
  const q = useGremium(g?.id ?? null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  if (gremien.isPending || (g && q.isPending)) return <Drawer title={TP.gremium} onClose={onClose}><Loading /></Drawer>;
  if (!g || q.error) {
    return (
      <Drawer title={TP.gremium} onClose={onClose} actions={<Zurueck portfolio={portfolio} onBack={onBack} />}>
        {!g || isGone(q.error) ? <Empty>{TP.gremiumGone}</Empty> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      </Drawer>
    );
  }
  if (!q.data) return null;
  return mode === 'edit'
    ? <EditDrawer loaded={q.data} onDone={() => setMode('view')} onReload={() => q.refetch()} />
    : <ViewDrawer loaded={q.data} portfolio={portfolio} onClose={onClose} onBack={onBack} onEdit={() => setMode('edit')} />;
}

function ViewDrawer({ loaded: { item, etag }, portfolio, onClose, onBack, onEdit }: {
  loaded: Loaded<Gremium>; portfolio: Portfolio; onClose(): void; onBack(): void; onEdit(): void;
}) {
  const toast = useToast();
  const { remove } = useGremiumMutations();
  const [confirm, setConfirm] = useState(false);
  return (
    <Drawer title={item.name} onClose={onClose} actions={<>
      <Zurueck portfolio={portfolio} onBack={onBack} />
      {item.can.admin ? <button type="button" className="btn sm" onClick={onEdit}><Icon name="edit" />{T.common.edit}</button> : null}
      {item.can.admin ? <button type="button" className="btn sm danger" onClick={() => setConfirm(true)}><Icon name="trash" />{T.common.delete}</button> : null}
    </>}>
      <dl className="attrs">
        <dt>{TP.kuerzel}</dt><dd className="mono">{item.kuerzel}</dd>
        <dt>{TP.art}</dt><dd>{TP.arten[item.art]}</dd>
        <dt>{TP.rhythmus}</dt><dd>{item.rhythmus || <span className="empty">{TP.keinRhythmus}</span>}</dd>
      </dl>
      {!item.can.admin ? <p className="note">{TP.noRight}</p> : null}
      <Termine gremium={item} />
      {confirm ? (
        <Confirm title={T.common.delete} text={TP.confirmGremiumDelete(item.name)} confirm={T.common.delete} busy={remove.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() => void remove.mutateAsync({ id: item.id, etag }).then(
            () => { toast.show(TP.gremiumDeleted); onBack(); },
            (e: unknown) => { setConfirm(false); toast.error(e, statusOf(e) === 409 ? TP.imGremienweg : isConflict(e) ? TP.gremiumConflict : undefined); },
          )} />
      ) : null}
    </Drawer>
  );
}

function Termine({ gremium }: { gremium: Gremium }) {
  const id = useId();
  const toast = useToast();
  const termine = useTermine(gremium.id);
  const { termin, terminEntfernen } = useGremiumMutations();
  const [datum, setDatum] = useState('');
  const [key, setKey] = useState(newIdempotencyKey);
  const [touched, setTouched] = useState(false);
  const fehler = touched && !/^\d{4}-\d{2}-\d{2}$/.test(datum) ? TP.terminUngueltig
    : statusOf(termin.error) === 409 ? TP.terminDoppelt
      : statusOf(termin.error) === 422 ? TP.terminUngueltig : undefined;
  const planen = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return;
    termin.mutate({ id: gremium.id, datum, key }, {
      onSuccess: t => { toast.show(TP.terminGeplant(fmtDatum(t.datum))); setDatum(''); setTouched(false); setKey(newIdempotencyKey()); },
    });
  };
  return (
    <section aria-labelledby={`t-${gremium.id}`} className="grp">
      <h3 id={`t-${gremium.id}`} className="grp-h"><Icon name="calendar" /> {TP.termine}</h3>
      {termine.isPending ? <Loading /> : termine.error ? <ErrorState error={termine.error} onRetry={() => void termine.refetch()} /> : termine.data.items.length ? (
        <dl className="attrs">
          {termine.data.items.map(t => (
            <Fragment key={t.id}>
              <dt>{fmtDatum(t.datum)}</dt>
              <dd>{gremium.can.admin ? (
                <button type="button" className="iconbtn" aria-label={TP.terminEntfernen(fmtDatum(t.datum))} disabled={terminEntfernen.isPending}
                  onClick={() => terminEntfernen.mutate({ id: gremium.id, datum: t.datum }, {
                    onSuccess: () => toast.show(TP.terminEntfernt(fmtDatum(t.datum))),
                    onError: e => toast.error(e),
                  })}><Icon name="x" /></button>
              ) : null}</dd>
            </Fragment>
          ))}
        </dl>
      ) : <p className="empty">{TP.keineTermine}</p>}
      {gremium.can.admin ? (
        <form className="form" onSubmit={planen} noValidate aria-busy={termin.isPending}>
          <div className="field">
            <label htmlFor={`${id}-datum`}>{TP.terminDatum}</label>
            <input id={`${id}-datum`} type="date" value={datum} onChange={e => { setDatum(e.target.value); termin.reset(); }}
              aria-invalid={fehler ? true : undefined} aria-describedby={fehler ? `${id}-datum-e` : undefined} />
            {fehler ? <p id={`${id}-datum-e`} className="ferr" role="alert">{fehler}</p> : null}
          </div>
          <div><button type="submit" className="btn sm" disabled={termin.isPending}><Icon name="plus" />{TP.terminPlanen}</button></div>
        </form>
      ) : null}
    </section>
  );
}

function EditDrawer({ loaded, onDone, onReload }: { loaded: Loaded<Gremium>; onDone(): void; onReload(): Promise<unknown> }) {
  const formId = useId();
  const toast = useToast();
  const { update } = useGremiumMutations();
  const gremien = useGremien();
  const conflict = isConflict(update.error);
  const { item } = loaded;
  // 409: entweder hat das Portfolio schon ein entscheidendes Gremium (A-45), oder das Gremium steht im Gremienweg
  const anderesEntscheidend = (gremien.data ?? []).some(g => g.portfolioId === item.portfolioId && g.id !== item.id && g.art === 'entscheidend');
  const [artGesendet, setArtGesendet] = useState<Art>(item.art);
  return (
    <Drawer title={`${T.common.edit}: ${item.name}`} onClose={onDone} footer={<>
      <button type="button" className="btn" onClick={onDone}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={update.isPending || conflict}>{T.common.save}</button>
    </>}>
      {conflict ? (
        <div className="notice" role="alert">
          <p>{TP.gremiumConflict}</p>
          <button type="button" className="btn" onClick={async () => { await onReload(); update.reset(); }}>{T.common.reload}</button>
        </div>
      ) : <SaveError error={update.error} conflict={artGesendet === 'entscheidend' && anderesEntscheidend ? TP.zweitesEntscheidend : TP.imGremienweg} />}
      <GremiumForm key={item.version} formId={formId} neu={false} busy={update.isPending} error={update.error}
        initial={{ kuerzel: item.kuerzel, name: item.name, art: item.art, rhythmus: item.rhythmus }}
        onSubmit={v => { setArtGesendet(v.art); update.mutate({ id: item.id, etag: loaded.etag, body: { name: v.name, art: v.art, rhythmus: v.rhythmus } }, {
          onSuccess: () => { toast.show(TP.saved); onDone(); },
        }); }} />
    </Drawer>
  );
}
