/**
 * Projektorganisation bearbeiten (PP.04.04, UC-002 Schritt 2): Liste mit Funktion, Person und AKV in der Schublade.
 * Prüfung beim Absenden mit Meldung am Feld (I-F3): Sponsor, Projektleitung und CTL je höchstens eine Person, keine
 * Doppel, Person gewählt; der Server entscheidet (422 am Feld, I-P6). Vor dem Speichern zeigt die Schublade, wer Zugriff
 * erhält und wer ihn verliert (I-F5, I-R1 Stufe 3: wirkt auf andere). 412: Hinweis und neu laden (Z7).
 */
import { describeError, PersonName, PersonPick } from '@vollholz/iam-web';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { isConflict } from '../../api/index.ts';
import { Drawer, ErrorState, Hinweis, Icon, T, useToast } from '../../ui/index.ts';
import { useOrganisationSpeichern, type Funktion, type OrgLoaded } from './api.ts';
import { TP } from './texte.ts';

interface Zeile { key: number; funktion: Funktion; personId: string; akv: string }

const FUNKTIONEN: Funktion[] = ['sp', 'koalition', 'pl', 'ctl', 'kt'];
const ROLLEN: Funktion[] = ['sp', 'pl', 'ctl', 'kt'];
const EINZELN: Funktion[] = ['sp', 'pl', 'ctl'];

/** Fehler je Zeile und Feld (`<index>/<feld>`), lokal geprüft. */
export function pruefe(zeilen: Zeile[]): Record<string, string> {
  const e: Record<string, string> = {};
  const gesehen = new Set<string>();
  const einzeln = new Set<Funktion>();
  zeilen.forEach((z, i) => {
    if (!z.personId) { e[`${i}/personId`] = TP.org.personFehlt; return; }
    const k = `${z.funktion}:${z.personId}`;
    if (gesehen.has(k)) e[`${i}/personId`] = TP.org.doppelt;
    gesehen.add(k);
    if (EINZELN.includes(z.funktion)) {
      if (einzeln.has(z.funktion)) e[`${i}/funktion`] = TP.org.einzeln(TP.funktion[z.funktion]);
      einzeln.add(z.funktion);
    }
  });
  return e;
}

/** Personen mit Rolle am Projekt (sp, pl, ctl, kt), für die Wirkung. */
const mitRolle = (l: { funktion: Funktion; personId: string }[]) => new Set(l.filter(m => ROLLEN.includes(m.funktion) && m.personId).map(m => m.personId));

export function OrganisationDrawer({ projektId, titel, geladen, neuLaden, onClose }: {
  projektId: string; titel: string; geladen: OrgLoaded; onClose(): void;
  /** Aktuellen Stand holen (nach 412); die Eingaben bleiben, gespeichert wird gegen den neuen Stand. */
  neuLaden(): Promise<OrgLoaded | undefined>;
}) {
  const id = useId();
  const toast = useToast();
  const speichern = useOrganisationSpeichern();
  const [naechste, setNaechste] = useState(geladen.org.mitglieder.length);
  const [zeilen, setZeilen] = useState<Zeile[]>(() => geladen.org.mitglieder.map((m, key) => ({ key, funktion: m.funktion, personId: m.personId, akv: m.akv })));
  const [geprueft, setGeprueft] = useState(false);
  const [stand, setStand] = useState(geladen);
  const lokal = geprueft ? pruefe(zeilen) : {};
  const server = Object.fromEntries((describeError(speichern.error).fields ?? []).map(f => [f.path.replace(/^\/mitglieder\//, ''), f.message]));
  const fehler: Record<string, string> = { ...server, ...lokal };

  const wirkung = useMemo(() => {
    const vorher = mitRolle(stand.org.mitglieder);
    const nachher = mitRolle(zeilen);
    return { erhalten: [...nachher].filter(p => !vorher.has(p)), verlieren: [...vorher].filter(p => !nachher.has(p)) };
  }, [stand, zeilen]);

  const setze = (key: number, teil: Partial<Zeile>) => setZeilen(zs => zs.map(z => (z.key === key ? { ...z, ...teil } : z)));
  const hinzufuegen = () => { setZeilen(zs => [...zs, { key: naechste, funktion: 'kt', personId: '', akv: '' }]); setNaechste(n => n + 1); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setGeprueft(true);
    const f = pruefe(zeilen);
    if (Object.keys(f).length) {
      // Fokus auf das erste fehlerhafte Feld (I-F3)
      const [erster] = Object.keys(f);
      document.getElementById(`${id}-${erster!.replace('/', '-')}`)?.focus();
      return;
    }
    speichern.mutate(
      { id: projektId, etag: stand.etag, mitglieder: zeilen.map(z => ({ personId: z.personId, funktion: z.funktion, akv: z.akv.trim() })) },
      { onSuccess: () => { toast.show(TP.org.gespeichert); onClose(); } },
    );
  };

  return (
    <Drawer title={TP.org.bearbeiten} onClose={onClose} actions={<span className="muted">{titel}</span>} footer={<>
      <button type="button" className="btn" onClick={onClose}>{T.common.cancel}</button>
      <button type="submit" form={id} className="btn primary" disabled={speichern.isPending}>{speichern.isPending ? T.common.loading : T.common.save}</button>
    </>}>
      {speichern.error && isConflict(speichern.error) ? (
        <Hinweis stufe="warnung" live aktion={<button type="button" className="btn sm" onClick={() => void neuLaden().then(l => { if (l) { setStand(l); speichern.reset(); } })}>{T.common.reload}</button>}>
          {TP.org.konflikt}
        </Hinweis>
      ) : null}
      {speichern.error && !isConflict(speichern.error) && !Object.keys(server).length ? <ErrorState error={speichern.error} /> : null}
      <form id={id} className="form" onSubmit={submit} noValidate aria-busy={speichern.isPending}>
        {zeilen.map((z, i) => {
          const fid = (feld: string) => `${id}-${i}-${feld}`;
          const err = (feld: string) => fehler[`${i}/${feld}`] ?? (feld === 'personId' ? fehler[`${i}`] : undefined);
          return (
            <fieldset key={z.key} className="pj-zeile">
              <legend className="sr">{TP.org.zeile(i + 1)}</legend>
              <div className="field">
                <label htmlFor={fid('funktion')}>{TP.org.funktion}</label>
                <select id={fid('funktion')} value={z.funktion} onChange={e => setze(z.key, { funktion: e.target.value as Funktion })}
                  aria-invalid={err('funktion') ? true : undefined} aria-describedby={err('funktion') ? `${fid('funktion')}-e` : undefined}>
                  {FUNKTIONEN.map(f => <option key={f} value={f}>{TP.funktionLang[f]}</option>)}
                </select>
                {err('funktion') ? <p id={`${fid('funktion')}-e`} className="ferr">{err('funktion')}</p> : null}
              </div>
              <div className="field">
                <label htmlFor={fid('personId')}>{TP.org.person}</label>
                <PersonPick id={fid('personId')} value={z.personId} onChange={v => setze(z.key, { personId: v })}
                  invalid={!!err('personId')} describedBy={err('personId') ? `${fid('personId')}-e` : undefined} />
                {err('personId') ? <p id={`${fid('personId')}-e`} className="ferr">{err('personId')}</p> : null}
              </div>
              <div className="field">
                <label htmlFor={fid('akv')}>{TP.org.akv} <span className="muted">({TP.org.optional})</span></label>
                <input id={fid('akv')} value={z.akv} maxLength={2000} onChange={e => setze(z.key, { akv: e.target.value })} />
              </div>
              <button type="button" className="btn sm pj-entfernen" onClick={() => setZeilen(zs => zs.filter(x => x.key !== z.key))} aria-label={TP.org.entfernen(i + 1)}>
                <Icon name="trash" />
              </button>
            </fieldset>
          );
        })}
        <div><button type="button" className="btn sm" onClick={hinzufuegen}><Icon name="plus" />{TP.org.hinzufuegen}</button></div>
        <section className="pj-wirkung" aria-live="polite">
          <h3 className="grp-h">{TP.org.wirkung}</h3>
          {!wirkung.erhalten.length && !wirkung.verlieren.length ? <p className="muted">{TP.org.keineWirkung}</p> : null}
          {wirkung.erhalten.length ? <p>{wirkung.erhalten.length} {TP.org.erhalten} {wirkung.erhalten.map((p, k) => <span key={p}>{k ? ', ' : ''}<PersonName id={p} /></span>)}</p> : null}
          {wirkung.verlieren.length ? <p>{wirkung.verlieren.length} {TP.org.verlieren} {wirkung.verlieren.map((p, k) => <span key={p}>{k ? ', ' : ''}<PersonName id={p} /></span>)}</p> : null}
        </section>
      </form>
    </Drawer>
  );
}
