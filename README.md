# Academic Research Assistant

Open-source toolkit for AI-assisted academic writing and scientific manuscript review.

The project aims to provide reusable tools and skills for researchers, PhD students, academics, and scientific authors across multiple disciplines.

## Architecture

The project separates:

- **MCP tools** — deterministic technical capabilities such as linguistic analysis.
- **Academic Skills** — contextual reasoning for scientific writing, methodology, citations, document types, and disciplines.
- **Research Profiles** — dynamic project-specific configuration without hard-coding a research topic.

## Initial components

Planned initial components:

- LanguageTool MCP server
- Academic Writing Skill
- Scientific Review Skill
- Research Profile Skill
- Citation Integrity Skill

## LanguageTool MCP server

`packages/languagetool-mcp` is a stdio MCP server for a locally installed LanguageTool
instance. It exposes four tools: `health_check`, `get_supported_languages`, `check_text`
(texts up to 50,000 characters) and `check_document` (longer documents up to 100,000
characters, checked part by part with bounded results). It returns structured diagnostics
and never rewrites text.

```bash
npm install
npm run build
LANGUAGETOOL_BASE_URL=http://127.0.0.1:8081 node packages/languagetool-mcp/dist/index.js
```

Configuration (`LANGUAGETOOL_BASE_URL`, `LANGUAGETOOL_TIMEOUT_MS`), tool reference and
client setup: see [packages/languagetool-mcp/README.md](packages/languagetool-mcp/README.md).

## Status

Early development / architecture phase.
