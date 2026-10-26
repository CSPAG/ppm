/**
 * Formular für Anlegen und Bearbeiten. Prüft vor dem Senden wie die API (validate.ts) und zeigt Feldfehler der API
 * (422, `errors[].path`) an denselben Feldern. Beim Senden mit Fehlern springt der Fokus zum ersten fehlerhaften Feld.
 */
import { useId, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import { fieldErrors } from '../../api/client.ts';
import { InlineError } from '../../ui/states.tsx';
import { asLevel } from './types.ts';
import { validateProjekt, type FieldErrors, type ProjektField, type ProjektValues } from './validate.ts';

const LEVELS = [
  { level: 0, label: 'intern' },
  { level: 1, label: 'vertraulich' },
  { level: 2, label: 'streng vertraulich' },
] as const;

const ORDER: ProjektField[] = ['label', 'beschreibung', 'beginn', 'ende', 'classification'];

export interface ProjektFormProps {
  initial: ProjektValues;
  /** Höchste Stufe, die ich vergeben darf (Freigabestufe). */
  clearance: 0 | 1 | 2;
  submitLabel: string;
  busy?: boolean;
  /** Fehler des letzten Sendens (422 erscheint an den Feldern, alles andere oben). */
  error?: unknown;
  /** Hinweis über dem Formular (z. B. Konflikt 412) statt des allgemeinen Fehlers. */
  notice?: ReactNode;
  onSubmit: (values: ProjektValues) => void;
  onCancel: () => void;
}

export function ProjektForm({ initial, clearance, submitLabel, busy, error, notice, onSubmit, onCancel }: ProjektFormProps) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [v, setV] = useState<ProjektValues>(initial);
  const [local, setLocal] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);
  const server = fieldErrors(error) as FieldErrors & { ''?: string };
  const errors: FieldErrors = touched ? { ...server, ...local } : server;
  const hasServerFields = Object.keys(server).length > 0;

  const set = <K extends ProjektField>(k: K, value: ProjektValues[K]) => {
    const next = { ...v, [k]: value };
    setV(next);
    if (touched) setLocal(validateProjekt(next));
  };

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const found = validateProjekt(v);
    setTouched(true);
    setLocal(found);
    const first = ORDER.find(k => found[k]);
    if (first) {
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    onSubmit({ ...v, label: v.label.trim() });
  };

  const field = (k: ProjektField) => ({
    id: `${id}-${k}`,
    name: k,
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${id}-${k}-err` : undefined,
  });
  const err = (k: ProjektField) => (errors[k] ? <p id={`${id}-${k}-err`} className="field-error">{errors[k]}</p> : null);

  return (
    <form ref={form} className="form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
      {notice ?? (error !== undefined && error !== null && !hasServerFields ? <InlineError error={error} /> : null)}
      {server[''] ? <InlineError>{server['']}</InlineError> : null}
      <div className="field">
        <label htmlFor={`${id}-label`}>Bezeichnung <span className="req" aria-hidden="true">*</span></label>
        <input {...field('label')} type="text" required maxLength={200} autoComplete="off" value={v.label} onChange={e => set('label', e.target.value)} data-autofocus />
        {err('label')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-beschreibung`}>Beschreibung</label>
        <textarea {...field('beschreibung')} rows={4} maxLength={10000} value={v.beschreibung} onChange={e => set('beschreibung', e.target.value)} />
        {err('beschreibung')}
      </div>
      <fieldset className="field-row">
        <legend>Zeitraum <span className="muted small">(optional, Beginn und Ende gemeinsam)</span></legend>
        <div className="field">
          <label htmlFor={`${id}-beginn`}>Beginn</label>
          <input {...field('beginn')} type="date" value={v.beginn} onChange={e => set('beginn', e.target.value)} />
          {err('beginn')}
        </div>
        <div className="field">
          <label htmlFor={`${id}-ende`}>Ende</label>
          <input {...field('ende')} type="date" value={v.ende} min={v.beginn || undefined} onChange={e => set('ende', e.target.value)} />
          {err('ende')}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${id}-classification`}>Klassifizierung</label>
        <select {...field('classification')} value={v.classification} onChange={e => set('classification', asLevel(Number(e.target.value)))}
          aria-describedby={`${id}-classification-hint${errors.classification ? ` ${id}-classification-err` : ''}`}>
          {LEVELS.map(l => <option key={l.level} value={l.level} disabled={l.level > clearance}>{l.label}</option>)}
        </select>
        <p id={`${id}-classification-hint`} className="hint">Höher als deine Freigabestufe kannst du nicht wählen.</p>
        {err('classification')}
      </div>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>Abbrechen</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Wird gespeichert …' : submitLabel}</button>
      </div>
    </form>
  );
}

export const emptyValues: ProjektValues = { label: '', beschreibung: '', beginn: '', ende: '', classification: 0 };
