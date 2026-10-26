/**
 * Fehler nach RFC 9457 (problem+json). `HttpError` kommt aus `@vollholz/iam`, damit dessen Fehlerbehandlung ihn
 * erkennt; Texte in Du-Form (scripts/check-address.ts).
 */
export { HttpError, notFound, forbidden, conflict, invalid, problemBody } from '@vollholz/iam';
import { HttpError } from '@vollholz/iam';

export const preconditionRequired = () => new HttpError(428, 'If-Match fehlt', 'Ändern und Löschen brauchen den Header If-Match mit dem ETag der gelesenen Fassung.');
export const preconditionFailed = (current: number) => new HttpError(412, 'Fassung veraltet', 'Jemand hat den Eintrag inzwischen geändert. Lade ihn neu und übernimm deine Änderung.', {}, { currentVersion: current });

/** Fehler, nach dem ein Job nicht wiederholt wird. */
export class PermanentJobError extends Error {}
