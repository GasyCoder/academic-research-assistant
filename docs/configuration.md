# Configuration reference

Settings are operator environment variables. No package automatically loads `.env`.
The LanguageTool `.env.example` is a reference, not a loader. Set values in the process/MCP
host. Leave optional integration variables **unset**, rather than empty; empty keys fail
validation. Never store keys in Research/Discipline Profiles or Git.

## Runtime settings

| Variable | Package | Purpose/default | Required | Sensitive |
| --- | --- | --- | --- | --- |
| LANGUAGETOOL_BASE_URL | LanguageTool | HTTP(S) endpoint; http://127.0.0.1:8081 | No | No; can reveal internal address |
| LANGUAGETOOL_TIMEOUT_MS | LanguageTool | Timeout 1–300000 ms; 30000 | No | No |
| ARA_INTEGRATIONS_TIMEOUT_MS | Integrations | HTTP/Vale timeout 100–60000 ms; 10000 | No | No |
| ARA_INTEGRATIONS_RESPONSE_BYTES | Integrations | 1024–8388608 bytes; 2097152 | No | No |
| ARA_INTEGRATIONS_CACHE_TTL_MS | Integrations | Public cache 0–300000 ms; 60000 | No | No |
| ARA_CROSSREF_CONTACT | Integrations | Polite-pool email; unset | No | Personal contact; protect as config |
| ARA_OPENALEX_API_KEY | Integrations | Bearer key; unset | No for basic use | Yes |
| ARA_ZOTERO_API_KEY | Integrations | Private Web API read key; unset | Private web reads only | Yes |
| ARA_ZOTERO_LOCAL | Integrations | Fixed loopback API; 0 | 1 opts in | No |
| ARA_VALE_PATH | Integrations | Absolute trusted installed executable; unset | Vale only | No; local path |
| ARA_VALE_CONFIG | Integrations | Absolute trusted config; unset | Vale only | No; local path |

Document Formats has no env settings or network I/O. Profiles hold academic context, not
infrastructure. Timeout covers streaming; integration queue/initial pacing is additional.
Allow overhead in the calling host's timeout. Contracts:
[LanguageTool](../packages/languagetool-mcp/README.md#configuration) and
[Integrations](research-integrations.md#configuration). Integration base URLs cannot be set
by tools/env; fake-server injection is an internal test seam. Keys/cache never replace consent.

## Opt-in test controls

| Variable | Scope/default | Sensitive |
| --- | --- | --- |
| LANGUAGETOOL_INTEGRATION | Real LanguageTool tests; unset/skipped, set by root test:integration | No |
| ARA_LIVE_INTEGRATIONS | Public metadata smoke tests; unset/skipped, set by package test:live | No |
| ARA_LIVE_ZOTERO_LIBRARY_ID | Private live user library; unset/skipped | User-specific id |
| ARA_LIVE_ZOTERO_ITEM_KEY | Private live item; unset/skipped | User-specific id |

```sh
npm run test:integration
npm run test:live --workspace @gasycoder/research-integrations-mcp
```

The first needs a real configured LanguageTool. The second explicitly sends a public DOI
to Crossref/OpenAlex; its private Zotero case also needs the key and chosen library/item.
None is required by ordinary tests/CI. Vale tests use fake executables; real Vale is an
operator-run optional check, not a separate automated live suite. Do not enable live flags
in routine CI.
