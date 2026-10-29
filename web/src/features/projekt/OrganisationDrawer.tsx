/**
 * Projektorganisation bearbeiten (PP.04.04, UC-002 Schritt 2): Liste mit Funktion, Person und AKV in der Schublade.
 * Fest sind Projektauftraggeber:in und Projektleitung (je höchstens eine Person, A-04); weitere Funktionen tragen eine
 * Bezeichnung mit Vorschlägen aus der Organisation (A-72). Prüfung beim Absenden mit Meldung am Feld (I-F3); der Server
 * entscheidet (422 am Feld, I-P6). Die Projektorganisation vergibt keinen Zugriff (Master Entscheid 16). 412: Hinweis
 * und neu laden (Z7).
 */
import { describeError, PersonPick } from '@vollholz/iam-web';
import { useId, useState, type FormEvent } from 'react';
import { isConflict } from '../../api/index.ts';
import { Drawer, ErrorState, Hinweis, Icon, T, useToast } from '../../ui/index.ts';
import { useOrganisationSpeichern, type Funktion, type OrgLoaded } from './api.ts';
import { TP } from './texte.ts';

interface Zeile { key: number; funktion: Funktion; funktionText: string; personId: string; akv: string }

const FUNKTIONEN: Funktion[] = ['sp', 'pl', 'weitere'];

/** Fehler je Zeile und Feld (`<index>/<feld>`), lokal geprüft. */
export function pruefe(zeilen: Zeile[]): Record<string, string> {
  const e: Record<string, string> = {};
  const gesehen = new Set<string>();
  const einzeln = new Set<Funktion>();
  zeilen.forEach((z, i) => {
    const text = z.funktion === 'weitere' ? z.funktionText.trim() : '';
    if (z.funktion === 'weitere' && !text) e[`${i}/funktionText`] = TP.org.textFehlt;
    if (!z.personId) { e[`${i}/personId`] = TP.org.personFehlt; return; }
    const k = `${z.funktion}:${text.toLowerCase()}:${z.personId}`;
    if (gesehen.has(k)) e[`${i}/personId`] = TP.org.doppelt;
    gesehen.add(k);
    if (z.funktion !== 'weitere') {
      if (einzeln.has(z.funktion)) e[`${i}/funktion`] = TP.org.einzeln(TP.funktion[z.funktion]);
      einzeln.add(z.funktion);
    }
  });
  return e;
}

export function OrganisationDrawer({ projektId, titel, geladen, neuLaden, onClose }: {
  projektId: string; titel: string; geladen: OrgLoaded; onClose(): void;
  /** Aktuellen Stand holen (nach 412); die Eingaben bleiben, gespeichert wird gegen den neuen Stand. */
  neuLaden(): Promise<OrgLoaded | undefined>;
}) {
  const id = useId();
  const toast = useToast();
  const speichern = useOrganisationSpeichern();
  const [naechste, setNaechste] = useState(geladen.org.mitglieder.length);
  const [zeilen, setZeilen] = useState<Zeile[]>(() => geladen.org.mitglieder.map((m, key) => ({ key, funktion: m.funktion, funktionText: m.funktionText, personId: m.personId, akv: m.akv })));
  const [geprueft, setGeprueft] = useState(false);
  const [stand, setStand] = useState(geladen);
  const lokal = geprueft ? pruefe(zeilen) : {};
  const server = Object.fromEntries((describeError(speichern.error).fields ?? []).map(f => [f.path.replace(/^\/mitglieder\//, ''), f.message]));
  const fehler: Record<string, string> = { ...server, ...lokal };

  const setze = (key: number, teil: Partial<Zeile>) => setZeilen(zs => zs.map(z => (z.key === key ? { ...z, ...teil } : z)));
  const hinzufuegen = () => { setZeilen(zs => [...zs, { key: naechste, funktion: 'weitere', funktionText: '', personId: '', akv: '' }]); setNaechste(n => n + 1); };
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
      {
        id: projektId, etag: stand.etag,
        mitglieder: zeilen.map(z => ({ personId: z.personId, funktion: z.funktion, ...(z.funktion === 'weitere' ? { funktionText: z.funktionText.trim() } : {}), akv: z.akv.trim() })),
      },
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
      <Hinweis stufe="hinweis">{TP.org.keinZugriff}</Hinweis>
      <datalist id={`${id}-vorschlaege`}>{stand.org.vorschlaege.map(v => <option key={v} value={v} />)}</datalist>
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
              {z.funktion === 'weitere' ? (
                <div className="field">
                  <label htmlFor={fid('funktionText')}>{TP.org.funktionText}</label>
                  <input id={fid('funktionText')} value={z.funktionText} maxLength={100} list={`${id}-vorschlaege`} placeholder={TP.org.funktionTextHint}
                    onChange={e => setze(z.key, { funktionText: e.target.value })}
                    aria-invalid={err('funktionText') ? true : undefined} aria-describedby={err('funktionText') ? `${fid('funktionText')}-e` : undefined} />
                  {err('funktionText') ? <p id={`${fid('funktionText')}-e`} className="ferr">{err('funktionText')}</p> : null}
                </div>
              ) : null}
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
      </form>
    </Drawer>
  );
}
