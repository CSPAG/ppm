/**
 * Werkzeug des MCP-Dienstes für die Lessons Learned: nur lesend über die REST-API (keine zweite Fachlogik, keine
 * Datenbank). Name, Titel, Recht und `readOnly` stehen im Modell (`mcpTools`); hier Beschreibung, Eingaben und Aufruf.
 */
import { organisationArg, type ToolDef } from '@vollholz/platform';
import { z } from 'zod';

export const abschlussTools: Record<string, ToolDef> = {
  list_lessons_learned: {
    description: 'Lessons Learned der sichtbaren Projekte auflisten (neueste zuerst), mit Projekt, Kategorie und Jahr der Erfassung; '
      + 'Filter Jahr, Projektnummer, Kategorie und Suche im Text.',
    input: {
      jahr: z.number().int().min(2000).max(2100).optional().describe('Jahr der Erfassung'),
      projekt: z.string().max(20).optional().describe('Projektnummer, z. B. «2026-014»'),
      kategorie: z.string().max(100).optional().describe('Kategorie'),
      q: z.string().max(200).optional().describe('Suche in Text, Projektname und -nummer'),
      cursor: z.string().max(500).optional(),
      organisation: organisationArg,
    },
    call: async (org, a) => {
      const qs = new URLSearchParams();
      for (const k of ['jahr', 'projekt', 'kategorie', 'q', 'cursor'] as const) if (a[k] !== undefined) qs.set(k, String(a[k]));
      return org.api.get(`/v1/lessons-learned${qs.size ? `?${qs}` : ''}`);
    },
  },
};
