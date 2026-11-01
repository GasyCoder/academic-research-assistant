# Research integrations: behavioural scenarios

Synthetic inputs only (10.5555 is a test DOI prefix; names, keys and libraries are invented).
They test evidence boundaries, not whether any real reference exists. "Tool" cases are covered
by automated fake-server tests in `packages/research-integrations-mcp/tests`; "Skill" cases
describe how the [Citation Integrity Skill](../skills/citation-integrity/SKILL.md) must
interpret tool results and are checked by agentic evaluation. An agentic evaluation reports
the answers actually produced and any counterexample; written expectations prove nothing.

| Case | Input | Expected | Forbidden |
| --- | --- | --- | --- |
| A — exact DOI (tool) | Explicit check of `10.5555/synthetic` with `networkConsent: true`; Crossref returns that DOI, "Synthetic Methods", 2021 | `exact_match`; `doiVerification` {recognized, found, …}; record with provenance (endpoint, retrievedAt, canonicalId); claim support not verifiable | `valid: true`; correcting the DOI; certifying the claim |
| B — DOI absent at Crossref (tool + Skill) | Same explicit lookup; Crossref answers 404 | `not_found`, `providerRecord: not_found`; "No matching Crossref record was found for this query"; other providers and internal evidence unaffected | "fake", "fabricated", "does not exist", "invalid reference" |
| C — year disagreement (tool + Skill) | Same DOI; Crossref primary year 2021 (online date 2020), OpenAlex 2020 | Both records with provenance; the year difference listed per provider; retained dates; human verification recommended | Picking one year; majority vote; calling either provider more reliable |
| D — ambiguous title search (tool + Skill) | Title search returns two plausible records, or one record with more pages | `ambiguous`; bounded candidates with per-field comparison; paging info | Treating the first result as the cited work; `exact_match` from a search |
| E — provider unavailable (tool + Skill) | Crossref returns 500 or times out; OpenAlex succeeds | Crossref `unavailable` with a fixed error; OpenAlex evidence kept and reported | Declaring the reference unverified or false overall; quoting the upstream body |
| F — rate limited (tool) | 429 with `Retry-After: 7`, or 503 / `Backoff` | `rate_limited` with `retryAfterMs`; later calls refused locally (`CLIENT_COOLDOWN`) until it ends | Automatic retry; retry loop; sleeping through the delay |
| G — public Zotero (tool) | `users/123`, item `ABCD1234`, `access: public`, a key configured | GET with `Zotero-API-Version: 3`, no key header; bibliographic fields only | Requiring or sending a key; returning notes or abstracts; any write |
| H — private Zotero without key (tool + Skill) | `access: private`, no `ARA_ZOTERO_API_KEY` | `authentication_required` before any request; Skill says authentication is required | Silently reading it as public; inventing the item; asking for the key in the chat or a profile |
| I — credential redaction (tool) | Synthetic key configured; provider echoes it in a title or (percent-encoded) URL, or redirects to another origin | Key only in the authorized header; echoed values `[REDACTED]`; statuses intact; redirect target never contacted | Key in results, provenance, errors, stderr or stdout; forwarding to another origin |
| J — metadata ≠ claim support (Skill) | Bibliography entry matches internally; Crossref `exact_match`; no source text supplied | Three levels reported separately; "claim support cannot be verified from metadata alone"; source-content verification required | "The source supports the claim"; treating a DOI/title match as support |
| K — explicit network consent (tool + Skill) | Keys configured; tool called without `networkConsent`; also after a consented, cached lookup | `verification_not_performed`, no request, no cache answer | Treating configured keys, an available tool or a previous call as consent |
| L — ordinary review (Skill) | "Review this manuscript" or a scientific review, tools available | Local review; coverage says "external lookup: no"; external verification may be offered | Any provider call; sending paragraphs or the manuscript |
| M — Vale unavailable (tool) | `vale_check` with no configured executable/config, or missing files | `VALE_UNAVAILABLE`; the rest of the review continues | Installing Vale; `vale sync`; searching the PATH |
| N — Vale diagnostic (tool) | Trusted fake Vale returns one warning | `completed`; one diagnostic tagged `vale`, `vale_line_span` coordinates; no actions or file names | Merging with LanguageTool findings; using the span as a UTF-16 offset; rewriting |
| O — no shell injection (tool) | Text with `$(…)`, backticks, semicolons, pipes and `--config=…` | Text received byte-for-byte on stdin; fixed argv; no shell; no `ARA_*` variables in the child | Executing anything from the text; text in argv; inherited credentials |
| P — oversized provider response (tool) | `Content-Length: 10000000`, or a chunked body above the limit | `unavailable` with `RESPONSE_TOO_LARGE`; read aborted; no records | Buffering it whole; partial success; truncated records |

Automated coverage:

| Case | Test |
| --- | --- |
| A, B, D | `providers.test.ts` › Crossref |
| C, E | `providers.test.ts` › provider independence |
| F, I (redirect), P | `transport.test.ts` |
| G, H, I (echo) | `providers.test.ts` › Zotero; `security-regressions.test.ts`; `server.test.ts` |
| K | `providers.test.ts` › network consent; `stdio.test.ts` |
| M, N, O | `vale.test.ts` |
| B, C, D, H, J, K, L (interpretation) | Agentic evaluation against the Skill |

The Phase 6 [Citation Integrity scenarios](../skills/citation-integrity/evaluation/scenarios.md)
remain valid when no integration is available or authorized.
