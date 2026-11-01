# Academic Research Assistant

A public toolkit for researchers, PhD students and scientific authors: academic writing,
scientific structure review and evidence-bound citation review, with optional local linguistic
tools and external metadata checks. It supports declared project context across disciplines.

**License:** [Apache-2.0](LICENSE), explicitly selected by the owner.
All npm packages remain private and unpublished. The current runtime version is 0.3.0;
0.4.0 is the authorized release-preparation target, not a published version.
[Third-party licences and notices](docs/third-party-notices.md) remain applicable.
See [distribution status](docs/distribution.md) and the [release checklist](docs/releasing.md).

## Capabilities

| Component | Purpose |
| --- | --- |
| [Academic Writing](skills/academic-writing/SKILL.md) | Proofreading, clarity and argumentation; preserves meaning, numbers and citations |
| [Scientific Review](skills/scientific-review/SKILL.md) | Evidence-bound alignment of question, methods, results and conclusions; no validity verdict |
| [Citation Integrity](skills/citation-integrity/SKILL.md) | Internal reference consistency; authorized metadata evidence stays distinct from claim support |
| [Research Profile](skills/research-profile/SKILL.md) | Optional declared context; no secrets or inferred preferences |
| [Discipline Profiles](docs/discipline-profiles.md) | Five optional generic guidance profiles, selected explicitly |
| [Document Formats](docs/document-formats.md) | Local Markdown, conservative LaTeX and read-only DOCX inspection with protected prose and UTF-16 locations |
| [LanguageTool MCP](packages/languagetool-mcp/README.md) | Separate local LanguageTool adapter: health, languages, text and long-document diagnostics |
| [Research Integrations](docs/research-integrations.md) | Separate read-only Crossref, OpenAlex and Zotero tools, plus optional local Vale lint |

Skills require a compatible AI host; they are instructions, not autonomous programs. This
repository supplies no LLM service. There is no document writer, PDF parser, TeX compiler,
automatic bibliography correction, universal reference-validity verdict or metadata-based
proof that a source supports a claim.

## Requirements and quick start

Use an official full-ICU Node.js build. Node **20 and 22** are tested; Node 22 is recommended
for this release. Validation used npm 10.8.2 with Node 20 and npm 11.11.0 with Node 22;
other npm versions and operating systems have not been separately certified. CI runs on
Ubuntu Linux. Java, LanguageTool, Vale and provider credentials are optional.

For development, use **Node 22.12 or later on the tested Node 22 line**. On Node 20,
the locked Vitest 5 reports `EBADENGINE`: ordinary checks passed, but Vitest does not
declare support for that runtime and `npm ci --engine-strict` fails. Installed runtime
tarballs passed a separate strict-engine Node 20 install. See the
[final distribution audit](docs/distribution-audit.md) for this outstanding tooling issue.

```sh
git clone https://github.com/GasyCoder/academic-research-assistant.git
cd academic-research-assistant
npm ci
npm run build
node examples/read-document.mjs
```

The last command produces a first local result: a synthetic typo mapped through bold markup
to an **unapplied** proposal. It needs no LanguageTool, Vale, provider account or AI host.
Installation needs npm registry access or a prepared cache; the example itself uses no network
and changes no input. [Worked workflow and profiles](examples/README.md).

## Use the Skills in Claude Code

After cloning, load the local Skills plugin:

```sh
claude plugin validate .
claude --plugin-dir .
```

For example, in that session:

```text
/academic-research-assistant:academic-writing Review clarity in examples/manuscript.md; do not rewrite or perform external lookups.
```

Four Skills are discovered under `skills/`. No MCP or hook starts automatically; no
marketplace is configured/published. Keep the full clone, including linked docs, schemas and
profiles. Root CLAUDE.md is developer guidance, not plugin context. See
[client/plugin setup](docs/client-setup.md) for details and manual MCP registration.

## Optional local LanguageTool

LanguageTool is **installed separately**, not bundled in npm. The tested LanguageTool
6.9-SNAPSHOT setup uses Java 17 or later. From its downloaded, unzipped directory:

```sh
java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081
```

From this repository, start the stdio MCP or let a compatible host start it:

```sh
LANGUAGETOOL_BASE_URL=http://127.0.0.1:8081 node packages/languagetool-mcp/dist/index.js
```

Use `health_check` and `get_supported_languages` in your host before linguistic checks.
Health establishes liveness, not language-loading readiness. If LanguageTool is absent,
tools report unavailability and Skills can review manually. stdout is protocol-only.
[Detailed setup and limits](packages/languagetool-mcp/README.md).

## A small review workflow

1. Optionally copy a [synthetic profile](examples/README.md) into ignored `profiles/local/`;
   declare only what you know and validate it. [Profile format](skills/research-profile/references/profile-format.md).
2. Supply a passage/document and request Academic Writing or Scientific Review at the intended
   scope. Optional discipline guidance needs explicit selection; no profile is required.
3. Citation Integrity inventories supplied citations/bibliography without inventing entries.
   Authorize specific metadata checks separately; ordinary review stays local.

[Document contracts](docs/document-formats.md) and [integration setup](docs/research-integrations.md)
describe available structure, mapping and tool limits. Both MCPs also work with a generic
compatible stdio MCP host; Claude Code is optional.

## Privacy and limits

Parsing is local. A remote configured LanguageTool receives submitted prose; your AI host
has its own data policy. Authorized providers receive only necessary bibliographic fields or
selected library identifiers. Zotero is read-only, Vale is local, and ordinary review never
automatically uploads manuscripts to bibliographic providers. Keys stay out of profiles/Git.

[Configuration](docs/configuration.md), [privacy/threat boundaries](docs/privacy-and-security.md)
and [security reporting](SECURITY.md) describe guarantees and limits. Conservative TeX,
incomplete Word styles/layout, unavailable services and partial supplied sections must be
reported as coverage limits. A missing record is never proof of fabrication.

## Development

```sh
npm run check                  # validators, typecheck, tests, build, tarball/install checks
npm run validate:distribution  # versions, local links, plugin and synthetic profiles
npm run pack:check             # independent tarball installation and import/bin smoke tests
```

Standard tests use local fake services/executables. Install checks may use npm, never live
providers. [Live tests](docs/configuration.md#opt-in-test-controls) remain separately opt-in.
See [CONTRIBUTING](CONTRIBUTING.md), [CHANGELOG](CHANGELOG.md), [architecture](docs/architecture.md),
[roadmap](docs/roadmap.md) and [release preparation](docs/releasing.md). These checks never
publish, tag or release anything.
