/**
 * Testpersonen der lokalen Entwicklung in der Datenbank der App: Mandant (gebunden an die Organisation in Keycloak),
 * Principal, Rolle als Tupel an der Organisation, Freigabestufe. Als Besitzer-Rolle; genutzt von keycloak-setup.ts
 * (Datenbank ppm) und e2e-db.ts (Datenbank ppm_e2e). Die IDs aus Keycloak stehen in `.local/people.json`.
 */
import pg from 'pg';

export interface People {
  orgs: { alias: string; name: string; id: string }[];
  people: { email: string; first: string; last: string; org: string | null; role: string | null; clearance: number; id: string }[];
}

export async function seedPeople(url: string, p: People): Promise<void> {
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  try {
    for (const o of p.orgs) {
      await admin.query('BEGIN');
      try {
        const t = (await admin.query<{ id: string }>('SELECT app.resolve_tenant($1, $2, $3, true) AS id', [o.alias, o.id, o.name])).rows[0]!.id;
        await admin.query("SELECT set_config('app.tenant_id', $1, true)", [t]);
        for (const x of p.people.filter(y => y.org === o.alias)) {
          const id = (await admin.query<{ id: string }>(
            `INSERT INTO ppm.principal AS x (tenant_id, kind, subject, display_name, email, clearance) VALUES ($1, 'user', $2, $3, $4, $5)
             ON CONFLICT (tenant_id, kind, subject) DO UPDATE SET clearance = excluded.clearance RETURNING id`,
            [t, x.id, `${x.first} ${x.last}`, x.email, x.clearance])).rows[0]!.id;
          if (x.role) await admin.query("INSERT INTO ppm.authz_tuple (tenant_id, subject, relation, object_type, object_id) VALUES ($1, $2, $3, 'org', NULL) ON CONFLICT DO NOTHING", [t, `user:${id}`, x.role]);
        }
        await admin.query('COMMIT');
      } catch (e) { await admin.query('ROLLBACK'); throw e; }
    }
  } finally { await admin.end(); }
}
