/**
 * Kopfkarten der Startseite je Rolle (fachmodell.md 4.1, informationsarchitektur.md «Startseite je Rolle»): Jedes
 * Fachmodul bietet `GET /v1/<modul>/kopf` und eine Karte in seinem Feature; die App meldet sie in `src/kopfkarten.ts`
 * an (eine Zeile je Modul, Recht und Karte), der Router gibt sie an die Startseite. So importiert kein Feature aus
 * `features/eingang`. Wer mehrere Rollen hat, sieht mehrere Karten (Telefon: untereinander).
 */
import type { ComponentType } from 'react';
import type { AppPermission } from '../../auth/permissions.ts';

export interface KopfKarte {
  id: string;
  /** Sichtbar mit diesem Recht irgendwo (canSomewhere), z. B. `statusbericht:review` für den Monatszyklus der UE. */
  recht: AppPermission;
  /** Karte; lädt ihre Kopfdaten selbst (`GET /v1/<modul>/kopf`). */
  Karte: ComponentType;
}
