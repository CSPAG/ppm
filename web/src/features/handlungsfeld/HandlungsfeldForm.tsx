/** Formular für Anlegen und Bearbeiten: Bezeichnung, Leitsatz, Stossrichtungen (eine je Zeile), Reihenfolge. */
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { T } from '../../ui/index.ts';
import type { HandlungsfeldInput } from './api.ts';

export interface FormValues { label: string; leitsatz: string; stossrichtungen: string; position: string }

export const toValues = (h?: { label: string; leitsatz: string; stossrichtungen: string[]; position: number }): FormValues =>
  ({ label: h?.label ?? '', leitsatz: h?.leitsatz ?? '', stossrichtungen: (h?.stossrichtungen ?? []).join('\n'), position: String(h?.position ?? 0) });

const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

export const toInput = (v: FormValues): HandlungsfeldInput =>
  ({ label: v.label.trim(), leitsatz: v.leitsatz.trim(), stossrichtungen: lines(v.stossrichtungen), position: Number(v.position) });

export function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const e: Partial<Record<keyof FormValues, string>> = {};
  if (!v.label.trim()) e.label = T.handlungsfeld.labelMissing;
  if (lines(v.stossrichtungen).length > 20) e.stossrichtungen = T.handlungsfeld.tooMany;
  if (!/^\d{1,3}$/.test(v.position.trim())) e.position = T.handlungsfeld.positionInvalid;
  return e;
}

export function HandlungsfeldForm({ formId, initial, onSubmit, busy, children, serverErrors }: {
  /** Für Knöpfe ausserhalb des Formulars (`form`-Attribut). */
  formId: string;
  initial: FormValues; busy: boolean; onSubmit(v: FormValues): void; children?: ReactNode;
  /** Feldfehler des Servers (422, Pfad z. B. `/label`). */
  serverErrors?: { path: string; message: string }[];
}) {
  const id = useId();
  const [v, setV] = useState(initial);
  const [touched, setTouched] = useState(false);
  const errors = { ...Object.fromEntries((serverErrors ?? []).map(x => [x.path.replace(/^\//, '').split('/')[0], x.message])), ...(touched ? validate(v) : {}) } as Partial<Record<string, string>>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(validate(v)).length === 0) onSubmit(v);
  };
  const describedBy = (k: keyof FormValues, hint?: boolean) =>
    [hint ? `${id}-${k}-h` : '', errors[k] ? `${id}-${k}-e` : ''].filter(Boolean).join(' ') || undefined;
  const error = (k: keyof FormValues) => errors[k] ? <p id={`${id}-${k}-e`} className="ferr">{errors[k]}</p> : null;
  return (
    <form id={formId} className="form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="field">
        <label htmlFor={`${id}-label`}>{T.handlungsfeld.label}</label>
        <input id={`${id}-label`} name="label" value={v.label} onChange={e => setV({ ...v, label: e.target.value })} required maxLength={200}
          autoComplete="off" data-autofocus aria-invalid={errors.label ? true : undefined} aria-describedby={describedBy('label')} />
        {error('label')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-leitsatz`}>{T.handlungsfeld.leitsatz}</label>
        <textarea id={`${id}-leitsatz`} name="leitsatz" value={v.leitsatz} onChange={e => setV({ ...v, leitsatz: e.target.value })} maxLength={2000} rows={3}
          aria-invalid={errors.leitsatz ? true : undefined} aria-describedby={describedBy('leitsatz')} />
        {error('leitsatz')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-stossrichtungen`}>{T.handlungsfeld.stossrichtungen}</label>
        <textarea id={`${id}-stossrichtungen`} name="stossrichtungen" value={v.stossrichtungen} onChange={e => setV({ ...v, stossrichtungen: e.target.value })} rows={5}
          aria-invalid={errors.stossrichtungen ? true : undefined} aria-describedby={describedBy('stossrichtungen', true)} />
        <p id={`${id}-stossrichtungen-h`} className="hint">{T.handlungsfeld.stossrichtungenHint}</p>
        {error('stossrichtungen')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-position`}>{T.handlungsfeld.position}</label>
        <input id={`${id}-position`} name="position" inputMode="numeric" value={v.position} onChange={e => setV({ ...v, position: e.target.value })}
          aria-invalid={errors.position ? true : undefined} aria-describedby={describedBy('position')} />
        {error('position')}
      </div>
      {children}
    </form>
  );
}
