/**
 * Projektübersicht (UI-06, UC-014 A1; Seitentyp Bericht): Phasenleiste P0–P4, Angaben und Projektorganisation (PP.04.04)
 * mit Bearbeiten in der Schublade für Sponsor, Projektleitung und Programmleitung (`can.organisation`). Meilensteine,
 * Status und letzte Entscheide ergänzen die Pakete der Register und der Gremien (projektdaten, sitzung).
 */
import { PersonName, useAccessList, useIamConfig } from '@vollholz/iam-web';
import { useState } from 'react';
import { ErrorState, fmtPhase, Icon, Loading, type Phase } from '../../ui/index.ts';
import { useOrganisation, useProjektNachNummer, type Organisation, type Projekt } from './api.ts';
import { OrganisationDrawer } from './OrganisationDrawer.tsx';
import { RegisterUebersicht } from './RegisterUebersicht.tsx';
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

/** Gruppen der Projektorganisation: Projektauftraggeber:in, Projektleitung, danach je Bezeichnung (A-72) in der Reihenfolge der Liste. */
function gruppen(org: Organisation): { titel: string; mitglieder: Organisation['mitglieder'] }[] {
  const out = new Map<string, { titel: string; mitglieder: Organisation['mitglieder'] }>();
  for (const m of [...org.mitglieder].sort((a, b) => Number(a.funktion !== 'sp') - Number(b.funktion !== 'sp') || Number(a.funktion !== 'pl') - Number(b.funktion !== 'pl'))) {
    const titel = m.funktion === 'weitere' ? m.funktionText : TP.funktionLang[m.funktion];
    const k = titel.toLowerCase();
    if (!out.has(k)) out.set(k, { titel, mitglieder: [] });
    out.get(k)!.mitglieder.push(m);
  }
  return [...out.values()];
}

/**
 * Projektorganisation mit dem Hinweis «kein Zugriff» an Personen, die das Projekt nicht sehen (K2 Schritt 3, UX-E14):
 * die Projektorganisation vergibt keinen Zugriff (Master Entscheid 16); wer hier Zugriff gibt, erhält die Aktion
 * «Zugriff geben», die in den Bereich «Zugriff» führt. Ohne Liste der Zugriffe (Fehler, Laden) kein Hinweis.
 */
function OrganisationListe({ org, projekt }: { org: Organisation; projekt: Projekt }) {
  const { router: { Link } } = useIamConfig();
  const zugriff = useAccessList({ type: 'projekt', id: projekt.id }, org.mitglieder.length > 0);
  const mit = zugriff.data ? new Set(zugriff.data.items.map(e => e.subject.ref)) : null;
  const darf = !!zugriff.data?.grantable.length;
  if (!org.mitglieder.length) return <p className="empty">{TP.org.leer}</p>;
  return (
    <dl className="attrs pj-org">
      {gruppen(org).map(g => (
        <div key={g.titel} className="pj-org-g">
          <dt>{g.titel}</dt>
          <dd>
            <ul>
              {g.mitglieder.map(m => (
                <li key={m.personId}>
                  <PersonName id={m.personId} />{m.akv ? <span className="muted small"> · {m.akv}</span> : null}
                  {mit && !mit.has(`user:${m.personId}`) ? (
                    <span className="pj-ohne-zugriff">
                      <span className="stand stand-neutral">{TP.org.ohneZugriff}</span>
                      {darf ? <Link to={`/projekte/${projekt.nummer}/zugriff`} className="linkbtn">{TP.org.zugriffGeben}</Link> : null}
                    </span>
                  ) : null}
                </li>
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
            <OrganisationListe org={org.data.org} projekt={p} />
            {!org.data.org.can.write && (p.lebenszyklus === 'aktiv' || p.lebenszyklus === 'sistiert') ? <p className="note">{TP.org.nurLesen}</p> : null}
          </>
        )}
      </section>
      <RegisterUebersicht projektId={p.id} />
      {bearbeiten && org.data ? <OrganisationDrawer projektId={p.id} titel={`${p.nummer} · ${p.name}`} geladen={org.data}
        neuLaden={async () => (await org.refetch()).data} onClose={() => setBearbeiten(false)} /> : null}
    </div>
  );
}
