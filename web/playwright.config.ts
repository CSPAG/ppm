/**
 * E2E gegen den lokalen Stack (api-Prozess mit gebauter Webapp, Keycloak, eigene Datenbank `ppm_e2e`):
 * `npm run e2e` im Root legt vorher `ppm_e2e` neu an und schreibt `.local/e2e.env` (Port 8090, Betrieb 9091);
 * `webServer` startet die API dazu aus dem Root (läuft sie schon, wird sie weiterverwendet). Die Webapp muss gebaut
 * sein (`npm run build`). Anmeldung über das Formular von Keycloak.
 *
 * - `E2E_BASE_URL` (Standard `http://localhost:8090`), `E2E_PASSWORD` (Standard `Test1234!`)
 * - `E2E_CHROMIUM`: Pfad zu einem vorhandenen Chromium (Sessions ohne `playwright install`)
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8090';
const executablePath = process.env.E2E_CHROMIUM;

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  // Testpersonen und Daten teilen sich einen Stack: nacheinander
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node --env-file=.env --env-file=.local/e2e.env --import ./src/platform/ops/preload.ts src/platform/main/api.ts',
    cwd: '..',
    url: 'http://localhost:9091/readyz',
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(executablePath ? { launchOptions: { executablePath } } : {}) },
    },
  ],
});
