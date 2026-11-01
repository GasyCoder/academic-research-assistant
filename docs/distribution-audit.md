# Final Phase 10 distribution audit — 2026-11-01

Historical Phase 10 record, preserved as observed before owner release decisions.
The owner subsequently selected Apache-2.0; see the current [release procedure](releasing.md)
and [third-party licence review](third-party-notices.md). Historical findings below are not
a statement that the licence decision is still open.

Readiness: **READY AFTER OWNER ACTION**.

The submitted distribution checks are reproducible. No demonstrated runtime or packaging
release blocker was found. The owner licence decision remains the sole **BLOCKER**.
One additional **SHOULD FIX** was demonstrated: the development dependency Vitest 5 does
not support Node 20, even though the ordinary Node 20 check passes. This qualification
must accompany the original validation record; passing tests alone do not remove it.

Owner must explicitly choose MIT or Apache-2.0 (or another license) before release preparation can continue.

## Baseline and method

Audited branch: `feat/distribution`, initially clean, submitted HEAD `faf51dd`, above
`main` at `af860f0`. The submitted commits were:

- `2429a5c` — private packaging and independent installation checks;
- `786e75f` — installation and owner-gated release documentation;
- `faf51dd` — validation record and remaining release gates.

The diff contains 29 files, 971 insertions and 295 deletions. No existing runtime source,
Skill, profile or schema changed in those commits. The architecture still separates
linguistic diagnostics, academic reasoning, declared context, optional discipline guidance,
document reading/mapping and controlled external retrieval. Phase 10 adds distribution
resources and checks, not an academic feature.

README, CLAUDE, AGENTS, CONTRIBUTING, SECURITY, CHANGELOG, architecture, roadmap, release
procedure/results, package manifests/lock, plugin, CI, scripts, examples and relevant
Phase 3–9 contracts/resources were reviewed. Prior audit results were background, not a
substitute for this run. Two fresh directories were extracted with `git archive HEAD`:
no ignored local profiles, `.env`, node_modules, dist, worktree additions or Git metadata
were included. Each ran its own `npm ci` and `npm run check`.

Further probes were written outside the checkout: real tarballs installed into a third
temporary project, raw JSON-RPC against its linked MCP binaries, deliberate validator
mutations restored in a disposable snapshot, strict-engine source/runtime installs and
synthetic provider failures. No real manuscript, provider credential or live metadata
request was used. npm registry/audit, primary documentation and public GitHub metadata
were accessed; local fake/closed-loopback endpoints supplied runtime failure cases.

## Findings

### BLOCKER — owner licence decision

There is no repository LICENSE and no unapproved MIT/Apache SPDX field in the four
project package manifests or plugin. README explicitly makes open-source distribution
conditional on the owner's choice. The release procedure requires that choice first.
Third-party licence files in installed dependencies are not a project licence grant.
Nothing was selected or created on the owner's behalf.

### Development toolchain: Node 20

**SHOULD FIX**, existing before Phase 10. All three workspaces declare Vitest `^5.0.5`.
The lock resolves 5.0.5, whose engine is `^22.12.0 || ^24.0.0 || >=26.0.0`.
This agrees with the [tagged upstream manifest](https://raw.githubusercontent.com/vitest-dev/vitest/v5.0.5/packages/vitest/package.json)
and [current guide](https://vitest.dev/guide/).

Reproduction with Node 20.20.2/npm 10.8.2 in temporary source installations:

```sh
npm ci                         # exits 0, warns EBADENGINE for vitest@5.0.5
npm run check                  # exits 0; counts below
npm ci --engine-strict --ignore-scripts --no-audit --no-fund
# exits 1: EBADENGINE, vitest@5.0.5 requires Node 22.12+ on the tested Node 22 line
```

Separately, installing all three runtime tarballs under Node 20 with `--engine-strict`,
`--omit=dev` and `--ignore-scripts` exits 0 without the engine warning. Vitest is absent
from that installation. The problem concerns development installation/support, not a
demonstrated Node 20 runtime failure, so it is not an additional distribution blocker.

README and CONTRIBUTING now recommend the tested Node 22 line, at least 22.12, for
development and disclose the Node 20 limitation. The original results record is qualified.
No dependency or engine field was changed. A later focused change should either select
a maintained compatible test toolchain or explicitly separate development requirements
from Node 20 runtime compatibility. Replay the complete matrix after that change.

### Other priorities

- **SHOULD FIX:** establish and verify a private security reporting channel and maintenance
  policy before public release. SECURITY currently offers a truthful conditional process,
  without an invented address, enabled GitHub feature or response-time commitment.
- **OPTIONAL:** plugin author attribution, listing icon, Code of Conduct with moderation,
  friendly missing-manifest validator diagnostics, broader OS/host testing and a future
  marketplace. None is evidence of a current local-runtime failure.

## Versions and distribution inventory

All four packages declare `private: true` and `engines.node: >=20`. Root and both MCPs,
including installed MCP `serverInfo.version`, and the plugin are 0.3.0. Formats is the
documented internal 0.1.0 exception. Package-lock entries agree. No 0.4.0 bump occurred.

| Surface | Name/version | Bin / exports / files | Intended status |
| --- | --- | --- | --- |
| Root | academic-research-assistant / 0.3.0 | No bin, exports or files allowlist; workspace orchestrator | Private development only; never publish root |
| LanguageTool | @gasycoder/languagetool-mcp / 0.3.0 | languagetool-mcp → ./dist/index.js; exports only ./package.json; files dist/**/*.js | Potential future public CLI after owner decision; no library API |
| Integrations | @gasycoder/research-integrations-mcp / 0.3.0 | research-integrations-mcp → ./dist/index.js; ESM ./dist/service.js + ./dist/service.d.ts and ./package.json; files dist | Potential future CLI/library, currently private |
| Formats | @gasycoder/document-formats / 0.1.0 | No bin; ESM ./dist/index.js + ./dist/index.d.ts; files dist | Internal private library |
| Local Claude plugin | academic-research-assistant / 0.3.0 | .claude-plugin/plugin.json and default skills/ | Full clone; four Skills; no auto-start MCP/hooks or marketplace |
| Resources | Skills, profiles, schemas, docs, examples | Repository files and relative links | Retain in full clone; not separate npm packages |

Versions come from manifests, not inconsistent hardcoded server constants. The recommendation
0.4.0 is coherent: additive optional capabilities since v0.3.0, a documented pre-1.0 minor
policy and no change to tagged LanguageTool runtime source. New internal models/library
contracts are not a 1.0 stability promise. No demonstrated break to the tagged LanguageTool
tool API was found; general parser/model APIs remain pre-1.0.

## Tarballs and installed behavior

Built `npm pack --dry-run --json --ignore-scripts` manifests were compared under both
runtimes. Paths, file sizes and modes match; in this run npm shasums match too. Byte-for-byte
identity is an observation, not a promised future reproducible-build contract.

| Archive | Files | Compressed bytes | Unpacked bytes | SHA-1 reported by npm |
| --- | ---: | ---: | ---: | --- |
| gasycoder-languagetool-mcp-0.3.0.tgz | 17 | 26,202 | 86,544 | fe1f565f25400feb2dc08ee0feeaf343e89a9ce6 |
| gasycoder-document-formats-0.1.0.tgz | 11 | 13,891 | 53,381 | 881260f68c63228b2bfd08c990f474255f9eb3e5 |
| gasycoder-research-integrations-mcp-0.3.0.tgz | 22 | 31,454 | 136,938 | 5071f9b7842d023f36a20708054b8862e94debf2 |

Exact inventories:

- LanguageTool: README.md, package.json; dist/{config,errors,index,languagetool-client,
  languagetool-schemas,segmentation,server,transform,types}.js; dist/tools/{check-document,
  check-options,check-text,get-supported-languages,health-check,results}.js.
- Formats: package.json; dist/{docx,index,latex,markdown,model}.{js,d.ts}.
- Integrations: README.md, package.json;
  dist/{config,contracts,http,index,metadata,providers,server,service,vale,version}.{js,d.ts}.

Actual archives were opened and installed outside every source snapshot, with a minimal
environment and empty npm userconfig. No local workspace link, source resolution or dev
dependency was needed. No env/credential, tests/fixtures, logs, maps, nested tarball,
private document or personal absolute path was found in them. npm installs and makes the
two declared linked bins executable; direct invocation verifies shebang handling.

The existing installed LanguageTool harness also passed synthetic `check_text` and a
77,000-unit multi-chunk document with 800 expected issues. Additional raw JSON-RPC probes
confirmed initialize, tools/list, failure behavior, protocol-only stdout, diagnostic stderr
and exit 0 after stdin closed, for both installed MCPs. Malformed timeout configuration
caused exit 1, no stdout and no echoed synthetic private value.

| MCP | Installed tools | Observed failure boundaries |
| --- | --- | --- |
| LanguageTool | health_check, get_supported_languages, check_text, check_document | Absent HTTP server → unavailable; MCP still starts |
| Integrations | crossref_lookup_doi, crossref_search_works, openalex_lookup_work, openalex_search_works, zotero_get_item, zotero_search_items, vale_check | No consent → NETWORK_CONSENT_REQUIRED; absent Vale → VALE_UNAVAILABLE; private Zotero without key → AUTHENTICATION_REQUIRED |

Installed library probes separately made consented Crossref and OpenAlex calls against
closed loopback endpoints: both return `unavailable`, empty records and code `UNAVAILABLE`;
the service remains usable. Existing synthetic suites cover HTTP failures, rate limits,
timeouts, redirects, provenance, redaction and provider independence. Startup requires
no live provider, key, Java server or Vale executable. Integration annotations are read-only,
and code limits retrieval to GETs, with no Zotero writes/sync or manuscript upload.

The documented example also ran from the installed Formats package, with only its synthetic
manuscript/script copied. It maps exactly `reslts` inside bold markup to an unapplied
proposal. Formats exports readDocument, mapFinding, proposeReplacement, revisionOf,
DocumentError, LIMITS and model types. Integrations exports createIntegrations, loadConfig,
comparison helpers, normalizeDoi, IntegrationError, LIMITS and contract types. Existing
format/integration docs describe these private interfaces sufficiently for local use.
DOCX remains read-only, LaTeX conservative and locations tied to the exact snapshot;
no writer, conversion or Word round-trip promise was introduced.

## Plugin, resources, documentation and CI

Claude Code 2.1.314 `claude plugin validate .` passes local validation with warnings:
missing author, and root CLAUDE.md not loaded as plugin context. Directory checks explicitly
report missing licence and icon; local validation is not directory acceptance. The
[official manifest reference](https://code.claude.com/docs/en/plugins-reference) confirms
default component layout and the scope of manifest validation. No authenticated model
session, interactive Skill invocation or marketplace install was certified by this audit.

The manifest has only name/version/description, no absolute/custom component paths and no
automatic executable surface. Four valid Skill frontmatters, their references/evaluation
directories, schema/profile links and five valid discipline profiles are retained. Full
clone is required. Real profiles remain ignored; both minimal and complete distributed
examples are synthetic and schema-valid. No secrets or personal institution is required.

All 41 submitted Markdown files pass the local link/anchor check. Mutations independently
prove failures for a missing relative file, missing anchor, missing plugin manifest,
stale plugin/runtime version and a broken custom Skill path. Custom plugin paths are
rejected as outside this minimal manifest policy, rather than silently accepted.
The scanner is deliberately not a full Markdown renderer or remote-link crawler.

Quickstart source installation/build/example succeeds without any optional provider.
Configuration docs cover every current runtime env variable, defaults, secret status and
opt-in live controls; no dotenv auto-loader is promised. The only `.env.example` contains
local URL/timeout settings. Invalid values produce sanitized diagnostics.

Java/LanguageTool is separately installed. Java 17 for the documented recent LanguageTool
is supported by [upstream's Java API requirements](https://dev.languagetool.org/java-api),
which date that floor to LanguageTool 6.6. This audit did not rerun a real Java server;
its startup instructions are consistent with the local-server contract. Linux is the
tested OS, without a claim of tested Windows/macOS support.

CI is a read-only Ubuntu Node 20/22 matrix: pinned checkout/setup actions, resource
validators, npm ci, typecheck, synthetic tests, build, example and tarball installation
checks. It has no credential, publisher job or live-test flag. Provider services are not
required; npm setup/install may require registry/cache access. The current local results
are not a claim that an unpushed remote CI job ran.

CHANGELOG remains Unreleased; 0.4.0 notes are explicitly a draft. CONTRIBUTING is usable
with the documented toolchain qualification. SECURITY discloses its missing private
channel rather than inventing one. No Code of Conduct is present or assumed mandatory.

## Exact test results

Both source snapshots ran the ordinary commands successfully, without hidden input files:

| Runtime | npm | npm ci | npm run check |
| --- | --- | --- | --- |
| Node 20.20.2 | 10.8.2 | Exit 0; Vitest EBADENGINE warning | Exit 0 |
| Node 22.16.0 | 11.11.0 | Exit 0 | Exit 0 |

Each installed 129 packages. The original checkout check also passes under Node 22.

| Category | Passed | Skipped |
| --- | ---: | ---: |
| Skill validator | 14 | 0 |
| Research Profile validator | 27 | 0 |
| Discipline Profile validator | 11 | 0 |
| Distribution validator | 5 | 0 |
| **Validation total** | **57** | **0** |
| Formats | 61 | 0 |
| LanguageTool | 247 | 9 |
| Integrations | 147 | 3 |
| **Application total** | **455** | **12** |

Application files: 26 passed, two skipped. The 12 skipped cases are nine real LanguageTool
tests and three live-provider tests; their suites are gated by explicit env flags, and
private Zotero additionally needs configured credentials/item identifiers. They are not
failed tests or executed live coverage. Real Vale/Java/providers were not run. All three
typechecks/builds, the example, allowlists and clean-room package checks pass.

After the documentation-only audit changes, `npm run validate:distribution` passes again:
five validator tests, synchronized private versions, 42 Markdown files and two synthetic
profiles. `git diff --check` also passes. The extra Markdown file is this report; no new
runtime test was needed for the documentation qualification.

`npm audit --json` and `npm audit --omit=dev --json` exit 0 with zero reported
vulnerabilities. `npm outdated --json` returns `{}`. These are observations on this date;
no dependency version was updated or automatic audit fix applied.

## Privacy, dependencies and hygiene

All 145 submitted tracked files were scanned. Name/location hits occur only in the
existing Skill validator's forbidden-word list and its negative fixtures. Case-insensitive
`/users/` hits are synthetic Zotero API paths, not workstation paths. Email-like hits use
`example.invalid`; phone-like matches are timestamps, numeric test strings, synthetic
ORCID/IP literals or a deterministic-test integer. Test keys are explicitly synthetic.
No personal manuscript, credential, phone or workstation path was found in tracked
contents or tarballs. Git author metadata contains the existing contributor identity;
it was not copied into examples or artifacts. No replacement author identity was invented.

No tracked tarball, log, node_modules, dist, coverage, temporary directory, private PDF/DOCX,
editor artifact or private key was found. Gitignore covers local profiles, env, temporary
archives/logs, build/test output and key files, while retaining required distributed files.
Largest tracked files are package-lock.json (113,954 bytes), LanguageTool README (26,340),
stdio tests (24,645), document-check tests (23,418), provider tests (23,214) and provider
implementation (22,655). These are expected source/docs/lock files, not personal documents.

Third-party runtime lock entries have 62 MIT, two Apache-2.0 (MCP core/server) and one
BlueOak-1.0.0 (sax) licence; none lacks metadata. Direct runtime dependencies are the MCP
server/zod and Formats' Markdown/GFM/sax/yauzl stack. Third-party code is installed by npm,
not bundled inside these three project tarballs. No obvious restrictive licence conflict
was identified from that inventory; this does not decide the project's licence.

Retain MIT copyright/permission notices, Apache licence/attribution and applicable upstream
NOTICE obligations, and sax's Blue Oak text or licence link when redistributing that code.
The owner must review actual redistribution surfaces, especially any later offline bundle.
See [Apache redistribution conditions](https://www.apache.org/licenses/LICENSE-2.0) and
[Blue Oak notices](https://spdx.org/licenses/BlueOak-1.0.0.html). Metadata inspection is not
a legal compliance certification; no project licence or copied notice was added here.

## Release gates and handoff

Local and remote tag inspection shows v0.3.0, v0.2.0 and v0.1.0, with no v0.4.0.
A read-only public GitHub releases API request returned an empty release list during this
audit. This observes public state, not private drafts or a forensic proof of every prior
action. Current scripts/workflow contain no publish, tag or release automation. All four
private flags remain true; npm publication would require an explicit policy change.

The release procedure orders owner licence choice, clean-main release preparation,
coordinated version/lock/plugin updates, Node 20/22 checks and audits, dry-runs/install
verification, reviewed notes/release PR, green CI and authorization before tag/push/release.
It keeps npm publication separate and excludes root/internal Formats. A release PR needs
a focused release commit before a tag is authorized; no tag should point at the current
unbumped development manifests. The current validator deliberately prevents private=false.

After the owner chooses a licence, and only then: create its exact LICENSE; update the
approved package metadata and README; review third-party notices and selected distribution
surfaces; resolve or explicitly track the development-toolchain issue; prepare the
coordinated proposed 0.4.0 bump, release commit and notes; rerun all checks and a short
audit on that final diff; obtain the required owner review/green CI; then create a tag
only when separately authorized. No part of this sequence was executed by the audit.

Audit changes are documentation only: this report, README, CONTRIBUTING, roadmap and the
original distribution results qualification. No runtime code, dependency, version, private
flag or licence changed. Temporary probes/logs/tarballs stayed outside Git. No push, merge,
tag, npm publish, GitHub Release, marketplace listing or message to another person occurred.
The final response records the audit commit and final working-tree state.
