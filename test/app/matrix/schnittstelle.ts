/** Modul schnittstelle (360_schnittstelle, BC AM.03.02, AM.03.03, AP-E7-3): Schnittstellen, Läufe, Änderungsprotokoll. */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

/** Inaktiv angelegt: kein Testlauf, keine Aufgabe im Eingang von A (matrix/eingang.ts). Adresse ohne Namensauflösung. */
const SEED = { umsystem: 'hr', daten: 'personal', rhythmus: 'manuell', adresse: 'http://127.0.0.1:9/geheim-a', aktiv: false };

export const matrix: Matrix = {
  tables: {
    schnittstelle: async (tx, t) => {
      await tx.query("INSERT INTO ppm.schnittstelle (tenant_id, umsystem, daten, richtung, rhythmus, adresse, aktiv) VALUES ($1, 'erp', 'ist_kosten', 'eingehend', 'monatlich', 'https://erp.example/probe', false)", [t]);
      return "adresse = 'https://erp.example/probe'";
    },
    schnittstelle_lauf: async (tx, t) => {
      await tx.query(
        `INSERT INTO ppm.schnittstelle_lauf (tenant_id, schnittstelle_id, art, stand, ende, umfang)
         SELECT $1, id, 'test', 'erfolgreich', now(), 7 FROM ppm.schnittstelle WHERE tenant_id = $1 AND adresse = 'https://erp.example/probe'`, [t]);
      return 'umfang = 7';
    },
  },
  policies: [
    // Muster ORG mit schnittstelle:admin (fachmodell.md 3.2, 3.4)
    "ppm.schnittstelle.schnittstelle_read RESTRICTIVE SELECT ppm_app USING app.has_permission('schnittstelle:admin'::text) CHECK -",
    "ppm.schnittstelle.schnittstelle_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('schnittstelle:admin'::text)",
    "ppm.schnittstelle.schnittstelle_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('schnittstelle:admin'::text) CHECK app.has_permission('schnittstelle:admin'::text)",
    "ppm.schnittstelle_lauf.schnittstelle_lauf_read RESTRICTIVE SELECT ppm_app USING app.has_permission('schnittstelle:admin'::text) CHECK -",
    "ppm.schnittstelle_lauf.schnittstelle_lauf_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('schnittstelle:admin'::text)",
    "ppm.schnittstelle_lauf.schnittstelle_lauf_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('schnittstelle:admin'::text) CHECK app.has_permission('schnittstelle:admin'::text)",
  ],
  tags: ['Schnittstellen', 'Änderungsprotokoll'],
  seed: async (api, a) => {
    const r = await api.app.inject({ method: 'POST', url: '/v1/schnittstellen', headers: a, payload: SEED });
    assert.equal(r.statusCode, 201, r.body);
    return { schnittstelle: r.json().schnittstelle.id };
  },
  cases: {
    'GET /v1/schnittstellen': () => ({ method: 'GET', url: '/v1/schnittstellen', kind: 'list' }),
    'POST /v1/schnittstellen': () => ({ method: 'POST', url: '/v1/schnittstellen', body: { ...SEED, adresse: 'http://127.0.0.1:9/b' }, kind: 'create' }),
    'GET /v1/schnittstellen/:id': i => ({ method: 'GET', url: `/v1/schnittstellen/${i.schnittstelle}`, kind: 'foreign' }),
    'PATCH /v1/schnittstellen/:id': i => ({ method: 'PATCH', url: `/v1/schnittstellen/${i.schnittstelle}`, body: { aktiv: true }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/schnittstellen/:id/laeufe': i => ({ method: 'GET', url: `/v1/schnittstellen/${i.schnittstelle}/laeufe`, kind: 'foreign' }),
    'POST /v1/schnittstellen/:id/starten': i => ({ method: 'POST', url: `/v1/schnittstellen/${i.schnittstelle}/starten`, kind: 'foreign' }),
    // Das Audit von A bleibt für B unsichtbar. Gefiltert auf Schnittstellen: Das ganze Protokoll von B enthält zu Recht
    // eigene Kennungen, die in den Seeds stehen (Vertretung von B aus matrix/eingang.ts)
    'GET /v1/aenderungsprotokoll': () => ({ method: 'GET', url: '/v1/aenderungsprotokoll?objekt=schnittstelle&limit=200', kind: 'list' }),
    'GET /v1/aenderungsprotokoll/objekte': () => ({ method: 'GET', url: '/v1/aenderungsprotokoll/objekte', kind: 'list' }),
  },
  unchanged: async (api, a) => {
    const r = (await api.app.inject({ method: 'GET', url: '/v1/schnittstellen', headers: a })).json().items as { adresse: string; aktiv: boolean; version: number; letzterLauf: unknown }[];
    assert.deepEqual(r.map(s => [s.adresse, s.aktiv, s.version, s.letzterLauf]), [[SEED.adresse, false, 1, null]]);
  },
};
