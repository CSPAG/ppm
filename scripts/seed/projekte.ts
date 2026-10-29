/**
 * Projekte der Demo mit Projektorganisation und Projektvertrag (K2, UC-002/003): Kapitel 1–13 aus dem Katalog,
 * Leitfragen des Gates, Einreichen, Quality-Check (UE), Unterschriften von SP, PL und CTL. Danach liegt das
 * Gate-Traktandum beim Gremium; den Entscheid fällt die Sitzung (sitzungen.ts).
 */
import type { Als } from './api.ts';
import type { Kontext, PersonKey, Projekt } from './kontext.ts';
import { pid } from './kontext.ts';
import { monat, monatsende } from './zeit.ts';

type Phase = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
const PHASEN: Phase[] = ['P0', 'P1', 'P2', 'P3', 'P4'];

export interface ProjektDef {
  key: string;
  name: string;
  portfolio: 'A' | 'B' | 'C';
  /** Phase beim Anlegen */
  phase: Phase;
  sp: PersonKey; pl: PersonKey; ctl: PersonKey | null; kt: PersonKey[];
  orgEinheit: string;
  handlungsfeld: string;
  /** Strategisches Ziel (Nummer) und ob ein Jahresziel dazu besteht */
  ziel: string;
  vertraulich?: boolean;
  berichteAb: number;
  /** Ende jeder Phase als Monat relativ zu heute */
  plan: Record<Phase, number>;
  /** Budget je Phase in CHF (Kap. 9) */
  budget: Partial<Record<Phase, number>>;
  text: { ausgangslage: string; problem: string; ziele: string; nutzen: string; loesung: string; businessCase: string };
  kpis: { art: 'klinisch' | 'nicht_klinisch' | 'projekt'; text: string; einheit: string; zielwert: string }[];
  risiken: { text: string; wahrscheinlichkeit: 'hoch' | 'mittel' | 'tief'; auswirkung: 'hoch' | 'mittel' | 'tief'; massnahme: string }[];
  stakeholder: { gruppe: string; interesse: string; einfluss: 'hoch' | 'mittel' | 'tief'; massnahmen: string }[];
  /** Meilenstein mit Abnahme durch das Gremium (Phase, Text) */
  abnahme?: { phase: Phase; text: string };
  /** Entsteht aus einer freigegebenen Idee (ideen.ts), nicht über `projektAnlegen` */
  ausIdee?: boolean;
}

const S = (gruppe: string, interesse: string, einfluss: 'hoch' | 'mittel' | 'tief', massnahmen: string) => ({ gruppe, interesse, einfluss, massnahmen });

export const PROJEKTE: ProjektDef[] = [
  {
    key: 'aufnahme', name: 'Digitale Patientenaufnahme', portfolio: 'A', phase: 'P0', sp: 'claudia', pl: 'sandra', ctl: 'lea', kt: ['jonas', 'daniel'],
    orgEinheit: 'DTI', handlungsfeld: 'patient', ziel: '2.1', berichteAb: -6,
    plan: { P0: -6, P1: -5, P2: -3, P3: 5, P4: 8 }, budget: { P1: 180_000, P2: 950_000, P3: 2_400_000, P4: 220_000 },
    text: {
      ausgangslage: 'Die Aufnahme erfolgt in jeder Klinik anders, grösstenteils auf Papier und mit Mehrfacherfassung.',
      problem: 'Lange Wartezeiten am Empfang, fehlerhafte Stammdaten und Doppelerfassung in KIS und Abrechnung.',
      ziele: 'Einheitliche digitale Aufnahme mit Vorerfassung durch die Patientinnen und Patienten zu Hause.',
      nutzen: 'Wartezeit am Empfang halbiert, weniger Fehler in Stammdaten und Abrechnung.',
      loesung: 'Aufnahme-App mit Anbindung an KIS und Patientenportal, Kiosk-Terminals in den Kliniken.',
      businessCase: 'Einsparung von 9 FTE administrativer Arbeit ab dem zweiten Betriebsjahr, Amortisation nach 4 Jahren.',
    },
    kpis: [
      { art: 'klinisch', text: 'Median Wartezeit am Empfang', einheit: 'Minuten', zielwert: '≤ 8' },
      { art: 'nicht_klinisch', text: 'Anteil vorerfasster Aufnahmen', einheit: '%', zielwert: '≥ 60' },
    ],
    risiken: [
      { text: 'Schnittstelle zum KIS nicht rechtzeitig verfügbar', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch', massnahme: 'Übergangslösung mit Dateiimport' },
      { text: 'Geringe Akzeptanz bei älteren Patientinnen und Patienten', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel', massnahme: 'Begleitung am Kiosk durch Lernende' },
    ],
    stakeholder: [S('Pflege und Empfang', 'Entlastung bei der Aufnahme', 'hoch', 'Schulung und Pilot im Notfallzentrum'), S('Patientinnen und Patienten', 'Kurze Wartezeit', 'mittel', 'Information über Portal und Flyer')],
  },
  {
    key: 'kis', name: 'Ablösung Klinikinformationssystem', portfolio: 'A', phase: 'P2', sp: 'thomas', pl: 'marco', ctl: 'simon', kt: ['jonas', 'reto', 'sandra'],
    orgEinheit: 'DTI-ICT', handlungsfeld: 'medizin', ziel: '3.1', berichteAb: -6,
    plan: { P0: -12, P1: -8, P2: 4, P3: 18, P4: 22 }, budget: { P2: 6_500_000, P3: 21_000_000, P4: 1_800_000 },
    text: {
      ausgangslage: 'Das heutige KIS ist über 20 Jahre alt; der Hersteller beendet die Wartung in drei Jahren.',
      problem: 'Fehlende Weiterentwicklung, viele Eigenentwicklungen und Medienbrüche in der Dokumentation.',
      ziele: 'Ein integriertes KIS für alle Standorte mit durchgängiger digitaler Dokumentation.',
      nutzen: 'Sichere Behandlung durch vollständige Daten, weniger Schnittstellen, Grundlage für alle Digitalisierungsvorhaben.',
      loesung: 'Ausschreibung eines Standardprodukts, Einführung in Etappen nach Standort.',
      businessCase: 'Investition von 29 Mio. CHF, vermiedene Kosten des Altsystems und Effizienzgewinne von 4 Mio. CHF pro Jahr.',
    },
    kpis: [
      { art: 'projekt', text: 'Arbeitspakete im Plan', einheit: '%', zielwert: '≥ 90' },
      { art: 'nicht_klinisch', text: 'Abgelöste Eigenentwicklungen', einheit: 'Anzahl', zielwert: '40' },
    ],
    risiken: [
      { text: 'Einsprache im Vergabeverfahren', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: 'Juristische Begleitung der Ausschreibung' },
      { text: 'Engpass bei klinischen Fachpersonen für Tests', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch', massnahme: 'Freistellung im Dienstplan vereinbaren' },
    ],
    stakeholder: [S('Ärzteschaft', 'Effiziente Dokumentation', 'hoch', 'Klinische Fachgruppe je Fachbereich'), S('ICT Betrieb', 'Stabiler Betrieb', 'hoch', 'Betriebsübergabe früh planen')],
  },
  {
    key: 'betten', name: 'Zentrale Bettendisposition', portfolio: 'A', phase: 'P0', sp: 'thomas', pl: 'daniel', ctl: 'lea', kt: ['jonas'],
    orgEinheit: 'DMS', handlungsfeld: 'wirtschaft', ziel: '5.1', berichteAb: -4,
    plan: { P0: -3, P1: 1, P2: 7, P3: 12, P4: 14 }, budget: { P1: 120_000, P2: 600_000, P3: 900_000, P4: 80_000 },
    text: {
      ausgangslage: 'Betten werden je Klinik disponiert; freie Kapazitäten anderer Kliniken sind nicht sichtbar.',
      problem: 'Verlegungen in andere Spitäler der Region, Überbelegung einzelner Stationen und lange Wartezeiten im Notfall.',
      ziele: 'Eine zentrale Disposition mit tagesaktuellem Bild aller Betten über alle Standorte.',
      nutzen: 'Höhere Auslastung, weniger Abweisungen, schnellere Verlegungen aus dem Notfall.',
      loesung: 'Leitstelle Bettenmanagement mit Dashboard aus dem KIS und klaren Dispositionsregeln.',
      businessCase: 'Mehrertrag von 2,1 Mio. CHF pro Jahr durch höhere Auslastung.',
    },
    kpis: [{ art: 'nicht_klinisch', text: 'Bettenauslastung', einheit: '%', zielwert: '≥ 88' }],
    risiken: [{ text: 'Widerstand der Kliniken gegen zentrale Steuerung', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: 'Regeln gemeinsam mit den Klinikleitungen erarbeiten' }],
    stakeholder: [S('Klinikleitungen', 'Eigene Betten behalten', 'hoch', 'Regelwerk im PRAT verabschieden')],
  },
  {
    key: 'aoz', name: 'Ambulantes Operationszentrum', portfolio: 'A', phase: 'P1', sp: 'claudia', pl: 'marco', ctl: 'simon', kt: ['reto'],
    orgEinheit: 'DIB', handlungsfeld: 'markt', ziel: '4.1', berichteAb: -5,
    plan: { P0: -9, P1: -1, P2: 9, P3: 24, P4: 27 }, budget: { P1: 400_000, P2: 3_200_000, P3: 18_000_000, P4: 600_000 },
    text: {
      ausgangslage: 'Ambulante Eingriffe belegen heute Operationssäle des stationären Betriebs.',
      problem: 'Lange Wartezeiten für ambulante Eingriffe, teure Infrastruktur für einfache Fälle.',
      ziele: 'Ein eigenes ambulantes Operationszentrum mit sechs Sälen am Standort Nord.',
      nutzen: 'Mehr ambulante Eingriffe, freie Kapazität für komplexe stationäre Fälle.',
      loesung: 'Umbau des Gebäudes Nord, eigenes Betriebsmodell mit Tagesklinik.',
      businessCase: 'Investition von 22 Mio. CHF, positiver Deckungsbeitrag ab dem dritten Betriebsjahr.',
    },
    kpis: [{ art: 'klinisch', text: 'Ambulante Eingriffe pro Jahr', einheit: 'Anzahl', zielwert: '≥ 6 000' }],
    risiken: [{ text: 'Baubewilligung verzögert sich', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: 'Vorabklärung mit der Gemeinde' }],
    stakeholder: [S('Chirurgie', 'Planbare Saalzeiten', 'hoch', 'Betriebskonzept mit den Chefärzten')],
  },
  {
    key: 'pflege2030', name: 'Fachkräfteprogramm Pflege 2030', portfolio: 'A', phase: 'P3', sp: 'claudia', pl: 'daniel', ctl: 'lea', kt: ['eva', 'sarah'],
    orgEinheit: 'DPF', handlungsfeld: 'kultur', ziel: '1.1', berichteAb: -6,
    plan: { P0: -20, P1: -16, P2: -10, P3: 6, P4: 9 }, budget: { P3: 2_800_000, P4: 300_000 },
    text: {
      ausgangslage: 'Die Fluktuation in der Pflege liegt über 15 %, offene Stellen bleiben lange unbesetzt.',
      problem: 'Hohe Belastung der Teams, Abhängigkeit von temporärem Personal.',
      ziele: 'Fluktuation unter 10 %, mehr Ausbildungsplätze und flexible Arbeitszeitmodelle.',
      nutzen: 'Stabile Teams, weniger Kosten für temporäres Personal.',
      loesung: 'Massnahmenpaket aus Arbeitszeitmodellen, Laufbahnen und Ausbildungsoffensive.',
      businessCase: 'Einsparung von 3,5 Mio. CHF pro Jahr bei temporärem Personal.',
    },
    kpis: [
      { art: 'nicht_klinisch', text: 'Fluktuationsrate Pflege', einheit: '%', zielwert: '≤ 10' },
      { art: 'nicht_klinisch', text: 'Besetzte Ausbildungsplätze', einheit: 'Anzahl', zielwert: '≥ 420' },
    ],
    risiken: [{ text: 'Arbeitsmarkt verschärft sich weiter', wahrscheinlichkeit: 'hoch', auswirkung: 'mittel', massnahme: 'Rekrutierung im Ausland prüfen' }],
    stakeholder: [S('Pflegeteams', 'Planbare Arbeitszeiten', 'hoch', 'Teamworkshops'), S('Personalverbände', 'Gute Anstellungsbedingungen', 'mittel', 'Sozialpartnergespräche')],
    abnahme: { phase: 'P3', text: 'Neues Arbeitszeitmodell in allen Kliniken eingeführt' },
  },
  {
    key: 'logistik', name: 'Smart Hospital Logistik', portfolio: 'A', phase: 'P2', sp: 'thomas', pl: 'sandra', ctl: 'simon', kt: ['jonas'],
    orgEinheit: 'DIB-LOG', handlungsfeld: 'wirtschaft', ziel: '5.2', berichteAb: -6,
    plan: { P0: -12, P1: -9, P2: 3, P3: 12, P4: 14 }, budget: { P2: 900_000, P3: 2_600_000, P4: 150_000 },
    text: {
      ausgangslage: 'Material wird manuell bestellt und verteilt, Lagerbestände auf den Stationen sind unbekannt.',
      problem: 'Hohe Lagerbestände, Fehlmengen bei kritischem Material, viele Wege für die Pflege.',
      ziele: 'Automatische Nachschubsteuerung mit RFID und autonomen Transportsystemen.',
      nutzen: 'Weniger Lagerbestand, mehr Zeit der Pflege am Bett.',
      loesung: 'RFID-Schränke auf den Stationen, Anbindung ans ERP, Transportroboter.',
      businessCase: 'Reduktion des Lagerbestands um 1,2 Mio. CHF.',
    },
    kpis: [{ art: 'nicht_klinisch', text: 'Lagerumschlag', einheit: 'pro Jahr', zielwert: '≥ 12' }],
    risiken: [{ text: 'ERP-Migration bindet dieselben Fachpersonen', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch', massnahme: 'Etappierung mit dem ERP-Projekt abstimmen' }],
    stakeholder: [S('Logistik', 'Effiziente Abläufe', 'hoch', 'Prozessaufnahme vor Ort')],
  },
  {
    key: 'portal', name: 'Patientenportal', portfolio: 'A', phase: 'P1', sp: 'claudia', pl: 'daniel', ctl: 'lea', kt: ['sarah'],
    orgEinheit: 'DTI', handlungsfeld: 'patient', ziel: '2.2', berichteAb: -3,
    plan: { P0: -6, P1: 1, P2: 8, P3: 14, P4: 16 }, budget: { P1: 250_000, P2: 1_400_000, P3: 1_900_000, P4: 120_000 },
    text: {
      ausgangslage: 'Befunde, Termine und Rechnungen gehen per Post an die Patientinnen und Patienten.',
      problem: 'Hohe Portokosten, Rückfragen am Telefon, kein digitaler Zugang zu eigenen Daten.',
      ziele: 'Ein Portal für Termine, Befunde, Rechnungen und die Vorerfassung der Aufnahme.',
      nutzen: 'Weniger Telefonanfragen, tiefere Portokosten, bessere Patientenerfahrung.',
      loesung: 'Standardportal mit Anbindung an KIS und elektronisches Patientendossier.',
      businessCase: 'Einsparung von 0,8 Mio. CHF pro Jahr an Porto und Telefonie.',
    },
    kpis: [{ art: 'nicht_klinisch', text: 'Registrierte Nutzende', einheit: 'Anzahl', zielwert: '≥ 20 000' }],
    risiken: [{ text: 'Datenschutzanforderungen verzögern die Freigabe', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel', massnahme: 'Datenschutzberatung von Beginn an' }],
    stakeholder: [S('Patientenorganisationen', 'Einfacher Zugang', 'mittel', 'Testgruppe mit Patientinnen und Patienten')],
  },
  {
    key: 'forschung', name: 'Datenplattform Forschung', portfolio: 'A', phase: 'P2', sp: 'thomas', pl: 'marco', ctl: 'simon', kt: [], vertraulich: true,
    orgEinheit: 'DLF', handlungsfeld: 'medizin', ziel: '3.2', berichteAb: -4,
    plan: { P0: -10, P1: -6, P2: 5, P3: 12, P4: 14 }, budget: { P2: 1_600_000, P3: 2_200_000, P4: 200_000 },
    text: {
      ausgangslage: 'Forschungsdaten liegen verteilt in Kliniksystemen und Tabellen.',
      problem: 'Aufwendige Datenbeschaffung für Studien, Risiken beim Datenschutz.',
      ziele: 'Eine Plattform für pseudonymisierte klinische Daten mit kontrolliertem Zugang.',
      nutzen: 'Schnellere Studien, höhere Drittmittel, Einhaltung des Humanforschungsgesetzes.',
      loesung: 'Data Warehouse mit Einwilligungsmanagement und Forschungsumgebung.',
      businessCase: 'Zusätzliche Drittmittel von 1,5 Mio. CHF pro Jahr.',
    },
    kpis: [{ art: 'projekt', text: 'Angeschlossene Quellsysteme', einheit: 'Anzahl', zielwert: '5' }],
    risiken: [{ text: 'Generalkonsent nicht flächendeckend vorhanden', wahrscheinlichkeit: 'mittel', auswirkung: 'hoch', massnahme: 'Einwilligung in der digitalen Aufnahme abfragen' }],
    stakeholder: [S('Forschende', 'Schneller Datenzugang', 'hoch', 'Pilotstudien auswählen'), S('Ethikkommission', 'Rechtskonforme Nutzung', 'hoch', 'Frühe Abstimmung')],
  },
  {
    key: 'tele', name: 'Telemedizinische Nachsorge', portfolio: 'A', phase: 'P0', sp: 'claudia', pl: 'sandra', ctl: 'lea', kt: ['sarah'], ausIdee: true,
    orgEinheit: 'AeD', handlungsfeld: 'patient', ziel: '2.2', berichteAb: -1,
    plan: { P0: 1, P1: 5, P2: 11, P3: 18, P4: 20 }, budget: { P1: 90_000, P2: 450_000, P3: 700_000, P4: 60_000 },
    text: {
      ausgangslage: 'Nach der Entlassung fehlen strukturierte Kontakte; Wiedereintritte sind häufig.',
      problem: 'Vermeidbare Wiedereintritte bei chronisch Kranken, hohe Belastung der Hausärztinnen und Hausärzte.',
      ziele: 'Nachsorge per Video und Telemonitoring für Herzinsuffizienz und COPD.',
      nutzen: 'Wiedereintritte um 20 % gesenkt, bessere Lebensqualität.',
      loesung: 'Telemonitoring-Plattform mit Messgeräten und Pflegesprechstunde per Video.',
      businessCase: 'Vermiedene Wiedereintritte von 1,1 Mio. CHF pro Jahr.',
    },
    kpis: [{ art: 'klinisch', text: 'Wiedereintritte innert 30 Tagen', einheit: '%', zielwert: '− 20 %' }],
    risiken: [{ text: 'Tarifierung der Telemedizin ungeklärt', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel', massnahme: 'Pilot mit Versicherern vereinbaren' }],
    stakeholder: [S('Hausärztinnen und Hausärzte', 'Einbindung in die Nachsorge', 'mittel', 'Information über das Zuweiserportal')],
  },
  {
    key: 'labor', name: 'Laborautomatisierung', portfolio: 'A', phase: 'P4', sp: 'thomas', pl: 'simon', ctl: 'lea', kt: ['jonas'],
    orgEinheit: 'DMS-LAB', handlungsfeld: 'wirtschaft', ziel: '5.2', berichteAb: 99,
    plan: { P0: -30, P1: -26, P2: -20, P3: -6, P4: 0 }, budget: {},
    text: {
      ausgangslage: 'Proben wurden manuell sortiert und verteilt.', problem: 'Lange Durchlaufzeiten.', ziele: 'Automatische Probenstrasse.',
      nutzen: 'Kürzere Durchlaufzeiten.', loesung: 'Probenstrasse mit Rohrpost.', businessCase: 'Einsparung 6 FTE.',
    },
    kpis: [], risiken: [], stakeholder: [],
  },
  {
    key: 'erp', name: 'ERP-Migration Finanzen', portfolio: 'B', phase: 'P2', sp: 'martina', pl: 'patrick', ctl: 'simon', kt: ['nina', 'sandra'],
    orgEinheit: 'DTI-ICT', handlungsfeld: 'wirtschaft', ziel: '5.1', berichteAb: -4,
    plan: { P0: -10, P1: -6, P2: 3, P3: 9, P4: 11 }, budget: { P2: 1_200_000, P3: 1_800_000, P4: 150_000 },
    text: {
      ausgangslage: 'Das ERP für Finanzen und Einkauf wird nicht mehr unterstützt.', problem: 'Manuelle Abschlüsse, fehlende Kostenträgerrechnung.',
      ziele: 'Neues ERP in der Cloud für Finanzen, Einkauf und Logistik.', nutzen: 'Schnellere Abschlüsse, bessere Kostentransparenz.',
      loesung: 'Migration auf die Cloud-Version des Herstellers.', businessCase: 'Tiefere Betriebskosten von 0,4 Mio. CHF pro Jahr.',
    },
    kpis: [{ art: 'projekt', text: 'Migrierte Mandanten', einheit: 'Anzahl', zielwert: '4' }],
    risiken: [{ text: 'Datenqualität der Kreditoren', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel', massnahme: 'Bereinigung vor der Migration' }],
    stakeholder: [S('Finanzen', 'Stabiler Abschluss', 'hoch', 'Parallelbetrieb im ersten Quartal')],
  },
  {
    key: 'einkauf', name: 'Einkauf Rahmenverträge', portfolio: 'B', phase: 'P3', sp: 'martina', pl: 'daniel', ctl: 'simon', kt: ['nina'],
    orgEinheit: 'DIB', handlungsfeld: 'wirtschaft', ziel: '5.2', berichteAb: -3,
    plan: { P0: -12, P1: -9, P2: -5, P3: 4, P4: 6 }, budget: { P3: 350_000, P4: 40_000 },
    text: {
      ausgangslage: 'Viele Einzelbestellungen ohne Rahmenvertrag.', problem: 'Hohe Sachkosten, wenig Verhandlungsmacht.',
      ziele: 'Rahmenverträge für die zehn grössten Warengruppen.', nutzen: 'Sachkosten um 2 % gesenkt.',
      loesung: 'Ausschreibungen gemeinsam mit Partnerspitälern.', businessCase: 'Einsparung von 3 Mio. CHF pro Jahr.',
    },
    kpis: [{ art: 'nicht_klinisch', text: 'Volumen unter Rahmenvertrag', einheit: '%', zielwert: '≥ 70' }],
    risiken: [{ text: 'Lieferengpässe bei Medizinprodukten', wahrscheinlichkeit: 'mittel', auswirkung: 'mittel', massnahme: 'Zweitlieferanten festlegen' }],
    stakeholder: [S('Kliniken', 'Gewohnte Produkte', 'mittel', 'Produktkommission einbinden')],
  },
  {
    key: 'energie', name: 'Energieeffizienz Gebäude', portfolio: 'B', phase: 'P1', sp: 'martina', pl: 'jonas', ctl: 'simon', kt: [],
    orgEinheit: 'DIB', handlungsfeld: 'wirtschaft', ziel: '5.1', berichteAb: -2,
    plan: { P0: -4, P1: 3, P2: 10, P3: 20, P4: 22 }, budget: {},
    text: {
      ausgangslage: 'Hoher Energieverbrauch der Bettenhäuser.', problem: 'Steigende Energiekosten.', ziele: 'Verbrauch um 15 % senken.',
      nutzen: 'Tiefere Energiekosten.', loesung: 'Gebäudeautomation und Wärmerückgewinnung.', businessCase: 'Amortisation nach 7 Jahren.',
    },
    kpis: [], risiken: [], stakeholder: [],
  },
  {
    key: 'skills', name: 'Skill-Grade-Mix auf den Stationen', portfolio: 'C', phase: 'P2', sp: 'eva', pl: 'sarah', ctl: null, kt: [],
    orgEinheit: 'DPF', handlungsfeld: 'kultur', ziel: '1.2', berichteAb: 99,
    plan: { P0: -8, P1: -5, P2: 4, P3: 9, P4: 10 }, budget: {},
    text: {
      ausgangslage: 'Aufgaben auf den Stationen sind nicht nach Ausbildungsstufen verteilt.', problem: 'Fachpersonen erledigen einfache Aufgaben.',
      ziele: 'Aufgabenverteilung nach Kompetenz.', nutzen: 'Entlastung der Fachpersonen.', loesung: 'Neues Aufgabenmodell je Station.', businessCase: 'Ohne zusätzliche Kosten.',
    },
    kpis: [], risiken: [], stakeholder: [],
  },
];

/** Projekt anlegen (UE bzw. Direktion für C) mit Projektorganisation. */
export async function projektAnlegen(k: Kontext, d: ProjektDef): Promise<Projekt> {
  const wer = d.portfolio === 'C' ? k.p.eva : k.p.ursula;
  const pf = k.portfolios[d.portfolio];
  const r = await wer.post<{ id: string; nummer: string }>('/v1/projekte', {
    name: d.name, portfolioId: pf.id, phase: d.phase, orgEinheitId: k.orgEinheiten[d.orgEinheit], handlungsfeldId: k.handlungsfelder[d.handlungsfeld], vertraulich: d.vertraulich ?? false,
  });
  const pj: Projekt = { key: d.key, id: r.body.id, nummer: r.body.nummer, name: d.name, portfolio: pf, phase: d.phase, lebenszyklus: 'aktiv', sp: d.sp, pl: d.pl, ctl: d.ctl, kt: d.kt, berichteAb: d.berichteAb };
  await organisation(k, pj, 'W/"0"');
  k.projekte[d.key] = pj;
  return pj;
}

export async function organisation(k: Kontext, pj: Projekt, ifMatch?: string): Promise<void> {
  const akv: Record<string, string> = { sp: 'Auftrag erteilen, Mittel sichern, Änderungen entscheiden', pl: 'Projekt führen und berichten', ctl: 'Klinische Sicht und Einführung verantworten', kt: 'Fachliche Mitarbeit' };
  const mitglieder = [
    { personId: pid(k, pj.sp), funktion: 'sp', akv: akv.sp },
    { personId: pid(k, pj.pl), funktion: 'pl', akv: akv.pl },
    ...(pj.ctl ? [{ personId: pid(k, pj.ctl), funktion: 'ctl', akv: akv.ctl }] : []),
    ...pj.kt.map(x => ({ personId: pid(k, x), funktion: 'kt', akv: akv.kt })),
  ];
  const url = `/v1/projekte/${pj.id}/organisation`;
  await k.p.ursula.put(url, { mitglieder }, ifMatch ?? (await k.p.ursula.get(url)).etag);
}

export const def = (key: string) => PROJEKTE.find(d => d.key === key);
const naechste = (p: Phase) => PHASEN[PHASEN.indexOf(p) + 1]!;
const phaseStart = (d: ProjektDef, p: Phase) => p === 'P0' ? d.plan.P0 - 3 : d.plan[PHASEN[PHASEN.indexOf(p) - 1]!] + 1;

/** Kapitel lesen, Felder ersetzen, speichern. */
async function kapitel(pl: Als, v: string, nr: number, felder: Record<string, unknown>): Promise<void> {
  const url = `/v1/vertragsversionen/${v}/kapitel/${nr}`;
  const r = await pl.get<{ inhalt: Record<string, unknown> }>(url);
  await pl.put(url, { inhalt: { ...r.body.inhalt, ...felder } }, r.etag);
}

/** Inhalt des ersten Vertrags: alle Kapitel mit Plan bis P4 (Pflichtangaben Kap. 9 für jede Zielphase). */
async function kapitelInitial(k: Kontext, d: ProjektDef, pj: Projekt, v: string): Promise<void> {
  const pl = k.p[pj.pl];
  const ab = PHASEN.slice(Math.max(1, PHASEN.indexOf(d.phase)));
  await kapitel(pl, v, 1, { ausgangslage: d.text.ausgangslage, problemstellung: d.text.problem, ohneProjekt: 'Die heutigen Probleme bleiben bestehen und verschärfen sich.', vorprojekte: '', rahmenbedingungen: 'Vorgaben des PM-Handbuchs, Datenschutz und Informationssicherheit.' });
  await kapitel(pl, v, 2, { strategischesZielId: k.ziele.strategisch[d.ziel], jahreszielId: k.ziele.jahr[d.ziel] ?? null, beitrag: `Leistet einen direkten Beitrag zum strategischen Ziel ${d.ziel}.` });
  await kapitel(pl, v, 3, { ziele: d.text.ziele, nutzen: d.text.nutzen, businessCase: d.text.businessCase, kpis: d.kpis.map(x => ({ registerId: null, ...x })) });
  await kapitel(pl, v, 4, { loesungsansatz: d.text.loesung, annahmen: 'Die benötigten Fachpersonen werden wie geplant freigestellt.' });
  await kapitel(pl, v, 5, { bearbeitet: d.text.ziele, nichtBearbeitet: 'Anpassungen an Umsystemen ausserhalb des Projektumfangs.' });
  const abh = d.key === 'aufnahme' && k.projekte.kis ? [{ registerId: null, zuProjektId: k.projekte.kis.id, text: 'Schnittstelle zur Patientenadministration im neuen KIS', ansprechperson: 'Marco Frei' }]
    : d.key === 'portal' && k.projekte.aufnahme ? [{ registerId: null, zuProjektId: k.projekte.aufnahme.id, text: 'Vorerfassung der Aufnahme im Portal', ansprechperson: 'Sandra Huber' }]
      : d.key === 'logistik' && k.projekte.erp ? [{ registerId: null, zuProjektId: k.projekte.erp.id, text: 'Bestellungen über das neue ERP', ansprechperson: 'Patrick Meier' }] : [];
  await kapitel(pl, v, 6, { abhaengigkeiten: abh, schnittstellen: 'KIS, ERP und Identitätsverwaltung.' });
  const meilensteine = ab.flatMap(p => [
    { registerId: null, phase: p, art: 'meilenstein', text: p === 'P4' ? 'Projektabschluss' : `Gate ${p}–${naechste(p)} vorbereitet`, termin: monatsende(monat(d.plan[p])) },
    ...(d.abnahme?.phase === p ? [{ registerId: null, phase: p, art: 'meilenstein', text: d.abnahme.text, termin: monatsende(monat(d.plan[p] - 4)) }] : []),
    ...(p === 'P3' ? [{ registerId: null, phase: p, art: 'lieferergebnis', text: 'Einführung abgeschlossen', termin: monatsende(monat(d.plan[p] - 1)) }] : []),
  ]);
  await kapitel(pl, v, 7, {
    vorgehen: 'Vorgehen nach Phasenmodell mit Gate je Phase; Einführung in Etappen.',
    meilensteine,
    termine: { projektStart: `${monat(phaseStart(d, 'P0'))}-01`, phasenStart: `${monat(phaseStart(d, d.phase === 'P0' ? 'P1' : d.phase))}-01`, phasenExit: monatsende(monat(d.plan[d.phase === 'P0' ? 'P1' : d.phase])), projektabschluss: monatsende(monat(d.plan.P4)) },
  });
  await kapitel(pl, v, 8, { mitglieder: [['sp', pj.sp], ['pl', pj.pl], ...(pj.ctl ? [['ctl', pj.ctl]] : [])].map(([funktion, wer]) => ({ personId: pid(k, wer as PersonKey), funktion, akv: '' })) });
  const kosten = ab.flatMap(p => {
    const b = d.budget[p] ?? 50_000;
    return [
      { registerId: null, phase: p, art: 'capex', text: p === 'P1' ? 'Konzept und Ausschreibung' : 'Lizenzen, Hardware und Umsetzung', lieferant: '', offerte: '', betrag: Math.round(b * 0.7) },
      { registerId: null, phase: p, art: 'opex', text: 'Externe Begleitung und Schulung', lieferant: '', offerte: '', betrag: Math.round(b * 0.3) },
    ];
  });
  const personal = ab.flatMap(p => {
    const von = monat(phaseStart(d, p)), bis = monat(d.plan[p]);
    return [
      { registerId: null, phase: p, rolle: 'projektleitung', groesse: null, fte: 0.8, vonMonat: von, bisMonat: bis, bemerkung: '' },
      ...(p === 'P2' || p === 'P3' ? [
        { registerId: null, phase: p, rolle: 'ctl', groesse: null, fte: 0.5, vonMonat: von, bisMonat: bis, bemerkung: '' },
        { registerId: null, phase: p, rolle: 'projektmitarbeit', groesse: null, fte: p === 'P3' ? 3 : 2, vonMonat: von, bisMonat: bis, bemerkung: 'Fachpersonen aus den Kliniken' },
      ] : []),
    ];
  });
  await kapitel(pl, v, 9, { kosten, personal });
  await kapitel(pl, v, 10, { risiken: d.risiken.map(x => ({ registerId: null, ...x, verantwortlich: k.personen[pj.pl].first + ' ' + k.personen[pj.pl].last })) });
  await kapitel(pl, v, 11, {
    stakeholder: d.stakeholder.map(x => ({ registerId: null, ...x })),
    kommunikation: [{ registerId: null, phase: ab[0], text: 'Information der betroffenen Kliniken', adressat: 'Klinikleitungen', ziel: 'Vorhaben bekannt machen', termin: monatsende(monat(phaseStart(d, ab[0]!))) }],
  });
  await kapitel(pl, v, 12, { bemerkung: '' });
}

/** Leitfragen des Gates beantworten (vor dem Einreichen). */
async function leitfragen(pl: Als, v: string): Promise<void> {
  const g = await pl.get<{ leitfragen: { id: string; text: string }[] }>(`/v1/vertragsversionen/${v}/gate`);
  for (const f of g.body.leitfragen) await pl.put(`/v1/vertragsversionen/${v}/gate/leitfragen/${f.id}`, { antwort: 'Ja, im Projektvertrag beschrieben und mit dem Sponsor abgestimmt.' }, 'W/"0"');
}

/**
 * Vertrag für das nächste Gate bis zur Unterschrift: Entwurf, Kapitel, Leitfragen, Einreichen, Quality-Check,
 * Unterschriften. `bis` hält früher an (für offene Stände in der Demo).
 */
export async function vertrag(k: Kontext, pj: Projekt, bis: 'entwurf' | 'eingereicht' | 'unterzeichnet' = 'unterzeichnet'): Promise<string> {
  const d = def(pj.key)!;
  const pl = k.p[pj.pl];
  const hat = (await pl.get<{ baseline: string | null }>(`/v1/projekte/${pj.id}/vertrag`)).body.baseline;
  const e = await pl.post<{ version: { id: string } }>(`/v1/projekte/${pj.id}/vertrag/entwuerfe`, { anlass: hat ? 'gate' : 'initial' });
  const v = e.body.version.id;
  if (hat) await kapitel(pl, v, 4, { annahmen: `Erkenntnisse aus ${pj.phase} sind eingearbeitet; Planung für ${naechste(pj.phase as Phase)} bestätigt.` });
  else await kapitelInitial(k, d, pj, v);
  await leitfragen(pl, v);
  if (bis === 'entwurf') return v;
  const r = await pl.mitEtag('POST', `/v1/vertragsversionen/${v}`, `/v1/vertragsversionen/${v}/einreichen`);
  if (bis === 'eingereicht') return v;
  await k.p.ursula.post(`/v1/vertragsversionen/${v}/quality-check`, { ergebnis: 'bestaetigt' }, r.etag);
  for (const wer of [pj.sp, pj.pl, pj.ctl]) {
    if (!wer) continue;
    await k.p[wer].mitEtag('POST', `/v1/vertragsversionen/${v}/pruefung`, `/v1/vertragsversionen/${v}/unterschriften`, { ergebnis: 'unterzeichnet' });
  }
  return v;
}

/** Phase und Lebenszyklus nach Entscheiden nachlesen. */
export async function nachlesen(k: Kontext, pj: Projekt): Promise<void> {
  const r = await k.p.ursula.get<{ phase: string; lebenszyklus: Projekt['lebenszyklus'] }>(`/v1/projekte/${pj.id}`);
  pj.phase = r.body.phase;
  pj.lebenszyklus = r.body.lebenszyklus;
}
