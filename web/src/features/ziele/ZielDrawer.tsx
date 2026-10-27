/**
 * Schublade eines strategischen Ziels (`?o=<nummer>`) bzw. zum Anlegen (`?o=neu`), BC ZM.01.02, UC-011 Schritt 2:
 * Angaben, Hinweis ohne Metrik (K6 G4), Verlauf mit den geänderten Angaben je Fassung (G11), Bearbeiten mit `If-Match`
 * (412: Hinweis und neu laden), vergebene Nummer (409) am Feld, Löschen mit Rückfrage.
 */
import { describeError, PersonName } from '@vollholz/iam-web';
import { useId, useState } from 'react';
import { isConflict, newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Confirm, Drawer, Empty, ErrorState, fmtDateTime, Hinweis, Icon, Loading, T, useToast } from '../../ui/index.ts';
import { useHandlungsfelder, useZielHistory, useZielMutations, useZielNachNummer, type HandlungsfeldKurz, type Loaded, type ZielVersion } from './api.ts';
import { TZ } from './texte.ts';
import { toInput, toValues, ZielForm } from './ZielForm.tsx';

/** Feldfehler aus der Antwort: 409 beim Speichern heisst «Nummer vergeben» (einzige eindeutige Angabe). */
const fieldErrors = (e: unknown) => (statusOf(e) === 409 ? [{ path: '/nummer', message: TZ.nummerVergeben }] : describeError(e).fields);

export function ZielDrawer({ nummer, canRead, onClose, onOpen }: {
  nummer: string;
  /** Darf die Person Handlungsfelder lesen (Namen und Auswahl)? */
  canRead: boolean;
  onClose(): void; onOpen(nummer: string): void;
}) {
  const felder = useHandlungsfelder(canRead);
  const liste = felder.data ?? [];
  return nummer === 'neu'
    ? <CreateDrawer handlungsfelder={liste} laedt={felder.isLoading} onClose={onClose} onCreated={onOpen} />
    : <DetailDrawer nummer={nummer} handlungsfelder={liste} onClose={onClose} onRenamed={onOpen} />;
}

function CreateDrawer({ handlungsfelder, laedt, onClose, onCreated }: { handlungsfelder: HandlungsfeldKurz[]; laedt: boolean; onClose(): void; onCreated(nummer: string): void }) {
  const formId = useId();
  const toast = useToast();
  // Ein Schlüssel je geöffnetes Formular: Doppelklick oder Wiederholung nach Netzfehler legt nicht doppelt an
  const [key] = useState(newIdempotencyKey);
  const { create } = useZielMutations();
  const ohneFeld = !laedt && handlungsfelder.length === 0;
  if (laedt) return <Drawer title={TZ.create} onClose={onClose}><Loading /></Drawer>;
  return (
    <Drawer title={TZ.create} onClose={onClose} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={create.isPending || ohneFeld}>{T.common.save}</button>
    </>}>
      {ohneFeld ? <Hinweis stufe="hinweis">{TZ.keineHandlungsfelder}</Hinweis> : null}
      {create.error && statusOf(create.error) !== 409 && statusOf(create.error) !== 422 ? <ErrorState error={create.error} /> : null}
      <ZielForm formId={formId} initial={toValues()} handlungsfelder={handlungsfelder} busy={create.isPending} serverErrors={fieldErrors(create.error)}
        onSubmit={v => create.mutate({ body: toInput(v), key }, { onSuccess: l => { toast.show(TZ.created); onCreated(l.item.nummer); } })} />
    </Drawer>
  );
}

function DetailDrawer({ nummer, handlungsfelder, onClose, onRenamed }: {
  nummer: string; handlungsfelder: HandlungsfeldKurz[]; onClose(): void; onRenamed(nummer: string): void;
}) {
  const q = useZielNachNummer(nummer);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  if (q.isPending) return <Drawer title={TZ.one} onClose={onClose}><Loading /></Drawer>;
  if (q.error) return <Drawer title={TZ.one} onClose={onClose}><ErrorState error={q.error} onRetry={() => void q.refetch()} /></Drawer>;
  if (!q.data) return <Drawer title={TZ.one} onClose={onClose}><Empty>{TZ.gone}</Empty></Drawer>;
  return mode === 'edit'
    ? <EditDrawer loaded={q.data} handlungsfelder={handlungsfelder} onDone={n => { setMode('view'); if (n !== nummer) onRenamed(n); }} onReload={() => q.refetch()} />
    : <ViewDrawer loaded={q.data} handlungsfelder={handlungsfelder} onClose={onClose} onEdit={() => setMode('edit')} />;
}

const feldName = (felder: HandlungsfeldKurz[], id: string) => felder.find(h => h.id === id)?.label ?? TZ.handlungsfeldUnbekannt;

function ViewDrawer({ loaded: { item, etag }, handlungsfelder, onClose, onEdit }: { loaded: Loaded; handlungsfelder: HandlungsfeldKurz[]; onClose(): void; onEdit(): void }) {
  const toast = useToast();
  const { remove } = useZielMutations();
  const [confirm, setConfirm] = useState(false);
  const history = useZielHistory(item.id);
  return (
    <Drawer title={`${item.nummer} ${TZ.one}`} onClose={onClose} actions={item.can.write ? <>
      <button type="button" className="btn sm" onClick={onEdit}><Icon name="edit" />{T.common.edit}</button>
      <button type="button" className="btn sm danger" onClick={() => setConfirm(true)}><Icon name="trash" />{T.common.delete}</button>
    </> : null}>
      <p className="wrap">{item.text}</p>
      {!item.metrik ? <Hinweis stufe="hinweis">{TZ.metrikFehltHinweis}</Hinweis> : null}
      <dl className="attrs">
        <dt>{TZ.handlungsfeld}</dt><dd>{feldName(handlungsfelder, item.handlungsfeldId)}</dd>
        <dt>{TZ.horizont}</dt><dd className="mono">{item.horizont}</dd>
        <dt>{TZ.metrik}</dt><dd className="wrap">{item.metrik || <span className="empty">{TZ.metrikFehlt}</span>}</dd>
        <dt>{TZ.zielwert}</dt><dd className="wrap">{item.zielwert || <span className="empty">{TZ.keinZielwert}</span>}</dd>
      </dl>
      {!item.can.write ? <p className="note">{TZ.noRight}</p> : null}
      <section aria-labelledby={`h-${item.id}`} className="grp">
        <h3 id={`h-${item.id}`} className="grp-h"><Icon name="clock" /> {TZ.history}</h3>
        {history.isPending ? <Loading /> : history.error ? <ErrorState error={history.error} /> : (
          <ol className="tl">
            {history.data.map((h, i) => (
              <li key={h.version}>
                <span className="tl-dot" aria-hidden="true" />
                <div>
                  <strong>{TZ.version(h.version)}</strong> {TZ.actions[h.action] ?? h.action}
                  <div className="t">{fmtDateTime(h.changedAt)}{h.changedBy ? <> · <PersonName id={h.changedBy} /></> : null}</div>
                  <Aenderungen jetzt={h} vorher={history.data[i + 1]} handlungsfelder={handlungsfelder} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      {confirm ? (
        <Confirm title={T.common.delete} text={TZ.confirmDelete(item.nummer)} confirm={T.common.delete} busy={remove.isPending}
          onClose={() => setConfirm(false)}
          onConfirm={() => void remove.mutateAsync({ id: item.id, etag }).then(
            () => { toast.show(TZ.deleted); onClose(); },
            (e: unknown) => { setConfirm(false); toast.error(e, isConflict(e) ? TZ.conflict : undefined); },
          )} />
      ) : null}
    </Drawer>
  );
}

const FELDER = ['handlungsfeldId', 'nummer', 'text', 'horizont', 'metrik', 'zielwert'] as const;
const LABEL: Record<(typeof FELDER)[number], string> = {
  handlungsfeldId: TZ.handlungsfeld, nummer: TZ.nummer, text: TZ.text, horizont: TZ.horizont, metrik: TZ.metrik, zielwert: TZ.zielwert,
};

/** Was sich in dieser Fassung gegenüber der vorherigen geändert hat (frühere Stände nachvollziehbar, G11). */
function Aenderungen({ jetzt, vorher, handlungsfelder }: { jetzt: ZielVersion; vorher?: ZielVersion; handlungsfelder: HandlungsfeldKurz[] }) {
  if (!vorher || jetzt.action !== 'updated') return null;
  const wert = (v: ZielVersion, k: (typeof FELDER)[number]) => (k === 'handlungsfeldId' ? feldName(handlungsfelder, v[k]) : String(v[k]) || '–');
  const geaendert = FELDER.filter(k => vorher[k] !== jetzt[k]);
  if (!geaendert.length) return null;
  return (
    <ul className="tl-diff">
      {geaendert.map(k => <li key={k}>{LABEL[k]}: {wert(jetzt, k)} <span className="t">({TZ.vorher}: {wert(vorher, k)})</span></li>)}
    </ul>
  );
}

function EditDrawer({ loaded, handlungsfelder, onDone, onReload }: { loaded: Loaded; handlungsfelder: HandlungsfeldKurz[]; onDone(nummer: string): void; onReload(): Promise<unknown> }) {
  const formId = useId();
  const toast = useToast();
  const { update } = useZielMutations();
  const base = loaded;
  const conflict = isConflict(update.error);
  return (
    <Drawer title={`${T.common.edit}: ${base.item.nummer}`} onClose={() => onDone(base.item.nummer)} footer={<>
      <button type="button" className="btn" onClick={() => onDone(base.item.nummer)}>{T.common.cancel}</button>
      <button type="submit" form={formId} className="btn primary" disabled={update.isPending || conflict}>{T.common.save}</button>
    </>}>
      {conflict ? (
        <div className="notice" role="alert">
          <p>{TZ.conflict}</p>
          <button type="button" className="btn" onClick={async () => { await onReload(); update.reset(); }}>{T.common.reload}</button>
        </div>
      ) : update.error && statusOf(update.error) !== 409 && statusOf(update.error) !== 422 ? <ErrorState error={update.error} /> : null}
      <ZielForm key={base.item.version} formId={formId} initial={toValues(base.item)} handlungsfelder={handlungsfelder} busy={update.isPending}
        serverErrors={fieldErrors(update.error)}
        onSubmit={v => update.mutate({ id: base.item.id, etag: base.etag, body: toInput(v) }, { onSuccess: l => { toast.show(TZ.saved); onDone(l.item.nummer); } })} />
    </Drawer>
  );
}
