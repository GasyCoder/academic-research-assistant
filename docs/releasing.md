# Versioning and release preparation

These instructions authorize no push, merge, tag, npm publication, GitHub Release or public
plugin-directory submission. Current prepared runtime/plugin version: **0.4.1**, on
`feat/marketplace-distribution`. Latest historical release/tag: **v0.4.0**, preserved.
This patch adds Git marketplace distribution and host setup instructions only; no new
academic/scientific feature or runtime behavior. [Draft notes](release-notes-0.4.1-draft.md).

## Version contract

Root package.json is the coordinated runtime source of truth. Both MCP manifests and their
serverInfo (read from package metadata), lockfile and `.claude-plugin/plugin.json` follow it.
Document Formats remains an internal private library with its independent **0.1.0** version.
Schema/model versions remain independent. `validate:distribution` checks versions, private
flags, Apache-2.0 metadata, licence copies, links and the marketplace catalog contract.

`.claude-plugin/marketplace.json` retains name `gasycoder-academic-tools`, one entry named
`academic-research-assistant` and source `./`. The root plugin manifest supplies its version
and licence; the catalog does not duplicate these fields or embed components. Do not change
an install identity as a side effect of a version bump. The root source carries the four
Skills and linked docs/profiles/schemas from the full Git tree.

Before 1.0, minor versions may add/change documented contracts; patches fix defects or
improve distribution without new academic behavior. The owner-authorized 0.4.1 bump used:

```sh
npm version 0.4.1 --no-git-tag-version --include-workspace-root \
  --workspace @gasycoder/languagetool-mcp --workspace @gasycoder/research-integrations-mcp
```

Then plugin.json was synchronized. The command is already applied; do not repeat it on
unchanged 0.4.1 manifests. Avoid an all-workspaces bump that changes internal Formats.

## Preparation and final review

1. Keep the exact owner-approved Apache-2.0 LICENSE and workspace copies, SPDX metadata and
   [third-party notices](third-party-notices.md). Review the intended distribution surface;
   Git marketplace distribution does not grant permission for npm publication.
2. Run `npm ci --engine-strict` and `npm run check` on Node 20/22 (development floors
   20.19 / 22.12 with locked Vite). Check includes validators, typecheck, tests, build,
   example, tarball inventories and isolated installs. Run `npm audit`, `npm audit --omit=dev`,
   `git diff --check` and pack dry-runs. Keep real service tests explicitly opt-in.
3. Validate **both** the root plugin and marketplace manifest:

   ```sh
   claude plugin validate .
   claude plugin validate .claude-plugin/marketplace.json
   ```

   In a fresh temporary Claude configuration, add the local marketplace, install at user
   scope, inspect `plugin details`, then launch `claude` without `--plugin-dir`. Confirm all
   four namespaced Skills and zero bundled MCPs/hooks. Also verify Git clone installation
   when practical; local folder success alone does not exercise the Git checkout path.
   [Client setup](client-setup.md) documents exact commands and Web/MCP distinctions.
4. Review README, Unreleased changelog and draft notes; do not claim the new remote catalog
   works before its files reach the remote default branch. The Web user path is a Git
   marketplace in Customize; organization sync and public directory listing are separate
   mechanisms. Record browser verification honestly; local CLI startup is not a Web test.

## Owner-controlled merge and release gates

1. Verify private reporting is enabled and the private form is accessible using
   [SECURITY's checklist](../SECURITY.md#owner-activation-checklist). A read-only API check
   on 2026-11-01 returned `enabled: true`; that observation alone does not test the form.
   Earlier preparation/audit reports and SECURITY contain their historical disabled status;
   the owner should record current verification before release. Never change repository
   settings or publish personal contact information as a side effect of these checks.
2. Obtain final independent audit and owner review of the diff, installation evidence,
   versions, notices, notes and host limitations. Require green Node 20/22 PR CI. Merge only
   when separately authorized. Any publication-policy changes need their own reviewed,
   checked commit before selecting a release tag commit.
3. On clean reviewed main, wait for green Node 20/22 CI for **that exact commit**. Recheck
   0.4.1 across root/MCPs/serverInfo/plugin/lock and Formats 0.1.0. Any further release commit
   requires renewed review/checks/main CI. Confirm no newer unreviewed change entered main.
4. Only with separate owner authorization create an **annotated v0.4.1** tag on that commit,
   verify target/annotation, then push the selected tag if explicitly authorized. Use a
   signed annotated tag only with maintainer-approved signing. Preserve the v0.4.0 tag and
   release; this patch never deletes or recreates them.
5. npm is optional and separately authorized. All current packages remain private; skip
   publication for this preparation. Root and Formats stay internal. Publish a selected MCP
   only if an explicit policy/metadata/check change was reviewed before tagging; never edit
   metadata after tagging and publish different untagged contents under that release.
6. Only after an authorized tag push and any selected npm publication may the owner authorize
   a GitHub Release with reviewed notes. No npm publication is required for the Skills Git
   marketplace. Confirm remote marketplace installation after authorized integration; users
   can then add `GasyCoder/academic-research-assistant` and install the named plugin.

No publisher/token workflow is added. A Git-hosted catalog is not an Anthropic directory
submission. The existing [0.4.0 preparation](release-preparation-0.4.0.md) and
[audit](release-preparation-0.4.0-audit.md) are historical evidence; their version-specific
commands do not replace this patch procedure.
