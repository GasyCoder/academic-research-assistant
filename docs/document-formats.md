# Document Formats — read-first contract

`packages/document-formats` is a local library for inspecting supplied Markdown, LaTeX and
DOCX content. It exposes structure, protected source material, prose segments and locations.
It performs no academic reasoning, citation validation, external retrieval, rendering or
document writing. LanguageTool MCP remains separate and unchanged. No document MCP endpoint,
CLI, PDF support, conversion pipeline or automatic tool orchestration is added in Phase 8.

## API and model

After `npm run build`, callers can import `@gasycoder/document-formats` in this workspace:

```js
import { readDocument, proposeReplacement } from '@gasycoder/document-formats';

const source = '# Methods\n\nThe **reslts** are visible [3].';
const document = await readDocument(source, {
  format: 'markdown',
  scope: { kind: 'partial', notProvided: ['Results', 'Bibliography'] }
});
const segment = document.segments.find(s => s.text.includes('reslts'));
const proposal = proposeReplacement(document, {
  revision: document.revision,
  segmentId: segment.id,
  offset: segment.text.indexOf('reslts'), // representative diagnostic in submitted text
  length: 6
}, 'results');
// proposal.applied === false; neither source nor any file is changed.
```

`readDocument(input, options)` takes a string or UTF-8 bytes for text formats, and ZIP bytes
for DOCX. `options.format` wins over the optional filename extension (`.md`, `.markdown`,
`.tex`, `.docx`). Without an explicit format or recognised extension it fails with
`UNSUPPORTED_FORMAT`; a signature or a few characters never silently select a format.
The filename is an extension hint only: no file is opened, resolved or written.

| Model field | Contract |
| --- | --- |
| `modelVersion: 1` | Version of this minimal format-independent model |
| `format`, `revision` | Selected format and SHA-256 fingerprint of the exact supplied content |
| `sections` | Ordered headings with level, title and parent section id |
| `units` | Ordered structural blocks for text formats, plus separately retained LaTeX notes; DOCX containers precede their contents |
| `unit.text` | Original source slice for text formats; decoded visible text for DOCX, with object markers for non-prose elements |
| `unit.location` | Part, structural path, section ancestry, and source range where available |
| `unit.protected` | Unit-local UTF-16 regions excluded from prose submissions; overlapping exclusions may be merged |
| `unit.metadata` | Format-dependent visible markers, style/run information, identifiers or relationship targets; never inferred academic facts |
| `segments` | Eligible contiguous prose excerpts, each tied to one unit and one source range or DOCX text node |
| `coverage` | Input completeness declared by caller, extraction omissions, and material explicitly not provided |

Units include headings, paragraphs, lists/items, quotes, tables/rows/cells, notes, captions,
metadata and protected blocks where the source supplies that structure. A References heading
is exposed like any other heading; entry identification and matching remain Citation
Integrity's work. Citation-like markers are protected conservatively, not classified as
genuine citations. Titles may retain inline source markup or LaTeX commands.

IDs such as `section:2`, `unit:5` and `segment:8` are deterministic for the same input and
reader version. They are working identifiers, not permanent document annotations. Structural
paths retain list, table-cell or note origin. Reparse after any edit; identifiers need not
survive reordering, changed content or parser upgrades. Keep the original source separately.

## Coverage

`scope.kind` is `complete`, `partial` or `unknown` (default). It describes the input supplied,
not whether the review covered the entire manuscript. `coverage.extraction` is `complete`
or `partial`; omissions describe uninspected features, not scientific defects. “Complete”
means the supported extraction finished without a reported omission, never semantic
completeness or proof that all possible source constructs were understood.

Report sections actually reviewed, skipped units/parts, `notProvided`, extraction omissions
and source-content limitations. Protected material retained in a unit is available for
read-only inspection, but never automatically suitable for a prose checker. DOCX style
inheritance/layout are explicitly unresolved, so its coverage is always partial. TeX fragments
without an active document boundary and protected environments also report limitations.
Do not turn an orphan reference within extracted sections into a whole-manuscript verdict.

## Supported source features and protection

| Format | Available | Deliberate limits |
| --- | --- | --- |
| Markdown | CommonMark headings/paragraphs, ordered and unordered lists, blockquotes, emphasis, links, code, images; GFM tables and footnotes; leading YAML frontmatter retained as opaque source | No rendering; no frontmatter interpretation; encoded/escaped text without one-to-one mapping is withheld from prose; captions and bibliography entries are not inferred |
| LaTeX | Literal section/subsection/subsubsection hierarchy, source paragraphs, common braced commands and citation variants, refs/labels, comments and math protection | No TeX engine, macro expansion, includes or BibTeX parser; conditional/dynamic TeX stops further prose extraction conservatively; malformed regions may protect the remainder |
| DOCX | Standard UTF-8 OOXML main document, literal heading/caption style ids, paragraph text nodes, direct bold/italic/superscript style metadata, numbering ids/levels, table rows/cells/header flags, hyperlink targets, footnotes/endnotes, selected core metadata | No style inheritance or numbering-label rendering, custom-style resolution, layout, images, comments bodies, revision resolution, macros, arbitrary parts or write-back |

Markdown code fences, inline code, URLs/destinations, image paths, reference definitions,
frontmatter and raw HTML are excluded from prose. An inline HTML-containing paragraph is
withheld as a whole. Link labels may be prose. Numeric markers, author-year parentheses,
year parentheses and Pandoc `[@key]` syntax are retained and excluded conservatively.
This heuristic can withhold ordinary bracketed numbers; it does not find every possible
citation convention. Math protection is conservative, not a Markdown math renderer.
Dollar signs inside already protected code or destinations do not delimit surrounding math.
Empty YAML frontmatter is valid; inline as well as block nesting is bounded during traversal.

LaTeX citation keys (`cite`, `citep`, `citet`, `parencite` and related braced variants), refs,
labels, commands and arguments remain source. Only a small allowlist of formatting commands
exposes their text arguments; command delimiters stay protected. `$...$`, `$$...$$`,
`\(...\)`, `\[...\]` and opaque environments are excluded. `document`, `abstract`,
`itemize`, `enumerate` and `quote` permit prose, with environment delimiters retained as
protected markers. List items are not reconstructed as a complete TeX AST.

Figure, table, equation, align, verbatim, listing, minted and unknown environments are
opaque. Their source—including captions and labels—is retained for manual inspection.
Standalone braced footnotes and captions have separate protected source units; their
contents are not automatically submitted as prose. Comments and preamble/post-document
content are excluded. Explicit macro definitions/redefinitions (`def`, `let`, `newcommand`,
`renewcommand` and related forms), conditionals and catcode changes withhold all subsequent
input as protected source, even when they occur in a preamble. This prevents later calls to
redefined formatting commands from being treated as ordinary visible prose. Such documents
need manual review of the withheld source. Packages and arbitrary macro-generated syntax
are not interpreted; never claim exhaustive active-text recognition for arbitrary TeX.
Optional arguments respect brace-grouped brackets. Opaque environment scanning skips literal
terminators inside supported verbatim constructs. Control words use default letter catcodes;
`makeatletter`/`makeatother` conservatively stop extraction rather than changing tokenization.

DOCX visible text is split by original run/text-node boundaries. Direct formatting metadata
is descriptive; inherited or theme formatting is not resolved. Fields and instruction text,
hidden runs, bookmarks, note/comment markers, tracked changes, structured content controls,
drawings and equations are withheld or represented by object markers. Hyperlinks are never
followed. Caption numeric prefixes are protected when recognisable; field-generated numbers
remain protected fields. Graphics content is not analysed. Unread parts and missing note
content produce coverage limitations. No external part or linked resource is fetched.
Historical property-change records never override current styles or add visible characters.
Note relationship ids resolve in their own part, not against main-document relationships.
Special-character elements that are not decoded retain protected object markers and an
explicit omission. Core metadata shares the aggregate extracted-text budget with body/notes.

## Mapping and proposals

Only `segment.text` is eligible for LanguageTool; do not concatenate it with another
segment and reuse the original offsets. Segments are at most 40,000 UTF-16 code units,
below `check_text`'s 50,000-unit limit. Every diagnostic remains relative to the exact
submission. This layer neither calls LanguageTool nor retries it.

For Markdown/LaTeX a segment is an unchanged contiguous source slice: markup removal
never creates an invented global mapping. Units and segment ranges index the decoded string
in UTF-16, not UTF-8 file bytes. Byte input uses strict UTF-8 decoding, including standard BOM
handling. A leading BOM in a string is retained as protected source, including before
Markdown frontmatter. For DOCX, XML entities are decoded; `part`, paragraph path, `run`, `textNode` and
node-local UTF-16 range locate the passage, never an offset into serialized XML or ZIP data.
DOCX paths and run/text-node ordinals enumerate the reader's supported traversal, excluding
opaque revision/control subtrees. They are inspection coordinates, not raw DOM descendant
indices or XPath expressions. Resolve them through the same reader and snapshot; do not
index all XML descendants with these numbers or use them for direct XML patching.

`mapFinding` checks the revision, authentic in-memory snapshot, segment, bounds, integer
offsets and grapheme boundaries. Snapshots are frozen; JSON deserialization does not recreate
an authenticated mapping. Re-read the source rather than trusting a serialized snapshot.
Extended graphemes split across DOCX text nodes are withheld, with a coverage omission.
No Unicode normalization changes document content. Segment boundaries preserve surrogate
pairs, combining sequences and other extended graphemes.

`proposeReplacement` returns a location, replacement string, revision and `applied: false`.
It does not apply a patch, validate scientific meaning, escape format syntax or promise
that an arbitrary replacement is safe to serialize. Before any future writer could apply
one, it would need source-revision verification, syntax-aware escaping, protected-region
checks and format-specific preservation tests. A multi-run DOCX rewrite is outside Phase 8.
There is no write operation, so there is no output/write-failure API or round-trip guarantee.
Original input bytes and strings are never modified by the readers.

## Limits, errors and security

Limits are workload bounds for local inspection, not disciplinary manuscript limits:

- Text: 2,000,000 UTF-16 units for string input; 2,000,000 bytes for byte input, with decoded
  text also bounded. Split larger documents by supplied sections and state partial coverage.
- DOCX archive: 20 MiB; at most 2,000 entries; 8 MiB uncompressed per entry; 40 MiB total
  declared expanded bytes. Only eight allowlisted parts are decompressed, with actual stream
  lengths bounded and checked against declarations. Extracted text is bounded to 2,000,000 units.
- At most 50,000 units/segments; XML depth at most 256; deeply nested Markdown is withheld
  once traversal reaches its limit. Input is buffered within these limits, not streamed from disk.

`DocumentError.code` distinguishes `INVALID_INPUT`, `UNSUPPORTED_FORMAT`,
`MALFORMED_DOCUMENT`, `EXTRACTION_FAILURE`, `UNSUPPORTED_FEATURE`, `LIMIT_EXCEEDED` and
`STALE_LOCATION`. Messages contain fixed diagnostic text, without source excerpts or raw
parser errors. Callers should display the code/message, not stack traces or whole documents.
Unsupported features can instead be nonfatal coverage omissions when safely isolated.

ZIP names are checked for absolute/traversal paths, backslashes and duplicates; nothing is
unzipped to the filesystem, so symlink entries are never followed. Encrypted archives and
macro-enabled main content types are rejected. DTD declarations are rejected before entity
interpretation, XML uses strict entity parsing and no external entity resolver is installed.
Malformed packages and oversized decompression fail locally. CRC-32, digital signatures and
full OOXML schema validity are not certified. Only standard fixed main/notes paths are read;
package relationships do not redirect extraction. Documents using other paths/encodings
need separate support. The readers do not execute TeX, code fences, HTML or JavaScript.

Runtime dependencies: `mdast-util-from-markdown`, `mdast-util-gfm` and
`micromark-extension-gfm` for a maintained Markdown AST; `yauzl` for lazy bounded ZIP reads;
`sax` for strict event-based XML. The former four use MIT licenses; `sax` uses BlueOak-1.0.0.
Dependency installation/documentation checks use the network during development; runtime
reading uses none. Dependency audits supplement the explicit bounds and XML restrictions.

Ordinary workspace typecheck/tests/build already include this package and CI runs them on
Node 20/22. No artificial `validate:formats` command is added. Synthetic in-memory DOCX
fixtures cover style runs, tables, notes, fields and hostile archives without private files.
Behavioral cases: [document-formats-scenarios.md](document-formats-scenarios.md).
