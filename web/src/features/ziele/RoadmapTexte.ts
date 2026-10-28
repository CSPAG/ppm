/** Texte der Portfolio-Roadmap (UI-31, K6 Schritt 8; eigene Datei von AP-E6-2): Anrede «Du», Schweizer Rechtschreibung. */
import { NAV } from './nav.ts';
import { fmtDatum } from '../../ui/index.ts';

export const TR = {
  bereich: NAV.roadmap,
  inhalt: (jahr: number | null) => (jahr ? `Inhalt der Roadmap ${jahr}` : 'Inhalt der Roadmap'),
  titel: (jahr: number) => `Roadmap ${jahr}`,
  publiziert: (d: string) => `publiziert ${fmtDatum(d)}`,
  nichtPubliziert: 'nicht publiziert',
  jahr: 'Jahr',
  publizieren: 'Roadmap publizieren',
  vorschau: 'Vorschau',
  abbrechen: 'Abbrechen',
  wirkung: (jahr: number) => `Alle angemeldeten Personen sehen die Roadmap ${jahr} lesend. Vertrauliche Projekte erscheinen nicht.`,
  ersetzt: (d: string) => `Die Roadmap wurde zuletzt am ${fmtDatum(d)} publiziert; der neue Stand ersetzt ihn.`,
  nichtInKraft: (jahr: number) => `Die Jahresziele ${jahr} sind noch nicht in Kraft. Publiziere die Roadmap nach der Freigabe durch den VR.`,
  publiziertToast: (jahr: number) => `Roadmap ${jahr} publiziert.`,
  leer: (jahr: number) => `Für ${jahr} ist noch keine Roadmap publiziert.`,
  leerUe: 'Die Roadmap entsteht aus den freigegebenen Jahreszielen, ihren Hauptaktivitäten und den beitragenden Projekten.',
  keineZiele: 'Keine strategischen Ziele.',
  jahresziel: 'Jahresziel', metrik: 'Metrik', zielwert: 'Zielwert', hauptaktivitaeten: 'Hauptaktivitäten', projekte: 'Projekte',
  ohneJahresziel: 'Projekte am strategischen Ziel',
  keine: '–',
  verantwortlich: (name: string) => `verantwortlich: ${name}`,
  projektOeffnen: (nr: string, name: string) => `Projekt ${nr} ${name} öffnen`,
};
