/** Modul eingang (070_eingang, BC AM.01.03): Aufgaben, Mitteilungen, Stellvertretungen. */
import assert from 'node:assert/strict';
import { aufgabe, mitteilung } from '../../../src/modules/eingang/index.ts';
import { login } from '../api.ts';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

/** Schreiben in Aufgaben und Mitteilungen nur über das Modul (app.eingang_intern). */
const intern = (tx: { query(sql: string): Promise<unknown> }, on: boolean) => tx.query(`SELECT set_config('app.eingang_intern', '${on ? 'on' : ''}', true)`);

export const matrix: Matrix = {
  tables: {
    aufgabe: async (tx, t) => {
      // Personen für Mitteilung und Stellvertretung
      await tx.query(`INSERT INTO ppm.principal (tenant_id, kind, subject, display_name)
        VALUES ($1, 'user', 'probe-vertretene', 'Probe'), ($1, 'user', 'probe-vertreter', 'Probe')`, [t]);
      await intern(tx, true);
      await tx.query("INSERT INTO ppm.aufgabe (tenant_id, art, bezug_typ, bezug_id, empfaenger_recht, titel, link) VALUES ($1, 'probe.pruefen', 'probe', 'p', 'handlungsfeld:read', 'Probe', '/eingang')", [t]);
      await intern(tx, false);
      return "titel = 'Probe'";
    },
    mitteilung: async (tx, t) => {
      await intern(tx, true);
      await tx.query(`INSERT INTO ppm.mitteilung (tenant_id, empfaenger_person, bezug_typ, bezug_id, text)
        SELECT $1, id, 'probe', 'p', 'Probe' FROM ppm.principal WHERE subject = 'probe-vertretene'`, [t]);
      await intern(tx, false);
      return "text = 'Probe'";
    },
    stellvertretung: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.stellvertretung (tenant_id, vertretene_person, vertreter_person, von, bis)
        SELECT $1, a.id, b.id, current_date, current_date + 7 FROM ppm.principal a, ppm.principal b
         WHERE a.subject = 'probe-vertretene' AND b.subject = 'probe-vertreter'`, [t]);
      return 'true';
    },
  },
  policies: [
    // Lesesicht AUFGABE und EIGEN (fachmodell.md 3.4); Schreiben in Aufgaben und Mitteilungen nur über das Modul
    "ppm.aufgabe.aufgabe_insert RESTRICTIVE INSERT ppm_app USING - CHECK (current_setting('app.eingang_intern'::text, true) = 'on'::text)",
    "ppm.aufgabe.aufgabe_read RESTRICTIVE SELECT ppm_app USING ((current_setting('app.eingang_intern'::text, true) = 'on'::text) OR ((app.principal_id() IS NULL) AND app.write_all()) OR (empfaenger_person = app.principal_id()) OR ((empfaenger_recht IS NOT NULL) AND CASE ort_typ WHEN 'org'::text THEN app.has_permission(empfaenger_recht) ELSE app.has_permission(empfaenger_recht, ort_typ, ort_id) END) OR (EXISTS ( SELECT 1 FROM ppm.stellvertretung s WHERE ((s.tenant_id = aufgabe.tenant_id) AND (s.vertretene_person = aufgabe.empfaenger_person) AND (s.vertreter_person = app.principal_id()) AND ((((now() AT TIME ZONE 'Europe/Zurich'::text))::date >= s.von) AND (((now() AT TIME ZONE 'Europe/Zurich'::text))::date <= s.bis)))))) CHECK -",
    "ppm.aufgabe.aufgabe_update RESTRICTIVE UPDATE ppm_app USING (current_setting('app.eingang_intern'::text, true) = 'on'::text) CHECK (current_setting('app.eingang_intern'::text, true) = 'on'::text)",
    "ppm.mitteilung.mitteilung_insert RESTRICTIVE INSERT ppm_app USING - CHECK (current_setting('app.eingang_intern'::text, true) = 'on'::text)",
    "ppm.mitteilung.mitteilung_read RESTRICTIVE SELECT ppm_app USING ((empfaenger_person = app.principal_id()) OR (current_setting('app.eingang_intern'::text, true) = 'on'::text) OR ((app.principal_id() IS NULL) AND app.write_all())) CHECK -",
    'ppm.mitteilung.mitteilung_update RESTRICTIVE UPDATE ppm_app USING (empfaenger_person = app.principal_id()) CHECK (empfaenger_person = app.principal_id())',
    'ppm.stellvertretung.stellvertretung_delete RESTRICTIVE DELETE ppm_app USING ((vertretene_person = app.principal_id()) OR ((app.principal_id() IS NULL) AND app.write_all())) CHECK -',
    'ppm.stellvertretung.stellvertretung_insert RESTRICTIVE INSERT ppm_app USING - CHECK ((vertretene_person = app.principal_id()) OR ((app.principal_id() IS NULL) AND app.write_all()))',
    'ppm.stellvertretung.stellvertretung_read RESTRICTIVE SELECT ppm_app USING ((vertretene_person = app.principal_id()) OR (vertreter_person = app.principal_id()) OR ((app.principal_id() IS NULL) AND app.write_all())) CHECK -',
    'ppm.stellvertretung.stellvertretung_update RESTRICTIVE UPDATE ppm_app USING ((vertretene_person = app.principal_id()) OR ((app.principal_id() IS NULL) AND app.write_all())) CHECK ((vertretene_person = app.principal_id()) OR ((app.principal_id() IS NULL) AND app.write_all()))',
  ],
  tags: ['Eingang', 'Mitteilungen', 'Stellvertretungen'],
  seed: async (api, a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const me = await full(api.t.runtime, t, async tx => (await tx.query<{ id: string }>("SELECT id FROM ppm.principal WHERE subject = 'u-a'")).rows[0]!.id);
    const ids = await full(api.t.runtime, t, async tx => ({
      aufgabe: await aufgabe.oeffnen(tx, { art: 'probe.lesen', bezug: { typ: 'probe', id: 'a' }, empfaenger: { person: me }, titel: mark, link: '/eingang', manuell: true }),
      mitteilung: await mitteilung.senden(tx, { an: me, bezug: { typ: 'probe', id: 'a' }, text: mark }),
    }));
    const vertreterA = (await login(api, 'acme', 'u-a-vertretung', 'leser')).principalId;
    const s = await api.app.inject({ method: 'POST', url: '/v1/stellvertretungen', headers: a, payload: { vertreter: vertreterA, von: '2099-01-01', bis: '2099-01-31' } });
    assert.equal(s.statusCode, 201, s.body);
    const vertreterB = (await login(api, 'globex', 'u-b-vertretung', 'leser')).principalId;
    return { ...ids, stellvertretung: s.json().id, vertreterB };
  },
  cases: {
    'GET /v1/eingang': () => ({ method: 'GET', url: '/v1/eingang', kind: 'list' }),
    'GET /v1/eingang/anzahl': () => ({ method: 'GET', url: '/v1/eingang/anzahl', kind: 'list' }),
    'POST /v1/eingang/aufgaben/:id/erledigen': i => ({ method: 'POST', url: `/v1/eingang/aufgaben/${i.aufgabe}/erledigen`, kind: 'foreign' }),
    'POST /v1/eingang/aufgaben/:id/wieder-oeffnen': i => ({ method: 'POST', url: `/v1/eingang/aufgaben/${i.aufgabe}/wieder-oeffnen`, kind: 'foreign' }),
    'GET /v1/mitteilungen': () => ({ method: 'GET', url: '/v1/mitteilungen', kind: 'list' }),
    'POST /v1/mitteilungen/:id/gelesen': i => ({ method: 'POST', url: `/v1/mitteilungen/${i.mitteilung}/gelesen`, kind: 'foreign' }),
    'GET /v1/stellvertretungen': () => ({ method: 'GET', url: '/v1/stellvertretungen', kind: 'list' }),
    'POST /v1/stellvertretungen': i => ({ method: 'POST', url: '/v1/stellvertretungen', body: { vertreter: i.vertreterB, von: '2099-01-01', bis: '2099-01-31' }, kind: 'create' }),
    'DELETE /v1/stellvertretungen/:id': i => ({ method: 'DELETE', url: `/v1/stellvertretungen/${i.stellvertretung}`, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const e = (await api.app.inject({ method: 'GET', url: '/v1/eingang', headers: a })).json().items;
    assert.deepEqual(e.map((x: { titel: string }) => x.titel), [mark]);
    assert.equal((await api.app.inject({ method: 'GET', url: '/v1/stellvertretungen', headers: a })).json().items.length, 1);
  },
};
