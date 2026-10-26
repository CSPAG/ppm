/**
 * Migrationen: zuerst die von `@vollholz/iam` (Schema, Mandanten, Principals, Tupel, Audit, Sitzungen …), dann die der
 * App aus `db/migrations/NNN_*.sql` – jede in einer eigenen Transaktion, protokolliert in `public.schema_migrations`.
 * Nur vorwärts; veröffentlichte Migrationen nie ändern. Das Modell kommt als Parameter (db/ kennt kein authz/).
 */
import { join } from 'node:path';
import { dirMigrations, iamMigrations, migrate, type MigrationResult, type Model } from '@vollholz/iam';
import { PRODUCT, SCHEMA } from '../config/env.ts';

export const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', '..', 'db', 'migrations');

export function migrationSources(model: Model<string>) {
  return [iamMigrations({ product: PRODUCT, schema: SCHEMA, model }), dirMigrations(MIGRATIONS_DIR)];
}

export function runMigrations(adminUrl: string, model: Model<string>, log: (m: string) => void = () => undefined): Promise<MigrationResult> {
  return migrate(adminUrl, migrationSources(model), log);
}
