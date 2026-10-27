/**
 * Register des Projekts (Modul projektdaten, AP-E0-6) lesend für die Projektübersicht (UI-06): je Register eine Abfrage
 * über den typisierten Client. Kosten nur mit `finanzen:read` (A-33): ohne Recht antwortet die API mit 403, die
 * Übersicht lässt den Abschnitt dann weg. Wer `finanzen:read` nirgends hat, fragt gar nicht erst (403 lässt die Sitzung
 * neu prüfen).
 */
import { useQuery } from '@tanstack/react-query';
import { api, statusOf, type Schemas } from '../../api/index.ts';

export type Meilenstein = Schemas['Meilenstein'];
export type Kosten = Schemas['Kosten'];
export type Risiko = Schemas['Risiko'];
export type Abhaengigkeit = Schemas['Abhaengigkeit'];
export type Ressourcenbedarf = Schemas['Ressourcenbedarf'];

export const registerKeys = {
  all: (id: string) => ['projekt', 'register', id] as const,
  register: (id: string, name: string) => ['projekt', 'register', id, name] as const,
};

/** Höchstens so viele Einträge je Register in der Übersicht; mehr zeigt der Hinweis «weitere». */
export const ANZAHL = 200;

const query = { limit: ANZAHL };

export function useMeilensteine(id: string) {
  return useQuery({
    queryKey: registerKeys.register(id, 'meilensteine'),
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/meilensteine', { params: { path: { id }, query }, signal })).data!,
  });
}

export function useRisiken(id: string) {
  return useQuery({
    queryKey: registerKeys.register(id, 'risiken'),
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/risiken', { params: { path: { id }, query }, signal })).data!,
  });
}

/** Kosten oder `null`, wenn die Person keine Beträge sehen darf (403, A-33). `moeglich`: `finanzen:read` irgendwo. */
export function useKosten(id: string, moeglich: boolean) {
  return useQuery({
    queryKey: registerKeys.register(id, 'kosten'),
    enabled: moeglich,
    queryFn: async ({ signal }) => {
      try {
        return (await api.GET('/v1/projekte/{id}/kosten', { params: { path: { id }, query }, signal })).data!;
      } catch (e) {
        if (statusOf(e) === 403) return null;
        throw e;
      }
    },
  });
}

export function useAbhaengigkeiten(id: string) {
  return useQuery({
    queryKey: registerKeys.register(id, 'abhaengigkeiten'),
    queryFn: async ({ signal }) => (await api.GET('/v1/projekte/{id}/abhaengigkeiten', { params: { path: { id }, query }, signal })).data!,
  });
}

/** Anzahl der übrigen Register (KPIs, Stakeholder, Ressourcenbedarf, Meldungen) für die Zusammenfassung. */
export function useWeitere(id: string) {
  return useQuery({
    queryKey: registerKeys.register(id, 'weitere'),
    queryFn: async ({ signal }) => {
      const o = { params: { path: { id }, query }, signal };
      const [kpis, stakeholder, bedarf, meldungen] = await Promise.all([
        api.GET('/v1/projekte/{id}/kpis', o), api.GET('/v1/projekte/{id}/stakeholder', o),
        api.GET('/v1/projekte/{id}/ressourcenbedarf', o), api.GET('/v1/projekte/{id}/meldungen', o),
      ]);
      return { kpis: kpis.data!.items, stakeholder: stakeholder.data!.items, bedarf: bedarf.data!.items, meldungen: meldungen.data!.items };
    },
  });
}
