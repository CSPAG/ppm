/** Formular für Anlegen und Bearbeiten eines strategischen Ziels: Handlungsfeld, Nummer, Ziel, Horizont, Metrik, Zielwert. */
import { useId, useState, type FormEvent } from 'react';
import type { HandlungsfeldKurz, StrategischesZiel, StrategischesZielInput } from './api.ts';
import { TZ } from './texte.ts';
import './ziele.css';

export interface FormValues { handlungsfeldId: string; nummer: string; text: string; horizont: string; metrik: string; zielwert: string }

/** Vorgabe Horizont 2030 (A-15: strategische Ziele = Ziele 2030, keine Zwischenstufe). */
export const toValues = (z?: StrategischesZiel): FormValues => ({
  handlungsfeldId: z?.handlungsfeldId ?? '', nummer: z?.nummer ?? '', text: z?.text ?? '', horizont: String(z?.horizont ?? 2030),
  metrik: z?.metrik ?? '', zielwert: z?.zielwert ?? '',
});

export const toInput = (v: FormValues): StrategischesZielInput => ({
  handlungsfeldId: v.handlungsfeldId, nummer: v.nummer.trim(), text: v.text.trim(), horizont: Number(v.horizont), metrik: v.metrik.trim(), zielwert: v.zielwert.trim(),
});

export function validate(v: FormValues): Partial<Record<keyof FormValues, string>> {
  const e: Partial<Record<keyof FormValues, string>> = {};
  if (!v.handlungsfeldId) e.handlungsfeldId = TZ.handlungsfeldMissing;
  if (!/^[0-9]{1,3}(\.[0-9]{1,3}){0,3}$/.test(v.nummer.trim())) e.nummer = TZ.nummerInvalid;
  if (!v.text.trim()) e.text = TZ.textMissing;
  const h = Number(v.horizont);
  if (!/^\d{4}$/.test(v.horizont.trim()) || h < 2000 || h > 2100) e.horizont = TZ.horizontInvalid;
  return e;
}

export function ZielForm({ formId, initial, handlungsfelder, onSubmit, busy, serverErrors }: {
  /** Für Knöpfe ausserhalb des Formulars (`form`-Attribut). */
  formId: string;
  initial: FormValues; handlungsfelder: HandlungsfeldKurz[]; busy: boolean; onSubmit(v: FormValues): void;
  /** Feldfehler des Servers (422 mit Pfad wie `/nummer`, 409 bei vergebener Nummer). */
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
  const set = (k: keyof FormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <form id={formId} className="form ziel-form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="field">
        <label htmlFor={`${id}-handlungsfeldId`}>{TZ.handlungsfeld}</label>
        <select id={`${id}-handlungsfeldId`} name="handlungsfeldId" value={v.handlungsfeldId} onChange={set('handlungsfeldId')} required data-autofocus
          aria-invalid={errors.handlungsfeldId ? true : undefined} aria-describedby={describedBy('handlungsfeldId')}>
          <option value="">{TZ.handlungsfeldWaehlen}</option>
          {handlungsfelder.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
          {v.handlungsfeldId && !handlungsfelder.some(h => h.id === v.handlungsfeldId) ? <option value={v.handlungsfeldId}>{TZ.handlungsfeldUnbekannt}</option> : null}
        </select>
        {error('handlungsfeldId')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-nummer`}>{TZ.nummer}</label>
        <input id={`${id}-nummer`} name="nummer" inputMode="decimal" value={v.nummer} onChange={set('nummer')} required maxLength={15} autoComplete="off"
          aria-invalid={errors.nummer ? true : undefined} aria-describedby={describedBy('nummer', true)} />
        <p id={`${id}-nummer-h`} className="hint">{TZ.nummerHint}</p>
        {error('nummer')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-text`}>{TZ.text}</label>
        <textarea id={`${id}-text`} name="text" value={v.text} onChange={set('text')} required maxLength={1000} rows={3}
          aria-invalid={errors.text ? true : undefined} aria-describedby={describedBy('text')} />
        {error('text')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-horizont`}>{TZ.horizont}</label>
        <input id={`${id}-horizont`} name="horizont" inputMode="numeric" value={v.horizont} onChange={set('horizont')} maxLength={4}
          aria-invalid={errors.horizont ? true : undefined} aria-describedby={describedBy('horizont', true)} />
        <p id={`${id}-horizont-h`} className="hint">{TZ.horizontHint}</p>
        {error('horizont')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-metrik`}>{TZ.metrik}</label>
        <input id={`${id}-metrik`} name="metrik" value={v.metrik} onChange={set('metrik')} maxLength={500} autoComplete="off"
          aria-invalid={errors.metrik ? true : undefined} aria-describedby={describedBy('metrik')} />
        {error('metrik')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-zielwert`}>{TZ.zielwert}</label>
        <input id={`${id}-zielwert`} name="zielwert" value={v.zielwert} onChange={set('zielwert')} maxLength={200} autoComplete="off"
          aria-invalid={errors.zielwert ? true : undefined} aria-describedby={describedBy('zielwert')} />
        {error('zielwert')}
      </div>
    </form>
  );
}
