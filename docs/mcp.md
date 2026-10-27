# MCP-Dienst

Prozess `mcp` (`src/cli.ts mcp`, Server aus `@vollholz/platform`, Werkzeuge in `src/modules/handlungsfeld/mcp.ts`): KI-Hosts (Claude Desktop,
CLI-Hosts) greifen über das Model Context Protocol auf PPM zu – mit denselben Rechten wie in der Oberfläche,
begrenzt durch die Scopes. Der Dienst ist ein Client der REST-API, keine zweite Fachlogik; er hat keinen
Datenbank-Login (Regel `mcp-nur-rest`).

## Ablauf

1. **Endpunkt:** Streamable HTTP unter `/mcp` (Port `MCP_PORT` 8081; Caddy leitet `/mcp*` weiter), zustandslos, nur
   `POST` (`GET`/`DELETE` → 405). Öffentliche Adresse: `MCP_PUBLIC_URL`.
2. **Metadaten:** Protected Resource Metadata (RFC 9728) unter `/.well-known/oauth-protected-resource/mcp`; ohne
   Token antwortet `/mcp` mit 401 und `WWW-Authenticate`-Verweis darauf.
3. **Token:** Zielgruppe `ppm-mcp` (`OIDC_MCP_AUDIENCE`), nur von Hosts aus `MCP_HOST_CLIENT_IDS`
   (Standard `ppm-mcp-cli`); andere Tokens ergeben 403.
4. **Token Exchange (RFC 8693):** Der Dienst tauscht das Token als Client `ppm-mcp` (`private_key_jwt`,
   `MCP_PRIVATE_KEY`) gegen ein Token mit Zielgruppe `ppm-api`, DPoP-gebunden an `MCP_DPOP_KEY`.
   Getauschte Tokens werden bis kurz vor Ablauf zwischengespeichert; der Replay-Schutz liegt im Speicher.
5. **Organisation:** über Header `X-Tenant` oder `?org=`; ohne Wahl gelten alle Organisationen im Token.
6. **Aufrufe:** Werkzeuge rufen nur die REST-API (`MCP_API_URL`). Rechte, Klassifizierung, Rolle ∩ Scope und Audit
   (Quelle `mcp`) entscheidet die API.

Bausteine aus `@vollholz/iam`: `McpAuth`, `registerMcpAuth`, `TokenExchanger`, `DpopSigner`, `ApiClient`.

## Werkzeuge

Aus dem Modell (`mcpTools` in `src/authz/model.ts`), umgesetzt in `src/modules/handlungsfeld/mcp.ts` (`mcpTools` in `defineModule`):

| Werkzeug | REST-Aufruf | Recht | Hinweise |
|---|---|---|---|
| `list_handlungsfelder` | `GET /v1/handlungsfelder` | `handlungsfeld:read` | `readOnlyHint` |
| `get_handlungsfeld` | `GET /v1/handlungsfelder/{id}` | `handlungsfeld:read` | `readOnlyHint` |
| `get_phasenmodell` | `GET /v1/phasenmodelle/aktuell` bzw. `/{id}` | `phasenmodell:read` | `readOnlyHint` |
| `list_projekte` | `GET /v1/projekte` | `projekt:read` | `readOnlyHint` |
| `get_projekt` | `GET /v1/projekte/{id}` und `…/organisation` | `projekt:read` | `readOnlyHint` |
| `get_projektdaten` | `GET /v1/projekte/{id}/<register>` je Register | `projekt:read` | `readOnlyHint`; Kosten `null` ohne `finanzen:read` |
| `list_statusberichte` | `GET /v1/projekte/{id}/berichte[/{periode}]` | `projekt:read` | `readOnlyHint`; mit Periode der ganze Bericht |
| `get_periode` | `GET /v1/perioden/{periode}[/terminabweichungen]` | `statusbericht:review` | `readOnlyHint`; Monatsabschluss bzw. Terminabweichungen |
| `get_auslastung` | `GET /v1/auslastung` | `ressource:read` | `readOnlyHint`; Zeitraum `von`/`bis`, optional `szenario` |
| `list_sitzungen` | `GET /v1/gremien/{kuerzel}/sitzungen` | `sitzung:read` | `readOnlyHint` |
| `get_sitzung` | `GET /v1/sitzungen/{id}` | `sitzung:read` | `readOnlyHint` |
| `get_vertrag` | `GET /v1/projekte/{id}/vertrag`, Kapitel und Pflichtangaben einer Version | `projekt:read` | `readOnlyHint`; Beträge `null` ohne `finanzen:read` |

Neues Werkzeug: im Modell unter `mcpTools` eintragen (Titel, Recht, `readOnly`), in `mcp/tools.ts` als Aufruf der
REST-API umsetzen; nie direkt auf Module oder die Datenbank zugreifen.

## Keycloak

Clients im Realm (Realm-Modul mit `mcp: true` in `identity.app.json`, lokal `scripts/keycloak-setup.ts`):

| Client | Art | Zweck |
|---|---|---|
| `ppm-mcp` | vertraulich, `private_key_jwt` | Token Exchange zum API-Token |
| `ppm-mcp-cli` | öffentlich, Code-Flow mit PKCE, Loopback-Port | Anmeldung der Person im MCP-Host |

## Konfiguration

`MCP_PORT`, `MCP_PUBLIC_URL`, `MCP_API_URL`, `MCP_CLIENT_ID`, `MCP_HOST_CLIENT_IDS`, `MCP_PRIVATE_KEY`,
`MCP_DPOP_KEY`, `OIDC_MCP_AUDIENCE` – siehe [konfiguration.md](konfiguration.md#mcp).
