/**
 * Einzelwerte einer Zelle der Auslastung (Bericht: jede Zahl führt zu ihren Einzelwerten): Bedarf je Projekt und Phase
 * mit Deckung, Summe gegen das Angebot. Nur Summen je Rolle und Projekt, keine Personen (darstellung.md, sensible Daten).
 */
import { Drawer, fmtFte, Stand } from '../../ui/index.ts';
import type { Auslastung } from './api.ts';
import { TR } from './texte.ts';
import { monatLang } from './zeitraum.ts';

export function BeitraegeDrawer({ auslastung, rolle, monat, label, onClose }: { auslastung: Auslastung; rolle: string; monat: string; label: string; onClose(): void }) {
  const zelle = auslastung.rollen.find(r => r.rolle === rolle)?.zellen.find(z => z.monat === monat);
  const projekte = new Map(auslastung.projekte.map(p => [p.id, p]));
  const titel = `${label} · ${monatLang(monat)}`;
  return (
    <Drawer title={titel} onClose={onClose}>
      {!zelle ? <p className="empty">{TR.zelleUnbekannt}</p> : (
        <>
          <p>{TR.zelleLabel(label, monatLang(monat), fmtFte(zelle.bedarf), zelle.angebot === null ? TR.keinAngebot : fmtFte(zelle.angebot), TR.lage[zelle.lage] ?? zelle.lage)}</p>
          {zelle.beitraege.length ? (
            <table className="res-beitraege">
              <caption className="sr">{TR.beitraege}</caption>
              <thead><tr><th scope="col">{TR.projekt}</th><th scope="col">{TR.phase}</th><th scope="col" className="num">{TR.fte}</th><th scope="col">{TR.deckung}</th></tr></thead>
              <tbody>
                {zelle.beitraege.map(b => {
                  const p = projekte.get(b.projektId);
                  return (
                    <tr key={`${b.projektId}:${b.phase}`}>
                      <td>{p ? <><span className="mono">{p.nummer}</span> {p.name}</> : '–'}</td>
                      <td>{b.phase}</td>
                      <td className="num">{fmtFte(b.fte)}</td>
                      <td>{b.gedeckt ? <Stand familie="positiv" label={TR.gedeckt} /> : <Stand familie="wartet" label={TR.offen} />}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><th scope="row" colSpan={2}>{TR.summe}</th><td className="num">{fmtFte(zelle.bedarf)}</td><td /></tr></tfoot>
            </table>
          ) : <p className="empty">{TR.keineBeitraege}</p>}
        </>
      )}
    </Drawer>
  );
}
