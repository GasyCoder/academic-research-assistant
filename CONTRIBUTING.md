# Contributing

This repository uses the owner-approved [Apache-2.0 licence](LICENSE). Preserve licence and
[third-party notices](docs/third-party-notices.md); publication still needs explicit approval.

Use a focused branch from main, preserve unrelated work and keep commits atomic. Read
README, CLAUDE, AGENTS and docs/architecture before code changes. Install with `npm ci`
on an official full-ICU Node 22 build, version 22.12 or later, then `npm run check`.
Node 20 compatibility checks pass with an `EBADENGINE` warning, but the locked Vitest 5
does not support Node 20 and strict-engine development installation fails. See the
[audit finding](docs/distribution-audit.md#development-toolchain-node-20) before changing
the toolchain or its supported versions. Standard tests need no Java/key;
tarball checks use npm, not live providers.

Keep infrastructure, linguistic engines, reasoning, formats and profiles separate. Validate
inputs, sanitize errors, preserve compatibility and test meaningful behavior/security changes.
Follow existing TypeScript/ESM style; avoid unnecessary dependencies/reformatting. Skills need
valid frontmatter, links and behavioral scenarios; profiles need schema/validator tests and
synthetic examples. Preserve meaning and absence-not-nonexistence rules.

Before proposing a change:

- Run `npm run check`, `git diff --check`, `npm audit` and `npm audit --omit=dev`.
- For runtime/packaging changes repeat check on Node 20/22 and inspect tarballs.
- Use fake services/executables; keep live checks opt-in and disclose coverage limits.
- Document contract/config changes and update CHANGELOG's Unreleased section.
- Report changed files, tests/results and unresolved risks in the handoff/PR.

Never commit documents, secrets, real profiles, tarballs or logs. For sensitive issues use
[SECURITY](SECURITY.md); do not publish private data/exploit details. No Code of Conduct has
been adopted: a standard text and moderation/contact process remain an owner/community
improvement, not an invented enforcement policy.
