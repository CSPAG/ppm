/**
 * Texte der Szenarien (UI-22; K5 Schritte 5–6, «Texte», «Regeln und Rückmeldungen»; eigene Datei von AP-E5-3): Anrede
 * «Du» (UX-OF-1, #121), Schweizer Rechtschreibung; Regeln mit Ist-Wert und Ausweg (I-P2).
 */
import { fmtBetragKurz, fmtFte } from '../../ui/index.ts';

const projekte = (n: number) => (n === 1 ? '1 Projekt' : `${n} Projekte`);
const MONATE = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
export const fmtMonat = (m: string) => `${MONATE[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
export const fmtQuartalVon = (m: string) => `Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1} ${m.slice(0, 4)}`;

export const TS = {
  sub: 'Reihenfolge und Start durchspielen; die Wasserlinie zeigt, wo Budget oder Kapazität reissen.',
  portfolio: 'Portfolio',
  szenario: 'Szenario',
  szenarien: 'Szenarien',
  anlegen: 'Szenario anlegen',
  name: 'Name des Szenarios',
  nameFehlt: 'Gib dem Szenario einen Namen.',
  nameVorschlag: (n: number) => `Szenario ${String.fromCharCode(65 + Math.min(n, 25))}`,
  angelegt: (name: string) => `Szenario «${name}» angelegt.`,
  vergleichen: 'Szenarien vergleichen',
  vergleichAuswahl: 'Szenarien für den Vergleich (bis drei)',
  zurueck: 'Zum Szenario',
  // Zustände
  leer: 'Noch kein Szenario. Ein Szenario ist eine Kopie des Ist-Stands, mit der du Reihenfolge und Start durchspielst.',
  keinPortfolio: 'Es gibt noch kein Portfolio, das du siehst.',
  portfolioUnbekannt: 'Dieses Portfolio gibt es nicht, oder du siehst es nicht.',
  unbekannt: 'Dieses Szenario gibt es nicht, oder du siehst es nicht.',
  banner: (name: string) => `Szenario «${name}»: Der Ist-Stand des Portfolios ändert sich nicht.`,
  nurLesen: 'Du kannst das Szenario nur ansehen; Szenarien pflegt die Unternehmensentwicklung.',
  schmal: 'Umordnen geht ab einer Breite von 1024 px; hier siehst du das Szenario nur.',
  stand: { entwurf: 'Entwurf', beantragt: 'als Antrag gewählt', entschieden: 'entschieden', verworfen: 'verworfen' } as Record<string, string>,
  // Rangliste
  liste: 'Rangliste des Szenarios',
  tastatur: 'Alt+↑ / Alt+↓ verschiebt das Projekt; Ziehen mit der Maus geht auch.',
  rang: 'Rang', projekt: 'Projekt', start: 'Start', geplant: (m: string) => `geplant ${fmtMonat(m)}`, startWieGeplant: 'wie geplant',
  enthalten: 'enthalten', kosten: 'Kosten', kumuliert: 'kumuliert', ressourcen: 'Ressourcen', fteMonate: (n: number) => `${fmtFte(n)}-Monate`,
  groesse: (g: string) => `Grösse ${g}`, geschaetzt: 'nicht gerechnet',
  hoch: (nr: string) => `${nr} nach oben`, runter: (nr: string) => `${nr} nach unten`,
  startLabel: (nr: string) => `Start von ${nr}`,
  enthaltenLabel: (nr: string) => `${nr} im Szenario enthalten`,
  verschoben: (nr: string, rang: number, ueber: boolean | null) => `${nr} auf Rang ${rang}${ueber === null ? '' : ueber ? ', über der Wasserlinie' : ', unter der Wasserlinie'}`,
  wasserlinie: 'Wasserlinie',
  unterWasserlinie: 'unter der Wasserlinie',
  ohneWasserlinie: 'Alle enthaltenen Projekte liegen über der Wasserlinie.',
  nichtEnthalten: 'nicht enthalten',
  neu: 'neu im Portfolio',
  speichert: 'Wird gerechnet …',
  // Regeln (K5 «Regeln und Rückmeldungen»)
  budget: (bedarf: number, rahmen: number, portfolio: string, unter: number) =>
    `Budget: ${fmtBetragKurz(bedarf)} statt höchstens ${fmtBetragKurz(rahmen)} (${portfolio}). Unter der Wasserlinie: ${projekte(unter)}.`,
  kapazitaet: (monat: string, bedarf: number, rolle: string, angebot: number, betroffen: number) =>
    `Kapazität ${fmtQuartalVon(monat)}: ${fmtFte(bedarf)} ${rolle} statt höchstens ${fmtFte(angebot)}. Betroffen: ${projekte(betroffen)}.`,
  ausweg: { budget: 'Rang oder Start ändern', kapazitaet: 'Start verschieben' },
  engpaesse: 'Engpässe je Quartal und Rolle',
  keineEngpaesse: 'Keine Engpässe: Die Kapazität reicht in allen Monaten.',
  engpass: (quartal: string, bedarf: number, rolle: string, angebot: number, betroffen: number) =>
    `${quartal}: ${fmtFte(bedarf)} ${rolle} statt höchstens ${fmtFte(angebot)}. Betroffen: ${projekte(betroffen)}.`,
  ohneAngebot: 'kein Angebot erfasst',
  // Vergleich (K5 Schritt 6)
  vergleich: 'Szenarienvergleich',
  vergleichSub: 'Bis drei Szenarien nebeneinander; Unterschiede sind hervorgehoben.',
  kennzahl: 'Kennzahl',
  kostenUeber: 'Kosten über der Wasserlinie',
  budgetrahmen: 'Budgetrahmen',
  nutzen: 'Nutzen hoch / tief', risiko: 'Risiko hoch / tief', strategie: 'Strategiebeitrag hoch / mittel / tief',
  anzahl: (a: number, b: number, offen: number) => `${a} / ${b}${offen ? ` (${offen} offen)` : ''}`,
  anzahl3: (a: number, b: number, c: number, offen: number) => `${a} / ${b} / ${c}${offen ? ` (${offen} offen)` : ''}`,
  unter: 'Unter der Wasserlinie', grund: 'Wasserlinie bei',
  grundText: { budget: 'Budget', kapazitaet: 'Kapazität' } as Record<string, string>,
  keine: 'keine', anders: 'abweichend',
  projekteSeite: 'Lage der Projekte', ueber: 'über', unterKurz: 'unter',
  ohneBetrag: '–',
  // Antrag (K5 Schritt 6, Regel «Unvollständige Bewertung»)
  alsAntrag: 'Als Antrag wählen',
  alsAntragFrage: (name: string) => `Szenario «${name}» als Antrag wählen?`,
  alsAntragWirkung: (n: number) => `Die Entscheidungsvorlage enthält ${n === 1 ? 'dieses Szenario' : `alle ${n} verglichenen Szenarien`}. Ein bisheriger Antrag dieses Portfolios wird wieder Entwurf. Traktandiert wird danach mit «Für das Gremium traktandieren».`,
  antragGewaehlt: (name: string) => `Szenario «${name}» als Antrag gewählt.`,
  nichtBewertet: (nummern: string[]) => `Bewertung: ${projekte(nummern.length)} ohne Bewertung (${nummern.join(', ')}); diese erscheinen in der Vorlage als «nicht bewertet».`,
  bewerten: 'Zur Bewertung',
  vorlage: 'Entscheidungsvorlage (Vorschau)',
  vorlageSeit: (d: string) => `Stand ${d}`,
  // Verwerfen und Umbenennen
  verwerfen: 'Szenario verwerfen',
  verwerfenFrage: (name: string) => `Szenario «${name}» verwerfen?`,
  verwerfenWirkung: 'Das Szenario verschwindet aus der Liste. Der Ist-Stand des Portfolios bleibt unverändert.',
  verworfen: (name: string) => `Szenario «${name}» verworfen.`,
  umbenennen: 'Umbenennen', speichern: 'Speichern', abbrechen: 'Abbrechen',
  konflikt: 'Jemand anderes hat das Szenario inzwischen geändert. Lade neu; deine letzte Verschiebung geht dabei verloren.',
  neuLaden: 'Neu laden',
  fehler: 'Die Reihenfolge konnte nicht gespeichert werden; sie ist zurückgesetzt.',
  warnungen: 'Hinweise',
};
