# Draft release notes — prepared 0.4.1

**Unpublished draft.** No push, merge, tag, npm publication or GitHub Release is performed
by this preparation. Existing v0.4.0 is preserved.

This patch makes the existing Skills plugin distributable through a Git marketplace:

- Catalog: `gasycoder-academic-tools` in `.claude-plugin/marketplace.json`.
- Plugin: `academic-research-assistant`, sourced from the repository root (`./`).
- Claude Code: add `GasyCoder/academic-research-assistant`, install the plugin at the desired
  scope and start normally without `--plugin-dir`. Local folder loading remains a separate
  development option.
- Claude Web: add the Git repository from Customize → Plugins → Add marketplace, then add
  the plugin. Availability depends on the account and organization policy.

The four existing Skills are unchanged. No new academic/scientific feature, new tool or
parser/provider behavior is introduced. The plugin bundles no MCP or hook. Local LanguageTool
and Research Integrations MCPs still need separate registration in Claude Code or a supported
Cowork host; they do not start automatically in Web chat.

Root, both MCP manifests/serverInfo and plugin are coordinated at 0.4.1. Internal private
Document Formats remains 0.1.0. Apache-2.0 and private/unpublished npm package status remain.
Marketplace identity/source checks and installation guidance accompany the patch.

Remote Git instructions become usable once the reviewed catalog reaches the repository's
remote default branch. Git hosting is distinct from an Anthropic public-directory listing.
See [client setup](client-setup.md) and [release procedure](releasing.md).
