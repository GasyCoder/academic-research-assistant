# LanguageTool MCP server

Generic [MCP](https://modelcontextprotocol.io) server exposing a LanguageTool instance over stdio.

It only returns linguistic diagnostics. It never rewrites text, and it has no
knowledge of academic conventions, disciplines or citation styles: deciding
what to change belongs to the calling model or Skill.

## Requirements

- Node.js ≥ 20
- A running LanguageTool HTTP server (installed separately, e.g. on `http://127.0.0.1:8081`).
  Tested with LanguageTool 6.9-SNAPSHOT.

## Build and run

From the repository root:

```bash
npm install
npm run build
node packages/languagetool-mcp/dist/index.js
```

During development, `npm run dev -w @gasycoder/languagetool-mcp` runs the TypeScript sources with `tsx`.

The process speaks MCP on stdin/stdout. stdout is reserved for the protocol;
diagnostics are written to stderr and never include the analysed text.

## Configuration

| Variable                  | Default                 | Description                                        |
| ------------------------- | ----------------------- | -------------------------------------------------- |
| `LANGUAGETOOL_BASE_URL`   | `http://127.0.0.1:8081` | LanguageTool server URL (`http` or `https`).       |
| `LANGUAGETOOL_TIMEOUT_MS` | `30000`                 | Per-request timeout in milliseconds (1–300000).    |

Invalid values stop the server at startup with a message on stderr. No secret is required.
Text is sent to the configured URL: use a local instance for unpublished manuscripts.

The 30 s default covers loading a language on its first check (see below) plus a text at the
input limit, with about 2× headroom. It also stays below the 60 s default request timeout of
MCP SDK clients, so the caller gets this server's structured `TIMEOUT` rather than a generic
client-side timeout. Raise it on slow hardware; if you raise it above 60 s, raise the
client's tool-call timeout too.

## Cold start and readiness

LanguageTool loads each language lazily, on the first `/v2/check` that uses it. Measured
with LanguageTool 6.9-SNAPSHOT on a 12-core machine:

| Request                                  | Duration   |
| ---------------------------------------- | ---------- |
| `/v2/healthcheck`, 1–2 s after JVM start | < 10 ms    |
| first check in `en-US`                   | ~4 s       |
| first check in `fr`                      | 6–10 s     |
| first check in `de-DE`                   | ~9.5 s     |
| next short checks in the same language   | 0.01–1.5 s |
| 50,000 characters of French, warm        | ~4 s       |

`/v2/healthcheck` stays instant while a language is loading, so `health_check` reports
*liveness*, not readiness: `ok` does not mean that every language is loaded.

| `health_check` | `check_text`                | Meaning                                                                                               |
| -------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ok`           | succeeds, first call slower | Normal cold start.                                                                                    |
| `ok`           | `TIMEOUT`                   | LanguageTool is up, but the check exceeded the timeout: cold language on slow hardware, or long text. |
| `unavailable`  | `UNREACHABLE` or `TIMEOUT`  | LanguageTool is not running, or not answering at all.                                                 |
| `unhealthy`    | any error                   | LanguageTool answers, but with errors or invalid data.                                                |

The server never retries a request on its own. A timeout does not tell a language being
loaded from an overloaded or stuck server, and LanguageTool keeps processing a request after
the client gives up (the language keeps loading in the background). A retry would therefore
send the manuscript again and add to the load. After a cold-start `TIMEOUT`, a later call in the
same language is usually fast.

To remove the cold start altogether, let LanguageTool load its languages at startup by adding
to its `server.properties`:

```properties
pipelineCaching=true
pipelinePrewarming=true
```

In the measurement above this made every first check take about 1 s, at the cost of a slower
start (about 17 s instead of 2 s) and more memory. The port only opens once prewarming is done,
so `health_check` reports `unavailable` until LanguageTool is ready.

## Privacy and robustness

- HTTP redirects are never followed, so the text cannot be forwarded to another
  origin; a 3xx answer is reported as an `HTTP_ERROR`.
- Error messages are built from technical data only (code, HTTP status, endpoint,
  category). Bodies of HTTP error responses are discarded unread, and the message
  of unexpected exceptions is never forwarded.
- Response bodies larger than 8 MiB (`DEFAULT_MAX_RESPONSE_BYTES`) are rejected
  while streaming, with an `INVALID_RESPONSE` error.
- Issue ranges outside the submitted text, or context ranges outside their context
  text, are rejected as `INVALID_RESPONSE`.

## Tools

### `health_check`

No input. Calls `/v2/healthcheck`, then `/v2/info` for the version. Sends no text.

Returns `status`, `reachable`, `baseUrl`, `software` (name, version, build date,
or `null`) and `error` (or `null`). An offline server is reported in the result
rather than as a tool error.

| `status`      | `reachable` | Meaning                                                                 |
| ------------- | ----------- | ----------------------------------------------------------------------- |
| `ok`          | `true`      | `/v2/healthcheck` answered successfully.                                 |
| `unhealthy`   | `true`      | LanguageTool sent an HTTP response, but it was an error, invalid, incomplete or too slow. |
| `unavailable` | `false`     | No HTTP response: connection refused, DNS failure, or timeout before any answer. |

### `get_supported_languages`

No input. Returns the languages installed on the server (`/v2/languages`):
`count`, `languages` (`name`, `code`, `longCode`) and `variantsByCode`
(e.g. `{ "en": ["en", "en-US", "en-GB"] }`).

### `check_text`

| Input                | Required | Description                                                       |
| -------------------- | -------- | ----------------------------------------------------------------- |
| `text`               | yes      | Text to analyse; must not be empty or whitespace only.            |
| `language`           | yes      | A `longCode` from `get_supported_languages` (e.g. `fr`, `en-US`), or `auto`. |
| `level`              | no       | `default` or `picky` (enables stricter LanguageTool rules).        |
| `disabledRules`      | no       | LanguageTool rule ids to ignore.                                   |
| `disabledCategories` | no       | LanguageTool category ids to ignore.                               |

Returns `requestedLanguage`, `language` (used by LanguageTool), `detectedLanguage`,
`software`, `incompleteResults`, `issueCount` and `issues`. Each issue carries
`message`, `shortMessage`, `offset`, `length`, `replacements`, `sentence`,
`context`, `ruleId`, `ruleSubId`, `ruleDescription`, `issueType`, `categoryId`
and `categoryName`. Offsets are UTF-16 code units, i.e. JavaScript string indices.

### Errors

When LanguageTool cannot be used, `check_text` and `get_supported_languages`
return an MCP error result (`isError: true`) whose text is JSON:

```json
{ "error": { "code": "UNREACHABLE", "message": "LanguageTool is unreachable at http://127.0.0.1:8081 (ECONNREFUSED)", "endpoint": "/v2/check", "httpStatus": null } }
```

Codes: `TIMEOUT`, `UNREACHABLE`, `HTTP_ERROR` (e.g. unknown language → 400, or a
redirect), `INVALID_RESPONSE` (invalid, incomplete, inconsistent or oversized
response), `INTERNAL_ERROR`. `httpStatus` is non-null whenever LanguageTool sent
response headers.

## Minimal usage

Register the built server with Claude Code (use an absolute path):

```bash
claude mcp add languagetool \
  -e LANGUAGETOOL_BASE_URL=http://127.0.0.1:8081 \
  -- node /path/to/academic-research-assistant/packages/languagetool-mcp/dist/index.js
```

Any MCP client using stdio can be configured the same way, e.g. in `.mcp.json`:

```json
{
  "mcpServers": {
    "languagetool": {
      "command": "node",
      "args": ["/path/to/academic-research-assistant/packages/languagetool-mcp/dist/index.js"],
      "env": { "LANGUAGETOOL_BASE_URL": "http://127.0.0.1:8081" }
    }
  }
}
```

Example call and (abridged) result:

```json
{ "name": "check_text", "arguments": { "text": "Il ont mangé.", "language": "fr" } }
```

```json
{
  "requestedLanguage": "fr",
  "language": { "name": "French", "code": "fr" },
  "issueCount": 1,
  "issues": [
    {
      "message": "Vérifiez l’accord entre le pronom « Il » et le verbe « ont ».",
      "offset": 0,
      "length": 6,
      "replacements": ["Ils ont", "Il a"],
      "ruleId": "ACCORD_R_PERS_VERBE",
      "categoryId": "CAT_GRAMMAIRE",
      "categoryName": "Grammaire"
    }
  ]
}
```

## Tests

From the repository root:

```bash
npm test                    # unit and stdio tests, no LanguageTool server needed
npm run test:integration    # optional, against LANGUAGETOOL_BASE_URL
```

`npm test` builds the package and runs `dist/index.js` as a subprocess. The same
scripts work from `packages/languagetool-mcp/`, or from the root with
`-w @gasycoder/languagetool-mcp`.

## Source layout

```text
src/
  index.ts                 stdio transport entry point
  server.ts                McpServer factory and tool registration
  config.ts                environment configuration
  languagetool-client.ts   HTTP client (timeouts, error mapping)
  languagetool-schemas.ts  validation of raw LanguageTool responses
  transform.ts             raw responses → tool results
  types.ts                 tool output schemas
  errors.ts                LanguageToolError
  tools/                   one module per MCP tool
```
