# Marketplace distribution preparation — 0.4.1

Scope: Git marketplace installation of the existing Skills in Claude Web and Claude Code.
No academic feature, Skill instruction, parser, linguistic behavior or provider behavior is
added or changed. Branch: `feat/marketplace-distribution`, based on released v0.4.0/main
`d52021b`. The initial untracked marketplace manifest supplied by the owner was inspected,
preserved and included in this preparation.

## Catalog and versions

`.claude-plugin/marketplace.json` retains exactly these identities:

- Marketplace: `gasycoder-academic-tools`.
- Owner: `GasyCoder`, with the supplied public GitHub URL.
- One plugin: `academic-research-assistant`.
- Plugin source: `./`, relative to the catalog's repository root.

Claude Code 2.1.314 accepts the root plugin and the marketplace JSON when validated
separately. The repository validator enforces identity, source, one plugin, descriptions,
the four default Skill files and no extra catalog component/version overrides. The catalog
gets version/licence from plugin.json, keeping one authoritative plugin version.

Root, LanguageTool MCP, Research Integrations MCP, their manifest-derived serverInfo,
plugin.json and lockfile are prepared at **0.4.1**. Private internal Document Formats stays
**0.1.0**, per the existing exception. All four packages stay private and Apache-2.0.
No dependency version changed. The marketplace never starts either MCP automatically.

## Installation evidence

`npm run marketplace:check` is an explicit maintainer check requiring Claude Code and Git.
It is separate from npm-only CI so contributors without Claude CLI can still run the core
suite. It copies current tracked/indexed files into a temporary source tree, ignoring
node_modules, dist, env and real local profiles. Stage new distribution files first.

The script validates both manifests, adds/installs the plugin at user scope in two fresh
`CLAUDE_CONFIG_DIR` directories and runs from empty consumer directories:

| Mode | Registration/install | CLI without --plugin-dir |
| --- | --- | --- |
| Local folder marketplace | Passed, enabled user plugin 0.4.1 | Four namespaced Skills discovered |
| Git repository clone | Passed, plugin loads from isolated cache at 0.4.1 | Four namespaced Skills discovered |

The Git test uses the real Git clone path, with a process-local Git `insteadOf` setting
rewriting a synthetic HTTPS identifier to the temporary local repository. File transport
is the only permitted Git protocol in that test. No remote branch is uploaded or fetched
for the test. A direct file:// marketplace identifier is rejected by Claude's source parser;
using a Git URL rewrite lets Git clone locally without inventing a remote marketplace.

`plugin details` reports Skills (4), MCP servers (0), Hooks (0). The startup init event
independently lists:

- `academic-research-assistant:academic-writing`
- `academic-research-assistant:citation-integrity`
- `academic-research-assistant:research-profile`
- `academic-research-assistant:scientific-review`

The executable is launched headlessly with a local `/help` command, without `--plugin-dir`.
Headless help is unavailable as a UI command, but the init event proves plugin loading and
discovery; the local result has zero model turns/API time. This is not an interactive Skill
review or authenticated Web test. Temporary configs/caches/repos are deleted; the user's
existing Claude installation is not replaced or reset.

## Host documentation

README provides the GitHub marketplace add command, qualified plugin install and a normal
`claude` launch. It distinguishes session-only `--plugin-dir` development loading.
[Client setup](client-setup.md) covers CLI, the Web Customize repository flow, local smoke
testing and separately registered MCPs. Node/npm/build steps apply to MCP/library use,
not simply to installing the Skills catalog.

Current primary contracts were checked: [marketplace schema](https://code.claude.com/docs/en/plugins/marketplace-reference),
[CLI installation](https://code.claude.com/docs/en/discover-plugins) and
[Web plugin use](https://support.claude.com/en/articles/13837440-use-plugins-in-claude).
Account/organization policy can restrict Web availability. User installation and
organization-managed Git sync are separate flows. Local stdio/loopback tools do not run
automatically in chat; Claude Code/Cowork need the host's supported separate registration.

The remote GitHub add command is documented for use after the reviewed catalog reaches the
remote default branch. This work does not claim that the unpushed branch is already
installable from GitHub or that a Web account was exercised. It does not submit the plugin
to Anthropic's public directory. v0.4.0 tag/release remain unchanged.

## Validation results

| Check | Result |
| --- | --- |
| claude plugin validate . | Passed with warnings |
| claude plugin validate .claude-plugin/marketplace.json | Passed with optional author warning |
| Isolated local and Git marketplace installs | Passed; user scope; version 0.4.1 |
| Normal CLI startup / four Skills / no bundled MCP or hook | Passed in both installed modes |
| Node 22.16.0 / npm 11.11.0 npm run check | Passed |
| Clean Node 20.20.2 / npm 10.8.2 strict install and check | Passed |
| Validators | 14 Skills + 27 Profiles + 11 Disciplines + 10 distribution = **62 passed** |
| Application tests | **455 passed**, **12 optional live skipped**; no tests disabled |
| Typecheck/build/example | Passed in all three workspaces |
| Pack checks | LT 18 files, Formats 12, Integrations 23; independent installs/imports/MCP checks passed |
| Version/licence/link checks | Passed; Formats exception retained |
| npm audit / npm audit --omit=dev | Both zero reported vulnerabilities |
| git diff --check | Passed |

Four new validator tests cover the catalog contract and rejection of malformed entries,
identity/source drift, duplicate version metadata and executable component additions.
The application test count is unchanged; real LanguageTool/provider tests stay opt-in.
No real manuscript or provider credential was needed. Linux is the tested platform.

Warnings remain: optional plugin author attribution, root CLAUDE not loaded as plugin
context, and missing future directory-listing icon. The root CLAUDE warning is expected:
the four Skills contain the shipped instructions. No private attribution or cosmetic asset
was invented. Marketplace/one-step installation advice is not a functional validation error.

## Handoff

Created: marketplace.json, check-marketplace.mjs, this report and 0.4.1 draft notes.
Modified: plugin/root/two MCP version metadata and lockfile, distribution validator/tests,
README, client/distribution/release docs, CHANGELOG, roadmap, CLAUDE and the integration
version reference. No existing Skill or runtime source changed. Commit hashes and final
Git status are reported in the handoff. No push, merge, tag, npm publish, GitHub Release,
directory submission or change to the existing release occurred.

Next: independent audit, then separately authorized integration and remote/Web installation
verification under an eligible account. This preparation is ready for that audit; it is
not evidence of an already published marketplace patch.
