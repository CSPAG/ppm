/**
 * Client der REST-API (`/v1/…`, OpenAPI 3.1): Typen aus `schema.d.ts` (erzeugt mit `npm run api:types` aus dem Export
 * des Backends). Nur dieselbe Herkunft (L9). Die Middleware des Baukastens setzt `X-Tenant` (Organisation dieses Tabs)
 * und bei schreibenden Aufrufen `X-CSRF-Token` aus der Sitzung, wirft Fehler als `ApiError` (problem+json) und meldet
 * 401 an die Sitzung (Anmeldung erneut) bzw. 403 (Organisation prüfen).
 */
import { ApiError, iamMiddleware, ifMatch, origin } from '@vollholz/iam-web';
import createClient from 'openapi-fetch';
import type { components, paths } from './schema.d.ts';

// fetch erst beim Aufruf auflösen (nicht beim Import), damit Tests und Erweiterungen ihn ersetzen können
export const api = createClient<paths>({ baseUrl: origin, fetch: (req: Request) => globalThis.fetch(req) });
api.use(iamMiddleware);

export type Schemas = components['schemas'];
export { ApiError, ifMatch };

/** Status eines Fehlers der API (0 = Netz, null = kein ApiError). */
export const statusOf = (e: unknown): number | null => (e instanceof ApiError ? e.status : null);
export const isConflict = (e: unknown): boolean => statusOf(e) === 412;
export const isGone = (e: unknown): boolean => statusOf(e) === 404;

/** Schlüssel für `Idempotency-Key`: einmal je Absicht (z. B. je geöffnetes Formular), bei Wiederholung gleich. */
export const newIdempotencyKey = (): string => crypto.randomUUID();
