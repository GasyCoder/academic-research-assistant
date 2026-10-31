# Phase 8 independent audit — 2026-10-31

1. **Verdict: PASS WITH FIXES.** The announced implementation was not ready unchanged:
   independent inputs demonstrated defects despite its 35 passing tests. Fixes now pass
   61 format tests and the full repository check on Node 20 and 22. No demonstrated
   blocking defect remains within the documented read-only scope.

   Baseline: branch `feat/document-formats`, clean worktree, commits `708cd29` and
   `2bc2567` above `main` (`57d7f6e`). README, CLAUDE, AGENTS, architecture, roadmap,
   both format documents, all package files, the three integrating Skills, root manifest,
   lockfile and CI were inspected. The original diff and commit history were reviewed
   before modifications. This audit does not certify arbitrary TeX, full OOXML schema
   validity, a document writer, or external linguistic-service behavior.

2. **Architecture.** Formats handle reading, structure, locations, protection and mapping.
   No academic reasoning, researcher assumptions or discipline policy enters the readers.

3. **Package boundary.** `@gasycoder/document-formats` is independent of LanguageTool MCP.
   No MCP source, endpoint, tool definition or transport changed. Its ESM export supplies
   built JavaScript and declarations. It is private; a dry-run pack contains exactly ten
   `dist` files and `package.json`, with no fixtures or private material. No publication
   workflow was introduced.

4. **Actual formats.** Structured CommonMark/GFM reading, conservative lexical LaTeX
   inspection and structured UTF-8 OOXML DOCX reading. Explicit format takes priority over
   extension. ZIP bytes alone do not select DOCX; required parts/content type are checked.
   Ordinary ZIPs, missing parts and malformed packages fail. PDF is unsupported; there is
   no improvised extraction, conversion, rendering or round-trip support.

5. **Document model.** A small neutral core represents sections, units, protected spans,
   eligible segments, locations, metadata and coverage. Format-specific details live in
   metadata. Original Markdown/TeX units retain markup and citation keys; DOCX units retain
   supported decoded text and explicit non-prose markers. Snapshots are frozen.

6. **Source locations.** Text offsets address the decoded source string, not file bytes.
   DOCX coordinates address a part, supported paragraph path, run/text node and node-local
   UTF-16 range. These are reader-traversal coordinates, excluding opaque subtrees; they
   are not raw DOM ordinals, XPath or serialized-XML offsets. Identifiers belong to one
   snapshot/reader version and must be regenerated after edits.

7. **Coverage.** Caller scope (`complete`, `partial`, `unknown`) is separate from extraction
   status and omissions. Supplying only Methods does not imply extraction failure.
   Unsupported isolated features produce explicit omissions. DOCX always reports partial
   extraction because inheritance/layout are unresolved. Complete extraction is not proof
   of complete semantic interpretation.

8. **Markdown extraction.** Headings, hierarchy, lists, blockquotes, tables and footnotes
   remain structured. Table rows/cells are separate units. Empty frontmatter, leading
   string BOM and deep inline nesting required fixes. Malformed fences remain protected;
   incomplete links/tables and nested emphasis were counter-evaluated without crashes.

9. **Markdown protection.** Fences, inline code, destinations, image paths, definitions,
   frontmatter and HTML are withheld. YAML is opaque, including values. Numeric,
   author-year and Pandoc markers are conservatively protected without validation.
   Math scanning now ignores dollars inside existing exclusions. Citation recognition is
   heuristic and can conservatively withhold ordinary text.

10. **Markdown mapping.** Eligible segments are unchanged contiguous source slices.
    `This is **badly writen** text.` produces independently located excerpts, rather than
    one stripped string with invented global offsets. Mapping `reslts` inside `**reslts**`
    targets exactly those six source characters and preserves both pairs of asterisks.
    Link labels may be checked while their destinations remain protected.

11. **LaTeX extraction.** A bounded conservative scanner, not a TeX parser/compiler,
    recognizes literal headings and supported prose regions. Allowlisted formatting
    arguments such as `textbf`/`emph` may expose text; unknown commands stay opaque.

12. **LaTeX protection.** Commands, references, labels, citation keys/options, comments,
    inline/display math, equation/align and opaque environments stay outside prose.
    Braced brackets inside optional arguments and literal environment terminators inside
    supported verbatim constructs needed fixes. Escaped percent signs are distinguished
    from comments. Verbatim, listings and minted are never executed.

13. **Malformed/dynamic TeX.** Unclosed arguments, math or environments protect the
    affected remainder with partial coverage. Macro definitions, redefinitions,
    conditionals and catcode changes stop subsequent extraction. `makeatletter` and
    `makeatother` now stop extraction explicitly. Default control words use letters, so
    `@` works as an ordinary verbatim delimiter. Arbitrary package/macro behavior remains
    outside scope. The original commented-math, nested-environment and multiline-citation
    regressions are executable tests, not merely scenario claims.

14. **DOCX architecture.** Lazy ZIP traversal reads eight fixed allowlisted parts into
    bounded buffers; strict event-based XML parsing creates structure and text mappings.
    Package relationships cannot redirect which document parts are opened.

15. **ZIP security.** Archive size, entry count, declared per-entry/aggregate expansion and
    actual selected-stream lengths are bounded. Absolute, traversal, backslash and duplicate
    names are rejected; nothing is extracted to disk. Encrypted entries are rejected.
    There is no separate compression-ratio threshold: absolute expanded-size bounds and
    stream/declaration checks constrain bombs. Counter-tests rejected traversal, corrupt
    packages, missing parts and false size declarations. CRC/signature certification and
    full package schema validation are not provided.

16. **XML security.** DTDs raise `UNSUPPORTED_FEATURE`; strict entities, depth 256 and
    byte/text limits bound selected XML. Undefined entities and malformed XML fail with
    sanitized errors. There is no external resolver or network fetch. The synthetic
    external-entity fixture is refused rather than resolved.

17. **Paragraphs/runs.** Decoded paragraph text preserves visible run order. Prose segments
    stay within original text-node mappings; XML entities do not create fake byte offsets.
    URL/citation protection scans the whole unit, including sequences crossing runs.
    Graphemes crossing text nodes are withheld with an omission.

18. **Headings/lists/tables.** Literal `Heading 1`–`Heading 6` style ids are recognized;
    arbitrary custom styles/inheritance and visual layout are unresolved. Outline levels
    are not a general heading resolver. List numbering ids/levels are metadata, not rendered
    numbers. Tables retain rows, cells, paragraph paths and header flags, including empty
    cells and Unicode. Historical paragraph styles no longer create false headings.

19. **Hyperlinks.** Display text may be eligible; targets remain descriptive metadata and
    are never opened. Relationship ids now resolve against the owning main/footnote/endnote
    part, avoiding collisions between independently scoped ids.

20. **Notes/captions.** Fixed footnote/endnote parts and reference markers are supported;
    missing note content is reported. Recognizable literal Caption styles/prefixes are
    supported, without universal caption inference. Bookmark markers now preserve numeric
    prefix protection. Undecoded hyphens/symbols retain protected markers and an omission.
    Core metadata is limited to title, subject and language, retained as non-prose units;
    author, last-modifier, usernames and machine properties are not exposed by this reader.

21. **Tracked changes/comments/fields.** Insertions/deletions, moves and controls are opaque
    with coverage limitations; the reader does not resolve revisions. Historical property
    records no longer override current hidden/style state and add no visible characters.
    Comment bodies are uninspected, reference markers protected. Field instructions and
    field results are protected; citations, TOC and cross-references are not reconstructed.

22. **Read-only guarantee.** No writer, apply operation or serialization API exists.
    Replacement proposals always contain `applied: false`. Readers do not modify input
    bytes. A future writer would require separate revision, escaping and preservation work.

23. **Stale-location protection.** SHA-256 revisions bind findings to supplied content.
    Revision mismatches are refused; a WeakMap authenticates in-memory snapshots. Forged or
    JSON-deserialized documents cannot authorize mappings. Re-read after source changes;
    this content-only API cannot observe changes in a file it never opens.

24. **Source mapping.** Segment identity, integer bounds and exact source locality are
    checked. A caller cannot extend a valid segment across intervening protected syntax.
    Protected conflict attempts, markup-preserving replacements and stale snapshots were
    exercised. No direct application of a flattened-text diagnostic is supported.

25. **UTF-16/Unicode.** BMP, surrogate pairs, emoji, combining marks and extended grapheme
    boundaries were checked. Interior grapheme offsets are rejected. No normalization is
    performed. LF/CRLF mappings preserve their own source indices. String BOM remains
    protected source; byte input follows strict UTF-8 decoding/BOM handling. Malformed UTF-8
    and lone surrogates fail explicitly.

26. **LanguageTool boundary.** Readers make no LanguageTool call. The caller submits exact
    segment text and retains revision/segment identity before mapping diagnostic offsets.
    The 40,000-unit segment limit fits the existing check_text limit. No real LanguageTool
    service or manuscript transmission was invoked during this audit.

27. **Academic Writing integration.** Contract-only guidance preserves original units,
    context, locations, protections and coverage; only eligible segments go to LT. Manual
    review remains available when extraction/mapping is unavailable.

28. **Scientific Review integration.** Structure, headings, tables and coverage support
    evidence-bound review. The reader remains optional; plain-text review still works.

29. **Citation Integrity integration.** It explicitly inspects original units, notes and
    markers rather than only LT prose. Protected citation keys therefore remain available
    for inventory. Extraction does not certify reference existence or claim support.

30. **Resource limits.** Text: 2,000,000 UTF-16 units for strings, 2,000,000 bytes for raw
    text bytes, with decoded text also checked. DOCX: 20 MiB archive, 2,000 entries, 8 MiB
    per entry, 40 MiB total declared expansion and 2,000,000 aggregate extracted text units.
    Units/segments: 50,000 each; segment: 40,000; XML/Markdown traversal depth: 256.
    Limit violations fail explicitly or, for traversal withholding, report an omission.
    Core metadata now consumes the same aggregate text budget as body/notes.

31. **Error model.** Distinct used codes: `INVALID_INPUT`, `UNSUPPORTED_FORMAT`,
    `MALFORMED_DOCUMENT`, `EXTRACTION_FAILURE`, `UNSUPPORTED_FEATURE`, `LIMIT_EXCEEDED`,
    `STALE_LOCATION`. Safe isolated unsupported features may instead yield omissions.
    Messages contain fixed diagnostic text, without XML/manuscript excerpts or local paths.

32. **Dependencies/security.** The five runtime dependencies are
    `mdast-util-from-markdown` 2.1.0, `mdast-util-gfm` 3.1.0,
    `micromark-extension-gfm` 3.0.0, `yauzl` 3.4.0 and `sax` 1.6.1 in the inspected lock.
    Each serves AST/GFM, lazy ZIP or strict XML parsing. Existing dependency versions were
    not changed by Phase 8; the audit adds no dependency. Both npm audits return zero
    vulnerabilities. This is registry evidence at audit time, not a guarantee of absence
    of dependency defects.

33. **Node 20.** Node 20.20.2, npm 10.8.2: normal `npm run check` completed with exit 0,
    including build and the package-install smoke test; no offline bypass.

34. **Node 22.** Node 22.16.0, npm 11.11.0: normal `npm run check` completed with exit 0
    against the final code. Both runtimes used the same source and installed dependency tree.

35. **Scenarios.** The scenario document records audit inputs and corrections separately
    from the original author evaluation. A 2,000,000-unit Markdown probe returned one unit,
    fifty segments and complete supported extraction; one extra character failed with
    `LIMIT_EXCEEDED`. Observed time was 2,002 ms for reading, 2.29 s process elapsed and
    213,176 KiB peak RSS (about 208 MiB), including the TypeScript loader. This is one local
    workload observation, not a general performance guarantee.

36. **Independent counter-evaluation.** New synthetic inputs, plus two separate read-only
    reviewers, exercised A–L: emphasis mapping, URL protection, TeX citation/math, malformed
    TeX, ZIP traversal, DTD/entities, multi-run prose, tables, Unicode mapping, stale
    locations, resource bounds and unsupported PDF. Follow-up replays tested hidden styles,
    note-local relationships, caption bookmarks, cross-run graphemes and literal TeX
    terminators. All final replays passed. The initial new suite failed 16 assertions while
    the original 35 tests passed; the final 26 added tests cover fixes and follow-up variants.

37. **Privacy/network/execution.** The 18 original Phase 8 files and three new test files
    were scanned for the requested private names, paths, emails, phones and credential
    patterns: none found. Fixtures are synthetic. Manual import/call inspection found no
    runtime disk I/O, network client, external entity resolver or subprocess/TeX execution;
    regular-expression `.exec` calls are not command execution. Development npm audits and
    normal packaging checks use the network; parsing does not. No research document or
    credential was committed.

38. **Demonstrated findings.** All are resolved. HIGH below denotes protected material
    incorrectly becoming eligible for a caller's linguistic check, with privacy/content
    integrity impact; no execution, actual transmission or automatic write was demonstrated.

    | Severity/id | Reproduction and impact | Resolution |
    | --- | --- | --- |
    | HIGH H1 | Dollars inside Markdown code/destinations paired with real math delimiters, exposing math as prose | Ignore existing exclusions when scanning delimiters |
    | HIGH H2 | `cite[see {]}]{synthetic-key}` ended an optional argument early, exposing the key | Honor braced groups in square arguments |
    | HIGH H3 | Literal outer terminators inside verbatim closed opaque environments early; `verb@...@` exposed code | Skip supported literal constructs; default letter control words |
    | HIGH H4 | Historical `vanish=0` overrode current hidden properties, exposing hidden text | Skip historical property subtrees without visible markers |
    | MEDIUM M1 | Empty YAML frontmatter withheld valid following prose as unclosed | Recognize immediate closing delimiter |
    | MEDIUM M2 | Leading string BOM shifted Markdown classification/source positions | Retain protected BOM and correct parser base |
    | MEDIUM M3 | Deep inline emphasis caused recursive extraction failure | Iterative bounded traversal and explicit omission |
    | MEDIUM M4 | Footnote/endnote ids used main-document relationship targets | Scope relationship maps per owning part |
    | MEDIUM M5 | Three individually bounded metadata fields exceeded the aggregate text budget | Count metadata in shared budget |
    | MEDIUM M6 | Word hyphen/symbol elements silently disappeared | Protected markers, descriptive metadata and coverage |
    | MEDIUM M7 | Bookmark markers bypassed caption-prefix protection | Permit markers in prefix spacing |
    | LOW L1 | DOCX coordinate wording could be mistaken for raw DOM indices | Document supported-reader traversal and forbid direct XML patching |

    H4 also fixes demonstrated historical-heading misclassification. Follow-up tests caught
    visible-marker interference with captions/graphemes before the final correction. L1 is
    documentation precision, not evidence that an eligible source slice mapped incorrectly.

39. **Exact final validation results.** Counts are the same on both runtimes. Commands
    below ran through the ordinary `check` pipeline; format tests also ran directly.

    | Check | Result |
    | --- | --- |
    | `npm run validate:skills` | 14 passed, 0 failed/skipped; validator passed |
    | `npm run validate:profiles` | 27 passed, 0 failed/skipped; validator passed |
    | `npm run validate:disciplines` | 11 passed, 0 failed/skipped; validator passed |
    | `npm run typecheck` | Both workspaces passed |
    | `npm run test --workspace @gasycoder/document-formats` | 4 files, 61 passed, 0 skipped |
    | `npm test` | Formats 61 passed; MCP 247 passed, 9 skipped: 308 passed, 9 skipped total |
    | Repository test files | 18 passed, 1 skipped: 19 total |
    | `npm run build` | Both workspaces passed |
    | `npm run check` | Exit 0 on Node 20.20.2 and 22.16.0 |
    | `npm run pack:check` | MCP tarball: expected 17 files; installed binary starts, four tools, check_text/check_document smoke tests pass |
    | Formats `npm pack --dry-run --json --ignore-scripts` | Expected 11 files; no publishing or archive creation |
    | `git diff --check` | Passed |
    | `npm audit` | Exit 0; 0 vulnerabilities in all severity categories |
    | `npm audit --omit=dev` | Exit 0; 0 vulnerabilities in all severity categories |

    Nine skipped MCP tests belong to the real-service integration suite; that service was
    not started. These are not nine skipped format tests. Original baseline check was also
    reproduced before fixes. Local raw logs were kept outside the repository.

40. **Files changed during audit.** Modified: `packages/document-formats/src/model.ts`,
    `markdown.ts`, `latex.ts`, `docx.ts`; `docs/document-formats.md` and
    `docs/document-formats-scenarios.md`. Created: the three package tests
    `markdown-audit.test.ts`, `latex-audit.test.ts`, `docx-audit.test.ts`, and this report.
    No manifest, dependency lock, MCP implementation or Skill change was needed by the audit.

41. **Commits.** `75ae34f` — `fix(formats): harden protected extraction and source boundaries`;
    the documentation commit containing this report —
    `docs(formats): record independent audit results and guarantees`.
    No push, merge or tag was performed.

42. **Final Git state.** Handoff after committing this report: clean worktree on
    `feat/document-formats`, two implementation commits plus two audit commits above main.
    The final user-facing handoff records the observed status and documentation commit hash.

43. **Merge conclusion.** Phase 8 ready to merge into main: YES

44. **Phase 9 recommendation.** Review and merge the audited branch through the normal
    maintainer process, then scope external metadata integrations separately, with explicit
    network/consent boundaries, synthetic provider tests and preserved source provenance.
    No Phase 9 implementation, Crossref/OpenAlex/Zotero integration or document writer was
    started. Remaining limitations are conservative TeX interpretation, incomplete Word
    style/layout/revision resolution, bounded-resource costs near maximum input and lack
    of live LanguageTool integration validation in this audit; none is concealed as full
    support or a read/write guarantee.
