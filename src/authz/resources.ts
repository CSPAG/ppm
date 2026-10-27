/**
 * Ressourcen der App (identity-kit 7.7): Stufe «einfach», nur die Organisation. Neuer Typ (z. B. Projekt, Portfolio):
 * im Modell unter `types` eintragen, hier Kette, `exists` und – bei `classified` – `classification` ergänzen.
 */
import { flatResources, type ResourceModel } from '@vollholz/iam';

export const resources: ResourceModel<null> = flatResources({ tables: {} });
