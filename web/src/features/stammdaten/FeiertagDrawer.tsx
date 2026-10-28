/**
 * Schublade eines Feiertags (`?ansicht=feiertage&o=<id>`) bzw. zum Erfassen (`o=neu`): Datum und Bezeichnung. Feiertage
 * zählen bei Fristen in Arbeitstagen nicht (A-43). Bearbeiten mit `If-Match` (412, Z7), Löschen mit Rückfrage.
 */
import { describeError } from '@vollholz/iam-web';
import { useId, useState, type FormEvent } from 'react';
import { isConflict, isGone, newIdempotencyKey } from '../../api/index.ts';
import { Confirm, Drawer, Empty, ErrorState, fmtDatum, Icon, Loading, T, useToast } from '../../ui/index.ts';
import { useFeiertag, useFeiertagMutations, type Feiertag, type Loaded } from './api.ts';
import { geaendert, useFormStand } from './formStand.ts';
import { TS } from './texte.ts';

export function FeiertagDrawer({ id, jahr, onClose, onOpen }: { id: string; jahr: number; onClose(): void; onOpen(id: string, jahr: number): void }) {
  return id === 'neu' ? <CreateDrawer jahr={jahr} onClose={onClose} onCreated={onOpen} /> : <DetailDrawer id={id} onClose={onClose} />;
}

function CreateDrawer({ jahr, onClose, onCreated }: { jahr: number; onClose(): void; onCreated(id: string, jahr: number): void }) {
  const formId = useId();
  const toast = useToast();
  const [key] = useState(newIdempotencyKey);
  const { create } = useFeiertagMutations();
  return (
    <Drawer title={TS.feiertag.create} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={create.isPending}>{T.common.save}</button>
    </>}>
      {create.error ? <ErrorState error={create.error} /> : null}
      <FeiertagForm formId={formId} initial={{ datum: `${jahr}-01-01`, label: '' }} busy={create.isPending} serverErrors={describeError(create.error).fields}
        onSubmit={v => create.mutate({ body: toInput(v), key }, { onSuccess: l => { toast.show(TS.feiertag.created); onCreated(l.item.id, Number(l.item.datum.slice(0, 4))); } })} />
    </Drawer>
  );
}

function DetailDrawer({ id, onClose }: { id: string; onClose(): void }) {
  const q = useFeiertag(id);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  if (q.isPending) return <Drawer title={TS.feiertag.one} onClose={onClose}><Loading /></Drawer>;
  if (q.error) {
    return (
      <Drawer title={TS.feiertag.one} onClose={onClose}>
        {isGone(q.error) ? <Empty>{TS.feiertag.gone}</Empty> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      </Drawer>
    );
  }
  return mode === 'edit'
    ? <EditDrawer loaded={q.data} onDone={() => setMode('view')} onReload={() => q.refetch()} />
    : <ViewDrawer loaded={q.data} onClose={onClose} onEdit={() => setMode('edit')} />;
}

const datumLang = (d: string) => fmtDatum(d, new Date(1900, 0, 1));

function ViewDrawer({ loaded: { item, etag }, onClose, onEdit }: { loaded: Loaded<Feiertag>; onClose(): void; onEdit(): void }) {
  const toast = useToast();
  const { remove } = useFeiertagMutations();
  const [confirm, setConfirm] = useState(false);
  return (
    <Drawer title={item.label} onClose={onClose} actions={<>
      {item.can.write ? <button type="button" className="btn sm" onClick={onEdit}><Icon name="edit" />{T.common.edit}</button> : null}
      {item.can.delete ? <button type="button" className="btn sm danger" onClick={() => setConfirm(true)}><Icon name="trash" />{T.common.delete}</button> : null}
    </>}>
      <dl className="attrs">
        <dt>{TS.feiertag.datum}</dt><dd>{datumLang(item.datum)}</dd>
        <dt>{TS.feiertag.label}</dt><dd className="wrap">{item.label}</dd>
      </dl>
      {!item.can.write ? <p className="note">{TS.org.noRight}</p> : null}
      {confirm ? (
        <Confirm title={T.common.delete} text={TS.feiertag.confirmDelete(item.label, datumLang(item.datum))} confirm={T.common.delete} busy={remove.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() => void remove.mutateAsync({ id: item.id, etag }).then(
            () => { toast.show(TS.feiertag.deleted); onClose(); },
            (e: unknown) => { setConfirm(false); toast.error(e, isConflict(e) ? TS.feiertag.conflict : undefined); },
          )} />
      ) : null}
    </Drawer>
  );
}

function EditDrawer({ loaded: { item, etag }, onDone, onReload }: { loaded: Loaded<Feiertag>; onDone(): void; onReload(): Promise<{ error: unknown }> }) {
  const formId = useId();
  const toast = useToast();
  const { update } = useFeiertagMutations();
  const conflict = isConflict(update.error);
  return (
    <Drawer title={`${T.common.edit}: ${item.label}`} onClose={onDone} footer={<>
      <button type="button" className="btn" onClick={onDone}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={update.isPending || conflict}>{T.common.save}</button>
    </>}>
      {conflict ? (
        <div className="notice" role="alert">
          <p>{TS.feiertag.conflict}</p>
          <button type="button" className="btn" onClick={async () => { if (!(await onReload()).error) update.reset(); }}>{T.common.reload}</button>
        </div>
      ) : update.error ? <ErrorState error={update.error} /> : null}
      {/* ohne key: «Neu laden» (Z7) holt den neuen Stand für If-Match, die Eingaben im Formular bleiben */}
      <FeiertagForm formId={formId} initial={{ datum: item.datum, label: item.label }} busy={update.isPending} serverErrors={describeError(update.error).fields}
        onSubmit={v => {
          // nur Geändertes senden: die Änderung einer anderen Person am anderen Feld bleibt (Z7)
          const body = geaendert(toInput(v), toInput({ datum: item.datum, label: item.label }));
          if (!Object.keys(body).length) { onDone(); return; }
          update.mutate({ id: item.id, etag, body }, { onSuccess: () => { toast.show(TS.feiertag.saved); onDone(); } });
        }} />
    </Drawer>
  );
}

interface FormValues { datum: string; label: string }

const toInput = (v: FormValues) => ({ datum: v.datum, label: v.label.trim() });

function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const e: Partial<Record<keyof FormValues, string>> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.datum) || Number.isNaN(Date.parse(v.datum))) e.datum = TS.feiertag.datumInvalid;
  if (!v.label.trim()) e.label = TS.feiertag.labelMissing;
  return e;
}

function FeiertagForm({ formId, initial, onSubmit, busy, serverErrors }: {
  formId: string; initial: FormValues; busy: boolean; onSubmit(v: FormValues): void; serverErrors?: { path: string; message: string }[];
}) {
  const id = useId();
  const [v, setV] = useFormStand(initial);
  const [touched, setTouched] = useState(false);
  const errors = { ...Object.fromEntries((serverErrors ?? []).map(x => [x.path.replace(/^\//, '').split('/')[0], x.message])), ...(touched ? validate(v) : {}) } as Partial<Record<string, string>>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const fehler = validate(v);
    if (Object.keys(fehler).length === 0) onSubmit(v);
    else document.getElementById(`${id}-${Object.keys(fehler)[0]}`)?.focus();
  };
  const describedBy = (k: keyof FormValues) => (errors[k] ? `${id}-${k}-e` : undefined);
  const error = (k: keyof FormValues) => errors[k] ? <p id={`${id}-${k}-e`} className="ferr">{errors[k]}</p> : null;
  return (
    <form id={formId} className="form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="field">
        <label htmlFor={`${id}-datum`}>{TS.feiertag.datum}</label>
        <input id={`${id}-datum`} type="date" value={v.datum} onChange={e => setV({ ...v, datum: e.target.value })} data-autofocus
          aria-invalid={errors.datum ? true : undefined} aria-describedby={describedBy('datum')} />
        {error('datum')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-label`}>{TS.feiertag.label}</label>
        <input id={`${id}-label`} value={v.label} onChange={e => setV({ ...v, label: e.target.value })} maxLength={100} autoComplete="off"
          aria-invalid={errors.label ? true : undefined} aria-describedby={describedBy('label')} />
        {error('label')}
      </div>
    </form>
  );
}
