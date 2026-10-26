/**
 * Client der REST-API (`/v1`), typisiert aus `schema.d.ts` (erzeugt aus `web/openapi.json`, `npm run api:types`).
 *
 * - Nur die eigene Herkunft: Basis ist `window.location.origin`, nie eine feste Adresse.
 * - Die Middleware von iam-web setzt die Organisation des Tabs (`X-Tenant`) und bei schreibenden Aufrufen das
 *   CSRF-Token der Sitzung (`X-CSRF-Token`), wirft Fehler als `ApiError` (application/problem+json, RFC 9457) und
 *   meldet 401 an die Sitzung: Diese zeigt «Sitzung abgelaufen» mit «Erneut anmelden», Eingaben bleiben stehen.
 * - Antworten ohne Fehler haben darum immer `data` (oder sind 204).
 */
import { ApiError, ifMatch, iamMiddleware } from '@vollholz/iam-web';
import createClient from 'openapi-fetch';
import type { components, paths } from './schema';

export { ApiError, ifMatch };

export type Schemas = components['schemas'];

const base = (): string => (typeof window === 'undefined' ? '' : window.location.origin);

/** Client für alle Features; `fetch` spät gebunden, damit Tests es ersetzen können. */
export const api = createClient<paths>({
  baseUrl: base(),
  fetch: (request: Request) => globalThis.fetch(request),
});
api.use(iamMiddleware);

/** Zufälliger `Idempotency-Key` für einen schreibenden Aufruf (gleicher Schlüssel bei Wiederholung derselben Eingabe). */
export const idempotencyKey = (): string => crypto.randomUUID();

/** Ergebnis eines Aufrufs ohne Fehler (die Middleware wirft vorher); fehlt `data`, ist der Vertrag verletzt. */
export function required<T>(r: { data?: T; response: Response }): T {
  if (r.data === undefined) throw new ApiError(r.response.status, { title: 'Leere Antwort', detail: `Erwartet wurde ein Inhalt (${r.response.status}).` });
  return r.data;
}

/** Fassung veraltet (412) oder `If-Match` fehlt (428): jemand anderes war schneller. */
export const isVersionConflict = (e: unknown): e is ApiError => e instanceof ApiError && (e.status === 412 || e.status === 428);

/** Aktuelle Fassung aus einem 412 (`VersionConflict.currentVersion`), falls der Server sie nennt. */
export function currentVersion(e: unknown): number | undefined {
  if (!(e instanceof ApiError)) return undefined;
  const v = (e.problem as Schemas['VersionConflict']).currentVersion;
  return typeof v === 'number' ? v : undefined;
}

/** Feldfehler eines 422 je Feld (`/beginn` → `beginn`); Pfade ohne Feld unter `''`. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || e.status !== 422) return {};
  const out: Record<string, string> = {};
  for (const f of e.fieldErrors) {
    const key = f.path.split('/').filter(Boolean)[0] ?? '';
    out[key] ??= f.message;
  }
  return out;
}
