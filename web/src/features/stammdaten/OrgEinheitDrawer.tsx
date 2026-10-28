/**
 * Schublade einer Organisationseinheit (`?o=<id>`) bzw. zum Anlegen (`?o=neu`), UC-017 Schritt 1: Kürzel, Name, Art,
 * übergeordnete Einheit, aktiv. Bearbeiten mit `If-Match` (412: Hinweis und neu laden, Z7), Löschen nur ohne
 * Untereinheiten (sonst deaktivieren, I-Z1 mit Grund).
 */
import { describeError, PersonName } from '@vollholz/iam-web';
import { useId, useState, type FormEvent } from 'react';
import { isConflict, isGone, newIdempotencyKey } from '../../api/index.ts';
import { Confirm, Drawer, Empty, ErrorState, fmtDateTime, Icon, Loading, T, useToast } from '../../ui/index.ts';
import { useOrg, useOrgMutations, type Loaded, type OrgEinheit } from './api.ts';
import { TS } from './texte.ts';

export function OrgEinheitDrawer({ id, alle, onClose, onOpen }: { id: string; alle: OrgEinheit[]; onClose(): void; onOpen(id: string): void }) {
  return id === 'neu' ? <CreateDrawer alle={alle} onClose={onClose} onCreated={onOpen} /> : <DetailDrawer id={id} alle={alle} onClose={onClose} />;
}

function CreateDrawer({ alle, onClose, onCreated }: { alle: OrgEinheit[]; onClose(): void; onCreated(id: string): void }) {
  const formId = useId();
  const toast = useToast();
  // Ein Schlüssel je geöffnetes Formular: Doppelklick oder Wiederholung nach Netzfehler legt nicht doppelt an
  const [key] = useState(newIdempotencyKey);
  const { create } = useOrgMutations();
  return (
    <Drawer title={TS.org.create} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={create.isPending}>{T.common.save}</button>
    </>}>
      {create.error ? <ErrorState error={create.error} /> : null}
      <OrgForm formId={formId} initial={toValues()} alle={alle} busy={create.isPending} serverErrors={describeError(create.error).fields}
        onSubmit={v => create.mutate({ body: toInput(v), key }, { onSuccess: l => { toast.show(TS.org.created); onCreated(l.item.id); } })} />
    </Drawer>
  );
}

function DetailDrawer({ id, alle, onClose }: { id: string; alle: OrgEinheit[]; onClose(): void }) {
  const q = useOrg(id);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  if (q.isPending) return <Drawer title={TS.org.one} onClose={onClose}><Loading /></Drawer>;
  if (q.error) {
    return (
      <Drawer title={TS.org.one} onClose={onClose}>
        {isGone(q.error) ? <Empty>{TS.org.gone}</Empty> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      </Drawer>
    );
  }
  return mode === 'edit'
    ? <EditDrawer loaded={q.data} alle={alle} onDone={() => setMode('view')} onReload={() => q.refetch()} />
    : <ViewDrawer loaded={q.data} alle={alle} onClose={onClose} onEdit={() => setMode('edit')} />;
}

function ViewDrawer({ loaded: { item, etag }, alle, onClose, onEdit }: { loaded: Loaded<OrgEinheit>; alle: OrgEinheit[]; onClose(): void; onEdit(): void }) {
  const toast = useToast();
  const { remove } = useOrgMutations();
  const [confirm, setConfirm] = useState(false);
  const parent = alle.find(o => o.id === item.parentId);
  const kinder = alle.filter(o => o.parentId === item.id);
  return (
    <Drawer title={`${item.kuerzel} · ${item.name}`} onClose={onClose} actions={<>
      {item.can.write ? <button type="button" className="btn sm" onClick={onEdit}><Icon name="edit" />{T.common.edit}</button> : null}
      {item.can.delete ? <button type="button" className="btn sm danger" onClick={() => setConfirm(true)}><Icon name="trash" />{T.common.delete}</button> : null}
    </>}>
      <dl className="attrs">
        <dt>{TS.org.kuerzel}</dt><dd className="mono">{item.kuerzel}</dd>
        <dt>{TS.org.name}</dt><dd className="wrap">{item.name}</dd>
        <dt>{TS.org.art}</dt><dd>{TS.org.arten[item.art] ?? item.art}</dd>
        <dt>{TS.org.parent}</dt><dd>{parent ? `${parent.kuerzel} · ${parent.name}` : <span className="empty">{TS.org.keineParent}</span>}</dd>
        <dt>{TS.org.aktiv}</dt><dd>{item.aktiv ? TS.org.aktivJa : TS.org.inaktiv}</dd>
        <dt>{TS.org.geaendert}</dt><dd className="wrap">{fmtDateTime(item.updatedAt)}{item.updatedBy ? <> · <PersonName id={item.updatedBy} /></> : null}</dd>
      </dl>
      {kinder.length ? (
        <section aria-labelledby={`k-${item.id}`} className="grp">
          <h3 id={`k-${item.id}`} className="grp-h"><Icon name="network" /> {TS.org.untereinheiten(kinder.length)}</h3>
          <ul>{kinder.map(k => <li key={k.id}><span className="mono">{k.kuerzel}</span> · {k.name}</li>)}</ul>
        </section>
      ) : null}
      {item.can.write && !item.can.delete ? <p className="note">{TS.org.nichtLoeschbar}</p> : null}
      {!item.can.write ? <p className="note">{TS.org.noRight}</p> : null}
      {confirm ? (
        <Confirm title={T.common.delete} text={TS.org.confirmDelete(item.kuerzel)} confirm={T.common.delete} busy={remove.isPending}
          onClose={() => setConfirm(false)}
          // mutateAsync wie bei den Handlungsfeldern: nach dem Löschen verschwindet diese Ansicht samt Rückrufen von mutate()
          onConfirm={() => void remove.mutateAsync({ id: item.id, etag }).then(
            () => { toast.show(TS.org.deleted); onClose(); },
            (e: unknown) => { setConfirm(false); toast.error(e, isConflict(e) ? TS.org.conflict : undefined); },
          )} />
      ) : null}
    </Drawer>
  );
}

function EditDrawer({ loaded, alle, onDone, onReload }: { loaded: Loaded<OrgEinheit>; alle: OrgEinheit[]; onDone(): void; onReload(): Promise<unknown> }) {
  const formId = useId();
  const toast = useToast();
  const { update } = useOrgMutations();
  const conflict = isConflict(update.error);
  const { item, etag } = loaded;
  return (
    <Drawer title={`${T.common.edit}: ${item.kuerzel}`} onClose={onDone} footer={<>
      <button type="button" className="btn" onClick={onDone}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={update.isPending || conflict}>{T.common.save}</button>
    </>}>
      {conflict ? (
        <div className="notice" role="alert">
          <p>{TS.org.conflict}</p>
          <button type="button" className="btn" onClick={async () => { await onReload(); update.reset(); }}>{T.common.reload}</button>
        </div>
      ) : update.error ? <ErrorState error={update.error} /> : null}
      {/* ohne key: «Neu laden» (Z7) holt den neuen Stand für If-Match, die Eingaben im Formular bleiben */}
      <OrgForm formId={formId} initial={toValues(item)} alle={alle} selbst={item.id} busy={update.isPending} serverErrors={describeError(update.error).fields}
        onSubmit={v => update.mutate({ id: item.id, etag, body: toInput(v) }, { onSuccess: () => { toast.show(TS.org.saved); onDone(); } })} />
    </Drawer>
  );
}

// --- Formular

interface FormValues { kuerzel: string; name: string; art: 'direktion' | 'bereich'; parentId: string; aktiv: boolean }

const toValues = (o?: OrgEinheit): FormValues =>
  ({ kuerzel: o?.kuerzel ?? '', name: o?.name ?? '', art: o?.art ?? 'direktion', parentId: o?.parentId ?? '', aktiv: o?.aktiv ?? true });

const toInput = (v: FormValues) => ({ kuerzel: v.kuerzel.trim(), name: v.name.trim(), art: v.art, parentId: v.parentId || null, aktiv: v.aktiv });

const KUERZEL = /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,19}$/u;

function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const e: Partial<Record<keyof FormValues, string>> = {};
  if (!KUERZEL.test(v.kuerzel.trim())) e.kuerzel = TS.org.kuerzelMissing;
  if (!v.name.trim()) e.name = TS.org.nameMissing;
  return e;
}

/** Nachfahren von `id` (diese kommen als übergeordnete Einheit nicht in Frage, sonst entstünde ein Kreis). */
function nachfahren(alle: OrgEinheit[], id: string): Set<string> {
  const out = new Set([id]);
  for (let neu = true; neu;) {
    neu = false;
    for (const o of alle) if (o.parentId && out.has(o.parentId) && !out.has(o.id)) { out.add(o.id); neu = true; }
  }
  return out;
}

function OrgForm({ formId, initial, alle, selbst, onSubmit, busy, serverErrors }: {
  formId: string; initial: FormValues; alle: OrgEinheit[]; selbst?: string; busy: boolean; onSubmit(v: FormValues): void;
  serverErrors?: { path: string; message: string }[];
}) {
  const id = useId();
  const [v, setV] = useState(initial);
  const [touched, setTouched] = useState(false);
  const errors = { ...Object.fromEntries((serverErrors ?? []).map(x => [x.path.replace(/^\//, '').split('/')[0], x.message])), ...(touched ? validate(v) : {}) } as Partial<Record<string, string>>;
  const ausgeschlossen = selbst ? nachfahren(alle, selbst) : new Set<string>();
  const moegliche = alle.filter(o => !ausgeschlossen.has(o.id) && (o.aktiv || o.id === v.parentId));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const fehler = validate(v);
    if (Object.keys(fehler).length === 0) onSubmit(v);
    else document.getElementById(`${id}-${Object.keys(fehler)[0]}`)?.focus();
  };
  const describedBy = (k: keyof FormValues, hint?: boolean) =>
    [hint ? `${id}-${k}-h` : '', errors[k] ? `${id}-${k}-e` : ''].filter(Boolean).join(' ') || undefined;
  const error = (k: keyof FormValues) => errors[k] ? <p id={`${id}-${k}-e`} className="ferr">{errors[k]}</p> : null;
  return (
    <form id={formId} className="form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="field">
        <label htmlFor={`${id}-kuerzel`}>{TS.org.kuerzel}</label>
        <input id={`${id}-kuerzel`} value={v.kuerzel} onChange={e => setV({ ...v, kuerzel: e.target.value })} maxLength={20} autoComplete="off" data-autofocus
          className="mono" aria-invalid={errors.kuerzel ? true : undefined} aria-describedby={describedBy('kuerzel', true)} />
        <p id={`${id}-kuerzel-h`} className="hint">{TS.org.kuerzelHint}</p>
        {error('kuerzel')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-name`}>{TS.org.name}</label>
        <input id={`${id}-name`} value={v.name} onChange={e => setV({ ...v, name: e.target.value })} maxLength={200} autoComplete="off"
          aria-invalid={errors.name ? true : undefined} aria-describedby={describedBy('name')} />
        {error('name')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-art`}>{TS.org.art}</label>
        <select id={`${id}-art`} value={v.art} onChange={e => setV({ ...v, art: e.target.value as FormValues['art'] })}>
          <option value="direktion">{TS.org.arten.direktion}</option>
          <option value="bereich">{TS.org.arten.bereich}</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-parentId`}>{TS.org.parent}</label>
        <select id={`${id}-parentId`} value={v.parentId} onChange={e => setV({ ...v, parentId: e.target.value })}
          aria-invalid={errors.parentId ? true : undefined} aria-describedby={describedBy('parentId')}>
          <option value="">{TS.org.keineParent}</option>
          {moegliche.map(o => <option key={o.id} value={o.id}>{o.kuerzel} · {o.name}</option>)}
        </select>
        {error('parentId')}
      </div>
      <div className="field">
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={v.aktiv} onChange={e => setV({ ...v, aktiv: e.target.checked })} aria-describedby={`${id}-aktiv-h`} />
          {TS.org.aktiv}
        </label>
        <p id={`${id}-aktiv-h`} className="hint">{TS.org.aktivHint}</p>
      </div>
    </form>
  );
}
