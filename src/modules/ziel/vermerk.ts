/**
 * Vermerke der Ziele (AP-E8-4; Master G1, A-74, UX-E12): Die Roadmap lässt sich vor der Freigabe der Jahresziele durch
 * den VR publizieren (UC-011 A3). Der Vermerk wird aus dem Stand der Jahresziele abgeleitet und entfällt von selbst mit
 * der Freigabe; gespeichert wird nichts.
 */
import { Type, type Static } from '@sinclair/typebox';

export const VermerkT = Type.Object({
  art: Type.String({ description: 'Schlüssel des Vermerks, z. B. `jahresziele_nicht_freigegeben`.' }),
  text: Type.String({ description: 'Text für die Anzeige (darstellung.md «Vermerk offen»).' }),
}, { additionalProperties: false, description: 'Offener Vermerk (A-74): der Ablauf ging ohne Freigabe weiter.' });
export type Vermerk = Static<typeof VermerkT>;

/** Vermerk der Roadmap: Jahresziele noch nicht in Kraft (UC-011 A3). */
export function roadmapVermerke(stand: string | null | undefined): Vermerk[] {
  return stand && stand !== 'in_kraft' ? [{ art: 'jahresziele_nicht_freigegeben', text: 'Jahresziele noch nicht freigegeben' }] : [];
}
