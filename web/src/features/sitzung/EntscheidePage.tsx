/**
 * Entscheide und Auflagen (UI-36, Seitentyp «Liste + Schublade»; UC-006 Schritt 7, A3, A4): Entscheide der Gremien,
 * neueste Sitzung zuerst, Filter Gremium, offene Auflagen, Weiterleitung an den VR. Die Schublade zeigt Begründung und
 * Auflagen; die verantwortliche Person meldet eine Auflage erledigt. Adresse `/gremien/entscheide?e=<id>` bzw.
 * `?auflage=<id>` aus der Aufgabe «Auflage erfüllen» (I-B1, I-N5).
 */
import { useId } from 'react';
import { Datenliste, Drawer, Hinweis, Icon, Stand, fmtDatum, useToast, type Spalte } from '../../ui/index.ts';
import { useGremien } from './api.ts';
import { useAuflageErfuellen, useEntscheide, type EntscheidEintrag } from './Sitzungsmodus.api.ts';
import { TM } from './Sitzungsmodus.texte.ts';
import './sitzung.css';
import './Sitzungsmodus.css';

export interface EntscheideSearch { gremium?: string; auflagen?: 'offen'; vr?: '1'; e?: string; auflage?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Prüft die rohen Suchparameter; Unbekanntes fällt weg. */
export function validateEntscheideSearch(raw: Record<string, unknown>): EntscheideSearch {
  const s: EntscheideSearch = {};
  if (typeof raw.gremium === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(raw.gremium)) s.gremium = raw.gremium;
  if (raw.auflagen === 'offen') s.auflagen = 'offen';
  if (raw.vr === '1' || raw.vr === 1) s.vr = '1';
  if (typeof raw.e === 'string' && UUID.test(raw.e)) s.e = raw.e;
  if (typeof raw.auflage === 'string' && UUID.test(raw.auflage)) s.auflage = raw.auflage;
  return s;
}

export type SetEntscheideSearch = (next: { [K in keyof EntscheideSearch]?: EntscheideSearch[K] | undefined }, o?: { replace?: boolean }) => void;

const ergebnisText = (e: EntscheidEintrag) => (e.stellungnahme ? `${TM.stellungnahmeKurz}: ${e.label}${e.sns ? ` · ${TM.sns(e.sns.label)}` : ` · ${TM.snsAusstehend}`}` : e.label);

export function EntscheidePage({ search, setSearch }: { search: EntscheideSearch; setSearch: SetEntscheideSearch }) {
  const titelId = useId();
  const toast = useToast();
  // Aus der Aufgabe «Auflage erfüllen»: nur Entscheide mit offenen Auflagen
  const filter = { gremium: search.gremium, auflagen: search.auflagen ?? (search.auflage ? 'offen' as const : undefined), anVr: search.vr ? true : undefined };
  const q = useEntscheide(filter);
  const gremien = useGremien();
  const erfuellen = useAuflageErfuellen();
  const items = q.data?.items;
  const offen = search.e ? items?.find(x => x.id === search.e) : search.auflage ? items?.find(x => x.auflagen.some(a => a.id === search.auflage)) : undefined;
  const gefiltert = !!(search.gremium || search.auflagen || search.vr);

  const spalten: Spalte<EntscheidEintrag>[] = [
    { key: 'datum', titel: TM.spalten.datum, karte: true, zelle: e => `${e.sitzung.gremium.kuerzel.toUpperCase()} ${fmtDatum(e.sitzung.datum)}` },
    { key: 'geschaeft', titel: TM.spalten.geschaeft, art: 'name', zelle: e => `${e.projekt ? `${e.projekt.nummer} ` : ''}${e.traktandum.titel}` },
    { key: 'ergebnis', titel: TM.spalten.ergebnis, karte: true, zelle: e => ergebnisText(e) },
    { key: 'auflagen', titel: TM.spalten.auflagen, karte: true, zelle: e => TM.auflagenAnzahl(e.auflagen.filter(a => a.stand === 'offen').length, e.auflagen.length) },
  ];

  return (
    <section aria-labelledby={titelId}>
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="gavel" /></div>
            <div className="minw0"><h1 id={titelId}>{TM.entscheide}</h1><div className="sub">{TM.entscheideSub}</div></div>
          </div>
        </div>
        <div className="smo-filter">
          <select className="smo-select" value={search.gremium ?? ''} aria-label={TM.filterGremium} onChange={x => setSearch({ gremium: x.target.value || undefined, e: undefined }, { replace: true })}>
            <option value="">{TM.filterAlle}</option>
            {(gremien.data ?? []).map(g => <option key={g.id} value={g.kuerzel}>{g.kuerzel.toUpperCase()} {g.name}</option>)}
          </select>
          <label className="smo-check"><input type="checkbox" checked={!!filter.auflagen} onChange={x => setSearch({ auflagen: x.target.checked ? 'offen' : undefined, auflage: undefined }, { replace: true })} />{TM.filterAuflagen}</label>
          <label className="smo-check"><input type="checkbox" checked={!!search.vr} onChange={x => setSearch({ vr: x.target.checked ? '1' : undefined }, { replace: true })} />{TM.filterVr}</label>
        </div>
      </header>
      <div className="body smo-liste-body">
        <Datenliste titel={TM.entscheide} spalten={spalten} zeilen={items} schluessel={e => e.id} laedt={q.isPending} fehler={q.error} erneut={() => void q.refetch()}
          oeffnen={e => setSearch({ e: e.id, auflage: undefined })} aktuell={offen?.id}
          leer={TM.entscheideLeer} gefiltert={gefiltert} leerGefiltert={TM.entscheideGefiltert}
          zuruecksetzen={() => setSearch({ gremium: undefined, auflagen: undefined, vr: undefined, e: undefined, auflage: undefined }, { replace: true })}
          teilweise={q.data?.mehr ? TM.mehrAlt : undefined} />
      </div>
      {offen ? (
        <Drawer title={`${offen.projekt ? `${offen.projekt.nummer} ` : ''}${offen.traktandum.titel}`} onClose={() => setSearch({ e: undefined, auflage: undefined })}
          actions={<span className="smo-leise">{offen.sitzung.gremium.name} · {fmtDatum(offen.sitzung.datum)} · {offen.traktandum.artLabel}</span>}>
          <div className="smo-entscheid">
            {offen.traktandum.antrag ? <p><span className="smo-leise">{TM.antrag}: </span>{offen.traktandum.antrag}</p> : null}
            <p className="smo-ergebnis">{ergebnisText(offen)}</p>
            <p>{offen.begruendung}</p>
            {offen.anVr ? <Hinweis stufe="hinweis">{TM.weitergeleitet}</Hinweis> : null}
            {offen.auflagen.length ? (
              <>
                <h3 className="smo-h3">{TM.auflagen}</h3>
                <ul className="smo-al smo-al-gross">
                  {offen.auflagen.map(a => (
                    <li key={a.id} className={a.id === search.auflage ? 'on' : undefined}>
                      <span className="minw0">{TM.auflageZeile(a.text, a.verantwortlich.name, fmtDatum(a.termin))}</span>
                      {a.stand === 'erfuellt' ? <Stand familie="positiv" label={TM.erfuellt} />
                        : a.can.erfuellen ? (
                          <button type="button" className="btn" disabled={erfuellen.isPending} aria-label={TM.erfuellenName(a.text)}
                            onClick={() => erfuellen.mutate(a, { onSuccess: () => toast.show(TM.erfuelltOk), onError: x => toast.error(x) })}>
                            <Icon name="check" />{TM.erfuellen}
                          </button>
                        ) : <Stand familie="wartet" label={TM.offen} />}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </Drawer>
      ) : null}
    </section>
  );
}
