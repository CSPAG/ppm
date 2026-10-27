/**
 * Projektübersicht (UI-06, UC-014 A1; Seitentyp Bericht): Phasenleiste P0–P4, Angaben und Projektorganisation (PP.04.04)
 * mit Bearbeiten in der Schublade für Sponsor, Projektleitung und Programmleitung (`can.organisation`). Meilensteine,
 * Status und letzte Entscheide ergänzen die Pakete der Register und der Gremien (projektdaten, sitzung).
 */
import { PersonName } from '@vollholz/iam-web';
import { useState } from 'react';
import { ErrorState, fmtPhase, Icon, Loading, type Phase } from '../../ui/index.ts';
import { useOrganisation, useProjektNachNummer, type Organisation, type Projekt } from './api.ts';
import { OrganisationDrawer } from './OrganisationDrawer.tsx';
import { TP } from './texte.ts';

const PHASEN = ['P0', 'P1', 'P2', 'P3', 'P4'] as const;

/** Phasenleiste (darstellung.md «gross»): erledigt, aktuell, folgt; Gate-Termine ergänzt das Gate-Paket. */
function Phasenleiste({ phase }: { phase: Phase }) {
  const i = PHASEN.indexOf(phase as (typeof PHASEN)[number]);
  return (
    <ol className="pj-phasen" aria-label={TP.uebersicht.phasen}>
      {PHASEN.map((p, k) => {
        const zustand = k < i ? 'erledigt' : k === i ? 'aktuell' : 'offen';
        return (
          <li key={p} className={`pj-phase pj-${zustand}`} aria-current={k === i ? 'step' : undefined}>
            <span className="pj-phase-k">{zustand === 'erledigt' ? <Icon name="check" /> : null}{p}</span>
            <span className="pj-phase-n">{fmtPhase(p).slice(p.length + 1)}</span>
            <span className="sr">{TP.uebersicht[zustand]}</span>
          </li>
        );
      })}
    </ol>
  );
}

const ORDNUNG = ['sp', 'koalition', 'pl', 'ctl', 'kt'] as const;

function OrganisationListe({ org }: { org: Organisation }) {
  if (!org.mitglieder.length) return <p className="empty">{TP.org.leer}</p>;
  return (
    <dl className="attrs pj-org">
      {ORDNUNG.filter(f => org.mitglieder.some(m => m.funktion === f)).map(f => (
        <div key={f} className="pj-org-g">
          <dt>{TP.funktionLang[f]}</dt>
          <dd>
            <ul>
              {org.mitglieder.filter(m => m.funktion === f).map(m => (
                <li key={m.personId}><PersonName id={m.personId} />{m.akv ? <span className="muted small"> · {m.akv}</span> : null}</li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Angaben({ p }: { p: Projekt }) {
  return (
    <dl className="attrs">
      <dt>{TP.uebersicht.portfolio}</dt><dd>{p.portfolio ? `${p.portfolio.name} · ${TP.uebersicht.kategorie(p.portfolio.kategorie)}` : ''}</dd>
      <dt>{TP.uebersicht.handlungsfeld}</dt><dd>{p.handlungsfeld ?? <span className="empty">{TP.uebersicht.keinHandlungsfeld}</span>}</dd>
      <dt>{TP.uebersicht.stand}</dt><dd>{TP.lebenszyklus[p.lebenszyklus]}{p.vertraulich ? ` · ${TP.vertraulichHinweis}` : ''}</dd>
    </dl>
  );
}

export function ProjektUebersicht({ nummer }: { nummer: string }) {
  const projekt = useProjektNachNummer(nummer);
  const p = projekt.data ?? undefined;
  const org = useOrganisation(p?.id);
  const [bearbeiten, setBearbeiten] = useState(false);
  if (!p) return null;   // Zustände des Projekts zeigt der Rahmen
  return (
    <div className="pj-uebersicht">
      <section aria-labelledby="pj-phasen" className="grp">
        <h2 id="pj-phasen" className="grp-h">{TP.uebersicht.phasen}</h2>
        <Phasenleiste phase={p.phase} />
      </section>
      <section aria-labelledby="pj-angaben" className="grp">
        <h2 id="pj-angaben" className="grp-h">{TP.uebersicht.angaben}</h2>
        <Angaben p={p} />
      </section>
      <section aria-labelledby="pj-org" className="grp">
        <div className="pj-grp-kopf">
          <h2 id="pj-org" className="grp-h"><Icon name="users" /> {TP.org.titel}</h2>
          {org.data?.org.can.write ? <button type="button" className="btn sm" onClick={() => setBearbeiten(true)}><Icon name="edit" />{TP.org.bearbeiten}</button> : null}
        </div>
        {org.isPending ? <Loading /> : org.error ? <ErrorState error={org.error} onRetry={() => void org.refetch()} /> : (
          <>
            <OrganisationListe org={org.data.org} />
            {!org.data.org.can.write && (p.lebenszyklus === 'aktiv' || p.lebenszyklus === 'sistiert') ? <p className="note">{TP.org.nurLesen}</p> : null}
          </>
        )}
      </section>
      {bearbeiten && org.data ? <OrganisationDrawer projektId={p.id} titel={`${p.nummer} · ${p.name}`} geladen={org.data}
        neuLaden={async () => (await org.refetch()).data} onClose={() => setBearbeiten(false)} /> : null}
    </div>
  );
}
