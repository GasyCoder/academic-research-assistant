# Research Ecosystem Integrations

`packages/research-integrations-mcp` is a private workspace package with its own stdio MCP
server. It reads bibliographic metadata from Crossref, OpenAlex and Zotero, and optionally runs
an already installed Vale on supplied text. It is read-only: it never writes to a library or a
document, installs software, scrapes publisher pages, resolves arbitrary URLs or claims that
metadata establishes support for a claim. LanguageTool MCP and Document Formats are unchanged.

## Architecture

```text
Skills reason  →  integrations retrieve  →  Skills interpret
```

| Layer | Owns | Never does |
| --- | --- | --- |
| Academic Skills (Citation Integrity) | When a check is warranted and authorized, which fields to send, how to read statuses, how to report document, metadata and source-content evidence | HTTP, credentials, retries, provider JSON parsing |
| This package | Requests, timeouts, size limits, redirects, pacing and backoff, cache, decoding, normalization, comparison, provenance, sanitized errors | Academic judgement, verdicts on references, writes |
| Providers / Vale | Their own data and diagnostics | — |

Why a separate package rather than new tools in `packages/languagetool-mcp`: LanguageTool MCP
must stay a LanguageTool adapter, without bibliographic or network-provider knowledge. One
package holds both the small library (`createIntegrations`) and its MCP facade, so the transport
rules are written once. Its version follows the repository version (currently 0.3.0,
[releasing.md](releasing.md)); it stays `private` and nothing is published in this phase.

## Setup

```sh
npm ci
npm run build
node packages/research-integrations-mcp/dist/index.js   # or let an MCP client start it
```

Register it separately from LanguageTool, e.g. with Claude Code:

```sh
claude mcp add research-integrations -- node /absolute/path/to/packages/research-integrations-mcp/dist/index.js
```

stdout carries the MCP protocol only. stderr gets fixed one-line diagnostics, never a query,
metadata, text, URL or configuration value.

## Tools

| Tool | Input (strict) | Returns |
| --- | --- | --- |
| `crossref_lookup_doi` | `doi`, optional `expected` {doi, title, author, year} | One record, DOI verification levels, comparison |
| `crossref_search_works` | `title`, optional `author`, `year`; `limit` 1–20 (default 5); `start` 0–10,000 | Candidates, comparison, paging |
| `openalex_lookup_work` | `id`: W id, `https://openalex.org/W…` or a DOI form; optional `expected` | One record; DOI levels for DOI lookups |
| `openalex_search_works` | `title`, optional `author` (compared locally, not sent), `year`; `limit` 1–20; `page` 1–10 | Candidates, comparison, paging |
| `zotero_get_item` | `libraryType` users/groups, numeric `libraryId`, 8-character `itemKey`, `access` public/private, `mode` web/local | One library record |
| `zotero_search_items` | Same library selection, `query`, `limit` 1–20, `start` 0–10,000 | One page of top-level items |
| `vale_check` | `text` (1–40,000 UTF-16 units), `format` text/markdown | Vale diagnostics |

Every metadata tool takes `networkConsent` (default `false`). No tool accepts a URL, base URL,
header, credential, executable, configuration file or file path. All tools are annotated
read-only. Search results and paging are bounded; the package never downloads all pages and
never follows provider `Link` headers or returned URLs.

Library use, after `npm run build`:

```js
import { createIntegrations, compareProviderRecords } from '@gasycoder/research-integrations-mcp';
const tools = createIntegrations();            // no I/O, even when credentials are configured
// Only after an explicit verification request or an authorized, announced workflow:
const crossref = await tools.crossrefLookup({
  doi: '10.5555/synthetic', expected: { title: 'Synthetic Methods', year: 2021 }, networkConsent: true,
});
```

`compareProviderRecords(records)` lays records from several providers side by side and lists
differing DOI, title, year and container values with their provider; it never picks a winner.

## Network consent and privacy

- **No automatic network use.** An ordinary request ("review this manuscript", a writing or
  scientific review) sends nothing, even when the server and keys are configured. A request
  to verify specified references authorizes that scope; an announced workflow must already
  be authorized for its network step. The caller then sets `networkConsent: true` for those
  calls only. The flag is a per-call gate enforced before any cache or network access; it
  records the caller's decision but cannot prove that a human consented — hosts and Skills
  remain responsible for that policy.
- **Data minimization.** Only the identifier, or title / author / year for a search, is sent.
  Never a manuscript, paragraph, file, Research Profile or citation context. OpenAlex search
  sends the title (and a year filter) only; the author is used for local comparison.
  `expected` values are compared locally and never sent.
- **Document Formats.** Locate citations with Phase 8 (`packages/document-formats`), keep the
  locations locally, pass only the extracted bibliographic fields, and attach the returned
  evidence to the original finding. Extraction is not reimplemented here, and raw files are
  never passed to these tools.
- **Private Zotero data.** Zotero results are never cached, public or private. Abstracts, notes,
  attachments, tags and `extra` are not returned; a short allowlist of bibliographic fields is.
  Titles and creators of a private library are still user data: hosts must treat tool results
  accordingly. Nothing is logged.

## Results

Every provider call returns its own result; a failure of one provider never changes another's.

```text
provider, status, provenance, records[], doiVerification?, pagination?, cacheHit?,
interpretation { note, claimSupport: "cannot_be_verified_from_metadata_alone" }, error?
records[i] = { metadata, provenance, comparison[] }
```

### Normalized metadata

`provider`, `providerRecordId` (DOI for Crossref, `https://openalex.org/W…`, or
`users|groups/<id>/items/<key>`), and when present: `doi` (lower-cased for comparison; the
provider's original form stays in `identifiers.doi`), `title`, `authors` (name, given, family,
ORCID, Zotero creator role), `year` with its `yearSource`, all retained `dates`, `container`,
`volume`, `issue`, `pages`, `articleNumber`, `type`, `url`, `identifiers` and `providerFlags`.

Absent values stay absent; original strings are not rewritten. An OpenAlex W id is never
treated as a DOI. Up to 100 authors are kept (`AUTHORS_TRUNCATED` beyond); strings over 2,000
units and non-http URLs are omitted and listed in `omissions`. Returned URLs are descriptive
and never fetched. `providerFlags` currently exposes OpenAlex `is_retracted` as a provider
statement only: this is not a retraction check, and `false` certifies nothing.

### Provenance

`provider`, `queryType`, the minimal `query` sent, `endpoint` (origin and path, without query
string, so without contact or key), `requestedAt`, `retrievedAt` when a response arrived,
`redirected` when a same-origin redirect was followed, `sourceKind`
(`external_provider_result` or `local_library_result`) and, per record, `canonicalId`. A cache
hit keeps the original `retrievedAt` and reports `cacheHit: true`. These fields let a Skill
tell provider data apart from model inference or document evidence.

### Statuses

| Status | Meaning |
| --- | --- |
| `exact_match` | Lookup only: the record carries the identifier looked up and no compared value disagrees. Identifier and metadata agreement, nothing more |
| `candidate_match` | One candidate whose identity is not established: a single search result, or a lookup answered with another id (e.g. a merged OpenAlex work) |
| `ambiguous` | Several candidates, or one candidate with more results beyond this page; none is selected |
| `metadata_mismatch` | A single record disagrees with a compared DOI, title or year; inspect the comparison and dates |
| `not_found` | This provider returned no matching record for this query. Not evidence that the work does not exist |
| `unavailable` | Transport, HTTP, timeout, size or format failure. No bibliographic evidence either way |
| `rate_limited` | Provider throttle (429) or local cooldown; `error.retryAfterMs` says how long to wait |
| `authentication_required` | Missing key or library permission; private web reads without a key are refused before any request |
| `verification_not_performed` | No request: no consent, local Zotero not enabled, or an unrecognized DOI |

`interpretation.note` is a fixed sentence per status, e.g. for `not_found`: "No matching
Crossref record was found for this query. Provider coverage is not exhaustive: this is not
evidence that the work does not exist."

### DOI verification

"DOI verification" is three separate observations, never one `valid` flag:

| Field | Values |
| --- | --- |
| `syntax` | `recognized`, `not_recognized` (nothing is sent; nothing is corrected) |
| `providerRecord` | `found`, `not_found`, `not_checked` (no consent, failure, throttle) |
| `metadataAgreement` | Over caller-supplied title/author/year: `all_compared_fields_matched`, `mismatch_observed`, `inconclusive`, `not_compared` |

Recognized forms: bare `10.NNNN/…`, `doi:` prefix, and `doi.org` / `dx.doi.org` URLs (decoded
once). Other URLs, whitespace, query strings, fragments and overlong values are not recognized.
The DOI is lower-cased (DOIs are case-insensitive) but never repaired or completed. DOI
resolution through `doi.org` redirects to publisher sites is deliberately not used: only the
documented metadata APIs are queried.

### Comparisons

Deterministic and explainable, one state per field: `matched`, `mismatch`, `inconclusive` or
`not_available`; no score or probability.

- **Normalization for comparison only:** Unicode NFC, case folding, whitespace collapsing; for
  titles also trailing sentence punctuation. Symbols and inner punctuation stay significant
  (`α-β` ≠ `α+β`). A title that extends the other after a separator (possible subtitle) is
  `inconclusive`.
- **Authors:** only an identical full multi-word name matches. A lone surname, initials,
  diacritic variants or a different name are `inconclusive`, never `mismatch`: names neither
  prove nor disprove identity. ORCIDs are retained, never inferred.
- **Years:** equal to the primary year → `matched`; equal to another retained date
  (online, print, issue) → `inconclusive` with the date named; otherwise `mismatch`, noting that
  a year difference is not by itself an error. Crossref's primary year comes from `issued`,
  then `published`, `published-print`, `published-online`. Searches with a year filter use
  ±1 year for the same reason.
- **Provider disagreement:** keep every record and its provenance, report the differing
  values, recommend human verification. No majority vote, no provider is "more true".

**Metadata alone cannot verify claim support.** Matching DOI, title and authors say nothing
about what the source says. No abstracts or full text are returned; source-content evidence
needs supplied passages. Document evidence, external metadata evidence and source-content
evidence stay three separate levels (see the
[Citation Integrity Skill](../skills/citation-integrity/SKILL.md#optional-external-metadata-evidence)).

## Provider contracts (checked on 2026-11-01)

Checked against the official documentation and, for path forms, one manual request with the
public example DOI of the OpenAlex documentation. Provider policies change: response headers
and current documentation prevail over this summary.

**Crossref REST API.** Base `https://api.crossref.org/v1/`; the version is pinned in the path
as the [versioning policy](https://www.crossref.org/documentation/retrieve-metadata/api-versioning/)
recommends (only v1 is listed; unversioned requests default to v1 while it exists).
`works/{doi}` for lookups; `works` with `query.title`, optional `query.author`, a
`from-pub-date`/`until-pub-date` filter, `rows`, `offset` (≤ 10,000) and `select` for searches.
No key is needed. The [access policy](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/)
(updated 2025-10-16) lists 5 requests per interval and concurrency 1 for the public pool, 10 and
3 for the polite pool (identified by `mailto`), with `x-rate-limit-limit` /
`x-rate-limit-interval` headers (observed: `5`, `1s`). The User-Agent identifies the project;
the contact email is appended and sent as `mailto` only when the operator sets
`ARA_CROSSREF_CONTACT`. A 403 is a manual block, reported as `unavailable`, not as a key prompt.

**OpenAlex API.** Base `https://api.openalex.org/`. `works/W…` or `works/doi:…` for lookups;
merged work ids are redirected to the surviving record, so up to two same-origin redirects
are followed and the result is a `candidate_match` with `redirected: true`. Searches use the
title-scoped `search.title` parameter (the general `search` also matches abstracts and full
text, and `filter=title.search` is deprecated), a `publication_year` range filter, `per_page`
and basic `page` paging (depth ≤ 10,000). `select` limits responses to bibliographic fields.
The [authentication page](https://help.openalex.org/api/authentication/) (updated 2026-10-15)
allows keyless basic use (10 requests/s, shared daily budget), and a free key (30/s) sent as
`api_key` or `Authorization: Bearer`; this package uses the header only. 429 means a
per-second or daily budget was exceeded. Cursor paging, which needs a key, is not used.

**Zotero Web API v3.** Base `https://api.zotero.org/`, `Zotero-API-Version: 3` on every request
([basics](https://www.zotero.org/support/dev/web_api/v3/basics)). Public libraries are read
without a key; a configured key is sent only for `access: private`, only in the
`Zotero-API-Key` header (never the `key` query parameter). 403 means an invalid key or missing
permission. `Backoff` may come with any response and `Retry-After` with 429 or 503; both start
a cooldown. Searches use `items/top`, `format=json`, `q`, `qmode=titleCreatorYear`, `limit`,
`start` and the `Total-Results` header. No writes, sync, OAuth, collections, attachments,
full text or exports.

**Zotero local API** ([Desktop](https://www.zotero.org/support/dev/web_api/v3/local_api)).
Opt-in with `ARA_ZOTERO_LOCAL=1`, fixed at `http://127.0.0.1:23119/api/` (the documented
`localhost:23119/api/`), never another host or port, and never scanned or assumed running.
Users must enable "Allow other applications on this computer to communicate with Zotero";
otherwise it answers 403, reported as `unavailable`. Reads need no key, so no key is ever sent
locally; `users/0` designates the local user's library. Local write keys are out of scope.

## Configuration

Operator environment variables only, never Research or Discipline Profile fields or tool
arguments. Leave a variable unset rather than empty. Invalid values stop the server with a
fixed message that does not repeat them. Never commit credentials or a `.env` file.

| Variable | Default and contract |
| --- | --- |
| `ARA_INTEGRATIONS_TIMEOUT_MS` | 10,000; 100–60,000. One HTTP call including its whole body, or one Vale run |
| `ARA_INTEGRATIONS_RESPONSE_BYTES` | 2 MiB; 1 KiB–8 MiB, counted on received bytes |
| `ARA_INTEGRATIONS_CACHE_TTL_MS` | 60,000; 0–300,000; 0 disables the public metadata cache |
| `ARA_CROSSREF_CONTACT` | Unset. Email for Crossref's polite pool |
| `ARA_OPENALEX_API_KEY` | Unset. Optional OpenAlex key |
| `ARA_ZOTERO_API_KEY` | Unset. Needed for private web libraries only |
| `ARA_ZOTERO_LOCAL` | `0`; `1` enables the local Desktop API |
| `ARA_VALE_PATH`, `ARA_VALE_CONFIG` | Unset. Absolute paths to an installed Vale and its configuration |

## Transport, limits and secrets

- **HTTP:** one small client for all providers, Node's native `fetch`, GET only.
- **Timeout:** every call, covering headers and body streaming.
- **Size:** `Content-Length` above the limit is refused unread; streamed bodies are cut at the
  limit (`RESPONSE_TOO_LARGE`). Bodies must be strict UTF-8 JSON. Each tool result, counted on
  its whole MCP envelope, is capped at 512 KiB. Searches return at most 20 records.
- **Redirects:** none, except up to two same-origin redirects for OpenAlex lookups. A redirect
  to another origin, scheme or port, or with credentials in its URL, is never followed
  (`REDIRECT_BLOCKED`), so no key or `Authorization` header reaches another origin.
- **Retries: none.** One request per origin at a time, through a queue of at most four
  calls (more get `BUSY`). Pacing waits briefly (250 ms minimum interval, or Crossref's
  advertised rate; at most 2 s). A provider-requested delay — `Backoff`, `Retry-After`, or 1 s
  after a 429/503 without one — is never slept through: calls during it return
  `rate_limited` / `CLIENT_COOLDOWN` with `retryAfterMs`. Whether to try again is the caller's
  decision; there is no retry loop.
- **Cache:** in memory, per process, at most 32 Crossref/OpenAlex responses for the TTL, keyed by
  request URL. Zotero is never cached. Consent is checked before the cache.
- **Errors:** fixed codes and messages, optional HTTP status and retry delay. Upstream bodies,
  HTML, URLs, Vale stderr and caller values are never included.
- **Secrets:** keys travel in headers only, the Crossref contact in the User-Agent and
  `mailto`. They never appear in provenance (endpoints have no query string), errors, logs or
  stdout. If a provider echoes one into a returned value, raw or percent-encoded (fully, partly,
  any case), that whole value becomes `[REDACTED]`. Only free-form values are inspected;
  property names, statuses and codes stay intact. Deliberate obfuscation beyond percent-encoding
  is not covered.
- **SSRF:** destinations are the fixed official endpoints above. No tool or environment variable
  sets a base URL; only the internal test harness can point providers at a literal loopback
  HTTP address.

## Optional Vale

Vale is a style-guide linter: terminology, house style and prose conventions defined by its
configured styles. It does not replace LanguageTool (grammar, spelling, general style),
the Academic Writing Skill (clarity, register, argumentation) or the Scientific Review Skill.
Their findings are reported separately and never merged into one verdict.

- **Never installs or syncs.** Without both configured paths pointing to existing files, the
  result is `VALE_UNAVAILABLE`. There is no download, discovery, `vale sync` or style package
  installation; configure styles beforehand.
- **Execution:** `spawn` of the configured executable without a shell, with fixed arguments
  `--config <config> --no-global --output=JSON --no-exit --ext=.txt|.md`
  ([CLI](https://docs.vale.sh/topics/cli)), cwd at the config directory, and a minimal
  environment (`PATH`, `LANG`): provider keys never reach the process. The text goes through
  stdin, so there are no temporary files and no text in arguments. Timeout and a 512 KiB cap on
  stdout plus stderr kill the process; stderr is never returned. Exit code 2 (Vale could not
  run) gives `VALE_FAILURE`.
- **Trust:** the executable, configuration and installed styles are operator choices. A Vale
  configuration can load arbitrary rule files; this is not a sandbox for untrusted configs.
- **Results:** at most 200 diagnostics (`truncated` beyond), with `Check`, `Message`,
  `Severity`, `Match`, `Line`, `Span`. File names, actions and suggested replacements are
  dropped; nothing is applied. `coordinateSystem: vale_line_span` marks Vale's 1-based line and
  column span, which are not UTF-16 offsets for Document Formats `mapFinding`.
- **Formats:** plain text or Markdown via stdin. For LaTeX or DOCX, send a Phase 8 eligible
  prose segment as text and keep its location locally; DOCX is never passed to Vale.

## Tests

`npm test` and CI (Node 20 and 22) use local fake HTTP servers and fake Vale executables only:
consent, statuses, comparisons, provider independence and disagreement, ambiguity, paging,
timeouts, size limits, malformed bodies, redirects and credential forwarding, Retry-After and
Backoff, queueing, cache, secret redaction, shell-injection attempts, and the production stdio
server through the official MCP client on protocol revisions 2025-11-25 and 2026-07-28.

```sh
npm run test --workspace @gasycoder/research-integrations-mcp
# Opt-in, never in CI: sends one public DOI to Crossref and OpenAlex.
npm run test:live --workspace @gasycoder/research-integrations-mcp
```

The private Zotero live test also needs `ARA_ZOTERO_API_KEY`, `ARA_LIVE_ZOTERO_LIBRARY_ID`
and `ARA_LIVE_ZOTERO_ITEM_KEY`; it is skipped otherwise. Fake-server tests validate the
adapter, not provider coverage, availability or the truth of any reference.
Scenarios: [research-integrations-scenarios.md](research-integrations-scenarios.md).

## Limitations

- Provider coverage is partial; `not_found` stays a provider observation.
- No abstracts, full text, citation contexts or claim-support assessment.
- No retraction or correction engine; only OpenAlex's explicit flag is exposed.
- No cursor paging, Crossref Metadata Plus, Zotero writes, collections or exports.
- Comparison heuristics are deliberately conservative and favour `inconclusive`.
- The consent flag is a caller gate, not proof of human consent.
