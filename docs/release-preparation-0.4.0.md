# Version 0.4.0 release preparation — 2026-11-01

Branch: `release/0.4.0-prep`, created from audited `fff8154`. This preparation retains
the unmerged Phase 10 commits; it does not merge or publish them. The owner explicitly
authorized Apache-2.0, real Node 20/22 development support and the 0.4.0 preparation bump.

Readiness: **READY AFTER OWNER ACTION**. The remaining public-release **BLOCKER** is
activation and verification of private security reporting. Final independent review and
owner release approval remain required. Preparation is not permission to tag or publish.

## Licence and dependency review

The repository LICENSE is the exact official Apache License 2.0 text, with no substitution
inside its appendix. SHA-256:
`cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` (11,358 bytes).
Each workspace contains the same LICENSE, and the packaging checks require it. All four
package manifests and the local plugin carry `license: Apache-2.0`. All packages stay private.
README links to the licence. Historical Phase 10 records are marked as historical and
qualified by the subsequent owner decisions; their original observations are preserved.

[Third-party review](third-party-notices.md): 62 MIT, two Apache-2.0 and one BlueOak-1.0.0
third-party runtime lock entries, no missing licence metadata or changed runtime dependency
version. Dependencies are separate npm packages, not bundled code. Their licence files
remain installed; applicable attribution/NOTICE obligations must be retained in any future
bundle. No upstream NOTICE was found in the installed MCP core/server package roots, and
no invented aggregate NOTICE or personal author address was added.

## Test toolchain decision

Previous Vitest: `^5.0.5`, resolved 5.0.5, whose Node engine excludes Node 20.
Final Vitest: `~4.1.12`, resolved 4.1.12 in all three workspaces. The tilde excludes
4.2 and 5, allowing only subsequent 4.1 patches. Registry metadata and the
[tagged upstream manifest](https://raw.githubusercontent.com/vitest-dev/vitest/v4.1.12/packages/vitest/package.json)
confirm Node 20/22 compatibility. This was the latest published 4.1 patch when checked;
no indefinite upstream maintenance promise is inferred.

Before changing versions, all manifests, lock entries and Vitest imports/usages were
inspected. Tests use describe/it/expect, beforeAll/afterAll/afterEach, each/skipIf,
standard asymmetric matchers, vi.fn, vi.spyOn and standard mock methods. There are no
Vitest configuration files, custom runners/reporters, browser features or v5-only imports.
The v5 default clearMocks change does not require an adapter: mocks are created per case
or helper invocation and the Segmenter spy is explicitly restored. No test was rewritten,
disabled or given a longer timeout to make the downgrade pass.

Only development dependency resolution changed. The lock retains Vite 8.3.5, whose floor
is Node 20.19 / 22.12 on the tested lines. README/CONTRIBUTING disclose these development
floors; runtime package engines remain `>=20`. CI now installs with `--engine-strict` on
both Node 20 and 22 to detect another unsupported toolchain dependency.

## Security owner action

The read-only GitHub API check returned `enabled: false` on 2026-11-01. No GitHub settings
were changed. No private email or alternative channel was invented.

Follow the [SECURITY owner checklist](../SECURITY.md#owner-activation-checklist): an owner
or administrator must enable Private Vulnerability Reporting in repository settings,
verify the reporter-facing private form without submitting a fake report, confirm the API
returns `enabled: true`, and update SECURITY with the verification date. Public release
must wait for that evidence. Triage responsibility and maintenance/backport expectations
remain **SHOULD FIX** owner policy work; no response-time commitment is fabricated.

## Version synchronization

The [release contract](releasing.md) places the coordinated bump in release preparation.
Its selective no-tag npm command was used, followed by the plugin update and lock review.

| Surface | Prepared version | Licence | Private |
| --- | --- | --- | --- |
| Root | 0.4.0 | Apache-2.0 | true |
| LanguageTool MCP / serverInfo | 0.4.0 | Apache-2.0 | true |
| Research Integrations MCP / serverInfo | 0.4.0 | Apache-2.0 | true |
| Claude plugin | 0.4.0 | Apache-2.0 | n/a |
| Internal Document Formats | 0.1.0 | Apache-2.0 | true |

Both servers read their package manifests for serverInfo; no runtime source change was
needed. Formats, profile/discipline schemas and modelVersion keep their independent versions.
CHANGELOG is still Unreleased, draft notes are still unpublished and v0.3.0 remains the
latest tag. Prepared manifest values are not a published release.

## Final verification

Two separate clean directories copied only tracked/candidate release files, without Git
metadata, node_modules, dist, env or ignored local profiles. Each installed its own tree;
source/build artifacts from the original checkout were not used. npm registry/cache access
was permitted, while real provider traffic and credentials were not required.

| Runtime | npm | npm ci --engine-strict | npm run check |
| --- | --- | --- | --- |
| Node 20.20.2 | 10.8.2 | Exit 0, no EBADENGINE | Exit 0 |
| Node 22.16.0 | 11.11.0 | Exit 0, no EBADENGINE | Exit 0 |

Each installed 154 packages. Ordinary workspace checks had also passed on both runtimes
before the version bump. No timing failure or test retry was needed in these runs.

| Validation category | Result on each runtime |
| --- | --- |
| Skills | 14 validator tests; four Skills valid |
| Research Profiles | 27 validator tests; distributed/local-example rules pass |
| Discipline Profiles | 11 validator tests; five profiles valid |
| Distribution | Six validator tests; versions/private flags/SPDX and exact licence copies, 44 Markdown files, two synthetic profiles valid |
| Validation total | **58 passed**; one licence-policy regression added to the historical 57 |
| Formats | 61 application tests passed |
| LanguageTool | 247 application tests passed; nine real-server tests skipped |
| Integrations | 147 application tests passed; three live-provider tests skipped |
| Application total | **455 passed, 12 skipped**; 26 test files passed, two skipped |
| Typecheck/build | All three workspaces passed |
| Example and all pack checks | Passed, including installed library imports and MCP startup |

Live flags were not enabled. The skipped cases are the expected opt-in suites, not executed
live coverage. Real Java/LanguageTool, Vale and providers were not rerun. The core example
requires none of them and leaves its synthetic replacement unapplied.

### Archives and independent installation

Dry-run manifests and actual archives were inspected. Node 20/22 manifests match by path,
size and mode; npm archive shasums also match in this run. Each archive includes a LICENSE
byte-identical to the official root file and Apache-2.0 package metadata.

| Archive | Files | Compressed bytes | Unpacked bytes | npm SHA-1 |
| --- | ---: | ---: | ---: | --- |
| gasycoder-languagetool-mcp-0.4.0.tgz | 18 | 29,976 | 97,931 | c33272a7951e6b23b3d801dd6c43b38fecf7070d |
| gasycoder-document-formats-0.1.0.tgz | 12 | 17,812 | 64,767 | 811b399d3b29c087d021cf06a7c69f85b791fd1b |
| gasycoder-research-integrations-mcp-0.4.0.tgz | 23 | 35,263 | 148,362 | 5160b70e96d3ee17d7ac253c344bb0fb62385ef6 |

The inventories are the historical 17/11/22 files plus one LICENSE in each archive. No
source/test fixture, env, credential, nested archive, log, map or private document was included.
Actual archives were installed together into a third fresh temporary project, without dev
dependencies, source/workspace symlinks or fallback to checkout node_modules. The installed
synthetic example succeeds. Reinstalling that project with Node 20 `npm ci --engine-strict`
also succeeds (68 runtime packages), and its example remains unapplied.

The repository pack checks separately install LanguageTool and Formats/Integrations under
both runtimes. Installed LanguageTool passes synthetic text and 77,000-unit document checks.
Additional raw JSON-RPC probes against both linked executables verify initialize, tool
listing, version **0.4.0**, protocol-only stdout, diagnostic stderr and clean exit 0 after
stdin closes. LanguageTool exposes four tools; Integrations seven read-only tools. Absent
LanguageTool returns unavailable; no consent, missing Vale and unconfigured private Zotero
produce their local structured statuses. Invalid timeout configuration exits 1 without
stdout or echoing the synthetic private value. No live provider is needed at startup.

### Plugin, scanners and audits

Claude Code 2.1.314 `claude plugin validate .` exits 0. The missing-licence directory problem
is gone. Remaining warnings are missing author attribution, root CLAUDE not plugin context
and missing listing icon; marketplace advice does not imply a published marketplace.
No authenticated model invocation is claimed. Manifest is still Skills-only, without
hooks or automatically launched MCPs.

Deliberate temporary mutations are rejected for broken relative links/anchors, absent
plugin manifest, stale plugin/runtime versions and an unsupported broken component path.
The added licence regression rejects missing/conflicting SPDX metadata. LICENSE bytes,
package-lock versions and all private flags were also checked independently.

Privacy/secret/artifact scans cover all 152 candidate tracked files and archive contents.
No real manuscript, personal path/contact, credential, private key, tracked archive/log or
build output was found. Name-filter negative fixtures and Zotero `/users/` API paths explain
the location/name matches; email-like values use example.invalid. Phone-like matches are
synthetic numeric strings, timestamps, IP/ORCID literals or deterministic test data. Existing
Git author identity is metadata, not copied into distributed examples. Largest candidate
file is package-lock.json (129,824 bytes), followed by source/docs/tests.

`npm audit` and `npm audit --omit=dev` both exit 0 with zero reported vulnerabilities.
`git diff --check` passes. No automatic audit fix or runtime dependency upgrade was used.
README licence links, SPDX/copies, CHANGELOG Unreleased state and draft notes are consistent.
These observations apply to the checked dependency graph and are not a future security
or compatibility guarantee.

## Scope and remaining gates

No academic behavior, parser, provider, Skill, profile or schema implementation changed.
Live provider/real Java/Vale tests remain opt-in. Linux is the tested OS; no authenticated
Claude model session or marketplace installation is certified.

After final independent audit, the owner must complete security activation/verification,
maintenance/distribution decisions and review/integration into clean main. Tagging, pushing,
npm publication and GitHub Release each remain separately authorized later actions.
None is performed by this preparation. Root/internal Formats must not be published.

The final handoff records exact commits, changed files and clean Git status. Raw logs,
source snapshots, package archives and probes remain outside Git.

## Files and local commits

Created: four LICENSE copies and two documentation files. Modified: 27 existing files.
Inventory relative to audited `fff8154` (A = added, M = modified):

```text
M	.claude-plugin/plugin.json
M	.github/workflows/ci.yml
M	CHANGELOG.md
M	CLAUDE.md
M	CONTRIBUTING.md
A	LICENSE
M	README.md
M	SECURITY.md
M	docs/client-setup.md
M	docs/distribution-audit.md
M	docs/distribution-results.md
M	docs/distribution.md
M	docs/release-notes-0.4.0-draft.md
A	docs/release-preparation-0.4.0.md
M	docs/releasing.md
M	docs/research-integrations.md
M	docs/roadmap.md
A	docs/third-party-notices.md
M	package-lock.json
M	package.json
A	packages/document-formats/LICENSE
M	packages/document-formats/package.json
A	packages/languagetool-mcp/LICENSE
M	packages/languagetool-mcp/README.md
M	packages/languagetool-mcp/package.json
M	packages/languagetool-mcp/scripts/check-package.ts
A	packages/research-integrations-mcp/LICENSE
M	packages/research-integrations-mcp/README.md
M	packages/research-integrations-mcp/package.json
M	scripts/check-distribution.mjs
M	scripts/distribution-validation.mjs
M	scripts/distribution-validation.test.mjs
M	scripts/validate-distribution.mjs
```

Atomic commits before the final version/preparation record:
`c5efea4` (Apache-2.0), `8f1e2ad` (Node 20 test toolchain), `3400d22` (security guidance).
The final local commit contains the coordinated 0.4.0 version/lock/plugin updates,
current release documentation and this verification record. Its hash is in the final
handoff; it creates no tag. No push, merge, npm publish or GitHub Release occurred.
