/**
 * Kopfkarten der Startseite je Rolle (fachmodell.md 4.1, informationsarchitektur.md «Startseite je Rolle»): Jedes
 * Fachmodul bietet `GET /v1/<modul>/kopf`; hier trägt das Paket des Moduls mit einer Zeile ein, mit welchem Recht die
 * Karte erscheint und wie sie aussieht. Wer mehrere Rollen hat, sieht mehrere Karten (Telefon: untereinander).
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

/** Eine Zeile je Modul, in der Reihenfolge der Module (src/app.ts). */
export const KOPFKARTEN: readonly KopfKarte[] = [];
