/**
 * Personen der Demo im Betrieb einladen, wie die Administration in der Oberfläche (Verwaltung, `AdminService.invite`):
 * Keycloak legt ein Konto ohne Passwort an und trägt es als Mitglied ein, die Einladung legt Principal und Rolle an;
 * danach die Freigabestufe. Adressen unter .example (RFC 2606): die Mail «Passwort setzen» erreicht niemanden, also
 * meldet sich niemand als diese Personen an. Handelnd ist die Administration der Organisation (`org-admin`).
 */
import { randomUUID } from 'node:crypto';
import type { AdminService } from '@vollholz/iam';
import type { DemoPerson } from './personen.ts';

export async function einladen(admin: AdminService, org: { tenantId: string; alias: string },
  von: { id: string; subject: string; name: string; email: string | null; clearance: number }, personen: readonly DemoPerson[]): Promise<string[]> {
  const scope = {
    alias: org.alias, platform: false, source: 'system' as const, correlationId: randomUUID(),
    actor: {
      tenantId: org.tenantId, tenantAlias: org.alias, principalId: von.id, kind: 'user' as const, subject: von.subject, name: von.name, email: von.email,
      clientId: null, groups: [], subjects: [`user:${von.id}`], scopes: [], platformAdmin: false, binding: null as never, token: '',
    },
  };
  const out: string[] = [];
  for (const p of personen) {
    const r = await admin.invite(scope, { email: p.email, firstName: p.first, lastName: p.last, roles: [p.role] });
    // Freigabestufe höchstens bis zur eigenen der Administration (wie in der Oberfläche)
    const stufe = Math.min(p.clearance, von.clearance) as DemoPerson['clearance'];
    if (stufe) await admin.setClearance(scope, r.member.id, stufe);
    out.push(stufe < p.clearance ? `${p.email} (Freigabestufe ${stufe} statt ${p.clearance})` : p.email);
  }
  return out;
}
