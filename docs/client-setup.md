# Local plugin and MCP client setup

The supported path is a full clone with `npm ci` and `npm run build`. Packages remain private
and unpublished; do not use fictitious npx install commands. No marketplace exists for this
project. Licence selection remains an owner action.

## Skills-only local plugin

`.claude-plugin/plugin.json` names/versions the plugin. Claude Code discovers the four
default `skills/<name>/SKILL.md` directories and references. No hook, agent, MCP config,
installation script or secret is bundled.

```sh
claude plugin validate .
claude --plugin-dir .
```

Use `/academic-research-assistant:academic-writing`,
`/academic-research-assistant:scientific-review`,
`/academic-research-assistant:citation-integrity` or
`/academic-research-assistant:research-profile`, followed by a scoped request.

The [official manifest reference](https://code.claude.com/docs/en/plugins-reference) and
[local loading docs](https://code.claude.com/docs/en/plugins) were checked in Phase 10.
Claude Code 2.1.314 locally validated the manifest. Warnings include no author attribution
and that root CLAUDE.md is not plugin context. Directory submission checks additionally flag
the missing licence and listing icon; local loading is distinct from directory acceptance.
No authenticated model session or marketplace installation was used for validation.

Keep the full clone: Skill links reach root docs, schemas and discipline resources. Copying
only `skills/` breaks that contract. In another Skill-capable host, provide SKILL.md and
linked resources according to its mechanism; no universal host compatibility is claimed.

## Register MCP servers separately

Replace the absolute placeholder with your clone's path. These are optional local client
configuration commands; repository checks do not execute them. Official
[stdio registration syntax](https://code.claude.com/docs/en/mcp):

```sh
claude mcp add --transport stdio languagetool \
  --env LANGUAGETOOL_BASE_URL=http://127.0.0.1:8081 \
  -- node /absolute/path/to/academic-research-assistant/packages/languagetool-mcp/dist/index.js
claude mcp add --transport stdio research-integrations \
  -- node /absolute/path/to/academic-research-assistant/packages/research-integrations-mcp/dist/index.js
```

Inspect registered servers with `/mcp`. LanguageTool exposes four tools, Research Integrations
seven; a host can prefix their names. Start LanguageTool's external Java server separately.
`health_check` establishes liveness and `get_supported_languages` lists installed languages.

A generic stdio host uses the same `node .../dist/index.js` commands. Keep their stdout
channels separate: they carry MCP JSON-RPC, not prose. Configure keys in your host's protected
environment settings, never example JSON, shell history, profiles or Git. Loading the plugin
or registering a server does not authorize external metadata calls.

See [configuration](configuration.md), [LanguageTool](../packages/languagetool-mcp/README.md)
and [Research Integrations](research-integrations.md) for failure behavior and limits.
