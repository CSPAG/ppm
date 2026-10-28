/** Öffentliche Schnittstelle des Features «Jahresrückblick» (UI-37; Router und Navigation importieren nur von hier); AP-E7-5. */
export { TJ as jahresrueckblickTexte } from './JahresrueckblickTexte.ts';
export type { JahresrueckblickPageProps } from './JahresrueckblickPage.tsx';
/** Jahr, das «Gremien › Jahresrückblick» öffnet: im Q4 das laufende Jahr (Rückblick im Q4, UC-013), sonst das Vorjahr. */
export const rueckblickJahr = (heute = new Date()) => (heute.getMonth() >= 9 ? heute.getFullYear() : heute.getFullYear() - 1);
