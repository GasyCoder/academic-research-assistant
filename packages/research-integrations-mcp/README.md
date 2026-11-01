# Research Integrations MCP

Read-only Crossref, OpenAlex and Zotero metadata tools, and an optional local Vale linter,
behind a stdio MCP server separate from LanguageTool. Private workspace package, versioned
with the repository; nothing is published.

- Metadata tools send a request only when called with `networkConsent: true`, after an
  explicit verification request or an authorized, announced workflow. Ordinary reviews send
  nothing.
- Only identifiers or title/author/year are sent; never manuscript text.
- Each provider returns its own status, records, provenance and sanitized error.
  `not_found` is never evidence that a work does not exist, and metadata never proves that a
  source supports a claim.
- Credentials are operator environment variables, sent in headers only, never returned.
- No writes, scraping, automatic retries, `vale sync` or installation.

```sh
npm run build                                     # from the repository root
node packages/research-integrations-mcp/dist/index.js
npm run test --workspace @gasycoder/research-integrations-mcp       # fake servers only
npm run test:live --workspace @gasycoder/research-integrations-mcp  # opt-in, real providers
```

Tools, statuses, configuration, limits and the provider contracts:
[docs/research-integrations.md](https://github.com/GasyCoder/academic-research-assistant/blob/main/docs/research-integrations.md).
Scenarios: [docs/research-integrations-scenarios.md](https://github.com/GasyCoder/academic-research-assistant/blob/main/docs/research-integrations-scenarios.md).
