# Phase 10 preparation results — 2026-11-01

Historical Phase 10 record, preserved as observed before owner release decisions.
The owner subsequently selected Apache-2.0; see the current [release procedure](releasing.md)
and [third-party licence review](third-party-notices.md). Historical findings below are not
a statement that the licence decision is still open. Vitest 5 was subsequently replaced
with bounded Vitest 4.1.12; strict installs and full checks now pass under Node 20 and 22.

Technical scope: release preparation only, on `feat/distribution` above `af860f0`.
No new academic Skill/provider/parser/format was added. No push, merge, tag, publication,
GitHub Release or marketplace listing is performed. Licence remains explicitly undecided
by the owner's instruction; no LICENSE or SPDX licence field has been added.

## Readiness and owner gates

Overall readiness: **READY AFTER OWNER ACTION**, with technical checks passed as recorded
below and the subsequent [final audit](distribution-audit.md) recorded separately.
That audit found a Node 20 development-toolchain **SHOULD FIX**, described below.
An open licence decision is a **BLOCKER** for open-source release, even
when technical checks pass. Owner must select the licence, approve version/distribution
surfaces and complete the [release procedure](releasing.md). A private security reporting
channel/maintenance policy SHOULD be settled; Code of Conduct/listing icon and broader OS
validation are OPTIONAL improvements. No readiness score is assigned.

## Deliverables

The [package inventory](distribution.md) lists names, private flags, versions, entry points,
exports, file contracts, engines and dependencies. Root is orchestration only. MCP packages
are prospective public surfaces, still private. Document Formats remains internal 0.1.0.
Root, both MCP serverInfo versions and local plugin share 0.3.0; **0.4.0** is recommended as
the next pre-1.0 minor and is not applied/tagged. New model/metadata APIs remain pre-1.0.

README now offers a no-provider first result and links to setup, context, format and
integration contracts. Four existing Skills use their default plugin discovery paths.
The full clone retains linked references/docs/profiles/schemas. Plugin has no auto-start
MCP/hooks; clients register tools separately. `.claude-plugin` formerly contained only
`.gitkeep`; a minimal manifest replaces it. No marketplace procedure is invented.

Central environment documentation distinguishes secret keys/contact from endpoints/timeouts
and local paths. Privacy documentation covers AI-host data policy, local/remote LanguageTool,
explicit metadata consent, read-only Zotero, local Vale and parser/mapping/resource limits.
No universal security, Word round-trip or claim-support guarantee is made. CONTRIBUTING,
SECURITY, CHANGELOG and draft release notes establish factual processes without private
emails or an assumed enabled GitHub reporting feature. Code of Conduct remains a future
owner/community choice. Roadmap separates completed phases, Phase 10 gates and backlog.

## Validation record

Baseline `npm run check`, `npm audit` and `npm audit --omit=dev` passed before changes.
The new validator tests synchronized versions/private flags, Skills-only plugin shape,
local Markdown links/anchors outside fenced examples, and two synthetic profile examples.
It is a local scanner, not a complete Markdown renderer or Internet crawler.

Existing LanguageTool packaging checks run unchanged. Added private tarball checks inspect
Formats/Integrations inventories and size bounds, install outside the checkout without dev
dependencies/workspace links, resolve installed imports locally, verify mapping/unapplied
proposals, no-consent/provider absence behavior, linked bin/serverInfo and seven-tool discovery.
No manuscripts/credentials/live providers/system Vale/Java are needed. npm installation
can access the registry/cache. Temporary installations are removed in finally blocks.

Claude Code 2.1.314 `plugin validate .` accepted the local manifest with warnings. It notes
missing author info and unloaded root CLAUDE context; directory checks flag missing licence
and listing icon. These warnings do not mean marketplace acceptance. Authenticated model
invocation/discovery behavior in an interactive session was not tested. The official manifest,
default skill layout and local-load command were checked against current primary docs linked
from [client setup](client-setup.md).

## Final handoff coverage

The following maps the requested 46 handoff points to the concrete result.

| Point | Result |
| --- | --- |
| 1. Architecture | Existing layers preserved; only distribution tooling/resources added |
| 2. Package inventory | Root orchestrator; two private MCPs 0.3.0; internal Formats 0.1.0, detailed in distribution.md |
| 3. Surfaces | Full clone/local Skills plugin and built MCP/library entry points; no published packages |
| 4. Version model | Root → both MCP manifests/serverInfo + plugin; internal library/schema exceptions explicit |
| 5. Current version | Runtime/plugin 0.3.0; tags v0.3.0, v0.2.0, v0.1.0 inspected |
| 6. Recommended release | 0.4.0 pre-1.0 minor; no bump performed |
| 7. Licence | Absent; owner explicitly chose to leave the decision open; no grant/field invented |
| 8. Blockers | Licence is the release blocker; approval/version/publication gates remain explicit |
| 9. README | Reworked concise capability/install/limitations/navigation entry point |
| 10. Quick start | npm ci → build → local synthetic document example; no optional service required |
| 11. LanguageTool | Separate download/JVM, tested 6.9-SNAPSHOT and Java 17+, loopback setup, health/language tools |
| 12. Claude setup | Local --plugin-dir with separately registered stdio MCPs; no marketplace |
| 13. Skills | Four validated default skills/ directories with references/links retained in full clone |
| 14. Research Profile | Existing schema/Skill docs plus validated minimal/complete synthetic examples |
| 15. Discipline Profiles | Existing five optional explicit-selection profiles; guidance never scientific evidence |
| 16. Formats | Existing read-only contract linked; internal library import/mapping tested from installed tarball |
| 17. Integrations | Existing consent/provenance/config limits linked; installed library and seven-tool bin checked |
| 18. Env | Central table covers all runtime settings and live-test controls, defaults and sensitivity |
| 19. Privacy | Explicit local/provider/AI-host data boundaries; no implied offline model |
| 20. Security | Tested protections and trust limitations documented without universal guarantee |
| 21. CONTRIBUTING | Setup, branch/atomic commits, tests, resource changes, security and no private data |
| 22. SECURITY | Factual unverified private-channel status, no invented email/SLA/backport commitment |
| 23. Changelog | Unreleased capabilities since historical 0.3.0; no fabricated per-commit release history |
| 24. Release notes | Unpublished proposed 0.4.0 draft with capabilities/limitations |
| 25. Checklist | Owner-only licence/version/CI/install/notes/audit/tag/publication order; none executed |
| 26. CI | Read-only Ubuntu Node 20/22 matrix extended with distribution validator/example/install checks; fake services only |
| 27. Tarballs | LT 17 files, Formats 11, Integrations 22; explicit allowlists, no test/fixture/env/maps/private material |
| 28. Clean installs | Independent tarball projects without workspace links or dev tools; separate source snapshot npm ci/check |
| 29. MCP startup | LT linked executable/shebang, 4 tools and synthetic checks; Integrations linked bin, 7 tools and consent refusal |
| 30. Plugin | Official CLI validation passed with disclosed warnings; no model/marketplace session certification |
| 31. Links | 41 Markdown files checked locally, including anchors/references; scanner has fenced-example/full-renderer limits |
| 32. Examples | Two schema-valid YAML examples and local executable mapping/proposal example |
| 33. Hygiene | No tracked/candidate tarballs, logs, coverage, node_modules, dist or personal PDFs/DOCX |
| 34. Privacy scan | Repository scan found only existing name-filter fixtures in validator/test; no personal path/email/phone/token/private key |
| 35. Dependencies/notices | No dependency version upgrades; existing MCP client declared directly for root harness. Lock runtime licences: 62 MIT, 2 Apache-2.0, 1 BlueOak-1.0.0; no missing third-party runtime licence metadata |
| 36. Node 20 | Official temporary Node 20.20.2/npm 10.8.2, normal check in independent source snapshot |
| 37. Node 22 | Node 22.16.0/npm 11.11.0, workspace and independent-source checks |
| 38. Tests | Detailed counts below; no live services required |
| 39. npm audits | Full/dev-omitted both zero vulnerabilities, no automatic fixes |
| 40. Files | Build/CI/plugin + synthetic examples, docs/process files; inventory below |
| 41. Commits | 2429a5c for build/test, 786e75f for docs; validation-handoff commit recorded in final response |
| 42. Git status | Clean feat/distribution after commits; no unrelated work overwritten |
| 43. Priorities | BLOCKER licence; SHOULD FIX reporting/maintenance/attribution; OPTIONAL conduct/icon/host matrix/marketplace |
| 44. Owner actions | Choose licence, approve version/surfaces, review independent audit and release PR; no repeated licence question |
| 45. Exact procedure | docs/releasing.md, including selective no-tag MCP/root bump and separate plugin update; distribution approval remains separate |
| 46. Readiness | READY AFTER OWNER ACTION; technically ready for independent audit, not permission to release |

Dependency licence inventory is factual package metadata, not a legal compliance certification.
Dependencies are not bundled in our tarballs; npm installs their own packages/notices. Owner
must review attribution/notice obligations before any redistribution, especially an offline
bundle. No third-party licence text or Code of Conduct was copied arbitrarily.

## Exact validation results

| Command/check | Result |
| --- | --- |
| validate:skills | 14 tests passed; 4 Skills valid |
| validate:profiles | 27 passed; defaults/local example rules pass |
| validate:disciplines | 11 passed; 5 profiles valid |
| validate:distribution | 5 passed; 41 Markdown files, plugin/versions and 2 YAML examples valid |
| typecheck | All 3 workspaces passed |
| repository tests | Formats 61 + LanguageTool 247 + Integrations 147 = 455 passed, 12 opt-in live tests skipped |
| Runtime test files | 26 passed, 2 skipped (28 total) |
| build and example:check | All 3 builds and synthetic source-preserving mapping example passed |
| pack:check | Existing LT install plus new Formats/Integrations independent install/import/bin checks passed |
| Clean source npm ci | New directory without gitignored/node_modules/source artifacts; 129 installed packages, zero audit findings |
| npm run check | Node 22 workspace and independent snapshot; Node 20 independent snapshot |
| git diff --check | Passed |
| npm audit / npm audit --omit=dev | Exit 0, zero vulnerabilities |
| Claude plugin validate | CLI 2.1.314, local validation passed with documented warnings/directory licence blocker |

All test assertions together include 57 validator tests plus 455 workspace tests. Live
LanguageTool/provider tests were not run; neither Java nor real Vale nor credentials were
required. The integration fake servers cover provider behavior; distribution smoke tests
check installed boundaries rather than duplicating those suites. Linux is the tested OS,
not a certification for Windows/macOS or every Claude host.

## Changed files and remaining work

Created: plugin.json; four scripts for distribution validation/pack checks; examples README,
two profiles, manuscript and mapping script; CHANGELOG, CONTRIBUTING, SECURITY; client setup,
configuration, distribution inventory/results, privacy/security and draft release docs.
Modified: root package/lock, CI, README, CLAUDE, roadmap/releasing and the two MCP READMEs.
Removed: empty plugin .gitkeep. No runtime implementation or existing Skill/profile/schema
was changed. MCP README links now resolve to repository docs after tarball installation,
instead of escaping the installed package through broken relative paths.

The clean source snapshot contains only versioned/candidate files, with no local profiles,
env, builds or node_modules. Its install/check and nested tarball projects demonstrate no
essential dependency on ignored host state. Local raw logs/snapshots stay outside Git.
No test result overrides the owner's explicit licence deferral or publication gates.

The final audit reproduced both clean-source checks, but also observed `EBADENGINE` from
Vitest 5.0.5 under Node 20.20.2. Vitest declares Node `^22.12.0 || ^24.0.0 || >=26.0.0`;
strict-engine source installation fails, whereas strict-engine installation of the three
runtime tarballs succeeds under Node 20. Use the tested Node 22 line for development until
the toolchain policy is resolved. Passing Node 20 tests does not establish upstream Vitest
support. No dependency upgrade/downgrade or runtime support change was made by the audit.

The [release checklist](releasing.md) is preparation for owner use, not an action performed
by this phase. Final commit hashes and observed Git state are supplied in the handoff.
