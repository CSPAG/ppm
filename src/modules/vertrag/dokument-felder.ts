/**
 * Feldkatalog des Projektvertrags für eigene Word-Vorlagen (AM.03.01, UC-018 Schritt 2; AP-E7-7): Datenfelder, denen die
 * UE die Platzhalter ihrer Vorlage («Projektname») zuordnet. Die Werte liefert `vertragDokument` über die Blöcke mit
 * `feld` (gleiche Texte wie im Grundbestand); Listen erscheinen als Text mit einer Zeile je Eintrag.
 */
import type { VorlageFeld } from '../vorlage/index.ts';

const g = (gruppe: string, felder: [string, string][]): VorlageFeld[] => felder.map(([schluessel, bezeichnung]) => ({ schluessel, bezeichnung, gruppe }));

export const VERTRAG_FELDER: readonly VorlageFeld[] = [
  ...g('Deckblatt', [
    ['projekt.nummer', 'Projektnummer'], ['projekt.name', 'Projektname'], ['version.nummer', 'Version'], ['version.phase', 'Phase'],
    ['version.datum', 'Datum'], ['version.status', 'Status'], ['version.freigabe', 'Freigabe'], ['projekt.klassifikation', 'Klassifikation'],
    ['rolle.sponsor', 'Projektauftraggeber:in'], ['rolle.projektleitung', 'Projektleitung'],
    ['projekt.kategorie', 'Projektkategorie'], ['versionierung', 'Versionierung und Änderungstracking'],
    ['version.begruendung', 'Begründung der Änderung'], ['dokument.datum', 'Erstellt am'],
  ]),
  ...g('1 Ausgangslage / Problembeschreibung', [
    ['kap1.ausgangslage', 'Ausgangslage'], ['kap1.problemstellung', 'Problemstellung'], ['kap1.ohneProjekt', 'Was geschieht ohne das Projekt'],
    ['kap1.vorprojekte', 'Vorprojekte und Initiativen'], ['kap1.rahmenbedingungen', 'Vorgaben und Rahmenbedingungen'],
  ]),
  ...g('2 Strategiebezug', [['kap2.handlungsfeld', 'Handlungsfeld'], ['kap2.ziel', 'Strategisches Ziel'], ['kap2.jahresziel', 'Jahresziel'], ['kap2.beitrag', 'Beitrag zum Ziel']]),
  ...g('3 Ziele und Nutzenbeitrag', [['kap3.ziele', 'Ziele'], ['kap3.nutzen', 'Nutzenbeitrag'], ['kap3.businessCase', 'Business Case'], ['kap3.kpis', 'KPIs']]),
  ...g('4 Lösungsansatz', [['kap4.loesungsansatz', 'Lösungsansatz'], ['kap4.annahmen', 'Annahmen']]),
  ...g('5 Abgrenzung', [['kap5.bearbeitet', 'Im Projekt bearbeitet'], ['kap5.nichtBearbeitet', 'Nicht bearbeitet']]),
  ...g('6 Abhängigkeiten', [['kap6.abhaengigkeiten', 'Abhängigkeiten'], ['kap6.schnittstellen', 'Weitere Schnittstellen']]),
  ...g('7 Projektplanung und Lieferergebnisse', [
    ['kap7.vorgehen', 'Tätigkeiten je Phase'], ['kap7.meilensteine', 'Lieferergebnisse und Meilensteine'], ['kap7.projektStart', 'Projektstart'],
    ['kap7.phasenStart', 'Start der Phase'], ['kap7.phasenExit', 'Exit der Phase'], ['kap7.projektabschluss', 'Erwarteter Projektabschluss'],
    ['kap7.toleranzTermin', 'Toleranz Termin'], ['kap7.toleranzKosten', 'Toleranz Kosten'], ['kap7.toleranzUmfang', 'Toleranz Umfang'],
  ]),
  ...g('8 Projektstruktur und Organisation', [['kap8.mitglieder', 'Projektorganisation']]),
  ...g('9 Ressourcen', [['kap9.kosten', 'Kosten'], ['kap9.total', 'Kosten total'], ['kap9.personal', 'Personal']]),
  ...g('10 Risiko-Management', [['kap10.risiken', 'Risiken']]),
  ...g('11 Change Management', [['kap11.stakeholder', 'Stakeholder'], ['kap11.kommunikation', 'Kommunikation']]),
  ...g('12 Freigabe', [['version.eingereicht', 'Eingereicht'], ['kap12.unterschriften', 'Unterschriften'], ['kap12.bemerkung', 'Bemerkungen zur Freigabe']]),
  ...g('13 Beilagen', [['kap13.beilagen', 'Beilagen']]),
];
