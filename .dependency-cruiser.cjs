/**
 * Modulgrenzen (Spezifikation 5.6), geprüft mit `npm run arch`. Den Querschnitt (HTTP, Worker, Betrieb, MCP) liefert
 * @vollholz/platform; die App hat nur noch Kompositionswurzel, Plattform-Bindung, Modell und Module:
 *
 *   cli.ts → app.ts                Kompositionswurzel (Prozesse, Befehle)
 *     └── modules/<x>/index.ts     öffentliche Schnittstelle eines Moduls
 *           └── modules/<x>/*      intern
 *   platform.ts                    gebundene Bausteine für Module (record, enqueue, seal …)
 *     └── authz/ product.ts        Modell, Ressourcen, Name und Schema
 *
 * Neue Ausnahmen nur mit TODO, Begründung und Eintrag in docs/zielarchitektur.md.
 */
const S = '^src/';

/** Gemeinsame Bausteine, die Features der Webapp ausser ui/, api/ und auth/ nutzen dürfen (anfangs leer). */
const SHARED_FEATURE_PARTS = [];

module.exports = {
  forbidden: [
    {
      name: 'keine-zyklen',
      severity: 'error',
      comment: 'Zyklen machen Module untrennbar (auch über import type).',
      from: {},
      to: { circular: true },
    },
    {
      name: 'kein-test-im-code',
      severity: 'error',
      comment: 'Produktiver Code importiert keine Tests.',
      from: { pathNot: '^test/' },
      to: { path: '^test/' },
    },
    {
      name: 'modul-nur-ueber-index',
      severity: 'error',
      comment: 'Ein Modul nutzt ein anderes nur über dessen index.ts.',
      from: { path: `${S}modules/([^/]+)/` },
      to: { path: `${S}modules/([^/]+)/`, pathNot: [`${S}modules/$1/`, `${S}modules/[^/]+/index\\.ts$`] },
    },
    {
      name: 'von-aussen-nur-ueber-index',
      severity: 'error',
      comment: 'Ausserhalb der Module nur die index.ts eines Moduls.',
      from: { path: S, pathNot: `${S}modules/` },
      to: { path: `${S}modules/[^/]+/`, pathNot: `${S}modules/[^/]+/index\\.ts$` },
    },
    {
      name: 'module-kennen-keine-wurzel',
      severity: 'error',
      comment: 'Module kennen die Kompositionswurzel nicht (Bausteine aus platform.ts).',
      from: { path: `${S}modules/` },
      to: { path: `${S}(app|cli)\\.ts$` },
    },
    {
      name: 'basis-ohne-module',
      severity: 'error',
      comment: 'Plattform-Bindung, Modell und Ressourcen kennen weder Module noch Kompositionswurzel.',
      from: { path: `${S}(platform\\.ts|product\\.ts|authz/)` },
      to: { path: [`${S}modules/`, `${S}(app|cli)\\.ts$`] },
    },
    {
      name: 'querschnitt-nur-oeffentlich',
      severity: 'error',
      comment: 'Von @vollholz/platform nur die öffentlichen Exporte (`@vollholz/platform`, `/preload`), nie Dateien darin.',
      from: { path: S },
      to: { path: '^node_modules/@vollholz/platform/dist/', pathNot: '^node_modules/@vollholz/platform/dist/(index|ops/preload)\\.(js|d\\.ts)$' },
    },
    // Webapp
    {
      name: 'feature-nur-gemeinsame-bausteine',
      severity: 'error',
      comment: 'Features nutzen nur gemeinsame Bausteine, keine anderen Features.',
      from: { path: '^web/src/features/([^/]+)/' },
      to: { path: '^web/src/features/([^/]+)/', pathNot: ['^web/src/features/$1/', ...SHARED_FEATURE_PARTS] },
    },
    {
      name: 'feature-ohne-shell-und-router',
      severity: 'error',
      comment: 'Features kennen Shell und Router nicht (Navigation über api/ und search.ts).',
      from: { path: '^web/src/features/' },
      to: { path: ['^web/src/shell/', '^web/src/router\\.tsx$', '^web/src/app\\.tsx$', '^web/src/main\\.tsx$'] },
    },
    {
      name: 'basis-ohne-features',
      severity: 'error',
      comment: 'Gemeinsame Bausteine kennen keine Features.',
      from: { path: '^web/src/(ui|api|auth|styles)/' },
      to: { path: '^web/src/features/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.d\\.ts$', '^web/src/api/schema\\.d\\.ts$'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'], extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'] },
  },
};
