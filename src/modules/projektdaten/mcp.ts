/**
 * Werkzeug des MCP-Dienstes für die Register: nur lesend über die REST-API (keine zweite Fachlogik, keine Datenbank).
 * Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

/** Register und ihre Pfade unter `/v1/projekte/:id/`. */
const REGISTER = {
  meilensteine: 'meilensteine', kosten: 'kosten', risiken: 'risiken', kpis: 'kpis', stakeholder: 'stakeholder',
  abhaengigkeiten: 'abhaengigkeiten', ressourcenbedarf: 'ressourcenbedarf', meldungen: 'meldungen',
} as const;
type Name = keyof typeof REGISTER;

export const projektdatenTools: Record<string, ToolDef> = {
  get_projektdaten: {
    description: 'Register eines Projekts lesen: Meilensteine und Kommunikationsmassnahmen, Kosten (nur mit Recht auf Beträge, sonst null), '
      + 'Risiken, KPIs, Stakeholder, Abhängigkeiten (in beide Richtungen), Ressourcenbedarf und Meldungen an ICT/Infrastruktur. Je Register höchstens 200 Einträge.',
    input: {
      id: z.string().uuid().describe('ID des Projekts (list_projekte)'),
      register: z.array(z.enum(Object.keys(REGISTER) as [Name, ...Name[]])).optional().describe('Nur diese Register; ohne Angabe alle'),
      organisation: organisationArg,
    },
    call: async (org, a) => {
      const id = encodeURIComponent(a.id);
      const namen = (a.register as Name[] | undefined) ?? (Object.keys(REGISTER) as Name[]);
      const out: Record<string, unknown> = {};
      for (const n of namen) {
        try {
          out[n] = (await org.api.get<{ items: unknown[] }>(`/v1/projekte/${id}/${REGISTER[n]}`, { limit: 200 })).items;
        } catch (e) {
          // Ohne Recht auf Beträge (403) bleiben die Kosten leer; andere Fehler (z. B. 404) gelten für das ganze Werkzeug
          if (n === 'kosten' && (e as { status?: number }).status === 403) out[n] = null;
          else throw e;
        }
      }
      return out;
    },
  },
};
