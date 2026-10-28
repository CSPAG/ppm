/** Modul finanzen (370_finanzen, BC PC.01.02, PC.01.04, PC.01.05, AP-E7-4): Kostenträger, Ist-Kosten, Begründungen, Budgetübergabe. */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

/** Projekt «Probe» (2026-001) aus matrix/projekt.ts. */
const PROBE = "(SELECT id FROM ppm.projekt WHERE nummer = '2026-001')";
const PERIODE = '2026-01';

export const matrix: Matrix = {
  tables: {
    kostentraeger: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.kostentraeger (tenant_id, projekt_id, nummer) VALUES ($1, ${PROBE}, 'KT-PROBE')`, [t]);
      return "nummer = 'KT-PROBE'";
    },
    ist_kosten: async (tx, t) => {
      await tx.query("INSERT INTO ppm.ist_kosten (tenant_id, kostentraeger, monat, art, betrag) VALUES ($1, 'KT-PROBE', '2026-01', 'opex', 4711)", [t]);
      return 'betrag = 4711';
    },
    abweichung_begruendung: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.abweichung_begruendung (tenant_id, projekt_id, periode, text) VALUES ($1, ${PROBE}, '2026-01', 'Probe')`, [t]);
      return "text = 'Probe'";
    },
    budgetuebergabe: async (tx, t) => {
      await tx.query("INSERT INTO ppm.budgetuebergabe (tenant_id, jahr) VALUES ($1, 2001)", [t]);
      return 'jahr = 2001';
    },
  },
  policies: [
    // BETRAG (fachmodell.md 3.4) über ppm.betrag_sichtbar; schreiben FI (finanzen:write), PL begründet, die Schnittstelle übernimmt
    "ppm.abweichung_begruendung.abweichung_begruendung_delete RESTRICTIVE DELETE ppm_app USING (app.has_permission('projekt:write'::text, 'projekt'::text, projekt_id) OR app.has_permission('finanzen:write'::text)) CHECK -",
    "ppm.abweichung_begruendung.abweichung_begruendung_insert RESTRICTIVE INSERT ppm_app USING - CHECK (ppm.betrag_sichtbar(projekt_id) AND (app.has_permission('projekt:write'::text, 'projekt'::text, projekt_id) OR app.has_permission('finanzen:write'::text)))",
    'ppm.abweichung_begruendung.abweichung_begruendung_read RESTRICTIVE SELECT ppm_app USING ppm.betrag_sichtbar(projekt_id) CHECK -',
    "ppm.abweichung_begruendung.abweichung_begruendung_update RESTRICTIVE UPDATE ppm_app USING (app.has_permission('projekt:write'::text, 'projekt'::text, projekt_id) OR app.has_permission('finanzen:write'::text)) CHECK (app.has_permission('projekt:write'::text, 'projekt'::text, projekt_id) OR app.has_permission('finanzen:write'::text))",
    "ppm.budgetuebergabe.budgetuebergabe_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('finanzen:write'::text) CHECK -",
    "ppm.budgetuebergabe.budgetuebergabe_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('finanzen:write'::text)",
    "ppm.budgetuebergabe.budgetuebergabe_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('finanzen:read'::text) OR app.has_permission('schnittstelle:admin'::text)) CHECK -",
    "ppm.budgetuebergabe.budgetuebergabe_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('finanzen:write'::text) CHECK app.has_permission('finanzen:write'::text)",
    "ppm.ist_kosten.ist_kosten_delete RESTRICTIVE DELETE ppm_app USING (app.has_permission('finanzen:write'::text) OR app.has_permission('schnittstelle:admin'::text)) CHECK -",
    "ppm.ist_kosten.ist_kosten_insert RESTRICTIVE INSERT ppm_app USING - CHECK (app.has_permission('finanzen:write'::text) OR app.has_permission('schnittstelle:admin'::text))",
    "ppm.ist_kosten.ist_kosten_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('finanzen:read'::text) OR app.has_permission('schnittstelle:admin'::text) OR (EXISTS ( SELECT 1 FROM ppm.kostentraeger k WHERE ((k.nummer = ist_kosten.kostentraeger) AND ppm.betrag_sichtbar(k.projekt_id))))) CHECK -",
    "ppm.ist_kosten.ist_kosten_update RESTRICTIVE UPDATE ppm_app USING (app.has_permission('finanzen:write'::text) OR app.has_permission('schnittstelle:admin'::text)) CHECK (app.has_permission('finanzen:write'::text) OR app.has_permission('schnittstelle:admin'::text))",
    "ppm.kostentraeger.kostentraeger_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('finanzen:write'::text) CHECK -",
    "ppm.kostentraeger.kostentraeger_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('finanzen:write'::text)",
    "ppm.kostentraeger.kostentraeger_read RESTRICTIVE SELECT ppm_app USING (ppm.betrag_sichtbar(projekt_id) OR app.has_permission('finanzen:write'::text)) CHECK -",
    "ppm.kostentraeger.kostentraeger_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('finanzen:write'::text) CHECK app.has_permission('finanzen:write'::text)",
  ],
  tags: ['Finanzen'],
  seed: async (api, a, mark) => {
    // Projekt von A aus matrix/projektdaten.ts (Name = Markierung)
    const t = await tenant(api.t.runtime, 'acme');
    const projekt = await full(api.t.runtime, t, async tx => (await tx.query<{ id: string }>('SELECT id FROM ppm.projekt WHERE name = $1', [mark])).rows[0]!.id);
    const call = (method: 'PUT' | 'POST', url: string, payload: Record<string, unknown> | undefined, h: Record<string, string> = {}) =>
      api.app.inject({ method, url, headers: { ...a, ...h }, ...(payload ? { payload } : {}) });
    const kt = await call('PUT', `/v1/projekte/${projekt}/kostentraeger`, { nummer: 'KT-A-1' });
    assert.equal(kt.statusCode, 200, kt.body);
    const b = await call('PUT', `/v1/projekte/${projekt}/abweichungsbegruendungen/${PERIODE}`, { text: mark }, { 'if-match': 'W/"0"' });
    assert.equal(b.statusCode, 200, b.body);
    const u = await call('PUT', '/v1/budgetuebergaben/2027', { korrekturen: [{ projektId: projekt, capex: 1, opex: null, bemerkung: mark }] }, { 'if-match': 'W/"0"' });
    assert.equal(u.statusCode, 200, u.body);
    // Übergeben: erledigt die Aufgabe «Jahresbedarf übergeben» (der Eingang von A zeigt nur die Markierung, matrix/eingang.ts)
    const x = await call('POST', '/v1/budgetuebergaben/2027/export', undefined, { 'if-match': 'W/"1"' });
    assert.equal(x.statusCode, 200, x.body);
    return { finanzProjekt: projekt };
  },
  cases: {
    'GET /v1/finanzen': () => ({ method: 'GET', url: '/v1/finanzen', kind: 'list' }),
    'GET /v1/finanzen/abweichungen': () => ({ method: 'GET', url: '/v1/finanzen/abweichungen', kind: 'list' }),
    'PUT /v1/projekte/:id/kostentraeger': i => ({ method: 'PUT', url: `/v1/projekte/${i.finanzProjekt}/kostentraeger`, body: { nummer: 'KT-B' }, kind: 'foreign' }),
    'GET /v1/projekte/:id/abweichungsbegruendungen': i => ({ method: 'GET', url: `/v1/projekte/${i.finanzProjekt}/abweichungsbegruendungen`, kind: 'foreign' }),
    'PUT /v1/projekte/:id/abweichungsbegruendungen/:periode': i => ({
      method: 'PUT', url: `/v1/projekte/${i.finanzProjekt}/abweichungsbegruendungen/${PERIODE}`, body: { text: 'B' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign',
    }),
    'GET /v1/budgetuebergaben/:jahr': () => ({ method: 'GET', url: '/v1/budgetuebergaben/2027', kind: 'list' }),
    'PUT /v1/budgetuebergaben/:jahr': () => ({ method: 'PUT', url: '/v1/budgetuebergaben/2028', body: { korrekturen: [] }, kind: 'create' }),
    'POST /v1/budgetuebergaben/:jahr/export': () => ({ method: 'POST', url: '/v1/budgetuebergaben/2029/export', kind: 'create' }),
  },
  unchanged: async (api, a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const rows = await full(api.t.runtime, t, async tx => (await tx.query<{ x: string }>(
      `SELECT k.nummer || ':' || k.version || ':' || b.version || ':' || u.version AS x FROM ppm.kostentraeger k
       JOIN ppm.abweichung_begruendung b ON b.projekt_id = k.projekt_id AND b.text = $1 JOIN ppm.budgetuebergabe u ON u.jahr = 2027`, [mark])).rows.map(r => r.x));
    assert.deepEqual(rows, ['KT-A-1:1:1:2']);
  },
};
