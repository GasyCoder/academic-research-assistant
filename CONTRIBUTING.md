# Contributing

Licence selection is pending. Do not assume an MIT/Apache grant or publish/relicense this
repository. The owner must resolve that before a distributable release.

Use a focused branch from main, preserve unrelated work and keep commits atomic. Read
README, CLAUDE, AGENTS and docs/architecture before code changes. Install with `npm ci`
on a tested Node 20/22 full-ICU build, then `npm run check`. Standard tests need no Java/key;
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
