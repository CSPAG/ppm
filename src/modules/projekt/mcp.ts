/**
 * Werkzeuge des MCP-Dienstes für Projekte: nur lesend über die REST-API (keine zweite Fachlogik, keine Datenbank). Name,
 * Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const projektTools: Record<string, ToolDef> = {
  list_projekte: {
    description: 'Projekte der Organisation auflisten (Nummer, Name, Portfolio, Phase, Lebenszyklus, Sponsor und Projektleitung), sortiert nach Nummer, mit Filtern und Seiten.',
    input: {
      q: z.string().max(200).optional().describe('Suche in Name und Nummer'),
      portfolio: z.string().max(40).optional().describe('Schlüssel des Portfolios, z. B. transformation'),
      phase: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']).optional(),
      rolle: z.enum(['sp', 'pl', 'ctl', 'kt', 'koalition']).optional().describe('Nur Projekte, in denen die angemeldete Person diese Funktion hat'),
      cursor: z.string().max(512).optional().describe('nextCursor der vorherigen Seite'),
      limit: z.number().int().min(1).max(200).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => (await org.api.call('GET', '/v1/projekte', { query: { q: a.q, portfolio: a.portfolio, phase: a.phase, rolle: a.rolle, cursor: a.cursor, limit: a.limit } })).body,
  },
  get_projekt: {
    description: 'Ein Projekt mit Kopfdaten und Projektorganisation (Sponsor, Koalition, Projektleitung, CTL, Kernteam mit AKV) lesen.',
    input: { id: z.string().uuid().describe('ID des Projekts'), organisation: organisationArg },
    call: async (org, a) => {
      const id = encodeURIComponent(a.id);
      const projekt = (await org.api.call('GET', `/v1/projekte/${id}`)).body;
      const projektorganisation = (await org.api.call('GET', `/v1/projekte/${id}/organisation`)).body;
      return { projekt, projektorganisation };
    },
  },
};
