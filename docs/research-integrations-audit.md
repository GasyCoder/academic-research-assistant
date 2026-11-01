# Phase 9 independent audit — 2026-11-01

**Verdict: PASS WITH FIXES.** The six submitted commits were not ready unchanged. New
counterexamples demonstrated seven defects, including one credential-redaction gap. Targeted
fixes now have regression coverage and independent replays. No demonstrated blocking defect
remains in the documented read-only scope. This audit does not establish provider coverage,
bibliographic truth, claim support or isolation of an untrusted Vale installation.

## Baseline and scope

The audit began on clean `feat/research-integrations`, HEAD `6a39a73`, above main `9278062`.
The six commits reviewed were `9105a70`, `59e6a37`, `0c6b050`, `58191b5`, `72c3513`,
`6a39a73`. README, AGENTS, CLAUDE, architecture, roadmap, integration contracts/scenarios,
package source/tests/manifests, lockfile, CI and the integrating Skill changes were inspected.
Two independent read-only reviewers ran additional local synthetic counterexamples; the
primary auditor reproduced the failures and added executable regressions before correction.

Earlier concurrent edits belonged to this Codex session and the implementation session,
not an unexplained dependency or malicious file. Codex stopped writing when the collision
was detected, and the user selected the other session to finish. This audit starts from
that session's committed, coherent final HEAD, rather than the earlier mixed working tree.
The previously added `security-regressions.test.ts` was reviewed and replayed; its six tests
passed on the submitted HEAD, but did not cover the new variants below.

The original package's 133 tests passed on Node 22, and the full submitted check passed on
Node 20. The first Node 22 repository check encountered one pre-existing Document Formats
deep-Markdown test timeout at its five-second test limit; final ordinary checks passed on
both runtimes without changing that test or its limit. This is a test timing sensitivity,
not evidence of a Phase 9 source failure, and is recorded rather than hidden.

## Demonstrated findings and corrections

All findings below are resolved. HIGH denotes credential material recoverable from a tool
result under an adversarial upstream echo; no real credential, external transmission or
cross-origin forwarding was used in the reproduction.

| Severity | Reproduction and impact | Minimal correction |
| --- | --- | --- |
| HIGH H1 | A synthetic key percent-encoded four times survives the three-pass decoder in `metadata.url`; decoding the returned value recovers the key | Decode percent escapes to a fixed point on bounded strings; preserve protocol fields and property names |
| MEDIUM M1 | OpenAlex same-origin redirect immediately issues its next GET, bypassing 250 ms pacing and a `Backoff: 30` on the redirect response | Apply pacing/cooldown checks to every hop; keep timeout active while waiting |
| MEDIUM M2 | `Retry-After: 172800` on 503 is silently reduced to one day; another call reaches the provider a day early | Preserve numeric/date delays beyond 24 hours, bounded only by safe numeric timestamps |
| MEDIUM M3 | A finite rate count `1e-320` with interval `1s` overflows the spacing quotient, yielding permanent cooldown and non-finite retryAfterMs, invalid under the MCP schema | Require positive safe integer counts and finite positive bounded intervals |
| MEDIUM M4 | Cross-provider DOI comparison uses title punctuation normalization: `10.5555/alpha.` and `10.5555/alpha` incorrectly report no disagreement | Normalize each field separately; retain significant DOI suffix punctuation |
| MEDIUM M5 | Identical `A. Example` or structured family-only `van der Example` is marked matched, and can produce all_compared_fields_matched | Keep initial tokens and structured family-only author agreement inconclusive |
| LOW L1 | A 100,000-character Zotero DOI is omitted from the normalized field but copied unbounded to identifiers.doi, contrary to the 2,000-unit field contract | Apply the same Decoder string bound to the retained raw DOI |

Twelve added regression cases failed on the submitted code. They passed after correction;
two further cases cover timeout during redirect pacing and a two-day HTTP-date cooldown.
The final package therefore has 147 passing tests, up from 133, plus three skipped live tests.

Independent replays confirmed pacing at 250 ms, one request on redirect Backoff, the full
two-day delay, valid finite rate results, redaction of nested key echoes, preservation of DOI
disagreement, inconclusive partial names and omission of the long raw Zotero DOI. Existing
subtitle/alternative-year behavior, Unicode MCP results and consent-before-cache still pass.
These replays used separate local probes, not only the newly written repository tests.

## Architecture, API and evidence boundaries

- The private `@gasycoder/research-integrations-mcp` library and separate stdio server remain
  independent of LanguageTool MCP. No LanguageTool or Document Formats source, profile,
  schema, root script or CI change was needed by the audit. Runtime version follows root
  0.3.0. Skills reason; integrations retrieve/normalize; Skills interpret.
- Seven strict provider-specific tools expose Crossref DOI/search, OpenAlex work/search,
  Zotero get/search and optional Vale. No generic boolean reference-validity API hides the
  provider or the level of evidence. No Phase 10 release/distribution work was started.
- Metadata reads are GET-only. No Zotero library write, delete, sync, attachment download,
  publisher scraping, DOI redirect resolution, software installation or `vale sync` exists.
- Every metadata call checks `networkConsent` before network and cache. Constructing the
  service has no I/O. Ordinary manuscript/scientific review does not authorize lookup.
  Explicit verification authorizes only its stated scope; the host remains responsible
  for truthful consent flags and selection of minimal fields.
- Destinations are fixed official endpoints. Tools/env cannot provide arbitrary URLs,
  headers or executable/config paths. The internal test seam accepts literal HTTP loopback
  only. Zotero local mode additionally needs operator opt-in and uses fixed loopback port
  23119; it does not scan ports or assume Desktop is running.
- The normalized model preserves absent fields, original strings/identifiers, dates and
  yearSource, distinct OpenAlex/DOI ids, creator roles and explicit omissions. Metadata has
  no inferred scientific facts. Up to 100 authors are retained with an explicit omission.
- Provenance includes provider, query type/minimal query, endpoint without contact/key query
  parameters, request/retrieval times, source kind, canonical returned id and redirect flag.
  Cache retains its original retrieval time. Failure/unperformed states have no records.
- `exact_match` is lookup identifier agreement and can coexist with inconclusive metadata.
  Searches retain bounded candidates, ambiguity and pagination; no first-result selection.
  Syntax recognition, provider record and metadataAgreement remain separate DOI observations.
- Cross-provider disagreements retain every record and provenance without a vote/winner.
  Partial names never establish identity; online/print/issue dates and subtitle differences
  remain descriptive/inconclusive when appropriate. Missing provider fields are not errors
  in the source bibliography. Comparison heuristics remain conservative, not universal
  name resolution or a full DOI grammar.
- Citation Integrity preserves document evidence, provider evidence and source-content
  evidence separately. `not_found` is not fabricated/nonexistent, failures are not negative
  bibliographic evidence, and metadata alone cannot verify claim support. Optional provider
  flags do not constitute universal retraction checking. No abstract/full text is returned.
- Phase 8 locations remain local; only bibliographic fields reach providers. Protected keys
  stay visible to citation inventory. Academic Writing may request Vale separately; Scientific
  Review stays evidence-bound and does not silently initiate external lookup. Profiles hold
  no credentials or provider choices. Skills contain no HTTP/parsing/retry implementation.

## Provider and transport checks

Official sources were rechecked on 2026-11-01:

| Provider | Contract observed and implementation boundary |
| --- | --- |
| Crossref | [Access policy](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/) and explicit [v1 version policy](https://www.crossref.org/documentation/retrieve-metadata/api-versioning/); public lookup/search, identifiable User-Agent, optional configured contact, rate headers, no key requirement |
| OpenAlex | [Singletons](https://help.openalex.org/api/get-single-entities/) support W ids and DOI lookup; [authentication](https://help.openalex.org/api/authentication/) allows basic keyless use and optional bearer key; bounded title search/basic pages, no cursor provisioning or semantic rerank |
| Zotero | [v3 basics](https://www.zotero.org/support/dev/web_api/v3/basics): pinned header, public reads without keys, private header auth, Backoff even on success, Retry-After on 429/503; [local API](https://www.zotero.org/support/dev/web_api/v3/local_api) is separate and opt-in |
| Vale | [CLI](https://docs.vale.sh/topics/cli): trusted explicit config, stdin, JSON, no-global/no-exit and text/Markdown format; no installation or sync |

HTTP uses one native-fetch abstraction with timeout covering headers/body and redirected
requests. It has zero retries, one active call per origin and at most four queued/running
calls. Queue/initial pacing time is outside the HTTP timeout, as documented; redirect pacing
is within it. At most two same-origin redirects are allowed for OpenAlex lookup only;
origin/scheme/port/credentialed-URL changes are refused before the target is contacted.

Actual response bytes and Content-Length are bounded (2 MiB default, configurable 1 KiB–8 MiB).
Strict UTF-8/JSON parsing and fixed error messages avoid raw upstream body leakage. Search
outputs are capped at 20 records. The normalized library result and duplicated/escaped MCP
envelope each have a 512 KiB check. Rate hints cannot create non-finite spacing; requested
provider cooldowns are returned rather than slept through or retried automatically.

Cache is process-local, at most 32 successful public Crossref/OpenAlex responses with bounded
TTL, keyed by URL; no Zotero cache. Keys are headers only and no public Zotero call receives
a configured private key. Local Zotero never receives a web key. Redaction applies to
free-form values, not protocol property names/statuses, including nested percent encodings.
It is not a detector for encryption or every possible deliberate obfuscation.

Vale uses `spawn` with shell=false, fixed arguments, text on stdin, minimal environment,
timeout and combined stdout/stderr cap. No manuscript temp files exist; errors discard stderr
and file keys/actions. Native line/span coordinates are not claimed as verified UTF-16
offsets. Malicious executables/configs are outside the trust contract; there is no OS sandbox.
Repository tests use fake executables and do not establish semantics of a real rule set.

## Final validation

The normal `npm run check` was reproduced on Node 22.16.0/npm 11.11.0 and
Node 20.20.2/npm 10.8.2, with the final corrected source and the same dependency tree.
The already available temporary official Node 20 runtime was used outside the repository.

| Check | Result on both runtimes unless stated otherwise |
| --- | --- |
| validate:skills | 14 passed, zero failed/skipped; four Skills valid |
| validate:profiles | 27 passed, zero failed/skipped; validator passed |
| validate:disciplines | 11 passed, zero failed/skipped; five profiles valid |
| typecheck | All three workspaces passed |
| integration package tests | 147 passed, 3 live tests skipped; 8 passed files and 1 skipped file |
| Document Formats tests | 61 passed, zero skipped; 4 files passed |
| LanguageTool MCP tests | 247 passed, 9 real-service tests skipped; 14 files passed, 1 skipped |
| repository tests | 455 passed, 12 skipped; 26 files passed, 2 skipped |
| build | All three workspaces passed |
| check | Exit 0, including ordinary package-install smoke check |
| pack:check | Existing LanguageTool 17-file tarball/install check passed; four tools and text/document checks work |
| integration package pack dry-run | Expected 22 files: README, package.json, ten JS/declaration pairs in dist; no tests/private fixtures |
| direct integration test command | Same 147 passed, 3 skipped |
| git diff --check | Passed |
| npm audit | Exit 0, zero vulnerabilities in every severity category |
| npm audit --omit=dev | Exit 0, zero vulnerabilities in every severity category |

The official MCP client exercises both supported protocol revisions (2025-11-25 and
2026-07-28), strict schemas, populated results, protocol-only stdout, sanitized stderr,
continued service after errors, output bounds and clean stdin-close exit.

No live provider test or real LanguageTool/Vale execution was initiated by this audit.
The implementation session reported two public live successes; those are author evidence,
not independently reproduced here. The three live metadata tests remain skipped by default,
and private Zotero live requires explicit credentials/identifiers. Official documentation
browsing and npm auditing/package checks were the explicit external development operations;
counterexamples used only local fake servers and synthetic data.

Privacy scanning covered the 34 submitted changed files plus the new audit regression file:
no requested private names, personal paths, real emails/phones, private keys or API-token
patterns were found. `.invalid` contacts/URLs and synthetic test keys are intentional.
Existing dependency-lock entries are unchanged from main; only the new workspace and its
link were added. SDK MCP and zod are reused; no new dependency implementation/version or
automatic security fix was introduced by the audit. No real credential or research document
was supplied to the counterexamples, logged or committed.

## Handoff

Modified during audit: `src/config.ts`, `src/http.ts`, `src/metadata.ts` within the integration
package, and `docs/research-integrations.md`. Created: `tests/independent-audit.test.ts`
and this report. No implementation-session commit was rewritten.

Audit commits: `d52335a` (`fix(integrations): close independent audit regressions`)
and the documentation/report commit (`docs(integrations): record independent audit and limits`).
Their hashes and observed clean Git state are recorded in the user-facing final handoff.
No push, merge, tag, publication or Phase 10 work was performed.

Remaining limits: incomplete provider coverage, no full-text/claim-support or universal
retraction verification, conservative identity heuristics, caller-owned consent policy,
trusted local Vale, bounded cache memory costs and no independent live-service validation.
The legacy deep-Markdown test showed timing sensitivity once during the baseline run.

Recommended next step: maintainer review and merge of the audited branch. Then scope
Phase 10 separately (licensing, distribution/client examples and packaging checks), keeping
live/private tests explicitly opt-in. Do not infer release authorization from this audit.

Phase 9 ready to merge into main: YES
