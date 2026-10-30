# Architecture

## Core principle

Academic Research Assistant separates technical capabilities from academic reasoning.

```text
AI Client
   |
   +-- Academic Skills
   |      |
   |      +-- Academic Writing
   |      +-- Scientific Review
   |      +-- Research Profile
   |      +-- Citation Integrity
   |
   +-- MCP Tools
          |
          +-- LanguageTool MCP
                 |
                 +-- Local LanguageTool Server

---

# 10. Roadmap

```bash
cat > docs/roadmap.md <<'EOF'
# Roadmap

## Phase 0 — Foundation

- Repository structure
- Architecture documentation
- Agent guidelines
- Development conventions

## Phase 1 — LanguageTool MCP

Implement minimal MCP server with:

- health_check
- get_supported_languages
- check_text

## Phase 2 — MCP quality

- unit tests
- integration tests
- error handling
- structured responses
- local LanguageTool configuration

## Phase 3 — Academic Writing Skill

Generic scientific writing guidance.

## Phase 4 — Research Profile

Dynamic configuration for:

- discipline
- methodology
- document type
- language
- citation style

## Phase 5 — Scientific Review

Structured manuscript review.

## Phase 6 — Citation Integrity

Reference and citation safeguards.

## Phase 7 — Discipline Profiles

Optional discipline-specific extensions.

## Phase 8 — Document Formats

Potential support for:

- Markdown
- LaTeX
- DOCX

## Phase 9 — Research ecosystem integrations

Potential integrations:

- Zotero
- Crossref
- OpenAlex
- DOI validation
- Vale

## Phase 10 — Distribution

- documentation
- examples
- CI
- release process
- MCP distribution
- Claude Code plugin packaging
