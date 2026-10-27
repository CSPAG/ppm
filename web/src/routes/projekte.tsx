/**
 * Routen des Arbeitsraums «Projekte» (informationsarchitektur.md, Adressen; fachmodell.md 7.2): «Meine Projekte»
 * (`/projekte`, UI-05) und die Projektakte (`/projekte/<nr>/…`) mit dem Rahmen des Features `projekt`. Weitere Reiter
 * (Vertrag, Bericht, Versionen, Abschluss) tragen ihre Pakete hier ein: je ein Eintrag in `REITER` und eine Route unter
 * `akteRoute`; der Rahmen erhält den Inhalt als Kind und kennt die Features nicht.
 */
import { createRoute, Outlet, redirect, useNavigate, type AnyRoute } from '@tanstack/react-router';
import { Suspense, useCallback } from 'react';
import {
  MeineProjektePage, PROJEKTNUMMER, ProjektAkte, projektTexte, ProjektUebersicht, type ProjekteSearch, type Reiter, type SetProjekteSearch,
} from '../features/projekt/index.ts';
import { BerichtPage, berichtTexte, laufendePeriode } from '../features/bericht/index.ts';
import { VertragPage, vertragTexte, type SetVertragSearch, type VertragSearch } from '../features/vertrag/index.ts';
import { searchOf } from '../search.ts';
import { Loading } from '../ui/index.ts';

/** Reiter der Projektakte in ihrer Reihenfolge (IA: Übersicht, Vertrag, Bericht, Versionen, Abschluss). */
const REITER: readonly Reiter[] = [
  { pfad: '', label: projektTexte.akte.uebersicht },
  { pfad: 'vertrag', label: vertragTexte.reiter, recht: 'projekt:read' },
  { pfad: 'bericht', label: berichtTexte.reiter, recht: 'projekt:read' },
];

export function projekteRoutes(rootRoute: AnyRoute) {
  const listeRoute = createRoute({
    getParentRoute: () => rootRoute, path: '/projekte', validateSearch: searchOf.projekte, component: MeineProjekteRoute,
  });

  function MeineProjekteRoute() {
    const search = listeRoute.useSearch();
    const navigate = useNavigate({ from: listeRoute.fullPath });
    const setSearch = useCallback<SetProjekteSearch>((next, o) => {
      void navigate({ search: (prev: ProjekteSearch) => ({ ...prev, ...next }), replace: o?.replace ?? false });
    }, [navigate]);
    const oeffnen = useCallback((nr: string) => { void navigate({ to: '/projekte/$nr', params: { nr }, search: {} }); }, [navigate]);
    return <MeineProjektePage search={search} setSearch={setSearch} oeffnen={oeffnen} />;
  }

  // Projektakte: Nummer «JJJJ-NNN» in der Adresse (I-N5); anderes ist eine unbekannte Seite
  const akteRoute = createRoute({
    getParentRoute: () => rootRoute, path: '/projekte/$nr',
    beforeLoad: ({ params }) => { if (!PROJEKTNUMMER.test(params.nr)) throw redirect({ to: '/projekte', search: {}, replace: true }); },
    component: AkteRoute,
  });

  function AkteRoute() {
    const { nr } = akteRoute.useParams();
    return <ProjektAkte nummer={nr} reiter={REITER}><Outlet /></ProjektAkte>;
  }

  const uebersichtRoute = createRoute({ getParentRoute: () => akteRoute, path: '/', component: UebersichtRoute });

  function UebersichtRoute() {
    const { nr } = akteRoute.useParams();
    return <ProjektUebersicht nummer={nr} />;
  }

  // Statusbericht (UI-13, K1): `/projekte/<nr>/bericht?periode=2026-10`
  const berichtRoute = createRoute({ getParentRoute: () => akteRoute, path: '/bericht', validateSearch: searchOf.bericht, component: BerichtRoute });

  function BerichtRoute() {
    const { nr } = akteRoute.useParams();
    const { periode } = berichtRoute.useSearch();
    return <BerichtPage nummer={nr} periode={periode ?? laufendePeriode()} />;
  }

  // Vertrag (UI-07, K2): `?kapitel=7&version=entwurf&feld=…` (informationsarchitektur.md, Adressen)
  const vertragRoute = createRoute({ getParentRoute: () => akteRoute, path: '/vertrag', validateSearch: searchOf.vertrag, component: VertragRoute });

  function VertragRoute() {
    const { nr } = akteRoute.useParams();
    const search = vertragRoute.useSearch();
    const navigate = useNavigate({ from: vertragRoute.fullPath });
    const setSearch = useCallback<SetVertragSearch>((next, o) => {
      void navigate({ search: (prev: VertragSearch) => ({ ...prev, ...next }), replace: o?.replace ?? false });
    }, [navigate]);
    return <Suspense fallback={<Loading />}><VertragPage nummer={nr} search={search} setSearch={setSearch} /></Suspense>;
  }

  return [listeRoute, akteRoute.addChildren([uebersichtRoute, vertragRoute, berichtRoute])] as const;
}
