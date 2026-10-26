/**
 * Detail eines Projekts als Schublade (Suchparameter `?o=<id>`): Angaben, Klassifizierung, Bearbeiten mit Fassung
 * (`If-Match`; bei 412 Hinweis und «Neu laden»), Löschen mit Rückfrage, Verlauf und «Zugriff» (AccessSheet von
 * iam-web, Ressource `{ type: 'projekt', id }`). Knöpfe erscheinen nur mit der Fähigkeit aus `can`.
 */
import { AccessSheet, ApiError, ClassificationBadge, PersonName } from '@vollholz/iam-web';
import { useState } from 'react';
import { isVersionConflict } from '../../api/client.ts';
import { useSession } from '../../auth/session.tsx';
import { Icon } from '../../ui/Icons.tsx';
import { Confirm, Overlay } from '../../ui/Overlay.tsx';
import { ErrorState, InlineError, Loading } from '../../ui/states.tsx';
import { useToast } from '../../ui/Toasts.tsx';
import { useDeleteProjekt, useProjekt, useProjektHistory, useUpdateProjekt } from './api.ts';
import { fmtDateTime, fmtZeitraum } from './format.ts';
import { ProjektForm } from './ProjektForm.tsx';
import { asLevel, type Projekt, type ProjektPatch } from './types.ts';
import type { ProjektValues } from './validate.ts';

export const CONFLICT_TEXT = 'Jemand hat das Projekt inzwischen geändert.';

export function ProjektDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useProjekt(id);
  const title = q.data?.label ?? (q.isPending ? 'Projekt wird geladen …' : 'Projekt');
  return (
    <Overlay kind="drawer" title={title} onClose={onClose} sub={q.data ? <ClassificationBadge level={asLevel(q.data.classification)} /> : undefined}>
      {q.isPending ? <Loading label="Projekt wird geladen …" />
        : q.error ? <ErrorState error={q.error} title={q.error instanceof ApiError && q.error.status === 404 ? 'Projekt nicht gefunden' : undefined}
          onRetry={q.error instanceof ApiError && q.error.status === 404 ? undefined : () => void q.refetch()} />
        : <ProjektDetail key={q.data.id} projekt={q.data} onReload={() => q.refetch()} onDeleted={onClose} />}
    </Overlay>
  );
}

const toValues = (p: Projekt): ProjektValues => ({ label: p.label, beschreibung: p.beschreibung, beginn: p.beginn ?? '', ende: p.ende ?? '', classification: asLevel(p.classification) });

/** Nur geänderte Felder; der Zeitraum geht immer gemeinsam (die API prüft gegen den zusammengeführten Stand). */
function diff(p: Projekt, v: ProjektValues): ProjektPatch {
  const out: ProjektPatch = {};
  if (v.label !== p.label) out.label = v.label;
  if (v.beschreibung !== p.beschreibung) out.beschreibung = v.beschreibung;
  const beginn = v.beginn || null, ende = v.ende || null;
  if (beginn !== p.beginn || ende !== p.ende) { out.beginn = beginn; out.ende = ende; }
  if (v.classification !== p.classification) out.classification = v.classification;
  return out;
}

function ProjektDetail({ projekt: p, onReload, onDeleted }: { projekt: Projekt; onReload: () => Promise<unknown>; onDeleted: () => void }) {
  const session = useSession();
  const toast = useToast();
  const update = useUpdateProjekt(p.id);
  const remove = useDeleteProjekt(p.id);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [access, setAccess] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const conflict = isVersionConflict(update.error);

  // Neue Fassung: Formular mit dem Stand des Servers neu aufbauen (Schlüssel aus Fassung und Zähler)
  const reload = async () => {
    update.reset();
    await onReload();
    setFormKey(k => k + 1);
  };

  const save = (v: ProjektValues) => {
    const patch = diff(p, v);
    if (!Object.keys(patch).length) { setEditing(false); return; }
    update.mutate({ patch, version: p.version }, {
      onSuccess: () => { setEditing(false); toast.show('Projekt gespeichert.'); },
    });
  };

  const doDelete = () => remove.mutate({ version: p.version }, {
    onSuccess: () => { setConfirming(false); toast.show(`Projekt «${p.label}» gelöscht.`); onDeleted(); },
  });

  const classify = async (level: 0 | 1 | 2) => {
    await update.mutateAsync({ patch: { classification: level }, version: p.version });
    toast.show('Klassifizierung gespeichert.');
  };

  if (editing) {
    return (
      <ProjektForm key={`${p.version}:${formKey}`} initial={toValues(p)} clearance={session.clearance} submitLabel="Speichern" busy={update.isPending}
        error={update.error ?? undefined}
        notice={conflict ? (
          <InlineError>
            <strong>{CONFLICT_TEXT}</strong> Lade die aktuelle Fassung neu und übernimm deine Änderung danach noch einmal.
            <div><button type="button" className="btn btn-sm" onClick={() => void reload()}><Icon name="refresh" />Neu laden</button></div>
          </InlineError>
        ) : undefined}
        onSubmit={save} onCancel={() => { update.reset(); setEditing(false); }} />
    );
  }

  return (
    <div className="detail">
      <div className="detail-actions" role="group" aria-label="Aktionen">
        {p.can.write ? <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}><Icon name="edit" />Bearbeiten</button> : null}
        <button type="button" className="btn" onClick={() => setAccess(true)}><Icon name="share" />Zugriff</button>
        {p.can.delete ? <button type="button" className="btn btn-danger" onClick={() => { remove.reset(); setConfirming(true); }}><Icon name="trash" />Löschen</button> : null}
      </div>
      {!p.can.write && !p.can.delete ? <p className="muted small">Du kannst dieses Projekt lesen, aber nicht ändern.</p> : null}
      <dl className="props">
        <dt>Beschreibung</dt>
        <dd className="prewrap">{p.beschreibung || <span className="muted">Keine Beschreibung</span>}</dd>
        <dt>Zeitraum</dt>
        <dd>{fmtZeitraum(p.beginn, p.ende)}</dd>
        <dt>Klassifizierung</dt>
        <dd>{p.classification ? <ClassificationBadge level={asLevel(p.classification)} /> : 'intern'}</dd>
        <dt>Fassung</dt>
        <dd>{p.version} · geändert {fmtDateTime(p.updatedAt)}</dd>
      </dl>
      <History id={p.id} version={p.version} />
      {confirming ? (
        <Confirm title="Projekt löschen?" confirmLabel="Löschen" busy={remove.isPending} onConfirm={doDelete} onCancel={() => setConfirming(false)}>
          <p>«{p.label}» wird gelöscht. Der Verlauf bleibt im Protokoll erhalten.</p>
          {remove.error ? (isVersionConflict(remove.error)
            ? <InlineError><strong>{CONFLICT_TEXT}</strong> Schliesse die Rückfrage und lade das Projekt neu.</InlineError>
            : <InlineError error={remove.error} />) : null}
        </Confirm>
      ) : null}
      <AccessSheet resource={{ type: 'projekt', id: p.id }} label={p.label} open={access} onClose={() => setAccess(false)}
        classification={{
          level: asLevel(p.classification),
          onChange: p.can.write ? classify : undefined,
          disabledReason: p.can.write ? undefined : 'Nur mit dem Recht «Projekte ändern».',
        }} />
    </div>
  );
}

const ACTION: Record<string, string> = { created: 'angelegt', updated: 'geändert', deleted: 'gelöscht' };

function History({ id, version }: { id: string; version: number }) {
  const [open, setOpen] = useState(false);
  const q = useProjektHistory(id, open);
  return (
    <section className="history" aria-labelledby={`h-${id}`}>
      <h3 id={`h-${id}`}>
        <button type="button" className="disclosure" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <Icon name="chevron" className={open ? 'rot90' : undefined} />Verlauf <span className="muted small">({version} {version === 1 ? 'Fassung' : 'Fassungen'})</span>
        </button>
      </h3>
      {open ? (q.isPending ? <Loading label="Verlauf wird geladen …" />
        : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : (
          <ol className="timeline">
            {q.data.map(h => (
              <li key={h.version}>
                <span className="timeline-v">Fassung {h.version}</span>
                <span>{ACTION[h.action] ?? h.action} {fmtDateTime(h.changedAt)}</span>
                {h.changedBy ? <span className="muted"> von <PersonName id={h.changedBy} /></span> : null}
              </li>
            ))}
          </ol>
        )) : null}
    </section>
  );
}
