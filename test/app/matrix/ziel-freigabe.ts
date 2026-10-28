/** Modul ziel, Freigabe und Roadmap (310_freigabe_roadmap, BC ZM.02.02, PP.04.03, AP-E6-2). */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    // braucht das Zieljahr 2027 aus matrix/ziel-zyklus.ts
    roadmap: async (tx, t) => {
      await tx.query("INSERT INTO ppm.roadmap (tenant_id, jahr, inhalt) VALUES ($1, 2027, '{\"jahr\": 2027, \"handlungsfelder\": []}')", [t]);
      return 'jahr = 2027';
    },
  },
  policies: [
    // Muster ORG; Lesen nach Publikation für alle angemeldeten Personen (A-35)
    "ppm.roadmap.roadmap_read RESTRICTIVE SELECT ppm_app USING app.has_permission('tenant:read'::text) CHECK -",
    "ppm.roadmap.roadmap_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ziel:freigabe'::text)",
    "ppm.roadmap.roadmap_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('ziel:freigabe'::text) CHECK app.has_permission('ziel:freigabe'::text)",
    "ppm.roadmap.roadmap_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ziel:freigabe'::text) CHECK -",
  ],
  seed: async (api, a, mark) => {
    const call = async (method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) => {
      const r = await api.app.inject({ method: method as 'POST', url, headers: { ...a, ...headers }, ...(payload ? { payload: payload as object } : {}) });
      assert.ok(r.statusCode < 300, `${method} ${url}: ${r.body}`);
      return r;
    };
    // strategisches Ziel von A aus matrix/ziel.ts; Zielzyklus 2029 bis zur publizierten Roadmap
    const ziele = (await call('GET', `/v1/strategische-ziele?q=${encodeURIComponent(mark)}`)).json().items as { id: string }[];
    await call('POST', '/v1/ziele/2029', {});
    await call('POST', '/v1/jahresziele', { jahr: 2029, strategischesZielId: ziele[0]!.id, text: mark, metrik: 'Anzahl', zielwert: '1' });
    const v = (await call('POST', '/v1/ziele/2029/vorlegen', undefined, { 'if-match': 'W/"1"' })).json().version as number;
    await call('POST', '/v1/ziele/2029/freigabe', { entscheid: 'freigegeben', datum: '2028-12-01' }, { 'if-match': `W/"${v}"` });
    await call('POST', '/v1/roadmap/2029');
    return {};
  },
  cases: {
    // Jahre sind keine Geheimnisse: B hat keinen Zielzyklus 2029 (404), Liste und Vorschau zeigen nur B
    'GET /v1/ziele/:jahr/vorlage': () => ({ method: 'GET', url: '/v1/ziele/2029/vorlage', kind: 'foreign' }),
    'POST /v1/ziele/:jahr/vorlegen': () => ({ method: 'POST', url: '/v1/ziele/2029/vorlegen', headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'POST /v1/ziele/:jahr/freigabe': () => ({ method: 'POST', url: '/v1/ziele/2029/freigabe', body: { entscheid: 'anpassungen', datum: '2028-12-01', text: 'gehackt' }, headers: { 'if-match': 'W/"3"' }, kind: 'foreign' }),
    'GET /v1/roadmap': () => ({ method: 'GET', url: '/v1/roadmap', kind: 'list' }),
    'GET /v1/roadmap/:jahr': () => ({ method: 'GET', url: '/v1/roadmap/2029', kind: 'foreign' }),
    'GET /v1/roadmap/:jahr/vorschau': () => ({ method: 'GET', url: '/v1/roadmap/2029/vorschau', kind: 'list' }),
    'POST /v1/roadmap/:jahr': () => ({ method: 'POST', url: '/v1/roadmap/2029', kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const r = (await api.app.inject({ method: 'GET', url: '/v1/roadmap/2029', headers: a })).json();
    assert.equal(r.version, 1);
    assert.equal(r.inhalt.handlungsfelder.flatMap((h: { ziele: { jahresziele: { text: string }[] }[] }) => h.ziele.flatMap(z => z.jahresziele.map(j => j.text)))[0], mark);
    const z = (await api.app.inject({ method: 'GET', url: '/v1/ziele/2029', headers: a })).json();
    assert.equal(z.zieljahr.stand, 'in_kraft');
  },
};
