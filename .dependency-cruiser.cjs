/**
 * Modulgrenzen (docs/zielarchitektur.md › Modulgrenzen), geprüft mit `npm run arch`.
 *
 *   main/                       Kompositionswurzeln
 *     ├── modules/index.ts, modules/jobs.ts
 *     │     └── modules/<x>/index.ts   öffentliche Schnittstelle
 *     │           └── modules/<x>/*    intern
 *     ├── mcp/                   nur REST, keine Module (ausser Typen), keine Datenbank
 *     └── http/ auth/ authz/ ops/ worker/   Infrastruktur, kennt keine Module
 *           └── core/ db/ config/          Basis
 *
 * Neue Ausnahmen nur mit TODO, Begründung und Eintrag in docs/zielarchitektur.md.
 */
const P = '^src/platform/';
const INFRA = `${P}(http|auth|authz|ops|worker)/`;
const BASE = `${P}(core|db|config)/`;
const W = '^web/src/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'keine-zyklen', severity: 'error', comment: 'Keine Zyklen, auch nicht über import type.', from: {}, to: { circular: true } },
    { name: 'kein-test-im-code', severity: 'error', comment: 'Produktiver Code importiert keine Tests.', from: { path: '^(src|web/src)/', pathNot: '\\.test\\.tsx?$|^web/src/test/' }, to: { path: '(^test/|\\.test\\.tsx?$|^web/src/test/)' } },
    {
      name: 'modul-nur-ueber-index', severity: 'error',
      comment: 'Ein Modul nutzt ein anderes nur über dessen index.ts.',
      from: { path: `${P}modules/([^/]+)/` }, to: { path: `${P}modules/([^/]+)/(?!index\\.ts$)`, pathNot: `${P}modules/$1/` },
    },
    {
      name: 'von-aussen-nur-ueber-index', severity: 'error',
      comment: 'Ausserhalb von modules/ nur über modules/<x>/index.ts, modules/index.ts oder modules/jobs.ts.',
      from: { path: P, pathNot: `${P}modules/` }, to: { path: `${P}modules/[^/]+/(?!index\\.ts$)` },
    },
    { name: 'module-kennen-keine-prozesse', severity: 'error', comment: 'Module importieren keine Kompositionswurzeln.', from: { path: `${P}modules/` }, to: { path: `${P}main/` } },
    { name: 'core-ohne-module', severity: 'error', comment: 'Die Basis kennt keine Module.', from: { path: BASE }, to: { path: `${P}modules/` } },
    { name: 'core-ist-basis', severity: 'error', comment: 'core/, db/, config/ kennen keine Infrastruktur und keine Prozesse.', from: { path: BASE }, to: { path: `${P}(http|auth|authz|ops|worker|mcp|main)/` } },
    { name: 'infrastruktur-ohne-module', severity: 'error', comment: 'Infrastruktur kennt keine Module (Richtung umdrehen: Module registrieren sich).', from: { path: INFRA }, to: { path: `${P}(modules|main|mcp)/` } },
    {
      name: 'mcp-nur-rest', severity: 'error',
      comment: 'Der MCP-Dienst ist ein Client der REST-API: keine Module (ausser Typen), keine Datenbank.',
      from: { path: `${P}mcp/` }, to: { path: `(${P}(modules|db|worker|http)/|^node_modules/pg/)`, dependencyTypesNot: ['type-only'] },
    },
    { name: 'feature-nur-gemeinsame-bausteine', severity: 'error', comment: 'Features nutzen keine anderen Features.', from: { path: `${W}features/([^/]+)/` }, to: { path: `${W}features/([^/]+)/`, pathNot: `${W}features/$1/` } },
    { name: 'feature-ohne-shell-und-router', severity: 'error', comment: 'Features kennen Shell und Router nicht.', from: { path: `${W}features/` }, to: { path: `${W}(shell/|router\\.tsx$|app\\.tsx$)` } },
    { name: 'basis-ohne-features', severity: 'error', comment: 'ui/, api/, auth/ kennen keine Features.', from: { path: `${W}(ui|api|auth|styles)/` }, to: { path: `${W}features/` } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^web/dist/|^web/e2e/|\\.d\\.ts$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default', 'types'], extensions: ['.ts', '.tsx', '.js'] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
