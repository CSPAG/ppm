/**
 * Token-Prüfung: Signatur, Aussteller, Zielgruppe (`ppm-api` bzw. `ppm-mcp`), DPoP mit Replay-Schutz und mTLS liegen
 * vollständig in `@vollholz/iam` (`OidcProvider`, `TokenVerifier`). Die App baut nichts nach.
 */
export { OidcProvider, TokenVerifier, type VerifiedToken } from '@vollholz/iam';
