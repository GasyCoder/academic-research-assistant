# Final release preparation audit — 2026-11-01

**Verdict: PASS WITH FIXES. Readiness: READY AFTER OWNER ACTION.**

The four submitted commits pass fresh technical reproduction. One **LOW** documentation
defect in the release ordering was demonstrated and corrected. No HIGH or MEDIUM defect
was found. The sole remaining release/merge **BLOCKER** is the owner's activation and
verification of GitHub Private Vulnerability Reporting, currently `enabled: false`.

This is a new technical countercheck with the preparation history visible in the same
conversation, not a blind review by a different auditor. Results below come from new
committed-source installations, protocol probes and mutations, rather than copying the
preparation report's assertions.

## Baseline and scope

Initial branch `release/0.4.0-prep`, clean HEAD `c3e52d6`. Submitted commits:
`c5efea4` (Apache-2.0), `8f1e2ad` (Vitest/Node 20), `3400d22` (security), `c3e52d6`
(version preparation). Compared with `feat/distribution` at `fff8154`: 33 changed files.
Compared with main `af860f0`: eight commits, 41 changed files, 3,117 insertions and 527
deletions before this audit. Earlier distribution commits remain unmerged; no integration
or publication is inferred from this branch name.

README, LICENSE, CONTRIBUTING, SECURITY, CHANGELOG, CLAUDE, AGENTS, architecture, roadmap,
release procedure, both Phase 10 records, preparation report, third-party review, package
manifests/lock, plugin, CI, distribution scripts and changed files were reviewed.
Two independent directories were extracted from `git archive c3e52d6`: no ignored state,
local profile, env, node_modules or dist was copied. Each installed and built independently.
Separate standalone consumers were then created for each of the three actual tarballs.

## Demonstrated finding and correction

**LOW L1 — release procedure omitted final main checks and artifact ordering.** Submitted
`docs/releasing.md` step 5 required PR CI and security activation before public release;
step 6 permitted tagging a clean reviewed main commit without explicitly requiring green
main CI for that exact commit or a new version check. It did not name the tag annotation
policy, and its later npm policy/metadata changes could leave publication contents different
from the already selected tag. The owner's requested sequence also requires security
verification before merge, not merely before public release.

Evidence: those submitted steps can be read directly with
`git show c3e52d6:docs/releasing.md`. The historical v0.3.0 procedure used annotated tags;
the current local/remote historical tags are annotated. No unsafe operation was executed
to demonstrate a documentation omission.

Minimal correction: explicitly require enabled=true and a reporter-accessible private
form before merge; PR review/CI, then green Node 20/22 main CI for the exact commit;
recheck versions/lock/licences/private policy; repeat checks for any additional release
commit; use an annotated tag and separately authorized push. Publication-policy changes
must be reviewed/committed before choosing the tag commit. npm remains optional and is
skipped for this all-private preparation. A GitHub Release follows the pushed tag and any
selected npm publication. Signing remains a maintainer configuration/approval decision.

Only the release document and this audit record change. No executable test was added for
prose ordering. The local link/version/licence validator and diff check are the relevant
post-correction checks; no runtime, dependency, licence or version changed during audit.

## Fresh evidence

| Runtime | npm | npm ci --engine-strict | npm run check |
| --- | --- | --- | --- |
| Node 20.20.2 | 10.8.2 | Exit 0, no engine warning | Exit 0 |
| Node 22.16.0 | 11.11.0 | Exit 0, no engine warning | Exit 0 |

Each clean source installation added 154 packages. Both checks produced:
14 Skill + 27 Research Profile + 11 Discipline Profile + six distribution validator tests
= **58 passed**. Application tests: Formats 61, LanguageTool 247, Integrations 147
= **455 passed**, with **12 live tests skipped** (nine LanguageTool, three providers).
Application files: 26 passed, two skipped. All three typechecks/builds, example and package
checks passed. No retry, timeout increase, test rewrite or disabled regression was needed.
The toolchain commit has no application test diff; only the separate licence-policy
validator addition accounts for the change from the historical 57 to 58 validations.

The fresh full checks validate 44 submitted Markdown files. After this documentation fix
and report, local validation covers 45 Markdown files; the six validator tests still pass.
`git diff --check` passes. npm registry/cache, official documentation and read-only GitHub
metadata were accessed; no live provider, real manuscript or private credential was used.

### Licences, engine and version integrity

All four LICENSE files match the official
[Apache text](https://www.apache.org/licenses/LICENSE-2.0.txt) byte-for-byte: 11,358 bytes,
SHA-256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.
The official appendix placeholders were not replaced by personal identity. All four project
manifests and the plugin use Apache-2.0; conflicting MIT in a negative validator fixture is
test data, not a licence grant. Third-party MIT licences correctly remain third-party MIT.

The runtime lock inventory and the union of named packages actually installed in the three
standalone consumers both yield **62 MIT, two Apache-2.0, one BlueOak-1.0.0**. A naive scan
of every nested package.json also finds nine Zod subpath manifests without a licence/name;
they are module metadata inside the MIT-licensed Zod package, not nine independent
unlicensed dependencies. No runtime dependency version changed during preparation.

No NOTICE file occurs in these standalone installed dependency trees, no dependency code
is bundled in our tarballs, and no copied third-party content imposing an extra NOTICE
was identified. No empty NOTICE is needed for the inspected arrangement. Preserve licence,
copyright/attribution and applicable future NOTICE requirements when redistributing actual
third-party code, especially a future offline bundle. This is a distribution inventory,
not legal advice or a general compliance certification.

All three workspace Vitest ranges are `~4.1.12`, resolved 4.1.12; no resolved Vitest 5
remains. All used imports/mocks/matchers/hooks exist in v4. The
[tagged Vitest manifest](https://raw.githubusercontent.com/vitest-dev/vitest/v4.1.12/packages/vitest/package.json)
declares Node 20/22 compatibility. Locked Vite requires development Node 20.19 / 22.12,
accurately disclosed. Runtime project/MCP dependency engines are >=20; Node 18 is not
advertised. Root, two MCP manifests/serverInfo, plugin and lock agree on **0.4.0**.
Formats' private internal **0.1.0** exception predates this preparation and is documented
in the version contract; it is not a drift requiring a bump.

### Archives, standalone consumers and protocol

Every file is checked against the intended inventory; all archives include the exact
LICENSE and Apache-2.0 metadata. File manifests and npm shasums match across the two
runtime builds and match the submitted preparation record.

| Archive | Files | Compressed / unpacked bytes | npm SHA-1 |
| --- | ---: | --- | --- |
| LanguageTool 0.4.0 | 18 | 29,976 / 97,931 | c33272a7951e6b23b3d801dd6c43b38fecf7070d |
| Formats 0.1.0 | 12 | 17,812 / 64,767 | 811b399d3b29c087d021cf06a7c69f85b791fd1b |
| Integrations 0.4.0 | 23 | 35,263 / 148,362 | 5160b70e96d3ee17d7ac253c344bb0fb62385ef6 |

LanguageTool has README/package/LICENSE and 15 runtime JS files; Formats has package/LICENSE
and five JS/declaration pairs; Integrations has README/package/LICENSE and ten JS/declaration
pairs. No unwanted tests, fixtures, source/maps, env, logs, internal audit docs, private data
or nested archive is present.

Each tarball was installed **alone**, under a separate temporary project with minimal env
and empty npm userconfig. None resolved to a checkout symlink, another project package or
development tools. LT's supported package.json export and executable were tested; it has
no library root export. Formats alone reads synthetic Markdown and maps bold prose to an
unapplied replacement. Integrations alone imports createIntegrations, returns a no-consent
status without I/O and reports optional Vale absence; its executable starts without providers.

Raw JSON-RPC from the standalone MCP bins confirms 0.4.0, exact four/seven tool names,
protocol-only stdout, diagnostics on stderr and exit 0 on stdin close. Integrations tools
retain read-only annotations. LT absence and no-consent failure remain local. Existing
pack checks additionally exercise installed LT text and long-document operations against
a synthetic server under both runtimes. No authenticated Claude model session, real Java,
system Vale, provider coverage or non-Linux OS is certified.

Ten reversible mutations in disposable copies fail as intended: missing root LICENSE,
missing/altered package LICENSE, package MIT, plugin MIT, stale MCP/plugin manifest,
broken relative link, stale Integrations serverInfo and stale LT serverInfo. The latter
two run the real packaging guards and fail with actual 0.3.0 versus expected 0.4.0.
All mutations are restored; repository source was never mutated for these probes.

### Plugin, privacy and external state

Claude Code 2.1.314 `plugin validate .` exits 0; licence syntax is accepted. Warnings are:
author attribution OPTIONAL (not required, no private identity supplied); icon OPTIONAL for
a future listing; root CLAUDE context is documented host behavior, not a broken file link.
The manifest does not reference CLAUDE as plugin context; four standalone Skills provide
the shipped instructions. The [official manifest reference](https://code.claude.com/docs/en/plugins-reference)
confirms the metadata/layout contract. No asset or invented marketplace was added.

All 152 submitted tracked files and every archive entry were scanned. No real personal
contact/path, manuscript, credential, private key, PAT or packaging-injected secret was
found. Name hits are forbidden-word/negative fixtures; case-insensitive users-path hits
are Zotero API paths or explanations of those false positives. Email-like matches use
example.invalid. Phone-like matches are synthetic strings, timestamps, test constants,
IP or ORCID literals. Bearer/API-key mentions are implementation/documentation or explicit
synthetic fixtures, not live values. Existing Git author identity remains Git metadata;
no personal address was added to SECURITY or distributed examples. No tracked tarball,
log, build output or other temporary artifact is present.

Both npm audits exit 0 with zero vulnerabilities. `npm outdated` exits 1 informationally
because current/wanted Vitest 4.1.12 differs from latest 5.0.5; the bounded line is intentional
for Node 20. No automatic upgrade/fix was made.

Local/remote tags remain v0.3.0, v0.2.0, v0.1.0; no v0.4.0 exists. A fresh read-only public
GitHub API query returns no releases and **private reporting enabled=false**. Public state
does not prove absence of inaccessible private drafts or every historical action. Scripts,+lifecycle hooks and CI perform no automatic publication/tagging/release. All private flags
remain true. Remote GitHub security settings were not changed.

## Requested final assessment

| Item | Assessment |
| --- | --- |
| 1. Verdict | PASS WITH FIXES: LOW L1 documentation correction |
| 2–4. Apache / LICENSE / metadata | Official bytes intact; all project/plugin SPDX values Apache-2.0 |
| 5–6. Dependencies / NOTICE | 62 MIT + two Apache + one BlueOak; no additional NOTICE demonstrated |
| 7. Vitest | 5.0.5 → bounded 4.1.12; APIs reviewed; no test rewrites/skips |
| 8–11. Strict installs and checks | Node 20.20.2/npm 10.8.2 and Node 22.16.0/npm 11.11.0 all exit 0 |
| 12–18. Versions / lock | Coordinated root/LT/Integrations/plugin/serverInfo 0.4.0; intentional internal Formats 0.1.0 |
| 19–21. Tarballs | 18 / 12 / 23 allowed files with exact licence text |
| 22–24. Standalone installs | Each package alone passes supported import/bin smoke checks |
| 25–26. MCP | Exact four/seven tools, 0.4.0, clean protocol/stderr separation and shutdown |
| 27–28. Plugin | Validation passes; author/icon optional; CLAUDE warning is documented host behavior |
| 29–31. User/contributor/security docs | Accurate licence/toolchain commands; no false active private channel |
| 32. Private reporting | enabled=false, freshly observed; owner activation required |
| 33–34. Changelog / notes | Unreleased / draft, no invented publication date |
| 35. Release procedure | LOW L1 fixed: security → reviewed PR/CI → merge → exact-main CI/version checks → annotated tag/push → optional approved npm → GitHub Release |
| 36. CI | Read-only Node 20/22, strict install, all validations/build/tests/pack checks; no live secrets or providers |
| 37–39. Licence/version/links | Positive checks and independent negative mutations pass; 45 Markdown files after audit docs |
| 40–41. Privacy / archives | No real credential/private material; synthetic and metadata hits classified above |
| 42–43. npm audits | Full and dev-omitted both zero vulnerabilities |
| 44–46. Counts / skips | 58 validator + 455 application passed; exactly 12 opt-in live skipped |
| 47. Build/typecheck/diff | All passed |
| 48. Findings | HIGH none; MEDIUM none; LOW L1 corrected |
| 49. BLOCKER | Activate and verify GitHub Private Vulnerability Reporting |
| 50. SHOULD FIX | Owner report-triage responsibility and maintenance/backport policy |
| 51. OPTIONAL | Plugin attribution/icon, broader OS/host matrix, Code of Conduct, future marketplace |
| 52. Audit files | Modified docs/releasing.md; created this audit report |
| 53–54. Commit / final Git state | One documented documentation-fix commit; hash and clean branch state in final response |
| 55. Readiness | READY AFTER OWNER ACTION |
| 56. Owner action | Enable private reporting → confirm enabled=true → test private form access → only then merge/release |
| 57. Merge readiness now | NO: owner security gate is still pending; technical review is acceptable after L1 correction |
| 58. Release after activation | YES, subject to reviewed merge, green exact-main CI/version checks and explicit tag/release authorization |

The report does not authorize any remote mutation. No push, merge, tag, npm publish, GitHub
Release, security activation or message to another person was performed by this audit.
