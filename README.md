# Academic Research Assistant

Open-source toolkit for AI-assisted academic writing and scientific manuscript review.

The project aims to provide reusable tools and skills for researchers, PhD students, academics, and scientific authors across multiple disciplines.

## Architecture

The project separates:

- **MCP tools** — deterministic technical capabilities such as linguistic analysis.
- **Academic Skills** — contextual reasoning for scientific writing, methodology, citations, document types, and disciplines.
- **Research Profiles** — dynamic project-specific configuration without hard-coding a research topic.

## Initial components

Initial components:

- LanguageTool MCP server (available)
- Academic Writing Skill (available, see below)
- Scientific Review Skill (available, see below)
- Research Profile Skill (available, see below)
- Citation Integrity Skill (available, see below)

## LanguageTool MCP server

`packages/languagetool-mcp` is a stdio MCP server for a locally installed LanguageTool
instance. It exposes four tools: `health_check`, `get_supported_languages`, `check_text`
(texts up to 50,000 characters) and `check_document` (longer documents up to 100,000
characters, checked part by part with bounded results). It returns structured diagnostics
and never rewrites text.

### Getting started

Prerequisites:

- Node.js 20 or later, from an official build (they include the ICU data the server needs).
  Node 20 and 22 are tested in CI; Node 22 or later is recommended, as Node 20 reached its
  end of life in April 2026.
- Java 17 or later, to run LanguageTool.
- LanguageTool, downloaded from <https://languagetool.org/download/> and unzipped. The server
  was tested with LanguageTool 6.9-SNAPSHOT.

1. Install and build the MCP server:

   ```bash
   git clone https://github.com/GasyCoder/academic-research-assistant.git
   cd academic-research-assistant
   npm ci
   npm run build
   ```

2. Start LanguageTool from its unzipped directory (it listens on `127.0.0.1` only by default):

   ```bash
   java -cp languagetool-server.jar org.languagetool.server.HTTPServer --port 8081
   ```

3. Start the MCP server, or let an MCP client start it. It talks MCP over stdin/stdout:

   ```bash
   LANGUAGETOOL_BASE_URL=http://127.0.0.1:8081 node packages/languagetool-mcp/dist/index.js
   ```

   `LANGUAGETOOL_BASE_URL` (default `http://127.0.0.1:8081`) and `LANGUAGETOOL_TIMEOUT_MS`
   (default `30000`) are optional.

4. Register it in an MCP client with the absolute path of `dist/index.js`, e.g. Claude Code:

   ```bash
   claude mcp add languagetool -e LANGUAGETOOL_BASE_URL=http://127.0.0.1:8081 \
     -- node /absolute/path/to/academic-research-assistant/packages/languagetool-mcp/dist/index.js
   ```

Use `check_text` for a text of up to 50,000 characters, checked in one request, and
`check_document` for a longer document of up to 100,000 characters: it is split internally,
reports offsets in the whole document and bounds its result, so check its `complete` flag.

Configuration, tools, limits, cold start and client setup in detail:
[packages/languagetool-mcp/README.md](packages/languagetool-mcp/README.md).

### Development

```bash
npm run check              # what CI runs: skill and profile validation, typecheck, tests, build, npm package check
npm run validate:profiles  # research profiles; add -- path/to/profile.yaml for a given file
npm run test:integration   # against a real LanguageTool on LANGUAGETOOL_BASE_URL
```

Versioning and releases: [docs/releasing.md](docs/releasing.md).

## Academic Writing Skill

[`skills/academic-writing`](skills/academic-writing/SKILL.md) reviews and improves scholarly
prose in any discipline and language: clarity, precision, concision, coherence, register,
argumentation and paragraph structure. It uses the LanguageTool MCP tools for linguistic
diagnostics and keeps the academic judgement to itself. It preserves the author's meaning,
numbers and citations, and never invents sources, data or findings. Manual validation
scenarios are in [`evaluation/scenarios.md`](skills/academic-writing/evaluation/scenarios.md).

## Scientific Review Skill

[`skills/scientific-review`](skills/scientific-review/SKILL.md) reviews how a manuscript,
thesis chapter or set of sections holds together: alignment between question, methods,
results, discussion and conclusions, scope of claims, limitations, and consistency across
sections and numbers. It judges only the text provided, quotes its evidence, states which
sections it could not review, and gives no verdict on validity, no score and no acceptance
recommendation. Wording is left to the Academic Writing Skill and reference checking to
Citation Integrity. Validation scenarios:
[`evaluation/scenarios.md`](skills/scientific-review/evaluation/scenarios.md).

## Citation Integrity Skill

[`skills/citation-integrity`](skills/citation-integrity/SKILL.md) checks internal consistency
of visible citations, references and attribution in supplied materials: author-date and
numeric matching, ambiguous or missing matches, duplicates and scoped orphan references.
It distinguishes an internal match from actual claim support, comparing source passages
only when supplied. No external verification is available yet: no network lookup, DOI
existence certification, invented metadata or automatic misconduct accusations. Validation
scenarios: [`evaluation/scenarios.md`](skills/citation-integrity/evaluation/scenarios.md).

## Research Profile

A research profile is a YAML file declaring the context of a research project (discipline,
methodology, document type, language variant, citation style, voice, section conventions,
venue requirements, terminology) that the academic Skills follow when it is provided. It only
holds what the user states or confirms; an absent field means unknown, and the Skills then
use general conventions. The [Research Profile Skill](skills/research-profile/SKILL.md) creates
and updates profiles with the user's consent.

- Format: [`schemas/research-profile.schema.json`](schemas/research-profile.schema.json),
  described in [profile-format.md](skills/research-profile/references/profile-format.md).
- Example: [`profiles/default.yaml`](profiles/default.yaml).
- Real profiles: `profiles/local/`, ignored by Git. Never commit a real profile, and never
  store secrets or unneeded personal data in one.

## Status

Early development / architecture phase.
