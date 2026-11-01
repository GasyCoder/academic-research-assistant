# Third-party licences and notices

The owner explicitly selected Apache-2.0 for Academic Research Assistant. The repository
[LICENSE](../LICENSE) is the unmodified official Apache License 2.0 text, retrieved from
the [Apache Software Foundation](https://www.apache.org/licenses/LICENSE-2.0.txt).
The same bytes are present in each workspace LICENSE and required in its tarball. Root,
workspace and Claude plugin metadata use SPDX identifier `Apache-2.0`. Private package
flags remain true; licence adoption does not publish a package.

## Runtime dependency review

| Direct dependency | Licence in the lockfile |
| --- | --- |
| @modelcontextprotocol/server, with transitive @modelcontextprotocol/core | Apache-2.0 |
| zod | MIT |
| mdast-util-from-markdown, mdast-util-gfm, micromark-extension-gfm | MIT |
| yauzl | MIT |
| sax | BlueOak-1.0.0 |

The current third-party runtime lock inventory contains 62 MIT, two Apache-2.0 and one
BlueOak-1.0.0 entry, with no missing licence metadata. Runtime dependencies are separate
npm packages, not vendored or bundled inside our three tarballs. Their installed packages
retain their upstream licence files. Vitest is a MIT-licensed development dependency and
does not enter runtime installations.

No obvious restrictive licence conflict was identified in this inventory. This review does
not relicense third-party code or certify all future redistribution arrangements. Preserve
MIT copyright/permission notices; preserve Apache licence/attribution and applicable upstream
NOTICE text; retain sax's Blue Oak text or licence link. Conditions are in the
[Apache redistribution terms](https://www.apache.org/licenses/LICENSE-2.0),
[MIT text](https://opensource.org/license/mit) and
[Blue Oak notices](https://spdx.org/licenses/BlueOak-1.0.0.html).

No upstream NOTICE file was found in the installed MCP core/server package roots. No
third-party code or notices were copied into project source, so no invented aggregate NOTICE
is added. Reinspect licences and notices whenever dependencies or distribution surfaces
change, particularly before distributing an offline bundle or vendored dependencies.

LanguageTool, Java and Vale are installed separately and not redistributed by this project.
Their own distribution licences remain the operator's responsibility. Documentation links
to external services do not confer a licence to their data or terms of service.
