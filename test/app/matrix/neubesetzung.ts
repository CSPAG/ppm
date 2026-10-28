/** Modul eingang, Teil Neubesetzung (410_neubesetzung, AM.01.01, UC-016 A1): entzogene Zugänge mit festgehaltenen Rollen. */
import { randomUUID } from 'node:crypto';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

const ADMIN = "(app.has_permission('members:admin'::text) OR ((app.principal_id() IS NULL) AND app.write_all()))";

export const matrix: Matrix = {
  tables: {
    neubesetzung: async (tx, t) => {
      await tx.query("INSERT INTO ppm.principal (tenant_id, kind, subject, display_name) VALUES ($1, 'user', 'probe-entzogen', 'Probe')", [t]);
      await tx.query(`INSERT INTO ppm.neubesetzung (tenant_id, person, stand, entzogen_at)
        SELECT $1, id, 'entzogen', now() FROM ppm.principal WHERE subject = 'probe-entzogen'`, [t]);
      return 'true';
    },
    neubesetzung_rolle: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.neubesetzung_rolle (tenant_id, neubesetzung_id, ort_typ, ort_id, rolle)
        SELECT $1, id, 'projekt', $2, 'pl' FROM ppm.neubesetzung LIMIT 1`, [t, randomUUID()]);
      return "rolle = 'pl'";
    },
  },
  policies: [
    // Lesesicht ADMIN: nur mit «Mitglieder und Rollen verwalten» oder als System
    `ppm.neubesetzung.neubesetzung_admin RESTRICTIVE ALL ppm_app USING ${ADMIN} CHECK ${ADMIN}`,
    `ppm.neubesetzung_rolle.neubesetzung_rolle_admin RESTRICTIVE ALL ppm_app USING ${ADMIN} CHECK ${ADMIN}`,
  ],
  tags: ['Neubesetzung'],
  seed: async api => {
    // ohne Verwaltung im Test: entzogener Zugang direkt in der Datenbank
    const t = await tenant(api.t.runtime, 'acme');
    return full(api.t.runtime, t, async tx => {
      const person = (await tx.query<{ id: string }>(
        "INSERT INTO ppm.principal (tenant_id, kind, subject, display_name) VALUES ($1, 'user', 'u-a-entzogen', 'Entzogen') RETURNING id", [t])).rows[0]!.id;
      const nb = (await tx.query<{ id: string }>(
        "INSERT INTO ppm.neubesetzung (tenant_id, person, stand, entzogen_at) VALUES ($1, $2, 'entzogen', now()) RETURNING id", [t, person])).rows[0]!.id;
      return { neubesetzungPerson: person, neubesetzung: nb };
    });
  },
  cases: {
    'GET /v1/zugaenge/:person': i => ({ method: 'GET', url: `/v1/zugaenge/${i.neubesetzungPerson}`, kind: 'foreign' }),
    'POST /v1/zugaenge/:person/entziehen': i => ({ method: 'POST', url: `/v1/zugaenge/${i.neubesetzungPerson}/entziehen`, kind: 'foreign' }),
    'GET /v1/neubesetzungen': () => ({ method: 'GET', url: '/v1/neubesetzungen', kind: 'list' }),
    'GET /v1/neubesetzungen/:id': i => ({ method: 'GET', url: `/v1/neubesetzungen/${i.neubesetzung}`, kind: 'foreign' }),
  },
};
