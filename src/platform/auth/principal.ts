/**
 * Principal und Handelnder einer Anfrage. Anmeldung, Mandant und Principal löst `@vollholz/iam` auf (Bearer, DPoP,
 * mTLS, Sitzung der Oberfläche); hier nur die Abbildung für Audit und Ereignisse.
 */
import type { FastifyRequest } from 'fastify';
import type { Actor, Principal } from '@vollholz/iam';

export type { Principal };

export function actorOf(req: FastifyRequest): Actor {
  const p = req.principal;
  return {
    principal: p ? { kind: p.kind, principalId: p.principalId, name: p.name, clientId: p.clientId } : null,
    source: req.source, correlationId: req.id,
  };
}
