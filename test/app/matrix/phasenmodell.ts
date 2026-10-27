/** Modul phasenmodell (030_phasenmodell, BC AM.02.03): ein Entwurf mit je einem Kind; Kinder nur im Entwurf änderbar. */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

const KINDER = ['phase', 'gate', 'leitfrage', 'standard_ergebnis', 'pflichtangabe', 'kapitel_wirkung', 'frist', 'toleranz'];

export const matrix: Matrix = {
  tables: {
    phasenmodell: async (tx, t) => { await tx.query("INSERT INTO ppm.phasenmodell (tenant_id, nummer, beschreibung) VALUES ($1, 1, 'Probe')", [t]); return "beschreibung = 'Probe'"; },
    phase: async (tx, t) => {
      await tx.query("INSERT INTO ppm.phase (tenant_id, phasenmodell_id, code, name, position) SELECT $1, id, c, c, 0 FROM ppm.phasenmodell, unnest(ARRAY['P0', 'P1']) c WHERE tenant_id = $1", [t]);
      return "code = 'P0'";
    },
    gate: async (tx, t) => {
      await tx.query("INSERT INTO ppm.gate (tenant_id, phasenmodell_id, code, name, von_phase, nach_phase, position) SELECT $1, id, 'P0_P1', 'Probe', 'P0', 'P1', 0 FROM ppm.phasenmodell WHERE tenant_id = $1", [t]);
      return "code = 'P0_P1'";
    },
    leitfrage: async (tx, t) => {
      await tx.query("INSERT INTO ppm.leitfrage (tenant_id, phasenmodell_id, gate_code, wertestrom, position, text) SELECT $1, id, 'P0_P1', 'nutzen', 0, 'Probe' FROM ppm.phasenmodell WHERE tenant_id = $1", [t]);
      return "text = 'Probe'";
    },
    standard_ergebnis: async (tx, t) => {
      await tx.query("INSERT INTO ppm.standard_ergebnis (tenant_id, phasenmodell_id, phase_code, art, position, text) SELECT $1, id, 'P0', 'meilenstein', 0, 'Probe' FROM ppm.phasenmodell WHERE tenant_id = $1", [t]);
      return "text = 'Probe'";
    },
    pflichtangabe: async (tx, t) => {
      await tx.query("INSERT INTO ppm.pflichtangabe (tenant_id, phasenmodell_id, gate_code, kapitel, feld, position, text) SELECT $1, id, 'P0_P1', 9, 'kosten', 0, 'Probe' FROM ppm.phasenmodell WHERE tenant_id = $1", [t]);
      return "text = 'Probe'";
    },
    kapitel_wirkung: async (tx, t) => {
      await tx.query("INSERT INTO ppm.kapitel_wirkung (tenant_id, phasenmodell_id, kapitel, dimension) SELECT $1, id, 9, 'budget' FROM ppm.phasenmodell WHERE tenant_id = $1", [t]);
      return "dimension = 'budget'";
    },
    frist: async (tx, t) => {
      await tx.query("INSERT INTO ppm.frist (tenant_id, phasenmodell_id, schluessel, wert, einheit) SELECT $1, id, 'versand', 5, 'arbeitstage' FROM ppm.phasenmodell WHERE tenant_id = $1", [t]);
      return "schluessel = 'versand'";
    },
    toleranz: async (tx, t) => {
      await tx.query("INSERT INTO ppm.toleranz (tenant_id, phasenmodell_id, dimension, wert, einheit) SELECT $1, id, 'kosten', 10, 'prozent' FROM ppm.phasenmodell WHERE tenant_id = $1", [t]);
      return "dimension = 'kosten'";
    },
  },
  policies: [
    // Lesesicht: Recht an der Organisation; Kinder nur im Entwurf änderbar
    "ppm.phasenmodell.phasenmodell_read RESTRICTIVE SELECT ppm_app USING app.has_permission('phasenmodell:read'::text) CHECK -",
    "ppm.phasenmodell.phasenmodell_insert RESTRICTIVE INSERT ppm_app USING - CHECK (app.has_permission('phasenmodell:write'::text) AND (stand = 'entwurf'::text))",
    "ppm.phasenmodell.phasenmodell_update RESTRICTIVE UPDATE ppm_app USING (app.has_permission('phasenmodell:write'::text) OR app.has_permission('phasenmodell:activate'::text)) CHECK (app.has_permission('phasenmodell:write'::text) OR app.has_permission('phasenmodell:activate'::text))",
    "ppm.phasenmodell.phasenmodell_delete RESTRICTIVE DELETE ppm_app USING (app.has_permission('phasenmodell:write'::text) AND (stand = 'entwurf'::text)) CHECK -",
    ...KINDER.flatMap(t => {
      const entwurf = `(app.has_permission('phasenmodell:write'::text) AND (EXISTS ( SELECT 1 FROM ppm.phasenmodell m WHERE ((m.tenant_id = ${t}.tenant_id) AND (m.id = ${t}.phasenmodell_id) AND (m.stand = 'entwurf'::text)))))`;
      return [
        `ppm.${t}.${t}_read RESTRICTIVE SELECT ppm_app USING app.has_permission('phasenmodell:read'::text) CHECK -`,
        `ppm.${t}.${t}_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${entwurf}`,
        `ppm.${t}.${t}_update RESTRICTIVE UPDATE ppm_app USING ${entwurf} CHECK ${entwurf}`,
        `ppm.${t}.${t}_delete RESTRICTIVE DELETE ppm_app USING ${entwurf} CHECK -`,
      ];
    }),
  ],
  tags: ['Phasenmodell'],
  // Phasenmodell von A in Kraft (Version 2 nach dem In-Kraft-Setzen)
  seed: async (api, a, mark) => {
    const p = await api.app.inject({ method: 'POST', url: '/v1/phasenmodelle', headers: a, payload: { beschreibung: mark } });
    assert.equal(p.statusCode, 201, p.body);
    const k = await api.app.inject({ method: 'POST', url: `/v1/phasenmodelle/${p.json().id}/in-kraft-setzen`, headers: { ...a, 'if-match': p.headers.etag as string } });
    assert.equal(k.statusCode, 200, k.body);
    return { phasenmodell: p.json().id };
  },
  cases: {
    'GET /v1/phasenmodelle': () => ({ method: 'GET', url: '/v1/phasenmodelle', kind: 'list' }),
    'POST /v1/phasenmodelle': () => ({ method: 'POST', url: '/v1/phasenmodelle', body: { beschreibung: 'B' }, kind: 'create' }),
    'GET /v1/phasenmodelle/aktuell': () => ({ method: 'GET', url: '/v1/phasenmodelle/aktuell', kind: 'foreign' }),
    'GET /v1/phasenmodelle/:id': i => ({ method: 'GET', url: `/v1/phasenmodelle/${i.phasenmodell}`, kind: 'foreign' }),
    'PATCH /v1/phasenmodelle/:id': i => ({ method: 'PATCH', url: `/v1/phasenmodelle/${i.phasenmodell}`, body: { beschreibung: 'gehackt' }, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'DELETE /v1/phasenmodelle/:id': i => ({ method: 'DELETE', url: `/v1/phasenmodelle/${i.phasenmodell}`, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'POST /v1/phasenmodelle/:id/in-kraft-setzen': i => ({ method: 'POST', url: `/v1/phasenmodelle/${i.phasenmodell}/in-kraft-setzen`, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const pm = (await api.app.inject({ method: 'GET', url: '/v1/phasenmodelle/aktuell', headers: a })).json();
    assert.deepEqual([pm.beschreibung, pm.stand, pm.version], [mark, 'in_kraft', 2]);
  },
};
