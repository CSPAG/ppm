/**
 * End-to-End gegen den lokalen Stack: `npm run e2e` im Hauptverzeichnis (scripts/e2e.sh) legt die Datenbank
 * `ppm_e2e` neu an, gleicht Realm und Testpersonen aus `scripts/keycloak-setup.ts` ab und startet API (mit
 * gebauter Oberfläche auf E2E_BASE_URL) und Worker; in CI ebenso (Workflow «E2E»). Nur Chromium; die Projekte decken
 * hell, dunkel und 360 px ab. In Sessions ohne passenden Browser: E2E_CHROMIUM=/opt/pw-browsers/chromium.
 */
import { defineConfig, devices } from '@playwright/test';

const executablePath = process.env.E2E_CHROMIUM;

export default defineConfig({
  testDir: '.',
  // Spuren und Bildschirmfotos bei Fehlern (in CI als Artefakt)
  outputDir: '../test-results',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  // scheitert die Umgebung (z. B. Anmeldung), nicht alle Tests bis zum Zeitlimit laufen lassen
  maxFailures: process.env.CI ? 10 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'de-CH',
    // Ohne Einblenden (Meldungen mit opacity 0 → 1): axe misst sonst mitten in der Animation zu wenig Kontrast
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'hell', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dunkel', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    // schmalste Breite nach docs/ux/README.md (Abweichung Q-G1): 360 px
    { name: 'schmal', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 }, colorScheme: 'light' } },
  ],
});
