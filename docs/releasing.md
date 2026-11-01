# Versioning and release preparation

**No release is authorized by these instructions alone.** Phase 10 creates no tag, push,
npm publication, GitHub Release, marketplace listing or credential configuration.
Current runtime/plugin version: 0.3.0; latest historical tag: v0.3.0. Proposed next version:
**0.4.0**, not 1.0.0, because optional capabilities were added after the LanguageTool baseline
and public stability/distribution policies remain pre-1.0. [Draft notes](release-notes-0.4.0-draft.md).

## Version contract

Root package.json is the runtime source of truth. Both MCP manifests, their serverInfo
(read from their manifests) and `.claude-plugin/plugin.json` follow it. Document Formats is
an internal private library with its existing independent 0.1.0 version. Schema versions
`profileVersion`, `disciplineProfileVersion` and document modelVersion remain independent.
`npm run validate:distribution` enforces runtime/plugin synchronization and private flags.

Before 1.0, minor versions may add/change contracts with documented migration; patches fix
defects. Additions since v0.3.0 do not claim a break to the existing LanguageTool tool API.
No deprecation mechanism is needed for a demonstrated break in this phase. Historical
v0.1.0/v0.2.0 tags preceded manifest synchronization; from v0.3.0 the runtime tag/manifest
policy applies. Do not use an all-workspaces bump that changes the internal library by accident.

## Exact next release procedure (owner only, not executed)

1. Verify the owner's approved [Apache-2.0 LICENSE](../LICENSE), matching package/plugin
   SPDX metadata and packaged licence copies. The owner resolved the previously open choice
   after the Phase 10 audit. Review [third-party notices](third-party-notices.md).
2. Review the independent audit; start a dedicated release-preparation branch from clean,
   current main. Approve 0.4.0 or document a different target. Update only root, the two MCP
   manifests and plugin version, and refresh the lockfile. For the proposed target:

   ```sh
   npm version 0.4.0 --no-git-tag-version --include-workspace-root \
     --workspace @gasycoder/languagetool-mcp --workspace @gasycoder/research-integrations-mcp
   ```

   Update plugin.json to that same version, refresh/review the lock and verify with
   `npm run validate:distribution`. Keep internal formats/schema versions unless their
   own contracts changed. Update CHANGELOG, draft notes and inventory version references.
3. In an independent clone/snapshot, run `npm ci` then `npm run check` under Node 20 and 22.
   Check includes all package tests/builds, synthetic examples, tarball allowlists and
   independent install/import/bin checks. Also run `git diff --check`, `npm audit` and
   `npm audit --omit=dev`; inspect findings rather than running an automatic fix.
   Inspect `npm pack --dry-run` for each selected package. Verify the local plugin with
   `claude plugin validate .`; directory acceptance requires licence and listing decisions.
4. Keep live tests opt-in: real LanguageTool and public metadata smoke tests need explicit
   service/network setup, private Zotero needs authorized credentials/items, real Vale needs
   trusted installed rules. Record exactly what ran and which checks were skipped.
5. Finalize changelog/release notes, private security reporting/maintenance policy and actual
   distribution targets. Open a focused release PR; require green CI for Node 20/22 and owner
   review of versions, licence, package contents, notes and clean-room evidence. Merge only
   with the separately authorized maintainer process.
6. From the reviewed **clean main commit**, the owner may explicitly authorize creation/push
   of the selected version tag and a GitHub Release with the reviewed notes. Confirm no
   newer unreviewed changes entered main. Tagging/pushing/creating a Release were not done
   by Phase 10 and are not automatic CI steps.
7. npm publication is a separate decision. Root and formats remain internal; for each MCP
   selected for publication, review a separate change to private/license/package metadata
   and packaging gates, then repeat checks. The current validator intentionally refuses
   private=false, so any publication-policy change must be explicit and reviewed. Only then
   authorize a specific package/tag publication with owner-managed credentials. No npm token
   or automatic release workflow is configured. Do not publish root or every workspace.

The package scripts themselves do not tag/push/publish. [Distribution gates](distribution.md#release-gates)
remain visible even when technical checks pass. No marketplace exists: clone/local plugin
usage is the supported path. No release workflow is added before licence/publishing policy
and credentials are defined.
