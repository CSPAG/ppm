/** Modul ziel, Zielerreichung je Quartal (320_zielerreichung, BC ZM.03.01, AP-E6-3). */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

/** Quartal der Testfälle (in der Vergangenheit). */
const Q = '2025-Q3';

export const matrix: Matrix = {
  tables: {
    // braucht das Jahresziel «Probe» aus matrix/ziel-zyklus.ts
    zielerreichung: async (tx, t) => {
      await tx.query("INSERT INTO ppm.zielerreichung (tenant_id, ziel_typ, ziel_id, quartal, stand) SELECT $1, 'jahresziel', id, '2027-Q1', 'Probe' FROM ppm.jahresziel WHERE tenant_id = $1 AND text = 'Probe'", [t]);
      return "stand = 'Probe'";
    },
  },
  policies: [
    // Muster ORG: lesen mit ziel:read, erfassen mit zielerreichung:write
    "ppm.zielerreichung.zielerreichung_read RESTRICTIVE SELECT ppm_app USING app.has_permission('ziel:read'::text) CHECK -",
    "ppm.zielerreichung.zielerreichung_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('zielerreichung:write'::text)",
    "ppm.zielerreichung.zielerreichung_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('zielerreichung:write'::text) CHECK app.has_permission('zielerreichung:write'::text)",
    "ppm.zielerreichung.zielerreichung_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('zielerreichung:write'::text) CHECK -",
  ],
  seed: async (api, a, mark) => {
    // Strategisches Ziel von A aus matrix/ziel.ts (läuft vorher); vergangenes Quartal, damit kein Stand die Aufgabe
    // «Zielerreichung erfassen» des zuletzt abgeschlossenen Quartals öffnet (erreichung-aufgabe.ts)
    const sz = (await api.app.inject({ method: 'GET', url: `/v1/strategische-ziele?q=${encodeURIComponent(mark)}`, headers: a })).json().items[0];
    const r = await api.app.inject({ method: 'POST', url: `/v1/zielerreichung/${Q}`, headers: a, payload: { zielTyp: 'strategisch', zielId: sz.id, stand: mark } });
    assert.equal(r.statusCode, 201, r.body);
    return { zielerreichung: r.json().id };
  },
  cases: {
    // Quartal ist kein Geheimnis: B sieht seine eigenen Ziele ohne die Stände von A
    'GET /v1/zielerreichung/:quartal': () => ({ method: 'GET', url: `/v1/zielerreichung/${Q}`, kind: 'list' }),
    // Jahresziel von A: für B unbekannt → 404
    'POST /v1/zielerreichung/:quartal': i => ({ method: 'POST', url: `/v1/zielerreichung/${Q}`, body: { zielTyp: 'jahresziel', zielId: i.jahresziel, stand: 'GEHEIM-A' }, kind: 'foreign' }),
    'PATCH /v1/zielerreichung/:quartal/:id': i => ({ method: 'PATCH', url: `/v1/zielerreichung/${Q}/${i.zielerreichung}`, body: { stand: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/zielerreichung/:quartal/:id': i => ({ method: 'DELETE', url: `/v1/zielerreichung/${Q}/${i.zielerreichung}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const q = (await api.app.inject({ method: 'GET', url: `/v1/zielerreichung/${Q}`, headers: a })).json();
    const e = q.ziele.filter((z: { eintrag: unknown }) => z.eintrag).map((z: { eintrag: { stand: string; version: number } }) => [z.eintrag.stand, z.eintrag.version]);
    assert.deepEqual(e, [[mark, 1]]);
  },
};
