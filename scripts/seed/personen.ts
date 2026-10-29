/**
 * Personen der Demo-Organisation `demo`: Anmeldung über `npm run keycloak:setup` (Passwort `ppm-demo`, nur lokal), Daten
 * über `npm run seed:demo`. Die Rolle gilt an der Organisation; Funktionen im Projekt (SP, PL, CTL, KT) und Rollen am
 * Portfolio (Gremium, Direktion) vergibt das Seed-Skript. Rollen nach src/authz/model.ts, Akteure nach
 * docs/PPM-Master.md Abschnitt 4.
 */
export interface DemoPerson {
  /** Kurzname im Seed-Skript */
  key: string;
  email: string;
  first: string;
  last: string;
  role: string;
  clearance: 0 | 1 | 2;
  /** Funktion in der Demo (nur Doku) */
  als: string;
}

export const DEMO_PERSONEN: readonly DemoPerson[] = [
  { key: 'anna', email: 'anna@demo.example', first: 'Anna', last: 'Admin', role: 'org-admin', clearance: 2, als: 'Administration' },
  { key: 'bruno', email: 'bruno@demo.example', first: 'Bruno', last: 'Leser', role: 'mitglied', clearance: 0, als: 'Leserecht' },
  { key: 'ursula', email: 'ursula.egli@demo.example', first: 'Ursula', last: 'Egli', role: 'alle-fuehren', clearance: 2, als: 'Unternehmensentwicklung, Programmleitung' },
  { key: 'patrick', email: 'patrick.meier@demo.example', first: 'Patrick', last: 'Meier', role: 'alle-fuehren', clearance: 1, als: 'PMO' },
  { key: 'claudia', email: 'claudia.keller@demo.example', first: 'Claudia', last: 'Keller', role: 'alle-lesen', clearance: 2, als: 'CEO, Programmsponsorin, PRAT' },
  { key: 'thomas', email: 'thomas.brunner@demo.example', first: 'Thomas', last: 'Brunner', role: 'alle-lesen', clearance: 1, als: 'GL Medizin, Sponsor, PRAT' },
  { key: 'martina', email: 'martina.vogel@demo.example', first: 'Martina', last: 'Vogel', role: 'alle-lesen', clearance: 1, als: 'GL Finanzen und Betrieb, Sponsorin, GLPA' },
  { key: 'sandra', email: 'sandra.huber@demo.example', first: 'Sandra', last: 'Huber', role: 'mitglied', clearance: 1, als: 'Projektleiterin' },
  { key: 'marco', email: 'marco.frei@demo.example', first: 'Marco', last: 'Frei', role: 'mitglied', clearance: 1, als: 'Projektleiter' },
  { key: 'daniel', email: 'daniel.wyss@demo.example', first: 'Daniel', last: 'Wyss', role: 'mitglied', clearance: 1, als: 'Projektleiter' },
  { key: 'lea', email: 'lea.schmid@demo.example', first: 'Lea', last: 'Schmid', role: 'mitglied', clearance: 1, als: 'Clinical Transformation Lead' },
  { key: 'simon', email: 'simon.kaufmann@demo.example', first: 'Simon', last: 'Kaufmann', role: 'mitglied', clearance: 1, als: 'Clinical Transformation Lead' },
  { key: 'nina', email: 'nina.baumann@demo.example', first: 'Nina', last: 'Baumann', role: 'alle-fuehren', clearance: 1, als: 'Finanzen' },
  { key: 'reto', email: 'reto.gerber@demo.example', first: 'Reto', last: 'Gerber', role: 'alle-fuehren', clearance: 0, als: 'Ressourcenmanagement' },
  { key: 'eva', email: 'eva.roth@demo.example', first: 'Eva', last: 'Roth', role: 'mitglied', clearance: 1, als: 'Direktorin Pflege (Direktion am Portfolio Pflege)' },
  { key: 'jonas', email: 'jonas.zimmermann@demo.example', first: 'Jonas', last: 'Zimmermann', role: 'mitglied', clearance: 0, als: 'Kernteam' },
  { key: 'sarah', email: 'sarah.fischer@demo.example', first: 'Sarah', last: 'Fischer', role: 'mitglied', clearance: 0, als: 'Antragstellerin (Pflege)' },
];
