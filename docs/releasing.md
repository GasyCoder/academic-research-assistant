# Versioning and releases

## Versioning policy

The MCP runtime components (LanguageTool and Research Integrations) use **one version** for:

- the Git tag of a release (`vX.Y.Z`);
- the root `package.json`, `packages/languagetool-mcp/package.json` and
  `packages/research-integrations-mcp/package.json`;
- the version each MCP server reports in `serverInfo`, which is read from its
  `package.json` at runtime.

Tests check package/server versions against the root. The private Document Formats library
keeps its existing 0.1.0 package version; Phase 9 adds no release, tag or publishing workflow.

Versions follow [Semantic Versioning](https://semver.org/). Before 1.0.0, a minor version
(`0.Y.0`) may add tools or change their contract, and a patch version (`0.Y.Z`) only fixes
defects. Revisit this policy if the repository ever publishes several packages.

History: the tags `v0.1.0` (Phase 1) and `v0.2.0` (Phase 2A) were created while both
`package.json` files still said `0.1.0`. From `0.3.0` on, tag and package versions match.

## Release checklist

1. On a branch, set the version everywhere at once (root, workspace and lockfile; no commit,
   no tag):

   ```bash
   npm version X.Y.Z --no-git-tag-version --workspaces --include-workspace-root
   ```

2. Run the CI checks locally, and the integration tests against a real LanguageTool:

   ```bash
   npm ci
   npm run check               # typecheck, test, build, pack:check
   npm run test:integration    # needs LanguageTool on LANGUAGETOOL_BASE_URL
   ```

3. Open a pull request; CI must pass on Node 20 and Node 22. Merge into `main`.
4. Tag the merge commit on `main` and push the tag:

   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

5. Create a GitHub Release from the tag, with the changes since the previous release.

## Publishing to npm (not done yet)

`@gasycoder/languagetool-mcp` is marked `"private": true`, so `npm publish` refuses it.
Before a first publication:

- choose a licence, add a `LICENSE` file and the `license` field;
- remove `"private": true`;
- check the tarball with `npm run pack:check` (file list and an installed-binary smoke test);
- publish from a clean checkout of the tag:
  `npm publish --access public -w @gasycoder/languagetool-mcp`.

A publishing workflow can be added later; CI has read-only permissions and publishes nothing.
