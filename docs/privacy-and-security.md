# Privacy and tested threat boundaries

Manuscripts may contain unpublished or personal data. Local parsing/read-only tools reduce
risk; they do not make an AI host or arbitrary executable trusted. Decide what to supply.

| Operation | Data boundary |
| --- | --- |
| Skills in an AI host | Supplied passages/context are visible to that host under its data policy; local tooling does not imply an offline model |
| Research/Discipline Profiles | Local declared context; real profiles belong in ignored profiles/local or another private path |
| Document Formats | Local strings/bytes; no fetch, writer or TeX execution |
| LanguageTool MCP | Exact prose goes to the configured URL; loopback by default, remote if changed |
| Crossref/OpenAlex | Explicitly authorized minimal identifier/title/author/year; no automatic manuscript upload |
| Zotero | Selected read-only web/local requests; private metadata remains user data and is never cached here |
| Vale | stdin to a trusted local binary/config; no shell or manuscript temp files |

Do not log/commit manuscripts, keys or real profiles. Hosts may log tool requests/results
despite sanitized tool errors. Known configured key/contact echoes are redacted, including
nested percent encoding; this does not detect every possible secret or encrypted form.
Passing a scan is not permission to publish private content.

Tested controls include bounded HTTP/body/stdio output, timeouts, safe redirects/cooldowns,
fixed provider destinations, DOCX ZIP traversal/size and XML DTD/entity/depth protection,
protected syntax, authenticated snapshot/UTF-16/grapheme mapping, no TeX execution and
shell-free Vale spawn with minimal environment. These synthetic tests are not universal
security certification. Full XML schema/CRC/signatures and a writer are out of scope.
Vale binary/config/rules are trusted operator inputs, not sandboxed code.

Ordinary review does not authorize metadata lookup. `networkConsent` is checked before
cache/network but records a caller choice, not proof of human consent. Document, provider
and source-content evidence remain distinct. A missing record is not fabrication, and
metadata alone cannot establish claim support.

See [SECURITY](../SECURITY.md), [configuration](configuration.md),
[format limits](document-formats.md#limits-errors-and-security) and
[integration limits](research-integrations.md#transport-limits-and-secrets).
