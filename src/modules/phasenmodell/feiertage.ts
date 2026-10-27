/**
 * Feiertage der Organisation für die Arbeitstage (A-43). Sie gehören dem Modul `stammdaten` (AM.02.02, Tabelle
 * `feiertag (datum, label)` nach docs/fachmodell.md 2.2), das parallel entsteht (AP-E0-2). Bis es eine Abfrage über
 * seine `index.ts` anbietet, liest diese Datei die Tabelle direkt und liefert ohne sie keine Feiertage; danach ersetzt
 * der Aufruf von `stammdaten` diese Abfrage (Folgearbeit im Umsetzungsstand).
 */
import type { Tx } from '@vollholz/platform';
import { SCHEMA } from '../../platform.ts';
import type { Datum } from './arbeitstage.ts';

export async function feiertage(tx: Tx, von: Datum, bis: Datum): Promise<Set<Datum>> {
  const da = (await tx.query<{ t: string | null }>(`SELECT to_regclass('${SCHEMA}.feiertag')::text AS t`)).rows[0]?.t;
  if (!da) return new Set();
  const rows = (await tx.query<{ d: string }>(`SELECT to_char(datum, 'YYYY-MM-DD') AS d FROM ${SCHEMA}.feiertag WHERE tenant_id = app.tenant_id() AND datum BETWEEN $1 AND $2`, [von, bis])).rows;
  return new Set(rows.map(r => r.d));
}
