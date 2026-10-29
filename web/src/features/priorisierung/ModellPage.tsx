/**
 * Seite «Modell» (UI-19, Seitentyp Liste + Schublade; BC PP.01.02, PP.01.03, UC-008 A1, K5 «Modell und Budgetrahmen»):
 * Versionen des Bewertungsmodells mit Stand, Entscheid und «in Kraft seit»; Version in der Schublade (`?o=<nummer>`) mit
 * Kriterien, Zuordnung zur Matrix (A-39), Budgetrahmen je Portfolio (A-18) und Prüfbericht; Entwurf anlegen, bearbeiten,
 * verwerfen und mit dem Entscheid des Gremiums in Kraft setzen. Ohne `priorisierung:write` nur lesen (Z8).
 */
import { newIdempotencyKey, statusOf } from '../../api/index.ts';
import { Datenliste, fmtDatum, Icon, useToast, type Spalte } from '../../ui/index.ts';
import { standAnzeige } from './anzeige.tsx';
import { useModelle, useModellMutations, type BewertungsmodellKurz } from './api.ts';
import { Kopf } from './Kopf.tsx';
import { ModellDrawer } from './ModellDrawer.tsx';
import type { ModellSearch, SetModellSearch } from './search.ts';
import { TP } from './texte.ts';
import './priorisierung.css';

const spalten: Spalte<BewertungsmodellKurz>[] = [
  { key: 'nummer', titel: TP.nummer, art: 'name', zelle: m => TP.version(m.nummer) },
  { key: 'stand', titel: TP.standTitel, karte: true, zelle: standAnzeige },
  { key: 'inKraft', titel: TP.inKraftSeitTitel, karte: true, zelle: m => (m.inKraftAt ? fmtDatum(m.inKraftAt) : <span className="empty">–</span>) },
  { key: 'beschluss', titel: TP.beschluss, zelle: m => m.beschluss || <span className="empty">–</span> },
  { key: 'beschreibung', titel: TP.beschreibung, zelle: m => m.beschreibung || <span className="empty">–</span> },
];

export function ModellPage({ search, setSearch, navigieren }: { search: ModellSearch; setSearch: SetModellSearch; navigieren(pfad: string): void }) {
  const toast = useToast();
  const modelle = useModelle();
  const { anlegen } = useModellMutations();
  const items = modelle.data?.items;
  const offen = search.o ? items?.find(m => String(m.nummer) === search.o) : undefined;

  const neu = () => anlegen.mutate(newIdempotencyKey(), {
    onSuccess: l => { toast.show(TP.angelegt); setSearch({ o: String(l.item.nummer) }); },
    onError: async e => {
      // Ein Entwurf besteht schon (409): ihn öffnen statt eines zweiten
      if (statusOf(e) === 409) {
        const r = await modelle.refetch();
        const entwurf = r.data?.items.find(m => m.stand === 'entwurf');
        if (entwurf) { setSearch({ o: String(entwurf.nummer) }); return; }
      }
      toast.error(e);
    },
  });
  const anlegenKnopf = modelle.data?.can.create
    ? <button type="button" className="btn primary" onClick={neu} disabled={anlegen.isPending} title={TP.entwurfAnlegenHinweis}><Icon name="plus" />{TP.entwurfAnlegen}</button>
    : null;

  return (
    <section aria-labelledby="page-title" className="pr">
      <Kopf reiter="modell" reiterSichtbar={['bewertung', 'matrix', 'szenarien', 'modell']} navigieren={navigieren} sub={TP.sub} aktionen={items?.length === 0 ? undefined : anlegenKnopf} />
      <div className="body">
        <Datenliste<BewertungsmodellKurz> titel={TP.modelle} spalten={spalten} zeilen={items} schluessel={m => String(m.nummer)} name={m => TP.version(m.nummer)}
          oeffnen={m => setSearch({ o: String(m.nummer) })} aktuell={search.o} laedt={modelle.isPending} fehler={modelle.error} erneut={() => void modelle.refetch()}
          leer={TP.modellLeer} leerAktion={anlegenKnopf} />
      </div>
      {search.o && items ? (
        <ModellDrawer kurz={offen} onClose={() => setSearch({ o: undefined })} />
      ) : null}
    </section>
  );
}
