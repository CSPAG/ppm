/**
 * Schublade eines Handlungsfelds (`?o=<id>`) bzw. zum Anlegen (`?o=neu`): Leitsatz, Stossrichtungen, Verlauf,
 * Bearbeiten mit `If-Match` (412: Hinweis und neu laden), Löschen mit Rückfrage.
 */
import { describeError, PersonName } from '@vollholz/iam-web';
import { useId, useState } from 'react';
import { isConflict, isGone, newIdempotencyKey } from '../../api/index.ts';
import { Confirm, Drawer, Empty, ErrorState, fmtDateTime, Icon, Loading, T, useToast } from '../../ui/index.ts';
import { useHandlungsfeld, useHandlungsfeldHistory, useHandlungsfeldMutations, type Loaded } from './api.ts';
import { HandlungsfeldForm, toInput, toValues } from './HandlungsfeldForm.tsx';

export function HandlungsfeldDrawer({ id, onClose, onOpen }: { id: string; onClose(): void; onOpen(id: string): void }) {
  return id === 'neu' ? <CreateDrawer onClose={onClose} onCreated={onOpen} /> : <DetailDrawer id={id} onClose={onClose} />;
}

function CreateDrawer({ onClose, onCreated }: { onClose(): void; onCreated(id: string): void }) {
  const formId = useId();
  const toast = useToast();
  // Ein Schlüssel je geöffnetes Formular: Doppelklick oder Wiederholung nach Netzfehler legt nicht doppelt an
  const [key] = useState(newIdempotencyKey);
  const { create } = useHandlungsfeldMutations();
  return (
    <Drawer title={T.handlungsfeld.create} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={create.isPending}>{T.common.save}</button>
    </>}>
      {create.error ? <ErrorState error={create.error} /> : null}
      <HandlungsfeldForm formId={formId} initial={toValues()} busy={create.isPending} serverErrors={describeError(create.error).fields}
        onSubmit={v => create.mutate({ body: toInput(v), key }, { onSuccess: l => { toast.show(T.handlungsfeld.created); onCreated(l.item.id); } })} />
    </Drawer>
  );
}

function DetailDrawer({ id, onClose }: { id: string; onClose(): void }) {
  const q = useHandlungsfeld(id);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  if (q.isPending) return <Drawer title={T.handlungsfeld.one} onClose={onClose}><Loading /></Drawer>;
  if (q.error) {
    return (
      <Drawer title={T.handlungsfeld.one} onClose={onClose}>
        {isGone(q.error) ? <Empty>{T.handlungsfeld.gone}</Empty> : <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      </Drawer>
    );
  }
  return mode === 'edit'
    ? <EditDrawer loaded={q.data} onDone={() => setMode('view')} onReload={() => q.refetch()} />
    : <ViewDrawer loaded={q.data} onClose={onClose} onEdit={() => setMode('edit')} />;
}

function ViewDrawer({ loaded: { item, etag }, onClose, onEdit }: { loaded: Loaded; onClose(): void; onEdit(): void }) {
  const toast = useToast();
  const { remove } = useHandlungsfeldMutations();
  const [confirm, setConfirm] = useState(false);
  const history = useHandlungsfeldHistory(item.id);
  return (
    <Drawer title={item.label} onClose={onClose} actions={<>
      {item.can.write ? <button type="button" className="btn sm" onClick={onEdit}><Icon name="edit" />{T.common.edit}</button> : null}
      {item.can.delete ? <button type="button" className="btn sm danger" onClick={() => setConfirm(true)}><Icon name="trash" />{T.common.delete}</button> : null}
    </>}>
      <dl className="attrs">
        <dt>{T.handlungsfeld.leitsatz}</dt><dd className="wrap">{item.leitsatz || <span className="empty">{T.handlungsfeld.noLeitsatz}</span>}</dd>
        <dt>{T.handlungsfeld.stossrichtungen}</dt>
        <dd className="wrap">{item.stossrichtungen.length ? <ul>{item.stossrichtungen.map((s, i) => <li key={i}>{s}</li>)}</ul> : <span className="empty">{T.handlungsfeld.noStossrichtungen}</span>}</dd>
        <dt>{T.handlungsfeld.position}</dt><dd className="mono">{item.position}</dd>
      </dl>
      {!item.can.write ? <p className="note">{T.handlungsfeld.noRight}</p> : null}
      <section aria-labelledby={`h-${item.id}`} className="grp">
        <h3 id={`h-${item.id}`} className="grp-h"><Icon name="clock" /> {T.handlungsfeld.history}</h3>
        {history.isPending ? <Loading /> : history.error ? <ErrorState error={history.error} /> : (
          <ol className="tl">
            {history.data.map(h => (
              <li key={h.version}>
                <span className="tl-dot" aria-hidden="true" />
                <div>
                  <strong>{T.handlungsfeld.version(h.version)}</strong> {T.handlungsfeld.actions[h.action] ?? h.action}
                  <div className="t">{fmtDateTime(h.changedAt)}{h.changedBy ? <> · <PersonName id={h.changedBy} /></> : null}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      {confirm ? (
        <Confirm title={T.common.delete} text={T.handlungsfeld.confirmDelete(item.label)} confirm={T.common.delete} busy={remove.isPending}
          onClose={() => setConfirm(false)}
          // mutateAsync statt mutate mit Rückrufen: Nach dem Löschen entfernt der Hook die Abfrage, die Schublade lädt neu
          // und diese Ansicht verschwindet; Rückrufe von mutate() kämen dann nicht mehr an (keine Meldung, Schublade offen)
          onConfirm={() => void remove.mutateAsync({ id: item.id, etag }).then(
            () => { toast.show(T.handlungsfeld.deleted); onClose(); },
            (e: unknown) => { setConfirm(false); toast.error(e, isConflict(e) ? T.handlungsfeld.conflict : undefined); },
          )} />
      ) : null}
    </Drawer>
  );
}

function EditDrawer({ loaded, onDone, onReload }: { loaded: Loaded; onDone(): void; onReload(): Promise<unknown> }) {
  const formId = useId();
  const toast = useToast();
  const { update } = useHandlungsfeldMutations();
  // Neu laden nach 412: die Abfrage liefert die aktuelle Fassung, das Formular baut sich neu auf (Schlüssel = Version)
  const base = loaded;
  const conflict = isConflict(update.error);
  return (
    <Drawer title={`${T.common.edit}: ${base.item.label}`} onClose={onDone} footer={<>
      <button type="button" className="btn" onClick={onDone}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={update.isPending || conflict}>{T.common.save}</button>
    </>}>
      {conflict ? (
        <div className="notice" role="alert">
          <p>{T.handlungsfeld.conflict}</p>
          <button type="button" className="btn" onClick={async () => { await onReload(); update.reset(); }}>{T.common.reload}</button>
        </div>
      ) : update.error ? <ErrorState error={update.error} /> : null}
      <HandlungsfeldForm key={base.item.version} formId={formId} initial={toValues(base.item)} busy={update.isPending} serverErrors={describeError(update.error).fields}
        onSubmit={v => update.mutate({ id: base.item.id, etag: base.etag, body: toInput(v) }, { onSuccess: () => { toast.show(T.handlungsfeld.saved); onDone(); } })} />
    </Drawer>
  );
}
