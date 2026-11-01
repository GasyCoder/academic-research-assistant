# LanguageTool MCP server

Generic [MCP](https://modelcontextprotocol.io) server exposing a LanguageTool instance over stdio.

It only returns linguistic diagnostics. It never rewrites text, and it has no
knowledge of academic conventions, disciplines or citation styles: deciding
what to change belongs to the calling model or Skill.

## Requirements

- Node.js ≥ 20 with a working `Intl.Segmenter` and ICU segmentation data (official
  full-ICU builds recommended). Builds without ICU are not supported; custom small-ICU
  or system-ICU builds must provide the required segmentation data.
  Node 20 and 22 are tested in CI with official builds.
- A running LanguageTool HTTP server (installed separately, e.g. on `http://127.0.0.1:8081`),
  which needs Java 17 or later. Tested with LanguageTool 6.9-SNAPSHOT. From the unzipped
  LanguageTool directory: `java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081`.

## Build and run

From the repository root:

```bash
npm ci
npm run build
node packages/languagetool-mcp/dist/index.js
```

The package is a command (`languagetool-mcp`, i.e. `dist/index.js`), not a library: it has no
importable API. It remains private and unpublished; licence selection is pending. See the
[repository release procedure](https://github.com/GasyCoder/academic-research-assistant/blob/main/docs/releasing.md).

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

The 30 s default leaves headroom for the language-loading and text-check durations measured
below; it is not a guarantee on other hardware. It is below the installed TypeScript MCP
SDK's 60 s default request timeout, but each calling client can have a different timeout.
Configure the caller's tool-call timeout to exceed the server's HTTP timeout plus processing
and transport overhead, otherwise a client-side timeout can arrive before the structured
`TIMEOUT`. `health_check` makes two sequential HTTP requests, each with its own timeout.
Raise both server and caller timeouts as needed on slow hardware.

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

To reduce cold-start latency, LanguageTool can prewarm selected pipelines at startup. Add
the following to its `server.properties` and start LanguageTool with `--config server.properties`:

```properties
pipelineCaching=true
pipelinePrewarming=true
```

In the measurement above this made the tested first checks take about 1 s, at the cost of a
slower start (about 17 s instead of 2 s) and more memory. LanguageTool prewarms a selected set
of languages and request settings, not every possible language, variant, or rule combination;
cached pipelines can also be evicted. `pipelineCaching` reuses matching pipelines, while
`pipelinePrewarming` fills selected pipelines at startup. These are LanguageTool settings:
the MCP server does not enable them or send warmup checks. See the upstream
[configuration](https://github.com/languagetool-org/languagetool/blob/master/languagetool-server/src/main/java/org/languagetool/server/HTTPServerConfig.java)
and [prewarming implementation](https://github.com/languagetool-org/languagetool/blob/master/languagetool-server/src/main/java/org/languagetool/server/TextChecker.java).

In this LanguageTool version the HTTP listener starts after prewarming finishes, so
`health_check` reports `unavailable` during that startup. A later `ok` establishes HTTP
liveness; readiness of a particular language and configuration requires a successful check.

## Privacy and robustness

- HTTP redirects are never followed, so the text cannot be forwarded to another
  origin; a 3xx answer is reported as an `HTTP_ERROR`.
- Error messages are built from technical data only (code, HTTP status, endpoint,
  category). Bodies of HTTP error responses are discarded unread, and the message
  of unexpected exceptions is never forwarded.
- Response bodies larger than 8 MiB (`DEFAULT_MAX_RESPONSE_BYTES`) are rejected
  while streaming, with an `INVALID_RESPONSE` error.
- Tool results larger than 8 MiB (`MAX_MCP_RESULT_BYTES`), including both `content`
  and `structuredContent` and their JSON escaping, are replaced by a small
  `INVALID_RESPONSE` error before transmission. Diagnostics are never silently
  truncated. This leaves room for protocol metadata under the SDK's default
  10 MiB stdio receive buffer. The connection remains usable for a shorter check.
- Issue ranges outside the submitted text, or context ranges outside their context
  text, are rejected as `INVALID_RESPONSE`.
- `check_text` accepts at most 50,000 characters (`DEFAULT_MAX_TEXT_LENGTH`, see below)
  and `check_document` 100,000 (`MAX_DOCUMENT_LENGTH`). A longer text is rejected with
  `TEXT_TOO_LONG` before anything is sent, and is never truncated.
- `check_document` sends its parts one at a time, and its `failedRanges` carry positions
  and error codes only, never document text.

## Text length limit

LanguageTool's default `maxTextLength` is effectively unbounded. The SDK's stdio transport
does bound its receive buffer to 10 MiB, but that is a message-byte limit, not a text-length
policy. This server accepts at most 50,000 characters, counted in UTF-16 code units like
issue offsets. That is about 7,500 words, e.g. a journal article
or a thesis chapter section. The value comes from measurements on LanguageTool
6.9-SNAPSHOT:

- 50,000 characters of French take about 4 s on a warm server, and about 9 s when the
  language is cold, well within the 30 s default timeout.
- The measured ordinary prose produced about 4 bytes of response per character (about
  0.2 MB). One sample with a spelling error on every word produced about 100 bytes per
  character (about 5 MB); at 100,000 characters it exceeded the 8 MiB HTTP response limit.
  Other error-dense texts can exceed that limit even below 50,000 characters.
- A text checked against the wrong language can also be large: LanguageTool may suggest
  hundreds of replacements per word, and the response exceeds 8 MiB beyond about 17,000
  characters (French checked as `en-US`). This is reported as `INVALID_RESPONSE`.

These measurements do not guarantee that every accepted text produces a deliverable result.
Even a response below the HTTP limit can exceed the separate MCP result-size budget after
normalization and duplication; that also returns `INVALID_RESPONSE`, without partial diagnostics.

The limit is advertised as `maxLength` in the `check_text` input schema. For a longer
text, use `check_document`.

Both text tools emit a real JSON Schema `maxLength` keyword through Zod metadata, while
their handlers enforce the UTF-16 limit and return structured `TEXT_TOO_LONG` errors.
JSON Schema counts Unicode code points, so its advertised limit is a necessary upper
bound; a string containing astral characters may pass that constraint yet exceed the
handler's UTF-16 limit. A client that validates the schema before calling the server
can reject oversized arguments locally, without receiving our structured error.

## Long documents

| Tool             | Use for                                 | Limit (UTF-16 code units) |
| ---------------- | --------------------------------------- | ------------------------- |
| `check_text`     | one text, checked in a single request   | 50,000                    |
| `check_document` | a longer document, checked part by part | 100,000                   |

`check_document` takes the same inputs as `check_text` and returns the issues of the whole
document, with offsets in the whole document. It splits the document internally and sends
the parts to LanguageTool one at a time; the caller never handles the parts.

### Segmentation

- Each request carries at most 50,000 units: a core of at most 48,000 units, plus up to
  1,000 units of context on each side of an artificial cut. A document fitting in one
  request is sent whole, with no context, and its core can reach 50,000 units.
- Cuts are chosen, best first: blank-line paragraph break, line break, sentence boundary
  (`Intl.Segmenter` with the requested language; default rules for `auto` or a code it does
  not know), breakable whitespace (no-break spaces are kept), grapheme boundary. The latest
  cut of the best kind in the second half of the core budget is used.
- A cut never splits a surrogate pair or a CRLF. Grapheme boundaries are computed on the
  original document, preserving regional-indicator pairing, ZWJ sequences and combining
  marks even after whitespace. If no grapheme boundary fits in the allowed core window
  (for example an exceptionally long cluster of combining marks), the core falls back to
  a code-point boundary to guarantee progress within the request limit.
- Context is added only at artificial cuts, i.e. anything but a paragraph break: whole
  sentences of the same paragraph are preferred when they fit. Otherwise context falls
  back to whitespace or grapheme boundaries within the same budget, so complete sentences
  and paired brackets cannot always be preserved. A paragraph break gets none.

### Offsets and duplicates

- `offset` = start of the part's request in the document + LanguageTool's offset, in UTF-16
  code units like `check_text`; every range is then checked to lie within the document.
  `context.offset` stays relative to `context.text`.
- A part reports only the issues that start in its core. An issue found in a context region
  belongs to the neighbouring part, which reports it with its own context. No issue is
  returned twice, and different issues at the same offset are all kept.

### Result

| Field                                                                        | Meaning                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `complete`                                                                   | Every planned part succeeded, no owned diagnostic was omitted by our output budget, and LanguageTool reported no incomplete results. This does not promise equivalence to a monolithic check. |
| `truncated`, `truncatedAt`                                                   | The output budget was reached; `truncatedAt` is the first omitted owned issue's offset. The returned issues form a prefix from successful parts; an earlier rule at that same offset may already be included. Remaining parts were not checked. |
| `failedRanges`                                                               | Parts without diagnostics: `chunkIndex`, `start`, `end` (document offsets) and `code`, the error of the request or `SKIPPED` (not sent because processing stopped). No text. |
| `chunkCount`, `processedChunkCount`, `failedChunkCount`, `skippedChunkCount` | The three counts add up to `chunkCount`.                                                                                                                                     |
| `issues`                                                                     | In document order, at most 5 replacements each; `replacementsTruncated` tells when LanguageTool suggested more.                                                              |
| `languages`, `software`, `incompleteResults`                                 | Languages LanguageTool used (several only with `auto` on a mixed document), its version, and whether it reported incomplete results for a part.                              |

### Failures

- The parts are sent sequentially, each at most once; nothing is retried.
- An isolated `INVALID_RESPONSE` concerns one part's answer (e.g. a response over 8 MiB
  for an error-dense part): the part is listed in `failedRanges` and processing continues.
  Two consecutive `INVALID_RESPONSE` errors stop processing and later parts are `SKIPPED`,
  avoiding transmission of the remaining manuscript to a probably incompatible server.
  A successful part resets this counter. This also stops after two consecutive oversized
  responses; it does not inspect upstream messages or retry either part.
- `TIMEOUT`, `UNREACHABLE` and `HTTP_ERROR` would repeat or add load: the remaining parts
  are `SKIPPED`.
- If no part could be checked, the tool returns the first error as an MCP error result
  rather than an empty result, which would look like a clean document.
- A document over 100,000 units is rejected with `TEXT_TOO_LONG` before anything is sent.

### Limits

| Limit                        | Value          | Basis                                                          |
| ---------------------------- | -------------- | -------------------------------------------------------------- |
| Request (core + context)     | 50,000         | the `check_text` limit, reused per part                        |
| Core of a segmented part     | 48,000         | request limit minus context on both sides                      |
| Context at an artificial cut | 1,000 per side | several whole sentences of prose                               |
| Document                     | 100,000        | French: 12 s warm, 20 s on a fresh server                      |
| Issues                       | 1,650          | 3 × 5.5 issues per 1,000 units (densest measured) at the limit |
| Serialized issues            | 4 MiB          | half of `MAX_MCP_RESULT_BYTES`, both copies counted            |
| Replacements per issue       | 5              | only spelling rules exceeded it (5 of 1,532 issues)            |

Measured on LanguageTool 6.9-SNAPSHOT (12-core machine) with generic academic prose,
including typical errors, through `check_document` and its MCP result serialization:

| 100,000 units                | Parts | Duration    | Issues                            | Result  | Peak RSS |
| ---------------------------- | ----- | ----------- | --------------------------------- | ------- | -------- |
| French, warm                 | 3     | 10.8–12.2 s | 467, complete                     | 641 KiB | 74 MiB   |
| French, fresh server         | 3     | 20.1 s      | 460, complete                     | —       | —        |
| English, warm                | 3     | 2.6 s       | 456, complete                     | 555 KiB | 79 MiB   |
| French checked as `en-US`    | 3     | 22.9 s      | 416; 2 parts `INVALID_RESPONSE`   | 522 KiB | 109 MiB  |
| Spelling error on every word | 3     | 2.1 s       | 1,650, truncated; 2 parts skipped | 1.8 MiB | 128 MiB  |

At 150,000 units the same French check took 16–26 s warm and up to 42 s on a fresh server
with a second JVM running: too close to common client timeouts for a synchronous call.

### Client timeouts and progress

The call lasts as long as all its requests, each bounded by `LANGUAGETOOL_TIMEOUT_MS`. Whether
that fits depends on the calling client's tool-call timeout, which varies by client: the
TypeScript MCP SDK defaults to 60 s, other clients differ. Configure it above the durations
above, with headroom for cold starts.

When the request carries a `progressToken`, the server sends a `notifications/progress`
after each part (`progress`, `total`). Clients that support it can extend their timeout on
progress (`resetTimeoutOnProgress` in the TypeScript SDK). If the caller cancels the
request, no further part is sent.

### Effect of the cuts

Ownership prevents duplicates introduced by overlapping requests; it cannot guarantee
that neighbouring requests detect identical issues. An issue starting in overlap is
discarded even if its owning request did not detect it. A diagnostic longer than the
available context, or a rule requiring distant paragraphs, can be missed. Limited
context and artificial request edges can also introduce boundary false positives.
`complete` describes execution of our pipeline, not linguistic completeness or recall
relative to a single full-document request. Replacement limits are reported separately
by `replacementsTruncated` and do not make `complete` false.

Compared with a single request over the same text (150,000 units of generic academic prose,
4 parts): English gave identical issues (427); French returned 708 of 710, missing two
`FR_REPEATEDWORDS_*` style hints, which look for repetitions across paragraphs. No cut ever
produced an extra issue, including with 3,000-unit requests; there, inside a single long
paragraph, the context at artificial cuts reduced the missed style hints from 7 to 3.

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
| `text`               | yes      | Text to analyse; not blank; at most 50,000 UTF-16 code units.     |
| `language`           | yes      | A `longCode` from `get_supported_languages` (e.g. `fr`, `en-US`), or `auto`. |
| `level`              | no       | `default` or `picky` (enables stricter LanguageTool rules).        |
| `disabledRules`      | no       | LanguageTool rule ids to ignore.                                   |
| `disabledCategories` | no       | LanguageTool category ids to ignore.                               |

Returns `requestedLanguage`, `language` (used by LanguageTool), `detectedLanguage`,
`software`, `incompleteResults`, `issueCount` and `issues`. Each issue carries
`message`, `shortMessage`, `offset`, `length`, `replacements`, `sentence`,
`context`, `ruleId`, `ruleSubId`, `ruleDescription`, `issueType`, `categoryId`
and `categoryName`. Offsets are UTF-16 code units, i.e. JavaScript string indices.

### `check_document`

Same inputs as `check_text`, except that `text` may hold up to 100,000 UTF-16 code units.
Returns `requestedLanguage`, `languages`, `software`, `documentLength`, `complete`,
`truncated`, `truncatedAt`, `incompleteResults`, `chunkCount`, `processedChunkCount`,
`failedChunkCount`, `skippedChunkCount`, `failedRanges`, `issueCount` and `issues`. Issues
have the fields of `check_text` issues, with offsets in the whole document, plus
`replacementsTruncated`. See [Long documents](#long-documents).

### Errors

When LanguageTool cannot be used, or the text is too long, `check_text`, `check_document`
and `get_supported_languages` return an MCP error result (`isError: true`) whose text is JSON.
For `check_document` this happens only when no part of the document could be checked;
otherwise failures are reported in `failedRanges`:

```json
{ "error": { "code": "UNREACHABLE", "message": "LanguageTool is unreachable at http://127.0.0.1:8081 (ECONNREFUSED)", "endpoint": "/v2/check", "httpStatus": null } }
```

Codes: `TIMEOUT`, `UNREACHABLE`, `HTTP_ERROR` (e.g. unknown language → 400, or a
redirect), `INVALID_RESPONSE` (invalid, incomplete, inconsistent or oversized
response), `TEXT_TOO_LONG` (the text exceeds the length limit; nothing was sent, and
the message gives the text's length and the limit, never its content), `INTERNAL_ERROR`.
For HTTP failures, `httpStatus` is non-null whenever LanguageTool sent response
headers. A local MCP result-size rejection has `endpoint: null` and
`httpStatus: null`, since it describes the tool output rather than an HTTP failure.

Arguments that do not match the input schema (blank text, malformed language code,
unknown `level`) are rejected by the MCP SDK before the tool runs, with a plain-text
`Input validation error: …` result (`isError: true`).

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
npm run pack:check          # pack, install the tarball in a temporary project, run its binary
npm run check               # what CI runs: typecheck, test, build, pack:check
```

`npm test` builds the package and runs `dist/index.js` as a subprocess: with raw stdio
framing, and with the official v2 client (`@modelcontextprotocol/client`, a dev dependency)
on protocol revisions 2025-11-25 (legacy handshake) and 2026-07-28 (modern). It needs no
network. `pack:check` installs the runtime dependencies, so it needs the npm registry or a
warm npm cache. CI (`.github/workflows/ci.yml`) runs `npm run check`'s steps on Node 20 and
22. The scripts also work from `packages/languagetool-mcp/`, or from the root with
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
  segmentation.ts          long-document segmentation (cuts, context)
  types.ts                 tool output schemas
  errors.ts                LanguageToolError
  tools/                   one module per MCP tool, plus shared check options and results
```
