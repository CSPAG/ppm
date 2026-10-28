/** Modul jahresrueckblick (380_jahresrueckblick; BC ZM.03.03, UC-013, AP-E7-5): Jahresrückblick je Jahr. */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    jahresrueckblick: async (tx, t) => {
      await tx.query("INSERT INTO ppm.jahresrueckblick (tenant_id, jahr, erkenntnisse) VALUES ($1, 2001, 'Probe')", [t]);
      return "erkenntnisse = 'Probe'";
    },
  },
  policies: [
    // Muster ORG: lesen mit ziel:read (oder quartalsbericht:write), erfassen mit quartalsbericht:write
    "ppm.jahresrueckblick.jahresrueckblick_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('quartalsbericht:write'::text)",
    "ppm.jahresrueckblick.jahresrueckblick_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('ziel:read'::text) OR app.has_permission('quartalsbericht:write'::text)) CHECK -",
    "ppm.jahresrueckblick.jahresrueckblick_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('quartalsbericht:write'::text) CHECK app.has_permission('quartalsbericht:write'::text)",
  ],
  tags: ['Jahresrückblick'],
  // Jahresrückblick 2030 von A mit Erkenntnissen
  seed: async (api, a, mark) => {
    const r = await api.app.inject({ method: 'PUT', url: '/v1/jahresrueckblicke/2030', headers: a, payload: { erkenntnisse: mark, massnahmen: '' } });
    assert.equal(r.statusCode, 200, r.body);
    return {};
  },
  // Das Jahr ist kein Geheimnis: B sieht und erfasst nur seinen eigenen Rückblick
  cases: {
    'GET /v1/jahresrueckblicke/:jahr': () => ({ method: 'GET', url: '/v1/jahresrueckblicke/2030', kind: 'list' }),
    'PUT /v1/jahresrueckblicke/:jahr': () => ({ method: 'PUT', url: '/v1/jahresrueckblicke/2031', body: { erkenntnisse: 'B', massnahmen: '' }, kind: 'create' }),
    // B hat für 2030 keinen Rückblick: 404 wie für ein unbekanntes Jahr
    // B hat keine Vorhaben ohne Lessons Learned: legt seinen eigenen Rückblick an, keine Aufgabe zu Projekten von A
    'POST /v1/jahresrueckblicke/:jahr/lessons-learned/anfordern': () => ({ method: 'POST', url: '/v1/jahresrueckblicke/2032/lessons-learned/anfordern', kind: 'create' }),
    // B hat für 2030 keinen Rückblick: 404 wie für ein unbekanntes Jahr
    'GET /v1/jahresrueckblicke/:jahr/dokument': () => ({ method: 'GET', url: '/v1/jahresrueckblicke/2030/dokument', kind: 'foreign' }),
    'POST /v1/jahresrueckblicke/:jahr/traktandieren': () => ({ method: 'POST', url: '/v1/jahresrueckblicke/2029/traktandieren', kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const r = (await api.app.inject({ method: 'GET', url: '/v1/jahresrueckblicke/2030', headers: a })).json();
    assert.deepEqual([r.stand, r.erkenntnisse, r.version], ['in_arbeit', mark, 1]);
  },
};
