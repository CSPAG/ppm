/** Modul statusbericht (090_statusbericht; BC PS.01.01, AP-E1-1): Periode und Statusbericht je Projekt. */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

/** Periode der Testfälle: der laufende Monat (spätere Perioden haben noch nicht begonnen). */
const periode = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);

export const matrix: Matrix = {
  tables: {
    periode: async (tx, t) => {
      await tx.query("INSERT INTO ppm.periode (tenant_id, periode) VALUES ($1, '2026-01')", [t]);
      return "periode = '2026-01'";
    },
    // braucht das Projekt «Probe» aus matrix/projekt.ts
    statusbericht: async (tx, t) => {
      await tx.query("INSERT INTO ppm.statusbericht (tenant_id, projekt_id, periode, phase, entscheide) SELECT $1, id, '2026-01', 'P1', 'Probe' FROM ppm.projekt WHERE nummer = '2026-001'", [t]);
      return "entscheide = 'Probe'";
    },
  },
  policies: [
    // Periode: lesen alle der Organisation, offen anlegen, abschliessen mit periode:close (fachmodell.md 3.4, Muster ORG)
    "ppm.periode.periode_insert RESTRICTIVE INSERT ppm_app USING - CHECK (stand = 'offen'::text)",
    "ppm.periode.periode_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('periode:close'::text) CHECK app.has_permission('periode:close'::text)",
    // Statusbericht, Muster KIND (Schreiben statusbericht:write, Prüfung statusbericht:review)
    'ppm.statusbericht.statusbericht_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.statusbericht.statusbericht_insert RESTRICTIVE INSERT ppm_app USING - CHECK ppm.recht_am_projekt('statusbericht:write'::text, projekt_id)",
    "ppm.statusbericht.statusbericht_update RESTRICTIVE UPDATE ppm_app USING (ppm.recht_am_projekt('statusbericht:write'::text, projekt_id) OR app.has_permission('statusbericht:review'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id))) CHECK (ppm.recht_am_projekt('statusbericht:write'::text, projekt_id) OR app.has_permission('statusbericht:review'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id)))",
  ],
  tags: ['Statusberichte'],
  seed: async (api, a, mark) => {
    // Projekt von A direkt in der Datenbank (Routen der Projekte: AP-E0-4); A hat die Rolle UE an der Organisation
    const t = await tenant(api.t.runtime, 'acme');
    const projekt = await full(api.t.runtime, t, async tx => {
      const pf = (await tx.query<{ id: string }>(
        "INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'bericht', 'Bericht', true) RETURNING id", [t])).rows[0]!.id;
      return (await tx.query<{ id: string }>(
        "INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, '2026-951', $2, $3, 'P1') RETURNING id", [t, mark, pf])).rows[0]!.id;
    });
    const s = await api.app.inject({ method: 'PUT', url: `/v1/projekte/${projekt}/berichte/${periode()}`, headers: { ...a, 'if-match': 'W/"0"' }, payload: { entscheide: mark } });
    assert.equal(s.statusCode, 200, s.body);
    return { berichtProjekt: projekt };
  },
  cases: {
    // Kopfkarte «Meine Projekte»: fremde Projekte entfallen (Liste ohne IDs von A)
    'GET /v1/statusberichte/stand': i => ({ method: 'GET', url: `/v1/statusberichte/stand?projektId=${i.berichtProjekt}`, kind: 'list' }),
    'GET /v1/projekte/:id/berichte': i => ({ method: 'GET', url: `/v1/projekte/${i.berichtProjekt}/berichte`, kind: 'foreign' }),
    'GET /v1/projekte/:id/berichte/:periode': i => ({ method: 'GET', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}`, kind: 'foreign' }),
    'GET /v1/projekte/:id/berichte/:periode/verlauf': i => ({ method: 'GET', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}/verlauf`, kind: 'foreign' }),
    'PUT /v1/projekte/:id/berichte/:periode': i => ({ method: 'PUT', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}`, body: { entscheide: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/projekte/:id/berichte/:periode/einreichen': i => ({ method: 'POST', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}/einreichen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/projekte/:id/berichte/:periode/zurueckziehen': i => ({ method: 'POST', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}/zurueckziehen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const rows = await full(api.t.runtime, t, async tx => (await tx.query<{ entscheide: string; version: number; stand: string }>(
      "SELECT b.entscheide, b.version, b.stand FROM ppm.statusbericht b JOIN ppm.projekt p ON p.id = b.projekt_id WHERE p.nummer = '2026-951' AND p.name = $1", [mark])).rows);
    assert.deepEqual(rows, [{ entscheide: mark, version: 1, stand: 'entwurf' }]);
    void a;
  },
};
