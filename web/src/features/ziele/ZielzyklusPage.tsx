/**
 * Zielzyklus eines Jahres (UI-38, Kernablauf K6 Schritte 1–5; UC-011 Schritte 1–5; BC ZM.02.01, ZM.02.03, ZM.02.04,
 * PP.02.05). Seitentyp Arbeitsfläche: Kopf «Zielzyklus 2027 · in Arbeit · Vorlage an den VR geplant ‹Datum›», links der
 * Zielbaum, rechts das gewählte Ziel (`?o=ziel:<nummer>`) bzw. der Zielzyklus selbst, darunter der Prüfbericht mit
 * Sprung zum Ziel (I-P4). Zustände: Laden (Z1), noch nicht gestartet (Z2), Fehler (Z5), nur lesen (Z8), zur Freigabe
 * und in Kraft (Z9), Ziel unbekannt (Z10).
 */
import { useId, useState } from 'react';
import './Zielzyklus.css';
import { newIdempotencyKey } from '../../api/index.ts';
import { Empty, ErrorState, Hinweis, Icon, Skelett, Stand, useToast, useVerzoegert, type StandFamilie } from '../../ui/index.ts';
import { useSession } from '../../auth/index.ts';
import { useHandlungsfelder } from './api.ts';
import { useZielzyklus, useZielzyklusMutations, type Zielzyklus } from './ZielzyklusApi.ts';
import { baumAus, ZielzyklusBaum } from './ZielzyklusBaum.tsx';
import { JahreszielDetail, StrategischDetail } from './ZielzyklusDetail.tsx';
import type { SetZielzyklusSearch, ZielzyklusSearch } from './ZielzyklusSearch.ts';
import { TZZ } from './ZielzyklusTexte.ts';

const FAMILIE: Record<string, StandFamilie> = { in_arbeit: 'entwurf', zur_freigabe: 'wartet', in_kraft: 'positiv' };

export interface ZielzyklusPageProps {
  jahr: number;
  search: ZielzyklusSearch;
  setSearch: SetZielzyklusSearch;
  /** Anderes Jahr öffnen (`/ziele/<jahr>`). */
  jahrWechseln(jahr: number): void;
  /** Projektakte öffnen (`/projekte/<nummer>`, K6-2). */
  projektOeffnen(nummer: string): void;
  /** Assistent «Projektidee» mit Strategiebezug (K4); fehlt, solange es das Feature `idee` nicht gibt. */
  ideeAnstossen?: (zielNummer: string) => void;
  /** Strategische Ziele pflegen (leerer Zyklus ohne strategische Ziele). */
  strategischeZiele(): void;
}

const nummerAusO = (o?: string) => (o ? o.slice('ziel:'.length) : undefined);

export function ZielzyklusPage({ jahr, search, setSearch, jahrWechseln, projektOeffnen, ideeAnstossen, strategischeZiele }: ZielzyklusPageProps) {
  const { can } = useSession();
  const q = useZielzyklus(jahr);
  const felder = useHandlungsfelder(can('handlungsfeld:read'));
  const verzoegert = useVerzoegert(q.isPending);
  const zj = q.data?.zieljahr ?? null;
  const waehlen = (nummer: string) => setSearch({ o: `ziel:${nummer}` });

  return (
    <section aria-labelledby="page-title" className="zz">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="target" /></div>
            <div className="minw0">
              <h1 id="page-title">{TZZ.title(jahr)}</h1>
              <div className="sub">
                {zj ? <><Stand familie={FAMILIE[zj.stand] ?? 'entwurf'} label={TZZ.stand[zj.stand] ?? zj.stand} /> · {zj.vorlageBis ? TZZ.vorlageGeplant(zj.vorlageBis) : TZZ.vorlageOffen}</> : TZZ.sub}
              </div>
            </div>
          </div>
          <nav className="acts" aria-label={TZZ.bereich}>
            <button type="button" className="btn sm" onClick={() => jahrWechseln(jahr - 1)}><Icon name="chev" className="zz-zurueck" />{jahr - 1}</button>
            <button type="button" className="btn sm" onClick={() => jahrWechseln(jahr + 1)}>{jahr + 1}<Icon name="chev" /></button>
          </nav>
        </div>
      </header>
      <div className="body pad">
        {q.isPending ? (verzoegert ? <Skelett zeilen={8} /> : null)
          : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          : !zj ? <Leer zyklus={q.data} onStrategischeZiele={strategischeZiele} />
          : (
            <>
              {zj.stand === 'zur_freigabe' ? <div className="notice" role="status"><Icon name="lock" /> {TZZ.zurFreigabe(jahr, zj.updatedAt as string)}</div> : null}
              {zj.stand === 'in_kraft' ? <div className="notice" role="status"><Icon name="check" /> {TZZ.inKraft(jahr, zj.freigabeAt as string | null)}</div> : null}
              {zj.stand === 'in_arbeit' && !q.data.can.write ? <p className="note">{TZZ.nurLesen}</p> : null}
              <div className="zz-flaeche">
                <div className="zz-links">
                  <ZielzyklusBaum knoten={baumAus(q.data, felder.data ?? [])} aktiv={nummerAusO(search.o)} onWaehlen={waehlen} onProjekt={projektOeffnen} />
                </div>
                <aside className="zz-rechts" aria-label={TZZ.bereich}>
                  <Auswahl zyklus={q.data} nummer={nummerAusO(search.o)} onWaehlen={waehlen} onProjekt={projektOeffnen}
                    ideeAnstossen={ideeAnstossen} onNeuLaden={() => void q.refetch()} />
                  <Pruefbericht zyklus={q.data} onWaehlen={waehlen} />
                </aside>
              </div>
            </>
          )}
      </div>
    </section>
  );
}

/** Z2: noch nicht gestartet; «Zielzyklus starten» für die GL. */
function Leer({ zyklus, onStrategischeZiele }: { zyklus: Zielzyklus; onStrategischeZiele(): void }) {
  const toast = useToast();
  const m = useZielzyklusMutations(zyklus.jahr);
  const [key] = useState(newIdempotencyKey);
  if (!zyklus.strategischeZiele.length) {
    return <Empty action={<button type="button" className="btn" onClick={onStrategischeZiele}>{TZZ.zuStrategischenZielen}</button>}>{TZZ.keineStrategischenZiele}</Empty>;
  }
  return (
    <Empty action={zyklus.can.start ? (
      <button type="button" className="btn primary" disabled={m.starten.isPending}
        onClick={() => m.starten.mutate({ key }, { onSuccess: () => toast.show(TZZ.gestartet(zyklus.jahr)), onError: e => toast.error(e) })}>
        <Icon name="plus" />{TZZ.starten}
      </button>
    ) : undefined}>
      <strong>{TZZ.leerTitel(zyklus.jahr)}</strong> {zyklus.can.start ? TZZ.leer : TZZ.leerNurLesen}
    </Empty>
  );
}

function Auswahl({ zyklus, nummer, onWaehlen, onProjekt, ideeAnstossen, onNeuLaden }: {
  zyklus: Zielzyklus; nummer?: string; onWaehlen(n: string): void; onProjekt(n: string): void; ideeAnstossen?: (n: string) => void; onNeuLaden(): void;
}) {
  if (!nummer) return <ZyklusPanel zyklus={zyklus} />;
  for (const s of zyklus.strategischeZiele) {
    if (s.nummer === nummer) return <StrategischDetail key={s.id} ziel={s} zyklus={zyklus} onWaehlen={onWaehlen} onProjekt={onProjekt} ideeAnstossen={ideeAnstossen} />;
    const jz = s.jahresziele.find(j => j.nummer === nummer);
    if (jz) return <JahreszielDetail key={jz.id} jz={jz} ziel={s} zyklus={zyklus} onWaehlen={onWaehlen} onProjekt={onProjekt} onNeuLaden={onNeuLaden} />;
  }
  return <Empty>{TZZ.nichtGefunden}</Empty>;
}

/** Ohne Auswahl: Zielzyklus selbst mit dem Termin der Vorlage an den VR. */
function ZyklusPanel({ zyklus }: { zyklus: Zielzyklus }) {
  const id = useId();
  const zj = zyklus.zieljahr!;
  const m = useZielzyklusMutations(zyklus.jahr);
  const toast = useToast();
  const [datum, setDatum] = useState(zj.vorlageBis ?? '');
  return (
    <div className="zz-detail">
      <p className="note">{TZZ.waehlen}</p>
      {zj.can.write ? (
        <form className="form zz-form" onSubmit={e => {
          e.preventDefault();
          m.vorlage.mutate({ version: zj.version, vorlageBis: datum || null }, { onSuccess: () => toast.show(TZZ.gespeichert), onError: e2 => toast.error(e2) });
        }}>
          <div className="field">
            <label htmlFor={`${id}-d`}>{TZZ.vorlageBis} <span className="muted">(optional)</span></label>
            <input id={`${id}-d`} type="date" value={datum} aria-describedby={`${id}-dh`} onChange={e => setDatum(e.target.value)} />
            <div id={`${id}-dh`} className="note">{TZZ.vorlageHint}</div>
          </div>
          <div className="acts"><button type="submit" className="btn" disabled={m.vorlage.isPending}>{TZZ.vorlageSpeichern}</button></div>
        </form>
      ) : null}
    </div>
  );
}

/** Prüfbericht (K6 Regeln, I-P3 «vorher», I-P4 mit Sprung zum Ziel). */
function Pruefbericht({ zyklus, onWaehlen }: { zyklus: Zielzyklus; onWaehlen(n: string): void }) {
  const { ohneMetrik, ohneUmsetzung } = zyklus.pruefung;
  return (
    <section className="grp zz-pruef" aria-labelledby="zz-pruef-h">
      <h2 id="zz-pruef-h" className="grp-h"><Icon name="rules" /> {TZZ.pruefbericht}</h2>
      {!ohneMetrik.length && !ohneUmsetzung.length ? <Hinweis stufe="hinweis">{TZZ.pruefungOk}</Hinweis> : null}
      {ohneMetrik.length ? (
        <Hinweis stufe="warnung" aktion={<span className="zz-sprung">{ohneMetrik.map(x => (
          <button key={x.id} type="button" className="linkbtn" aria-label={TZZ.springen(x.nummer)} onClick={() => onWaehlen(x.nummer)}>{x.nummer}</button>
        ))}</span>}>
          {TZZ.ohneMetrik(ohneMetrik.length, ohneMetrik.map(x => x.nummer))}
        </Hinweis>
      ) : null}
      {ohneUmsetzung.map(x => (
        <Hinweis key={x.id} stufe="hinweis" aktion={<button type="button" className="linkbtn" aria-label={TZZ.springen(x.nummer)} onClick={() => onWaehlen(x.nummer)}>{x.nummer}</button>}>
          {TZZ.ohneUmsetzung(x.nummer)}
        </Hinweis>
      ))}
    </section>
  );
}
