/**
 * Bereich «Zugriff» am Projekt und am Portfolio (UI-51, UX-E14; UC-016 A2; Master Entscheide 16, 18): wer am Ort führt,
 * steuert oder mitliest, darunter wer über das Portfolio oder übergreifend Zugriff hat, mit «Warum?». Wer am Ort
 * `access:admin` hat, gibt Zugriff (Dialog des Baukastens), befristet oder entfernt ihn; bei einem vertraulichen Projekt
 * steht der Hinweis vor der Liste (UC-016 A2.2). Die Projektorganisation wirkt nicht auf den Zugriff (A-71).
 * Seitentyp Liste + Schublade (interaktion.md, `Datenliste`); Daten über `/v1/access` des Baukastens.
 */
import { GrantDialog, useAccessList, useAuthz, usePatchAccess, useRevoke, WhyDialog, type AccessEntry } from '@vollholz/iam-web';
import { useQuery } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { api } from '../../api/index.ts';
import { Confirm, Datenliste, Drawer, Empty, ErrorState, Hinweis, Icon, Skelett, T, useToast, type Spalte } from '../../ui/index.ts';
import { useProjektNachNummer } from './api.ts';
import { TP } from './texte.ts';

type Ort = { type: 'projekt' | 'portfolio'; id: string };

/** Herkunft eines Eintrags als Text: am Ort selbst, über das Portfolio oder übergreifend (Organisation). */
function ueber(e: AccessEntry, ort: Ort, portfolioName?: string): string {
  if (e.via === 'direct' && e.place.type === ort.type) return ort.type === 'projekt' ? TP.zugriff.amProjekt : TP.zugriff.amPortfolio;
  if (e.place.type === 'portfolio') return portfolioName ? TP.zugriff.ueberPortfolio(portfolioName) : TP.zugriff.ueberPortfolioOhne;
  if (e.place.type === 'org') return TP.zugriff.uebergreifend;
  return TP.zugriff.anderes;
}

const datum = (iso: string) => new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Schlüssel einer Zeile: Tupel-ID, sonst Herkunft, Subjekt und Rolle (Zuständigkeit ohne Tupel). */
const schluessel = (e: AccessEntry) => e.id ?? `${e.via}:${e.subject.ref}:${e.relation}:${e.place.type}:${e.place.id ?? ''}`;

/** Liste mit Schublade; gemeinsam für Projekt und Portfolio. */
export function ZugriffListe({ ort, label, vertraulich, portfolioName }: { ort: Ort; label: string; vertraulich?: boolean; portfolioName?: string }) {
  const authz = useAuthz();
  const q = useAccessList(ort);
  const [geben, setGeben] = useState(false);
  const [warum, setWarum] = useState(false);
  const [offen, setOffen] = useState<string | null>(null);

  const liste = q.data;
  const darf = !!liste?.grantable.length;
  // am Ort selbst zuerst, danach über das Portfolio und übergreifend (Reihenfolge des Baukastens bleibt je Gruppe)
  const hier = liste?.items.filter(e => e.via === 'direct' && e.place.type === ort.type);
  const geerbt = liste?.items.filter(e => !(e.via === 'direct' && e.place.type === ort.type));
  const eintrag = offen ? liste?.items.find(e => schluessel(e) === offen) ?? null : null;

  const spalten: Spalte<AccessEntry>[] = [
    { key: 'wer', titel: TP.zugriff.wer, art: 'name', zelle: e => e.subject.name },
    { key: 'rolle', titel: TP.zugriff.rolle, karte: true, zelle: e => authz.relationLabel(e.relation) },
    { key: 'ueber', titel: TP.zugriff.ueber, zelle: e => ueber(e, ort, portfolioName) },
    { key: 'bis', titel: TP.zugriff.befristet, karte: true, zelle: e => (e.expiresAt ? TP.zugriff.bis(datum(e.expiresAt)) : '–') },
  ];
  const gruppe = (titel: string, zeilen: AccessEntry[] | undefined, leer: string) => (
    <section className="pj-zugriff-g" aria-label={titel}>
      <h2 className="grp-h">{titel}</h2>
      <Datenliste titel={titel} spalten={spalten} zeilen={zeilen} schluessel={schluessel} name={e => e.subject.name}
        oeffnen={e => setOffen(schluessel(e))} aktuell={offen ?? undefined}
        laedt={q.isPending} fehler={q.error ?? undefined} erneut={() => void q.refetch()} leer={leer} />
    </section>
  );

  return (
    <div className="pj-zugriff">
      <div className="pj-zugriff-kopf">
        <p className="muted">{ort.type === 'projekt' ? TP.zugriff.introProjekt : TP.zugriff.introPortfolio}</p>
        <div className="acts">
          <button type="button" className="btn" onClick={() => setWarum(true)}>{TP.zugriff.warum}</button>
          {darf ? <button type="button" className="btn primary" onClick={() => setGeben(true)}><Icon name="plus" />{TP.zugriff.geben}</button> : null}
        </div>
      </div>
      {vertraulich && darf ? <Hinweis stufe="warnung">{TP.zugriff.vertraulich}</Hinweis> : null}
      {liste && !darf ? <p className="muted small">{TP.zugriff.nurLesen}</p> : null}
      {gruppe(ort.type === 'projekt' ? TP.zugriff.gruppeProjekt : TP.zugriff.gruppePortfolio, hier, TP.zugriff.niemandHier)}
      {liste ? gruppe(TP.zugriff.gruppeGeerbt, geerbt, TP.zugriff.niemand) : null}
      {geben && liste ? <GrantDialog resource={ort} label={label} grantable={liste.grantable} onClose={() => setGeben(false)} /> : null}
      {warum ? <WhyDialog resource={ort} label={label} onClose={() => setWarum(false)} /> : null}
      {eintrag ? <ZugriffDrawer eintrag={eintrag} ort={ort} label={label} portfolioName={portfolioName} onClose={() => setOffen(null)} /> : null}
    </div>
  );
}

/**
 * Schublade eines Eintrags: Angaben, «Warum?» für die Person, befristen und entfernen (UC-016 A2.2). Geerbte Einträge
 * ändert man am Ursprung; die Schublade nennt ihn.
 */
function ZugriffDrawer({ eintrag: e, ort, label, portfolioName, onClose }: { eintrag: AccessEntry; ort: Ort; label: string; portfolioName?: string; onClose(): void }) {
  const authz = useAuthz();
  const id = useId();
  const toast = useToast();
  const patch = usePatchAccess();
  const [wert, setWert] = useState(e.expiresAt ? e.expiresAt.slice(0, 10) : '');
  const [entfernen, setEntfernen] = useState(false);
  const [warum, setWarum] = useState(false);
  const heute = new Date().toISOString().slice(0, 10);
  const fehler = wert && wert < heute ? TP.zugriff.bisVergangen : null;
  const aenderbar = e.via === 'direct' && !!e.id && e.removable;
  const speichern = (ev: FormEvent) => {
    ev.preventDefault();
    if (fehler) { document.getElementById(`${id}-bis`)?.focus(); return; }
    // Ende des gewählten Tages (Ortszeit) bzw. ohne Ablauf
    const expiresAt = wert ? new Date(`${wert}T23:59:59`).toISOString() : null;
    patch.mutate({ id: e.id!, expiresAt }, { onSuccess: () => { toast.show(TP.zugriff.befristetGespeichert); onClose(); } });
  };
  return (
    <Drawer title={e.subject.name} onClose={onClose} actions={<span className="muted">{label}</span>} footer={aenderbar ? <>
      <button type="button" className="btn danger" onClick={() => setEntfernen(true)}><Icon name="trash" />{TP.zugriff.entfernen}</button>
      <button type="submit" form={id} className="btn primary" disabled={patch.isPending}>{patch.isPending ? T.common.loading : T.common.save}</button>
    </> : undefined}>
      <dl className="attrs">
        <dt>{TP.zugriff.rolle}</dt><dd>{authz.relationLabel(e.relation)}</dd>
        <dt>{TP.zugriff.ueber}</dt><dd>{ueber(e, ort, portfolioName)}</dd>
        {e.createdBy ? <><dt>{TP.zugriff.vergebenVon}</dt><dd>{e.createdBy}{e.createdAt ? `, ${datum(e.createdAt)}` : ''}</dd></> : null}
      </dl>
      {aenderbar ? (
        <form id={id} className="form" onSubmit={speichern} noValidate aria-busy={patch.isPending}>
          <div className="field">
            <label htmlFor={`${id}-bis`}>{TP.zugriff.bisFeld}</label>
            <input id={`${id}-bis`} type="date" value={wert} min={heute} onChange={x => setWert(x.target.value)}
              aria-invalid={fehler ? true : undefined} aria-describedby={`${id}-h`} />
            <p id={`${id}-h`} className={fehler ? 'ferr' : 'muted small'}>{fehler ?? TP.zugriff.bisHinweis}</p>
          </div>
          {patch.error ? <ErrorState error={patch.error} /> : null}
        </form>
      ) : <p className="muted">{e.via === 'direct' ? TP.zugriff.nurLesen : TP.zugriff.geerbtHinweis(ueber(e, ort, portfolioName))}</p>}
      {e.subject.kind === 'user' ? <p><button type="button" className="linkbtn" onClick={() => setWarum(true)}>{TP.zugriff.warumPerson(e.subject.name)}</button></p> : null}
      {warum ? <WhyDialog resource={ort} label={label} subject={e.subject.ref} onClose={() => setWarum(false)} /> : null}
      {entfernen ? <Entfernen eintrag={e} label={label} onClose={() => setEntfernen(false)} onEntfernt={onClose} /> : null}
    </Drawer>
  );
}

function Entfernen({ eintrag, label, onClose, onEntfernt }: { eintrag: AccessEntry; label: string; onClose(): void; onEntfernt(): void }) {
  const authz = useAuthz();
  const toast = useToast();
  const revoke = useRevoke();
  return (
    <Confirm title={TP.zugriff.entfernenTitel} confirm={TP.zugriff.entfernen} busy={revoke.isPending} onClose={onClose}
      text={TP.zugriff.entfernenText(eintrag.subject.name, authz.relationLabel(eintrag.relation), label)}
      onConfirm={() => revoke.mutate(eintrag.id!, { onSuccess: () => { toast.show(TP.zugriff.entfernt); onClose(); onEntfernt(); } })} />
  );
}

/** Reiter «Zugriff» der Projektakte (`/projekte/<nr>/zugriff`). */
export function ProjektZugriffPage({ nummer }: { nummer: string }) {
  const q = useProjektNachNummer(nummer);
  if (q.isPending) return <Skelett zeilen={4} />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const p = q.data;
  if (!p) return <Empty>{TP.akte.nichtGefunden}</Empty>;
  return <ZugriffListe ort={{ type: 'projekt', id: p.id }} label={`${p.nummer} ${p.name}`} vertraulich={p.vertraulich} portfolioName={p.portfolio?.name} />;
}

/** Portfolios, die die Person sieht, für die Auswahl am Portfolio › Zugriff. */
function usePortfolioListe() {
  return useQuery({
    queryKey: ['projekt', 'zugriff', 'portfolios'] as const,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const out: { id: string; schluessel: string; name: string; kategorie: string }[] = [];
      let cursor: string | undefined;
      do {
        const { data } = await api.GET('/v1/portfolios', { params: { query: { cursor, limit: 200 } }, signal });
        out.push(...data!.items.map(p => ({ id: p.id, schluessel: p.schluessel, name: p.name, kategorie: p.kategorie })));
        cursor = data!.nextCursor ?? undefined;
      } while (cursor);
      return out.sort((a, b) => a.kategorie.localeCompare(b.kategorie) || a.name.localeCompare(b.name, 'de-CH'));
    },
  });
}

/** Portfolio › Zugriff (`/portfolio/zugriff?portfolio=<schlüssel>`): Auswahl im Kopf, darunter die Liste. */
export function PortfolioZugriffPage({ portfolio, setPortfolio }: { portfolio?: string; setPortfolio(schluessel: string | undefined): void }) {
  const id = useId();
  const q = usePortfolioListe();
  const pf = q.data?.find(p => p.schluessel === portfolio) ?? (portfolio ? undefined : q.data?.[0]);
  return (
    <section aria-labelledby="page-title">
      <header className="mh">
        <div className="mh-row">
          <div className="mh-title">
            <div className="type-ico neutral"><Icon name="users" /></div>
            <div className="minw0"><h1 id="page-title">{TP.zugriff.titelPortfolio}</h1></div>
          </div>
          <div className="acts">
            <label htmlFor={`${id}-pf`} className="sr">{TP.zugriff.portfolio}</label>
            <select id={`${id}-pf`} value={pf?.schluessel ?? ''} disabled={!q.data?.length} onChange={e => setPortfolio(e.target.value || undefined)}>
              {(q.data ?? []).map(p => <option key={p.id} value={p.schluessel}>{`${p.kategorie} · ${p.name}`}</option>)}
            </select>
          </div>
        </div>
      </header>
      <div className="body">
        {q.isPending ? <Skelett zeilen={4} />
          : q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
            : !pf ? <Empty>{portfolio ? TP.zugriff.portfolioUnbekannt : TP.zugriff.keinPortfolio}</Empty>
              : <ZugriffListe key={pf.id} ort={{ type: 'portfolio', id: pf.id }} label={pf.name} portfolioName={pf.name} />}
      </div>
    </section>
  );
}
