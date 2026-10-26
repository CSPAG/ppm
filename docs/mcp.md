# MCP-Dienst (Profil mcp)

Der Prozess `mcp` bietet Werkzeuge von PPM für MCP-Hosts (Assistenten, Desktop- und CLI-Werkzeuge) an. Er ist ein
**Client der REST-API**: keine eigene Fachlogik, **kein Datenbank-Pool**, dieselben Rechte und dieselbe
Mandantentrennung wie jede andere Anfrage. Code: [`src/platform/mcp/`](../src/platform/mcp), Einstieg
[`main/mcp.ts`](../src/platform/main/mcp.ts); Anmeldung und Token-Tausch aus `@vollholz/iam` (`McpAuth`).

## Aufbau

| Thema | Umsetzung |
|---|---|
| Transport | Streamable HTTP unter **`/mcp`** (`MCP_PORT` 8081), **zustandslos**: nur `POST`, `GET`/`DELETE` → 405; Antworten als JSON |
| Ressource | Protected Resource Metadata nach **RFC 9728** unter `/.well-known/oauth-protected-resource/mcp`; ohne Token 401 mit `WWW-Authenticate`-Challenge, die auf die Metadaten zeigt. Resource Identifier ist `MCP_PUBLIC_URL` |
| Token des Hosts | Zielgruppe **`ppm-mcp`** (`OIDC_MCP_AUDIENCE`), nur von Host-Clients aus `MCP_HOST_CLIENT_IDS` (Standard `ppm-mcp-cli`); andere Tokens mit dieser Zielgruppe → 403 |
| Aufruf der API | **Token Exchange** (RFC 8693) mit dem Client `ppm-mcp` zu einem Token für **`ppm-api`** im Namen der Person, **DPoP-gebunden** an `MCP_DPOP_KEY` (ohne Angabe je Instanz ein eigener Schlüssel); Aufrufe an `MCP_API_URL` über den `ApiClient` des Baukastens. Getauschte Tokens bleiben bis kurz vor Ablauf im Speicher, die Rechte je Token und Organisation 60 s |
| Replay-Schutz | im Speicher (`MemoryReplayStore`), da ohne Datenbank |
| Bereitschaft | `/readyz` des Betriebs-Endpunkts prüft, ob die REST-API erreichbar ist |
| Proxy | Caddy leitet `/mcp`, `/mcp/*` und `/.well-known/oauth-protected-resource*` an `mcp:8081` ([`deploy/caddy/Caddyfile`](../deploy/caddy/Caddyfile)) |

## Werkzeuge

Die Werkzeuge stehen im Modell (`mcpTools` in [`authz/model.ts`](../src/platform/authz/model.ts)), ihre Umsetzung in
[`mcp/tools.ts`](../src/platform/mcp/tools.ts). Ein Werkzeug im Modell ohne Umsetzung bricht den Start ab.

| Werkzeug | Titel | Recht | REST-Aufruf | Eingaben |
|---|---|---|---|---|
| `list_projekte` | Projekte auflisten | `projekt:read` | `GET /v1/projekte` | `q`, `limit` (1–100), `cursor` |
| `get_projekt` | Projekt lesen | `projekt:read` | `GET /v1/projekte/{id}` | `id` (UUID) |

Beide tragen `readOnlyHint`. Angeboten wird ein Werkzeug nur, wenn sein Recht in mindestens einer Organisation der
Anfrage gilt; ohne Werkzeug antwortet `tools/list` mit einer leeren Liste (nicht «Method not found»).

**Organisation:** Der Host kann sie mit `X-Tenant` bzw. `?org=` wählen; sonst gelten alle Organisationen im Token. Gilt
ein Werkzeug in **mehreren** Organisationen, hat es den Pflichtparameter **`organisation`** (Alias, Auswahl aus den
erlaubten). Ergebnisse kommen als Text (JSON) und als `structuredContent`; Fehler der API als `isError`.

**Audit:** Jeder Werkzeugaufruf schreibt eine strukturierte Logzeile `audit: "mcp.tool"` mit Werkzeug,
Organisation, Subjekt und Organisationen der Anfrage (keine Datenbank, [offene-punkte.md](offene-punkte.md),
Punkt 10). Schreibende Werkzeuge protokolliert die API selbst im `audit_log` (Quelle `mcp`).

Ein neues Werkzeug: Eintrag in `mcpTools` (Titel, Recht, `readOnly`), Umsetzung in `TOOLS` (nur über `getJson` bzw.
den API-Client), `npm run identity:platform-json`, Fall in [`test/platform/mcp.test.ts`](../test/platform/mcp.test.ts).

## Konfiguration

| Variable | Lokal | Produktion |
|---|---|---|
| `MCP_PUBLIC_URL` | `http://localhost:8081/mcp` | `https://ppm.project-suite.ch/mcp` |
| `MCP_API_URL` | `http://localhost:8080` | intern, z. B. `http://ppm-api:8080` (Kubernetes) |
| `MCP_CLIENT_ID` | `ppm-mcp` | `ppm-mcp` |
| `MCP_PRIVATE_KEY` | `.local/keys/ppm-mcp.pem` | Geheimnis `mcp_private_key` |
| `MCP_DPOP_KEY` | – (je Start neu) | Geheimnis `mcp_dpop_key` (gleich für alle Instanzen) |
| `MCP_HOST_CLIENT_IDS` | `ppm-mcp-cli` | `ppm-mcp-cli` |

Alle Variablen: [konfiguration.md › MCP](konfiguration.md#mcp). Lokal: `npm run dev:api` und `npm run dev:mcp`.

## Einrichtung eines Hosts

Der Host meldet die Person im Browser an (OAuth 2.1 Code-Flow mit PKCE) und ruft dann `/mcp` mit dem Token auf.

| Angabe | Wert |
|---|---|
| Server-Adresse (Streamable HTTP) | `https://ppm.project-suite.ch/mcp` (lokal `http://localhost:8081/mcp`) |
| Autorisierungsserver | aus den Metadaten (RFC 9728) bzw. `https://id.project-suite.ch/realms/ppm` (lokal `http://localhost:8180/realms/ppm`) |
| Client | **`ppm-mcp-cli`**: öffentlich, ohne Geheimnis, PKCE `S256` |
| Weiterleitung | Loopback nach RFC 8252: `http://127.0.0.1/*` oder `http://localhost/*` mit beliebigem Port, oder fest **`http://localhost:8765/callback`** |
| Scopes | `ppm-mcp` (Zielgruppe, Standard des Clients), dazu `organization` und `ppm:read` |

Ablauf: Der Host ruft `/mcp` ohne Token auf, erhält 401 mit Verweis auf die Metadaten, findet darüber Keycloak, meldet
die Person mit `ppm-mcp-cli` an und wiederholt den Aufruf mit dem Token. Die Person braucht in der Organisation ein
Recht wie `projekt:read` (z. B. Rolle `viewer`), sonst bleibt die Liste der Werkzeuge leer. Weitere feste
Weiterleitungen (z. B. von Web-Hosts) kommen über das Realm-Modul (`mcp_extra_redirect_uris`), nicht von Hand in
Keycloak.

## Tests

[`test/platform/mcp.test.ts`](../test/platform/mcp.test.ts): Mock-IdP mit Token Exchange, API auf einem echten Port;
jedes Werkzeug des Modells umgesetzt, 401 mit Challenge und Metadaten, `tools/list` nur mit Recht (sonst leer),
`tools/call` über die REST-API mit DPoP, nur `POST`.
