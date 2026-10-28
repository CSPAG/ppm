/**
 * Kapazität laut HR-System lesen (BC RK.01.02, UC-009 Schritt 1; AP-E7-2): die übernommenen Summen je Rolle und Monat
 * für die Kapazitätsplanung (UI-23) neben dem festgelegten Angebot. Lesen mit `ressource:read` wie das Angebot; die
 * Übernahme selbst läuft über die Schnittstelle «HR-System» (`hr.ts`).
 */
import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { DateTime, invalid, Nullable, type Deps } from '@vollholz/platform';
import { hrList } from './hr.ts';
import { plusMonate } from './rechnung.ts';
import { TAG } from './routes.ts';
import { ZeitraumQuery } from './schemas.ts';

export const KapazitaetHr = Type.Object({
  von: Type.String(),
  bis: Type.String(),
  zellen: Type.Array(Type.Object({
    rolle: Type.String(),
    monat: Type.String(),
    fte: Type.Number({ description: 'Pensum minus Abwesenheit der Personen der Rolle in FTE.' }),
    abwesend: Type.Number({ description: 'Abwesenheit in FTE.' }),
    personen: Type.Integer({ description: 'Anzahl Personen der Rolle im Monat.' }),
  }, { additionalProperties: false }), { description: 'Je Rolle und Monat mit Lieferung des HR-Systems; Monate ohne Lieferung fehlen.' }),
  // letzte Übernahme im Zeitraum; null ohne Lieferung
  uebernommenAt: Nullable(DateTime),
}, { $id: 'KapazitaetHr', additionalProperties: false });
export type KapazitaetHrOut = Static<typeof KapazitaetHr>;

/** Laufender Monat und die elf folgenden, wenn kein Zeitraum angegeben ist (wie das Angebot); höchstens 60 Monate. */
function zeitraum(q: { von?: string; bis?: string }): { von: string; bis: string } {
  const jetzt = new Date();
  const heute = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}`;
  const von = q.von ?? (q.bis ? plusMonate(q.bis, -11) : heute);
  const bis = q.bis ?? plusMonate(von, 11);
  if (bis < von) throw invalid('Der Zeitraum endet vor seinem Beginn.', [{ path: '/bis', message: 'nicht vor «von»' }]);
  if (plusMonate(von, 59) < bis) throw invalid('Der Zeitraum umfasst höchstens 60 Monate.', [{ path: '/bis', message: 'höchstens 60 Monate ab «von»' }]);
  return { von, bis };
}

export function registerHrRoutes(app: FastifyInstance, _deps: Deps): void {
  app.addSchema(KapazitaetHr);

  app.get('/v1/kapazitaet/hr', {
    schema: {
      tags: [TAG], summary: 'Kapazität laut HR-System lesen',
      description: 'Summen der Schnittstelle «HR-System › Personal- und Abwesenheitsdaten» je Rolle und Monat (UC-009 Schritt 1): Pensum minus Abwesenheit und Anzahl Personen, ohne Personendaten. Wo die RM kein Angebot festgelegt hat, zählt dieser Wert in der Auslastung (Annahme AP-E7-2).',
      querystring: ZeitraumQuery, response: { 200: Type.Ref('KapazitaetHr') },
    },
  }, async (req): Promise<KapazitaetHrOut> => {
    await req.need('ressource:read');
    const { von, bis } = zeitraum(req.query as { von?: string; bis?: string });
    const rows = await req.tx(tx => hrList(tx, von, bis));
    const zuletzt = rows.reduce<Date | null>((m, r) => (!m || r.uebernommen_at > m ? r.uebernommen_at : m), null);
    return { von, bis, zellen: rows.map(r => ({ rolle: r.rolle, monat: r.monat, fte: r.fte, abwesend: r.abwesend, personen: r.personen })), uebernommenAt: zuletzt?.toISOString() ?? null };
  });
}
