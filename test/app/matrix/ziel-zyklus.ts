/**
 * Modul ziel, Zielzyklus (300_zielzyklus, BC ZM.02.01, ZM.02.03, ZM.02.04, PP.02.05, AP-E6-1): Zieljahr, Jahresziele,
 * Hauptaktivitäten, Zuordnung Projekt ↔ Ziel.
 */
import assert from 'node:assert/strict';
import { aufgabe } from '../../../src/modules/eingang/index.ts';
import { VERVOLLSTAENDIGEN } from '../../../src/modules/ziel/zyklus-routes.ts';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    zieljahr: async (tx, t) => {
      await tx.query('INSERT INTO ppm.zieljahr (tenant_id, jahr) VALUES ($1, 2027)', [t]);
      return 'jahr = 2027';
    },
    // braucht das strategische Ziel «Probe» aus matrix/ziel.ts
    jahresziel: async (tx, t) => {
      await tx.query("INSERT INTO ppm.jahresziel (tenant_id, jahr, strategisches_ziel_id, nummer, text) SELECT $1, 2027, id, '1.1.1', 'Probe' FROM ppm.strategisches_ziel WHERE tenant_id = $1 AND text = 'Probe'", [t]);
      return "text = 'Probe'";
    },
    hauptaktivitaet: async (tx, t) => {
      await tx.query("INSERT INTO ppm.hauptaktivitaet (tenant_id, jahresziel_id, text) SELECT $1, id, 'Probe' FROM ppm.jahresziel WHERE tenant_id = $1 AND text = 'Probe'", [t]);
      return "text = 'Probe'";
    },
    // braucht das Projekt «2026-001» aus matrix/projekt.ts
    ziel_projekt: async (tx, t) => {
      await tx.query(
        `INSERT INTO ppm.ziel_projekt (tenant_id, projekt_id, strategisches_ziel_id, jahresziel_id)
         SELECT $1, p.id, j.strategisches_ziel_id, j.id FROM ppm.projekt p, ppm.jahresziel j
          WHERE p.tenant_id = $1 AND p.nummer = '2026-001' AND j.tenant_id = $1 AND j.text = 'Probe'`, [t]);
      return 'jahresziel_id IS NOT NULL';
    },
  },
  policies: [
    // Lesesicht nach Muster ORG; das Zieljahr ändert auch die Freigabe (ziel:freigabe, AP-E6-2)
    "ppm.zieljahr.zieljahr_read RESTRICTIVE SELECT ppm_app USING app.has_permission('ziel:read'::text) CHECK -",
    "ppm.zieljahr.zieljahr_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ziel:write'::text)",
    "ppm.zieljahr.zieljahr_update RESTRICTIVE UPDATE ppm_app USING (app.has_permission('ziel:write'::text) OR app.has_permission('ziel:freigabe'::text)) CHECK (app.has_permission('ziel:write'::text) OR app.has_permission('ziel:freigabe'::text))",
    "ppm.zieljahr.zieljahr_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ziel:write'::text) CHECK -",
    "ppm.jahresziel.jahresziel_read RESTRICTIVE SELECT ppm_app USING app.has_permission('ziel:read'::text) CHECK -",
    "ppm.jahresziel.jahresziel_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ziel:write'::text)",
    "ppm.jahresziel.jahresziel_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('ziel:write'::text) CHECK app.has_permission('ziel:write'::text)",
    "ppm.jahresziel.jahresziel_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ziel:write'::text) CHECK -",
    "ppm.hauptaktivitaet.hauptaktivitaet_read RESTRICTIVE SELECT ppm_app USING app.has_permission('ziel:read'::text) CHECK -",
    "ppm.hauptaktivitaet.hauptaktivitaet_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ziel:write'::text)",
    "ppm.hauptaktivitaet.hauptaktivitaet_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('ziel:write'::text) CHECK app.has_permission('ziel:write'::text)",
    "ppm.hauptaktivitaet.hauptaktivitaet_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ziel:write'::text) CHECK -",
    // Muster KIND: sichtbar mit dem Projekt; schreiben mit ziel:write oder projekt:write am Projekt (301)
    'ppm.ziel_projekt.ziel_projekt_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.ziel_projekt.ziel_projekt_insert RESTRICTIVE INSERT ppm_app USING - CHECK (ppm.recht_am_projekt('ziel:write'::text, projekt_id) OR ppm.recht_am_projekt('projekt:write'::text, projekt_id))",
    "ppm.ziel_projekt.ziel_projekt_update RESTRICTIVE UPDATE ppm_app USING (ppm.recht_am_projekt('ziel:write'::text, projekt_id) OR ppm.recht_am_projekt('projekt:write'::text, projekt_id)) CHECK (ppm.recht_am_projekt('ziel:write'::text, projekt_id) OR ppm.recht_am_projekt('projekt:write'::text, projekt_id))",
    "ppm.ziel_projekt.ziel_projekt_delete RESTRICTIVE DELETE ppm_app USING (ppm.recht_am_projekt('ziel:write'::text, projekt_id) OR ppm.recht_am_projekt('projekt:write'::text, projekt_id)) CHECK -",
  ],
  seed: async (api, a, mark) => {
    const call = async (method: string, url: string, payload?: unknown) => {
      const r = await api.app.inject({ method: method as 'POST', url, headers: a, ...(payload ? { payload: payload as object } : {}) });
      assert.ok(r.statusCode < 300, `${method} ${url}: ${r.body}`);
      return r.json();
    };
    // strategisches Ziel von A aus matrix/ziel.ts (läuft vorher)
    const ziele = (await call('GET', `/v1/strategische-ziele?q=${encodeURIComponent(mark)}`)).items as { id: string }[];
    assert.equal(ziele.length, 1);
    await call('POST', '/v1/ziele/2026', {});
    // Die Aufgabe «Jahresziele vervollständigen» entfällt hier wieder: matrix/eingang.ts prüft den Eingang von A genau
    const t = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, t, async tx => {
      const id = (await tx.query<{ id: string }>('SELECT id FROM ppm.zieljahr WHERE jahr = 2026')).rows[0]!.id;
      assert.equal(await aufgabe.entfallen(tx, { art: VERVOLLSTAENDIGEN, bezug: { typ: 'zieljahr', id } }), 1);
    });
    const jz = await call('POST', '/v1/jahresziele', { jahr: 2026, strategischesZielId: ziele[0]!.id, text: mark, metrik: 'Anzahl' });
    const ha = await call('POST', '/v1/hauptaktivitaeten', { jahreszielId: jz.id, text: mark });
    // Projekt von A ohne Routen des Moduls projekt (Tabelle aus 010)
    const projekt = await full(api.t.runtime, t, async tx => {
      // dasselbe Projekt wie matrix/projektdaten.ts, falls schon angelegt (Nummer eindeutig)
      const da = (await tx.query<{ id: string }>('SELECT id FROM ppm.projekt WHERE name = $1', [mark])).rows[0];
      if (da) return da.id;
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'ziel-probe', $2, true) RETURNING id", [t, mark])).rows[0]!.id;
      return (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) VALUES ($1, '2026-901', $2, $3) RETURNING id", [t, mark, pf])).rows[0]!.id;
    });
    const zp = await call('POST', `/v1/projekte/${projekt}/ziele`, { jahreszielId: jz.id });
    return { jahresziel: jz.id, hauptaktivitaet: ha.id, zielProjekt: projekt, zielZuordnung: zp.id };
  },
  cases: {
    // Jahr ist kein Geheimnis: B sieht seinen eigenen (leeren) Zielzyklus bzw. legt ihn an
    'GET /v1/ziele/:jahr': () => ({ method: 'GET', url: '/v1/ziele/2026', kind: 'list' }),
    'GET /v1/ziele/:jahr/verlauf': () => ({ method: 'GET', url: '/v1/ziele/2026/verlauf', kind: 'list' }),
    'POST /v1/ziele/:jahr': () => ({ method: 'POST', url: '/v1/ziele/2028', body: {}, kind: 'create' }),
    'PATCH /v1/ziele/:jahr': () => ({ method: 'PATCH', url: '/v1/ziele/2026', body: { vorlageBis: '2026-11-30' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/jahresziele': () => ({ method: 'GET', url: '/v1/jahresziele', kind: 'list' }),
    // Jahresziel unter dem strategischen Ziel von A: für B unbekannt (zuerst fehlt B der Zielzyklus 2026) → 404
    'POST /v1/jahresziele': i => ({ method: 'POST', url: '/v1/jahresziele', body: { jahr: 2026, strategischesZielId: i.strategischesZiel, text: 'GEHEIM-A' }, kind: 'foreign' }),
    'GET /v1/jahresziele/:id': i => ({ method: 'GET', url: `/v1/jahresziele/${i.jahresziel}`, kind: 'foreign' }),
    'PATCH /v1/jahresziele/:id': i => ({ method: 'PATCH', url: `/v1/jahresziele/${i.jahresziel}`, body: { text: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/jahresziele/:id': i => ({ method: 'DELETE', url: `/v1/jahresziele/${i.jahresziel}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/hauptaktivitaeten': i => ({ method: 'GET', url: `/v1/hauptaktivitaeten?jahresziel=${i.jahresziel}`, kind: 'foreign' }),
    'POST /v1/hauptaktivitaeten': i => ({ method: 'POST', url: '/v1/hauptaktivitaeten', body: { jahreszielId: i.jahresziel, text: 'gehackt' }, kind: 'foreign' }),
    'GET /v1/hauptaktivitaeten/:id': i => ({ method: 'GET', url: `/v1/hauptaktivitaeten/${i.hauptaktivitaet}`, kind: 'foreign' }),
    'PATCH /v1/hauptaktivitaeten/:id': i => ({ method: 'PATCH', url: `/v1/hauptaktivitaeten/${i.hauptaktivitaet}`, body: { text: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/hauptaktivitaeten/:id': i => ({ method: 'DELETE', url: `/v1/hauptaktivitaeten/${i.hauptaktivitaet}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/projekte/:id/ziele': i => ({ method: 'GET', url: `/v1/projekte/${i.zielProjekt}/ziele`, kind: 'foreign' }),
    'POST /v1/projekte/:id/ziele': i => ({ method: 'POST', url: `/v1/projekte/${i.zielProjekt}/ziele`, body: { jahreszielId: i.jahresziel }, kind: 'foreign' }),
    'DELETE /v1/projekte/:id/ziele/:zuordnungId': i => ({ method: 'DELETE', url: `/v1/projekte/${i.zielProjekt}/ziele/${i.zielZuordnung}`, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const z = (await api.app.inject({ method: 'GET', url: '/v1/ziele/2026', headers: a })).json();
    const jz = z.strategischeZiele.flatMap((s: { jahresziele: unknown[] }) => s.jahresziele) as { text: string; version: number; hauptaktivitaeten: { text: string; version: number }[]; projekte: { name: string }[] }[];
    assert.deepEqual(jz.map(j => [j.text, j.version, j.hauptaktivitaeten.map(h => [h.text, h.version]), j.projekte.map(p => p.name)]), [[mark, 1, [[mark, 1]], [mark]]]);
    assert.equal(z.zieljahr.version, 1);
  },
};
