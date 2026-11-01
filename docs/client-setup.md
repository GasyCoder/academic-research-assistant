# Plugin installation and MCP client setup

The plugin `academic-research-assistant` contains four Skills plus their linked docs,
profiles and schemas. Its Git marketplace is `gasycoder-academic-tools`; the marketplace
entry's `source: "./"` selects this repository's root. The plugin manifest owns the version.
It bundles no MCP, hook or agent. Packages use [Apache-2.0](../LICENSE) and remain private
on npm; installing the Skills does not require npm, Java, Vale or building the MCPs.

The 0.4.1 catalog is prepared locally. Remote instructions below take effect after the
reviewed marketplace files are available on the repository's default branch. This work
performs no push, merge, tag, npm publication or marketplace-directory submission.

## Claude Code: install from the Git marketplace

Run in a shell with Claude Code installed:

```sh
claude plugin marketplace add GasyCoder/academic-research-assistant
claude plugin install academic-research-assistant@gasycoder-academic-tools --scope user
claude plugin list
claude plugin details academic-research-assistant
claude
```

The marketplace can also be supplied as
`https://github.com/GasyCoder/academic-research-assistant.git`. Inside a Claude Code session,
use `/plugin marketplace add GasyCoder/academic-research-assistant`, then
`/plugin install academic-research-assistant@gasycoder-academic-tools` and choose the
installation scope. A user installation persists across sessions; start `claude` normally
without `--plugin-dir`. Restart an existing session after installing/updating.

`plugin list` should show the installed plugin enabled; `plugin details` should show four
Skills and zero MCP servers/hooks. Use a current Claude Code release; these instructions
were tested with 2.1.314. A marketplace refresh and plugin update are separate operations:

```sh
claude plugin marketplace update gasycoder-academic-tools
claude plugin update academic-research-assistant@gasycoder-academic-tools
```

A catalog installed from a local folder continues to use that folder. To switch that local
test to Git, use a separate test configuration or remove/re-add it deliberately: marketplace
removal can uninstall its plugins. A CLI user-scope install does not itself install the
plugin into your Claude Web account.

## Claude Web chat

1. Open **Customize → Plugins** in Claude on the web.
2. Select **Add → Add marketplace → Add from a repository**.
3. Enter `GasyCoder/academic-research-assistant` or
   `https://github.com/GasyCoder/academic-research-assistant` and add the marketplace.
4. Find `academic-research-assistant` in `gasycoder-academic-tools` and select **Add**.
5. In chat, type `/` or use `+` to select one of the four plugin Skills, then supply the
   passage and explicitly declared context you want reviewed.

Plugin availability depends on your plan and organization policy. If adding repositories
is restricted, ask the organization owner which sources are allowed. These are user
installation instructions; organization-wide Git sync has separate administrator controls
and repository eligibility requirements. Do not assume a public user marketplace can be
registered through a private organization sync flow.

Web chat can use the Skills. It cannot automatically start a local stdio process, read a
profile on your computer or connect to your loopback LanguageTool/Zotero. Supply needed
passages/context using the host's file/context controls. Local MCP outputs are optional;
if unavailable, Skills retain their manual, evidence-bound workflow. A Web plugin install
is not proof of local tools being available.

## Local development and marketplace smoke test

For a session reading the current source checkout, from the repository root:

```sh
claude plugin validate .
claude --plugin-dir .
```

`--plugin-dir` loads the directory for that session; it does not add a marketplace or
persist an installation. Keep the full tree, since Skill links reach docs, schemas and
profiles. Copying only `skills/` breaks those references. Use a separate Claude test
configuration when comparing this mode with an installed copy.

To test a local marketplace installation from a clean test configuration:

```sh
# Set CLAUDE_CONFIG_DIR to a fresh temporary directory for this shell first.
claude plugin validate .claude-plugin/marketplace.json
claude plugin marketplace add ./
claude plugin install academic-research-assistant@gasycoder-academic-tools --scope user
claude plugin details academic-research-assistant
claude
```

This final launch deliberately omits `--plugin-dir`. The expected commands are:

- `/academic-research-assistant:academic-writing`
- `/academic-research-assistant:scientific-review`
- `/academic-research-assistant:citation-integrity`
- `/academic-research-assistant:research-profile`

For example, request clarity review of a supplied synthetic passage without rewriting or
external lookups. No actual manuscript/provider credential is needed to test discovery.
Local install/startup testing does not certify an authenticated browser installation.
Maintainers can run `npm run marketplace:check` after staging/committing new files to repeat
both folder and local Git installs with temporary configs. It requires Claude Code on PATH,
is separate from npm-only CI, and starts the CLI headlessly to inspect its init event without
`--plugin-dir` or a model request. It does not perform an interactive or Web Skill review.

## Register local MCPs separately

Only MCP users need a separate source clone and `npm ci --engine-strict && npm run build`.
Do not run binaries from an assumed plugin-cache build or use unpublished npm package names
with npx. Replace each absolute placeholder below with that separate clone's path.
Claude Code shell registration:

```sh
claude mcp add --transport stdio languagetool \
  --env LANGUAGETOOL_BASE_URL=http://127.0.0.1:8081 \
  -- node /absolute/path/to/academic-research-assistant/packages/languagetool-mcp/dist/index.js
claude mcp add --transport stdio research-integrations \
  -- node /absolute/path/to/academic-research-assistant/packages/research-integrations-mcp/dist/index.js
```

Inspect `/mcp`. LanguageTool exposes four tools; Research Integrations seven. Start the
external Java LanguageTool server separately; use `health_check` and
`get_supported_languages` before linguistic checks. Cowork support/configuration depends
on that host and administrator policy; these CLI registrations are Claude Code settings,
not automatic Cowork or Web registrations. Use the host's supported local-server mechanism.
A generic compatible stdio client can use the same `node .../dist/index.js` commands.

Configure keys in protected host environment settings, not profiles, example JSON or Git.
Each stdio server owns its protocol-only stdout. Installing Skills or registering an MCP
never authorizes metadata lookups; those still need explicit consent. See
[configuration](configuration.md), [LanguageTool](../packages/languagetool-mcp/README.md)
and [Integrations](research-integrations.md) for operation and limits.

## Contract sources and verification limits

Current primary references: [Claude Code marketplace creation](https://code.claude.com/docs/en/plugin-marketplaces),
[marketplace schema](https://code.claude.com/docs/en/plugins/marketplace-reference),
[plugin installation](https://code.claude.com/docs/en/discover-plugins),
[Web plugin use](https://support.claude.com/en/articles/13837440-use-plugins-in-claude),
[organization management](https://support.claude.com/en/articles/13837433-manage-plugins-for-your-organization)
and [stdio registration](https://code.claude.com/docs/en/mcp).

The official CLI accepts both manifests. Known warnings are optional author attribution,
listing icon and root CLAUDE.md not being loaded as plugin context. The four Skills carry
the shipped instructions; this is not a broken CLAUDE reference. Git marketplace hosting
is distinct from acceptance into Anthropic's public directory. Web instructions follow
current host documentation; this repository's check cannot exercise a signed-in Web UI.
Observed commands, results and remaining limits are recorded in the
[0.4.1 marketplace handoff](marketplace-distribution-0.4.1.md).
