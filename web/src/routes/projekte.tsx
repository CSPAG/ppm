/**
 * Routen des Arbeitsraums «Projekte» (informationsarchitektur.md, Adressen; fachmodell.md 7.2): «Meine Projekte»
 * (`/projekte`, UI-05) und die Projektakte (`/projekte/<nr>/…`) mit dem Rahmen des Features `projekt`. Weitere Reiter
 * (Vertrag, Bericht, Versionen, Abschluss) tragen ihre Pakete hier ein: je ein Eintrag in `REITER` und eine Route unter
 * `akteRoute`; der Rahmen erhält den Inhalt als Kind und kennt die Features nicht.
 */
import { type AnyRoute, createRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { Suspense, useCallback } from 'react';
import { type ProjekteSearch, PROJEKTNUMMER, projektTexte, type Reiter, type SetProjekteSearch } from '../features/projekt/index.ts';
import { berichtTexte, laufendePeriode } from '../features/bericht/index.ts';
import { type SetVertragSearch, type VertragSearch, vertragTexte } from '../features/vertrag/index.ts';
import { Loading } from '../ui/index.ts';
import { seite } from './seite.ts';
import { searchOf } from '../search.ts';

// Seiten als eigene Chunks (Q-L6)
const MeineProjektePage = seite(() => import('../features/projekt/MeineProjektePage.tsx'), 'MeineProjektePage');
const ProjektAkte = seite(() => import('../features/projekt/ProjektAkte.tsx'), 'ProjektAkte');
const ProjektUebersicht = seite(() => import('../features/projekt/ProjektUebersicht.tsx'), 'ProjektUebersicht');
const BerichtPage = seite(() => import('../features/bericht/BerichtPage.tsx'), 'BerichtPage');
const VertragPage = seite(() => import('../features/vertrag/VertragPage.tsx'), 'VertragPage');
const PruefenPage = seite(() => import('../features/vertrag/PruefenPage.tsx'), 'PruefenPage');
const UnterzeichnenPage = seite(() => import('../features/vertrag/UnterzeichnenPage.tsx'), 'UnterzeichnenPage');
const GatePage = seite(() => import('../features/vertrag/GatePage.tsx'), 'GatePage');

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

  // Quality-Check und Unterzeichnen (UI-12, K2 Schritte 7–8): Ziele der Aufgaben im Eingang (I-B1)
  const pruefenRoute = createRoute({ getParentRoute: () => akteRoute, path: '/vertrag/pruefen', component: PruefenRoute });
  function PruefenRoute() {
    const { nr } = akteRoute.useParams();
    return <Suspense fallback={<Loading />}><PruefenPage nummer={nr} /></Suspense>;
  }
  const unterzeichnenRoute = createRoute({ getParentRoute: () => akteRoute, path: '/vertrag/unterzeichnen', component: UnterzeichnenRoute });
  function UnterzeichnenRoute() {
    const { nr } = akteRoute.useParams();
    return <Suspense fallback={<Loading />}><UnterzeichnenPage nummer={nr} /></Suspense>;
  }
  // Gate-Modus (UI-08, K2 Schritte 1–4): Ziel der Aufgabe «Gate vorbereiten» (I-B1)
  const gateRoute = createRoute({ getParentRoute: () => akteRoute, path: '/vertrag/gate', component: GateRoute });
  function GateRoute() {
    const { nr } = akteRoute.useParams();
    return <Suspense fallback={<Loading />}><GatePage nummer={nr} /></Suspense>;
  }

  return [listeRoute, akteRoute.addChildren([uebersichtRoute, vertragRoute, pruefenRoute, unterzeichnenRoute, gateRoute, berichtRoute])] as const;
}
