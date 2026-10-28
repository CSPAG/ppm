/**
 * Texte des Features «Sitzungen» (Namensraum je Feature, docs/fachmodell.md 7.2): Anrede «Sie» (UX-E7), Schweizer
 * Rechtschreibung, Begriffe und Schaltflächen aus K3 (docs/ux/ablaeufe/K3-gremiumssitzung.md «Texte»).
 */
export const TS = {
  bereich: 'Sitzungen',
  title: 'Sitzungen',
  inhalt: 'Inhalt der Sitzung',
  sub: 'Sitzungen der Gremien vorbereiten: Traktandenliste aus Vorschlägen, Unterlagen prüfen und spätestens 5 Arbeitstage vorher versenden.',
  keineGremien: 'Sie sehen noch keine Sitzungen. Sitzungen entstehen aus den Sitzungsterminen der Gremien (Administration › Portfolios und Gremien).',
  keineTermine: 'Für dieses Gremium sind keine weiteren Sitzungstermine geplant.',
  spalten: { datum: 'Datum', stand: 'Stand', traktanden: 'Traktanden' },
  oeffnen: (g: string, d: string) => `Sitzung ${g} ${d} öffnen`,
  mehrLaden: 'Weitere Termine',

  stand: {
    geplant: 'geplant', in_vorbereitung: 'in Vorbereitung', versendet: 'Unterlagen versendet', laufend: 'läuft',
    geschlossen: 'geschlossen', protokoll_versendet: 'Protokoll versendet',
  } as Record<string, string>,

  // Kopf (K3 Schritt 1)
  sitzungTitel: (g: string, d: string) => `${g}-Sitzung ${d}`,
  versandBis: 'Versand bis',
  versendetAm: (z: string) => `Unterlagen versendet am ${z}`,
  ort: 'Ort', beginn: 'Beginn', dauer: 'Dauer',
  zeitbedarf: (ist: string, soll: string | null) => (soll ? `${ist} von ${soll}` : ist),
  zeitbedarfTitel: 'Zeitbedarf',

  // Zustände
  leer: (n: number) => (n
    ? `Noch keine Traktanden. Rechts stehen ${n} ${n === 1 ? 'Vorschlag' : 'Vorschläge'} aus Gates, Eskalationen und Änderungen.`
    : 'Noch keine Traktanden und keine Vorschläge. Planen Sie ein Geschäft ein, zum Beispiel ein Gate-Review.'),
  leerLesen: 'Die Traktandenliste erscheint mit dem Versand der Unterlagen.',
  nichtAngelegt: 'Zu diesem Termin ist die Sitzung noch nicht angelegt.',
  anlegen: 'Sitzung vorbereiten',
  angelegt: 'Sitzung angelegt.',
  gone: 'Diese Sitzung gibt es nicht, oder Sie sehen sie nicht.',
  nurLesen: 'Sie sehen die Sitzung lesend. Die Traktandenliste bereitet die Unternehmensentwicklung vor.',
  versendetBanner: (z: string) => `Unterlagen versendet am ${z}. Die Traktandenliste ist fest.`,
  konflikt: 'Die Sitzung wurde inzwischen geändert. Sie ist neu geladen; wiederholen Sie Ihre letzte Aktion.',

  // Traktandenliste (K3 Schritte 2–3)
  liste: 'Traktandenliste',
  griff: (n: number, t: string) => `${n}. ${t}: mit Alt+Pfeil nach oben oder unten verschieben`,
  nachOben: (t: string) => `${t} nach oben`,
  nachUnten: (t: string) => `${t} nach unten`,
  entfernen: 'Aus der Liste nehmen',
  // festes Traktandum 1 (K3 Schritt 4)
  festHinweis: 'Dieses Traktandum ist in jeder Sitzung gesetzt und bleibt Traktandum 1; Sie können es weder entfernen noch verschieben.',
  festPlatzhalter: 'Der Portfoliobericht ist noch nicht bereitgestellt. «Portfoliobericht erzeugen» im abgeschlossenen Dashboard füllt dieses Traktandum.',
  entfernt: 'Traktandum aus der Liste genommen.',
  verschieben: 'Auf nächste Sitzung verschieben',
  verschoben: (d: string) => `Traktandum auf ${d} verschoben.`,
  rueckgaengig: 'Rückgängig',
  eingeladen: 'Eingeladen',
  keineEinladung: 'niemand eingeladen',
  funktion: { pl: 'PL', ctl: 'CTL', sp: 'SP', weitere: 'weitere' } as Record<string, string>,
  antrag: 'Antrag',
  minuten: (n: number) => `${n} Min.`,
  ohneZeit: 'Zeitbedarf offen',
  viaSns: 'via SNS-VR',
  viaSnsHinweis: 'Der Entscheid des Gremiums ist eine Stellungnahme; er gilt erst mit dem SNS-VR.',
  verschobenVon: (d: string) => `verschoben von ${d}`,
  vertraulich: 'vertraulich',
  unterlagen: {
    bereit: 'Unterlagen bereit', quality_check_offen: 'Quality-Check offen', fehlt: 'Unterlagen fehlen', keine: 'keine Unterlagen nötig',
  } as Record<string, string>,
  unterlagenWarnung: (titel: string, rest: string) => `Unterlagen für ${titel} fehlen; Versand ${rest}. Verschieben Sie das Traktandum auf die nächste Sitzung oder warten Sie auf die Unterlagen.`,
  qcWarnung: (titel: string) => `Quality-Check: offen für ${titel}. Ohne bestandenen Quality-Check wird das Geschäft nicht behandelt.`,
  zeitbedarfHinweis: (ist: string, soll: string) => `Zeitbedarf: ${ist} statt höchstens ${soll}. Verschieben Sie ein Traktandum oder kürzen Sie die Zeit.`,

  // Vorschläge (K3 Schritt 1)
  vorschlaege: 'Vorschläge',
  keineVorschlaege: 'Keine offenen Vorschläge.',
  aufnehmen: 'Aufnehmen',
  aufnehmenName: (t: string) => `${t} aufnehmen`,
  aufgenommen: 'Traktandum aufgenommen.',
  einplanen: 'Gate-Review einplanen',

  // Versand (K3 Schritt 5, I-R1 Stufe 3)
  versenden: 'Unterlagen versenden',
  versandTitel: 'Unterlagen jetzt versenden?',
  versandMitglieder: (g: string, n: number, packets: number, bericht: number) => {
    const teile = [`Traktandenliste (${n} ${n === 1 ? 'Traktandum' : 'Traktanden'})`];
    if (bericht) teile.push(bericht === 1 ? 'Portfoliobericht' : `${bericht} Berichte`);
    if (packets) teile.push(packets === 1 ? '1 Gate Review Packet' : `${packets} Gate Review Packets`);
    return `Die Mitglieder des ${g} erhalten ${teile.join(', ').replace(/, ([^,]*)$/, ' und $1')}.`;
  },
  versandEingeladene: (n: number) => (n === 1 ? '1 eingeladene Person erhält Einladung und Zeitfenster.' : `${n} Eingeladene erhalten Einladung und Zeitfenster.`),
  versandVerschoben: (n: number) => `Projektleitung und Sponsor von ${n} verschobenen ${n === 1 ? 'Traktandum' : 'Traktanden'} werden informiert.`,
  fristEingehalten: (n: number) => `Frist 5 Arbeitstage: eingehalten (${n} Arbeitstage vor der Sitzung).`,
  fristVerletzt: (n: number, soll: number) => `Versand: ${n} statt mindestens ${soll} Arbeitstage vor der Sitzung.`,
  versandWarnungen: (n: number) => `${n} ${n === 1 ? 'Traktandum hat' : 'Traktanden haben'} keine vollständigen Unterlagen.`,
  versandOk: 'Unterlagen versendet.',
  weiterBearbeiten: 'Weiter bearbeiten',
  fristBanner: (n: number, soll: number) => `Versand: ${n} statt mindestens ${soll} Arbeitstage vor der Sitzung.`,
};
