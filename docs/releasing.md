# Versioning and release preparation

**No release is authorized by these instructions alone.** Phase 10 creates no tag, push,
npm publication, GitHub Release, marketplace listing or credential configuration.
Prepared runtime/plugin version: **0.4.0**, unreleased; latest historical tag: v0.3.0.
The owner approved this pre-1.0 minor because optional capabilities were added after the LanguageTool baseline
and public stability/distribution policies remain pre-1.0. [Draft notes](release-notes-0.4.0-draft.md).
Observed results and remaining gates: [0.4.0 preparation record](release-preparation-0.4.0.md).
Final countercheck and procedure correction: [release preparation audit](release-preparation-0.4.0-audit.md).

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

## Release preparation and remaining owner procedure

1. Verify the owner's approved [Apache-2.0 LICENSE](../LICENSE), matching package/plugin
   SPDX metadata and packaged licence copies. The owner resolved the previously open choice
   after the Phase 10 audit. Review [third-party notices](third-party-notices.md).
2. Review the Phase 10 audit and final preparation diff. The owner requested
   `release/0.4.0-prep` from audited `fff8154`, retaining the unmerged distribution work;
   no merge into main was performed. The authorized preparation bump updates only root,
   the two MCP manifests and plugin version, plus the lockfile. The command used was:

   ```sh
   npm version 0.4.0 --no-git-tag-version --include-workspace-root \
     --workspace @gasycoder/languagetool-mcp --workspace @gasycoder/research-integrations-mcp
   ```

   This bump is already applied; do not rerun it on unchanged 0.4.0 manifests.
   Plugin.json was updated to the same version. Review the lock and verify with
   `npm run validate:distribution`. Keep internal formats/schema versions unless their
   own contracts changed. Update CHANGELOG, draft notes and inventory version references.
3. In an independent clone/snapshot, run `npm ci --engine-strict` then `npm run check`
   under Node 20 and 22 (development floors 20.19 / 22.12 with the locked Vite dependency).
   Check includes all package tests/builds, synthetic examples, tarball allowlists and
   independent install/import/bin checks. Also run `git diff --check`, `npm audit` and
   `npm audit --omit=dev`; inspect findings rather than running an automatic fix.
   Inspect `npm pack --dry-run` for each selected package. Verify the local plugin with
   `claude plugin validate .`; directory acceptance requires licence and listing decisions.
4. Keep live tests opt-in: real LanguageTool and public metadata smoke tests need explicit
   service/network setup, private Zotero needs authorized credentials/items, real Vale needs
   trusted installed rules. Record exactly what ran and which checks were skipped.
5. Finalize changelog/release notes, maintenance policy and actual distribution targets.
   The owner must [activate and verify private security reporting](../SECURITY.md#owner-activation-checklist)
   **before merge or release**: confirm `enabled: true` and a reporter-accessible private
   form, then record the verification. Its last read-only status was `enabled: false`
   on 2026-11-01. Do not treat a documentation update as activation.
   Open a focused release PR; require green CI for Node 20/22 and owner
   review of versions, licence, package contents, notes and clean-room evidence. Any npm
   publication-policy/metadata changes need approval, a reviewed commit and repeated checks
   before selecting a release tag commit. Merge only through the separately authorized
   maintainer process, after the security gate above.
6. On the reviewed **clean main commit**, wait for main CI to pass on **both Node 20 and 22
   for that exact commit**. Recheck root, both MCP manifests/serverInfo, plugin and lockfile
   at 0.4.0, internal Formats at 0.1.0, licence metadata and intended private flags. If another
   release commit or any change is needed, review it and repeat the checks/main CI before
   tagging; no newer unreviewed commit may enter the release.

   Only after these gates may the owner explicitly authorize an **annotated** v0.4.0 tag
   on that exact commit, following the repository's historical annotated-tag policy.
   Use a signed annotated tag only when the maintainer has configured/approved signing.
   Verify the tag target and annotation before any separately authorized tag push.
7. npm publication is optional and separately authorized for specific MCP packages, never
   root/internal Formats or every workspace. All packages in the current preparation remain
   private: **skip this step** unless a publication-policy change was approved, committed,
   checked and included in the reviewed tag commit through steps 5–6. The current validator
   intentionally refuses private=false; changing that policy requires explicit review.
   Publish only the approved artifacts from the clean tagged commit with owner-managed
   credentials. Do not edit private/version metadata after tagging and publish different
   untagged contents as that release. Later policy changes require a later reviewed release.
8. Only after the reviewed tag has been pushed, and any explicitly selected npm publication
   has completed, may the owner separately authorize a GitHub Release from that tag with
   the reviewed notes. If npm publication was not selected, it is not a GitHub Release gate.
   No tag, push, npm publication or GitHub Release is performed by these instructions or CI.

The package scripts themselves do not tag/push/publish. [Distribution gates](distribution.md#release-gates)
remain visible even when technical checks pass. No marketplace exists: clone/local plugin
usage is the supported path. No release workflow is added before licence/publishing policy
and credentials are defined.
