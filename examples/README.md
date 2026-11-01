# Synthetic example workflow

Fixtures here are not verified sources or a real project. Start with `npm ci && npm run build`.

1. Optionally copy [minimal.yaml](profiles/minimal.yaml) or [complete.yaml](profiles/complete.yaml)
   to an identified file in ignored `profiles/local/`. Declare only known context; validate
   with `npm run validate:profiles -- profiles/local/example.yaml`. The complete example
   exercises several sections, not every optional schema field. It selects no discipline.
2. Run `node examples/read-document.mjs`. It reads [manuscript.md](manuscript.md), protects
   markup/citations/code and maps `reslts` to an unapplied `results` proposal. No provider,
   model or LanguageTool is called. Never reuse flattened offsets for DOCX.
3. In a [configured host](../docs/client-setup.md), request Academic Writing clarity review
   or Scientific Review of supplied claims/evidence. State profile path and section coverage.
4. Ask Citation Integrity to compare marker [1] with the synthetic bibliography. Internal
   correspondence establishes neither real-world existence nor claim support.
5. Optionally authorize a specific real reference check. Send only minimal bibliographic
   fields with networkConsent=true. Do not look up the fixture as if it were real. Keep
   provider provenance/status separate and retain ambiguity/coverage limits.

Both YAML files are validated by `npm run validate:distribution`. The mapping pattern also
runs against an independently installed tarball. Real profile writes require an identified
request/target; examples are not authorization to store private data.
