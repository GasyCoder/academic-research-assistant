# Agent Development Guidelines

This repository may be developed by multiple AI coding agents.

## General rules

Before modifying code:

1. Read README.md.
2. Read CLAUDE.md.
3. Read docs/architecture.md.
4. Inspect git status and recent commits.
5. Do not overwrite unrelated work.

## Git

Use small, atomic commits.

Do not combine unrelated changes in one commit.

Do not push changes unless explicitly authorized.

## Architecture

Maintain separation between:

- MCP infrastructure;
- linguistic engines;
- academic Skills;
- research profiles;
- discipline-specific extensions.

Do not introduce researcher-specific assumptions into reusable components.

## Quality

For every implementation:

- validate inputs;
- handle errors explicitly;
- add or update tests;
- preserve backward compatibility when applicable;
- avoid unnecessary dependencies;
- document non-obvious architectural decisions.

## Security and privacy

Academic manuscripts may contain unpublished research.

Therefore:

- prefer local processing where practical;
- never log entire manuscripts by default;
- never expose secrets;
- never commit research documents or credentials;
- make external network use explicit.

## Handoff

At the end of each task, report:

- files created;
- files modified;
- tests executed;
- test results;
- commits created;
- unresolved risks;
- recommended next step.
