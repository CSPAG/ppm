/**
 * Entscheide und Auflagen (UI-36, Seitentyp «Liste + Schublade»; UC-006 Schritt 7, A3, A4): Entscheide der Gremien,
 * neueste Sitzung zuerst, Filter Gremium, offene Auflagen, Weiterleitung an den VR. Die Schublade zeigt Begründung und
 * Auflagen; die verantwortliche Person meldet eine Auflage erledigt. Adresse `/gremien/entscheide?e=<id>` bzw.
 * `?auflage=<id>` aus der Aufgabe «Auflage erfüllen» (I-B1, I-N5). Das Gremium steht im Kopf (`?gremium=prat`, IA «Kontext
 * im Kopf»); ohne Angabe gilt das einzige bzw. zuletzt gewählte, ausser die Adresse nennt einen Entscheid oder eine Auflage.
 */
import { useEffect, useId, useState } from 'react';
import { Datenliste, Dialog, Drawer, Hinweis, Icon, Stand, T, fmtDatum, useToast, type Spalte } from '../../ui/index.ts';
import { useGremien } from './api.ts';
import { GremiumWahl, gremiumMerken, vorgabeGremium } from './GremiumWahl.tsx';
import { useAuflageErfuellen, useEntscheide, type Auflage, type EntscheidEintrag } from './Sitzungsmodus.api.ts';
import type { EntscheideSearch, SetEntscheideSearch } from './Entscheide.search.ts';
import { TM } from './Sitzungsmodus.texte.ts';
import './sitzung.css';
import './Sitzungsmodus.css';

const ergebnisText = (e: EntscheidEintrag) => (e.stellungnahme ? `${TM.stellungnahmeKurz}: ${e.label}${e.sns ? ` · ${TM.sns(e.sns.label)}` : ` · ${TM.snsAusstehend}`}` : e.label);

export function EntscheidePage({ search, setSearch }: { search: EntscheideSearch; setSearch: SetEntscheideSearch }) {
  const titelId = useId();
  const toast = useToast();
  // Aus der Aufgabe «Auflage erfüllen»: nur Entscheide mit offenen Auflagen
  const filter = { gremium: search.gremium, auflagen: search.auflagen ?? (search.auflage ? 'offen' as const : undefined), anVr: search.vr ? true : undefined };
  const q = useEntscheide(filter);
  const gremien = useGremien();
  // Gremium aus dem Kontext übernehmen (ersetzt den Eintrag im Verlauf); ein Sprung auf einen Entscheid bleibt ungefiltert
  const vorgabe = !search.gremium && !search.e && !search.auflage && gremien.data ? vorgabeGremium(gremien.data) : undefined;
  useEffect(() => { if (vorgabe) setSearch({ gremium: vorgabe }, { replace: true }); }, [vorgabe, setSearch]);
  useEffect(() => { if (search.gremium && gremien.data?.some(g => g.kuerzel === search.gremium)) gremiumMerken(search.gremium); }, [search.gremium, gremien.data]);
  const erfuellen = useAuflageErfuellen();
  // «Erledigt melden» lässt sich nicht zurücknehmen: Rückfrage mit der Auflage und der Wirkung (I-R1 Stufe 2)
  const [frage, setFrage] = useState<Auflage | null>(null);
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
          <div className="acts">
            <GremiumWahl gremien={gremien.data} wert={search.gremium} onWahl={k => setSearch({ gremium: k, e: undefined, auflage: undefined }, { replace: true })} />
          </div>
        </div>
        <div className="smo-filter">
          <label className="smo-check"><input type="checkbox" checked={!!filter.auflagen} onChange={x => setSearch({ auflagen: x.target.checked ? 'offen' : undefined, auflage: undefined }, { replace: true })} />{TM.filterAuflagen}</label>
          <label className="smo-check"><input type="checkbox" checked={!!search.vr} onChange={x => setSearch({ vr: x.target.checked ? '1' : undefined }, { replace: true })} />{TM.filterVr}</label>
        </div>
      </header>
      <div className="body smo-liste-body">
        <Datenliste titel={TM.entscheide} spalten={spalten} zeilen={items} schluessel={e => e.id} laedt={q.isPending} fehler={q.error} erneut={() => void q.refetch()}
          oeffnen={e => setSearch({ e: e.id, auflage: undefined })} aktuell={offen?.id}
          leer={TM.entscheideLeer} gefiltert={gefiltert} leerGefiltert={TM.entscheideGefiltert}
          zuruecksetzen={() => { gremiumMerken(undefined); setSearch({ gremium: undefined, auflagen: undefined, vr: undefined, e: undefined, auflage: undefined }, { replace: true }); }}
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
                            onClick={() => setFrage(a)}>
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
      {frage ? (
        <Dialog title={TM.erfuellenFrage(frage.text)} onClose={() => setFrage(null)} footer={<>
          <button type="button" className="btn" onClick={() => setFrage(null)} data-autofocus>{T.common.cancel}</button>
          <button type="button" className="btn primary" disabled={erfuellen.isPending}
            onClick={() => erfuellen.mutate(frage, { onSuccess: () => { setFrage(null); toast.show(TM.erfuelltOk); }, onError: x => { setFrage(null); toast.error(x); } })}>
            {TM.erfuellen}
          </button>
        </>}>
          <p>{TM.erfuellenWirkung}</p>
        </Dialog>
      ) : null}
    </section>
  );
}
