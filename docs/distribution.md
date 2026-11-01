# Distribution status and package inventory

The current supported installation is a **full clone/local build**. Nothing is published
to npm or a marketplace by Phase 10. The root remains a private development orchestrator.
Keep documentation, schemas and profiles with the Skills/plugin; these resources are not
embedded in the runtime npm tarballs.

## Package inventory

All manifests declare `engines.node: >=20`; CI tests official full-ICU Node 20 and 22.

| Surface | Version/private | Entry/export and files | Purpose/disposition |
| --- | --- | --- | --- |
| academic-research-assistant (root) | 0.3.0 / true | No bin/exports; workspace scripts | Development only; never publish root |
| @gasycoder/languagetool-mcp | 0.3.0 / true | bin languagetool-mcp → dist/index.js; only package.json exported; files dist/**/*.js | Potential future public CLI, after explicit publication decision; no library import/types API |
| @gasycoder/research-integrations-mcp | 0.3.0 / true | bin research-integrations-mcp → dist/index.js; ESM service.js + declarations, package.json export; files dist | Potential future public CLI/library after explicit owner decision |
| @gasycoder/document-formats | 0.1.0 / true | No bin; ESM index.js + declarations; files dist | Internal library for this release, separately versioned; no public publication decision |
| Claude local plugin | 0.3.0 | .claude-plugin/plugin.json; default skills/ | Full clone, Skills-only; no automatic MCP/hook or marketplace |
| Skills/profiles/schemas/docs/examples | Repository resources | Relative files, validated links/frontmatter/schemas | Distributed with clone; not independent npm packages |

The two MCPs depend on `@modelcontextprotocol/server` and `zod`. Document Formats depends
on `mdast-util-from-markdown`, `mdast-util-gfm`, `micromark-extension-gfm`, `yauzl`, `sax`.
These are resolved as npm dependencies, not vendored/bundled. Root uses `ajv`, `yaml` and the
official MCP client as development tools. Manifests/lockfile remain the exact dependency
inventory; no bulk upgrade is part of this phase.

The root version is the source of truth for both MCP packages/serverInfo and the plugin.
`validate:distribution` catches drift and accidental removal of private protection. Formats
0.1.0 is an explicit internal-library exception, not the next release number. Proposed next
runtime/plugin version is **0.4.0**, a pre-1.0 minor for capabilities added since v0.3.0.
No bump occurs here. Stable public API/OS/host commitments and actual publication policy are
not settled enough to recommend 1.0.0.

## Installation and packaging checks

`npm run check` validates Skills/profiles/discipline resources, local doc links and versions,
typechecks, tests all workspaces, builds, executes the synthetic example and pack-checks.

The existing LanguageTool pack check builds/packs, allows only README/package/runtime JS
(and any future licence), installs independently, runs the linked bin/shebang and discovers
four tools with synthetic linguistic text/document checks. Source maps/declarations/tests
are deliberately excluded; it is a CLI, not an importable library. Java/LanguageTool is
external, so the smoke test uses a local fake HTTP server.

The added resources check packs Document Formats and Research Integrations, verifies an
explicit file inventory and sizes, installs tarballs under a fresh OS temp directory with
no source/workspace links, omits development dependencies and runs imports **inside that
installation**. It checks mapping, unapplied proposals, no-consent behavior, optional Vale
absence, linked executable startup, matching server version and seven-tool discovery. No
real provider or system Vale is needed. Temp directories are cleaned in finally blocks.
Dependency installation may use npm registry/cache; this is not an offline install claim.

Pack dry-run/install checks are preparation, not authorization to publish. The local plugin
is checked structurally by the distribution validator and separately with the official
Claude CLI; no fake marketplace or authenticated model session is claimed.

## Release gates

- **Licence resolved:** the owner explicitly selected [Apache-2.0](../LICENSE). Root, all
  workspaces and plugin carry that SPDX identifier; each runtime tarball includes the exact
  licence text. [Third-party notices](third-party-notices.md) are reviewed separately.
  Licence adoption does not authorize changing private flags or publishing.
- **Owner action:** review final release preparation and select actual distribution surfaces.
  The owner authorized 0.4.0 preparation; its coordinated bump belongs in the release PR.
  These intentional gates do not prevent local testing of private tarballs.
- **BLOCKER before public release:** activate and verify private security reporting.
  The GitHub read-only status check returned `enabled: false` on 2026-11-01; follow the
  [owner checklist](../SECURITY.md#owner-activation-checklist). No alternative private
  address is invented. This does not prevent local release preparation or final audit.
- **SHOULD FIX:** clarify maintenance/backport and private report triage responsibilities.
- **OPTIONAL:** Code of Conduct plus moderation process, a listing icon, broader OS/Claude
  host matrix, a future marketplace, owner-authorized publication automation and manual
  live-service CI. No token, publisher workflow or release action is configured now.

For the concrete preparation/results see [Phase 10 report](distribution-results.md),
[release checklist](releasing.md) and [draft notes](release-notes-0.4.0-draft.md).
