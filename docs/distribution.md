# Distribution status and package inventory

The prepared 0.4.1 distribution adds a **Git marketplace for the Skills plugin**.
A full clone/local build remains the path for MCP/library development. No npm publication
or remote marketplace integration is performed by this preparation; the root stays private.
Keep documentation, schemas and profiles with the Skills/plugin; these resources are not
embedded in the runtime npm tarballs.

## Package inventory

All manifests declare `engines.node: >=20`; CI tests official full-ICU Node 20 and 22.

| Surface | Version/private | Entry/export and files | Purpose/disposition |
| --- | --- | --- | --- |
| academic-research-assistant (root) | 0.4.1 / true | No bin/exports; workspace scripts | Development only; never publish root |
| @gasycoder/languagetool-mcp | 0.4.1 / true | bin languagetool-mcp → dist/index.js; only package.json exported; files dist/**/*.js | Potential future public CLI, after explicit publication decision; no library import/types API |
| @gasycoder/research-integrations-mcp | 0.4.1 / true | bin research-integrations-mcp → dist/index.js; ESM service.js + declarations, package.json export; files dist | Potential future public CLI/library after explicit owner decision |
| @gasycoder/document-formats | 0.1.0 / true | No bin; ESM index.js + declarations; files dist | Internal library for this release, separately versioned; no public publication decision |
| Claude local plugin | 0.4.1 | .claude-plugin/plugin.json; default skills/ | Git catalog or local clone, Skills-only; no automatic MCP/hook |
| Skills/profiles/schemas/docs/examples | Repository resources | Relative files, validated links/frontmatter/schemas | Distributed with clone; not independent npm packages |

The two MCPs depend on `@modelcontextprotocol/server` and `zod`. Document Formats depends
on `mdast-util-from-markdown`, `mdast-util-gfm`, `micromark-extension-gfm`, `yauzl`, `sax`.
These are resolved as npm dependencies, not vendored/bundled. Root uses `ajv`, `yaml` and the
official MCP client as development tools. Manifests/lockfile remain the exact dependency
inventory; no bulk upgrade is part of this phase.

The root version is the source of truth for both MCP packages/serverInfo and the plugin.
The catalog deliberately has no duplicate version field.
`validate:distribution` catches drift and accidental removal of private protection. Formats
0.1.0 is an explicit internal-library exception. Runtime/plugin version **0.4.1** is prepared
on the owner-authorized feature branch, a distribution-only patch after v0.4.0; no patch
tag/publication occurred. Stable public API/OS/host commitments and actual publication policy are
not settled enough to recommend 1.0.0.

## Installation and packaging checks

`npm run check` validates Skills/profiles/discipline resources, local doc links and versions,
typechecks, tests all workspaces, builds, executes the synthetic example and pack-checks.

The existing LanguageTool pack check builds/packs, allows only README/package/runtime JS
and the Apache-2.0 LICENSE, installs independently, runs the linked bin/shebang and discovers
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

Pack dry-run/install checks are preparation, not authorization to publish. Plugin/catalog
identity and root source are checked by the distribution validator and
the official Claude CLI. Local installs and startup test discovery; they do not certify
an authenticated Web session. [Host setup](client-setup.md).

## Release gates

- **Licence resolved:** the owner explicitly selected [Apache-2.0](../LICENSE). Root, all
  workspaces and plugin carry that SPDX identifier; each runtime tarball includes the exact
  licence text. [Third-party notices](third-party-notices.md) are reviewed separately.
  Licence adoption does not authorize changing private flags or publishing.
- **Owner action:** review final release preparation and select actual distribution surfaces.
  The owner-authorized 0.4.1 bump is prepared locally and must be reviewed in the release PR.
  These intentional gates do not prevent local testing of private tarballs.
- **Owner verification before public release:** confirm private security reporting/form access.
  A fresh read-only check returned `enabled: true` on 2026-11-01; the owner must still verify
  the reporter-facing form and record it. Follow the
  [owner checklist](../SECURITY.md#owner-activation-checklist). No alternative private
  address is invented. This does not prevent local release preparation or final audit.
- **SHOULD FIX:** clarify maintenance/backport and private report triage responsibilities.
- **OPTIONAL:** Code of Conduct plus moderation process, a listing icon, broader OS/Claude
  host matrix, owner-authorized publication automation and manual
  live-service CI. No token, publisher workflow or release action is configured now.

For the concrete preparation/results see [Phase 10 report](distribution-results.md),
[historical 0.4.0 preparation](release-preparation-0.4.0.md), [release checklist](releasing.md)
and [0.4.1 draft notes](release-notes-0.4.1-draft.md).
