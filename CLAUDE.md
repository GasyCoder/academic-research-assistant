# Claude Code Project Instructions

## Project

Academic Research Assistant is a generic public research toolkit licensed under Apache-2.0,
explicitly selected by its owner. Packages remain private; licence adoption does not authorize publication.

It must remain reusable across:

- disciplines;
- universities;
- research topics;
- methodologies;
- document types;
- languages.

Never hard-code rules specific to a single researcher or thesis.

## Architectural principle

Keep a strict separation between:

1. MCP technical tools
2. Academic Skills
3. Dynamic research profiles

### MCP

MCP servers provide deterministic technical capabilities.

The LanguageTool MCP must not contain academic-domain reasoning.

It must not know about:

- thesis structure;
- APA;
- IEEE;
- disciplines;
- research methodologies;
- specific universities;
- specific research topics.

### Skills

Skills provide academic reasoning and contextual guidance.

They may interpret:

- discipline;
- methodology;
- document type;
- academic language;
- citation style;
- journal requirements;
- research profile.

### Research profile

Project-specific research information must be dynamic and configurable.

Do not hard-code researcher-specific information into reusable Skills.

## Development principles

- Prefer modular architecture.
- Prefer small focused commits.
- Add tests for implemented behavior.
- Avoid unnecessary dependencies.
- Do not invent citation or DOI data.
- Preserve scientific meaning when reviewing text.
- Do not silently modify research data.
- Never commit secrets.
- Do not push to GitHub unless explicitly requested.

## Current phase

Phases 0–10 are implemented and audited. Owner-authorized 0.4.0 release preparation and gates are documented
in docs/distribution.md; do not infer permission to publish, tag or choose a licence.

Before implementing a feature:

1. inspect the existing repository;
2. understand current architecture;
3. verify relevant official documentation when API or protocol versions matter;
4. implement the smallest coherent change;
5. run relevant tests and validation;
6. commit atomically.
