# Document Formats evaluation scenarios

All input examples and in-memory DOCX fixtures are synthetic. Expected/Forbidden describe
observable behavior, not exact output wording. No source is overwritten in any case.
The automated fixtures and assertions live in `packages/document-formats/tests/` and run
through the ordinary workspace tests. No real document, TeX compiler or external service
is needed. Parsing and academic judgement remain separate.

## A — Markdown prose and code

Input: `# Methods`, a paragraph with an inline code span, a fenced code block and a link.

Expected: heading and paragraph locations retained; eligible prose includes link-label text,
not its destination or code; protected raw source remains available for inspection.

Forbidden: code execution, raw-code LanguageTool submission or source reserialization.

## B — Markdown citations

Input: `Smith (2020) reports [3] and [@synthetic2020].`

Expected: original visible forms retained in units; year, numeric and Pandoc markers withheld
from prose submissions. Citation Integrity can inspect the raw unit with its location.

Forbidden: inventing a reference, changing a key or equating syntax with verified existence.

## C — LaTeX prose and math

Input: prose around `$x+y$`, `\(a=b\)`, `\[c=d\]` and an `align` environment.

Expected: prose is eligible; equations and environment source stay protected. Coverage
declares opaque environments. Commented closing markers do not expose remaining equations.

Forbidden: compilation, math rewriting or math-as-prose submission.

## D — LaTeX citation key

Input: `Prior \citep[see][4]{synthetic2020} work supports this wording.` Variant: comments
and newlines between the command, optional arguments and key.

Expected: key and all command syntax remain intact and excluded; prose locations use original
UTF-16 source positions. Associated bibliography remains unknown unless supplied.

Forbidden: key repair, DOI lookup or applying stripped-text offsets to source.

## E — Malformed LaTeX

Input: `Before $unclosed`, or a braced command / environment without its terminator.

Expected: preceding prose can be inspected; incomplete protected region is withheld through
the remaining input; partial coverage states the limitation. Explicit command redefinitions
also withhold subsequent text rather than guessing how redefined wrappers behave.

Forbidden: fabricated closing syntax, execution, guessed active content or complete-coverage claims.

## F — Styled DOCX paragraph

Input: synthetic paragraph with bold and italic runs, a hyperlink, a field and Unicode text.

Expected: direct run styles and relationship metadata retained; field instructions/results
are protected. Finding locations identify part, paragraph, run and text node. Bytes unchanged.

Forbidden: flattened-text write-back, lost run formatting or hyperlink retrieval.

## G — DOCX table

Input: synthetic table with a marked header row and distinct cells.

Expected: table/row/cell structural paths retained; row header flag visible; each paragraph
keeps its cell origin. No automatic table-to-prose conversion.

Forbidden: silently merging cells or reporting a cell value as an unlocated body paragraph.

## H — Partial document

Input: Discussion only, with caller scope `partial` and Methods/Bibliography not provided.

Expected: caller scope and extraction omissions remain separate; Skills state reviewed
sections and unavailable material. Parser success does not imply whole-manuscript coverage.

Forbidden: globally orphan references or claims that Methods do not exist.

## I — Long structured document

Input: long prose under supplied headings, within documented input limits.

Expected: source hierarchy retained; segments respect 40,000 UTF-16 units and grapheme
boundaries. Larger input fails explicitly so the caller can provide smaller scoped portions.

Forbidden: silent truncation, unbounded decompression or invented global LT offsets.

## J — Unsupported format and hostile package

Input: filename `synthetic.pdf`; variants include invalid ZIP, traversal names, duplicate
entries, encrypted data, DTD/external entities and excessive expanded size/XML depth.

Expected: unsupported format or controlled document error; no filesystem extraction, external
entity resolution, manuscript logging or raw parser error. Error codes distinguish categories.

Forbidden: PDF implementation, network retrieval, shell execution or misleading success.

## K — Unicode mapping

Input: `😀 The **reslts** are visible.` and a DOCX node containing `A &amp; 😀 reslts`.
Variant: a combining sequence spans two styled DOCX runs.

Expected: a representative diagnostic on `reslts` maps to the exact source slice or decoded
DOCX text-node range; no markup is touched. A split grapheme is withheld and disclosed.

Forbidden: byte offsets as UTF-16, split surrogate/combining sequences or XML serialization offsets.

## L — Citations, notes and bibliography preservation

Input: References heading, visible citation-like text, note markers and supplied note bodies;
LaTeX refs/labels, Markdown reference links, DOCX note and field markers.

Expected: source identity, numbering, note roles and supplied content remain locatable.
Missing note/include parts limit coverage. Citation Integrity reasons only from that evidence.

Forbidden: editing identifiers or field instructions, inventing entries or source-support claims.

## Evidence and remaining evaluation

Automated tests exercise these format/mapping invariants with original-byte comparisons for
DOCX and simulated diagnostic locations for Markdown/LaTeX. No writer is implemented, so
these are not round-trip tests. Actual LanguageTool integration remains covered by its own
package; Phase 8 tests use representative UTF-16 diagnostic ranges without invoking a service.
An independent audit should also try complex documents, custom DOCX styles, macro-generated
TeX, unusual Markdown extensions and the boundary between protected content and prose.

## Observed forward evaluation — 2026-10-31

One separate agent, started without conversation history or expected assertions, used the
current source reader and the updated Skills for three synthetic requests: a Markdown typo
beside code/citations, a LaTeX citation with an unavailable include, and Results/Conclusion
with an association-to-causation change. It made no repository edits, network calls or real
LanguageTool submissions. It returned actual located reviews and an unapplied typo proposal.

- The typo mapped to the exact original Markdown source range `[17,23)` without changing
  bold delimiters, citation `[3]` or the code fence.
- The citation key remained unchanged; matching was not assessed without bibliography,
  and the absent included file was disclosed rather than read or invented.
- Results and Conclusion retained separate locations; the scientific interpretation was
  performed by the Skill, with missing sections stated, rather than by the reader.

Its additional probes demonstrated three LaTeX extraction defects in the initial version:
an unbraced input filename entered prose, a preamble heading entered active section ancestry,
and redefined formatting commands exposed suppressed content. Source fixes and regression
tests now protect unbraced resource input, restrict active headings to the document body and
withhold text after explicit definitions/redefinitions. The agent repeated all five concrete
inputs (including `let`, `renewcommand` and `def` variants) and confirmed the corrected
segments/sections, partial coverage where appropriate and unchanged original strings.
The final diagnostic wording reports environment balance as not assessed after a deliberate
dynamic-syntax stop, rather than asserting an unclosed environment.

This was one agent pass plus a recheck, not a blind benchmark or a guarantee of general TeX
recognition. DOCX security and structure were exercised by synthetic automated tests rather
than that agent's forward review. The package tests also reject stale/forged mappings and
interior grapheme boundaries. A later independent audit remains necessary.

## Independent audit hardening — 2026-10-31

Two separate read-only agents and the primary audit exercised new synthetic inputs without
external services. The original 35 tests passed, while 16 initial regression assertions
demonstrated protection, structure and resource-budget defects. The targeted fixes and
follow-up variants now have 26 additional tests, for 61 passing format tests in four files.

| Area | Demonstrated defect and regression |
| --- | --- |
| Markdown protection | Dollars in inline code or link destinations could pair with actual math delimiters, exposing math as prose; existing exclusions now isolate delimiter scanning |
| Frontmatter | Empty YAML frontmatter was treated as unclosed; a string BOM displaced Markdown positions and classification; both LF/CRLF cases retain correct source ranges |
| Markdown nesting | Deep inline emphasis exhausted recursive traversal; inline traversal is now iterative and bounded, with an explicit omission |
| LaTeX options | A bracket inside a braced optional argument ended protection early and exposed a citation key; brace groups now keep those brackets literal |
| LaTeX environments | Literal terminators inside inline or nested verbatim could close an opaque figure early; supported literal constructs now remain opaque, including `@` delimiters |
| DOCX history | Historical run/paragraph properties could override current hidden/style state; their subtrees are skipped without adding visible markers |
| Note links | Note-local relationship ids incorrectly used main-document targets; relationships now resolve per owning part |
| Resource budget | Core metadata was bounded per field instead of in aggregate; it now consumes the body/notes text budget |
| Special characters | Visible special-character elements disappeared silently; protected object markers and coverage now retain their presence |
| Caption labels | Bookmark markers before/within a caption prefix prevented numeric-label protection; prefix detection now tolerates those object markers |

Follow-up evaluation caught two issues before completing the audit: `@` as an ordinary TeX
verbatim delimiter, and visible markers inserted for historical formatting records. Those
markers could defeat caption-prefix and cross-run grapheme protection. Both were reproduced
with failing tests before correction. Independent replays then confirmed the protected
content stayed out of prose, note targets were correct, metadata overflow was rejected, and
caption/grapheme boundaries remained intact.

The audit also clarified that DOCX path/run/text-node ordinals enumerate supported reader
traversal, not arbitrary raw XML descendant indices. They must not be used for direct XML
patching. The package still has no document writer or round-trip guarantee.

A near-limit 2,000,000-unit Markdown probe returned one unit and fifty prose segments without
truncation; one additional character failed with `LIMIT_EXCEEDED`. Its observed local run
took about two seconds and 208 MiB peak resident memory, including the TypeScript loader;
this is a workload observation rather than a general performance benchmark. CRLF, BOM,
Unicode, stale snapshots, protected-range conflicts, ZIP/XML rejection and PDF refusal were
also checked. The readers made no external calls and changed no original document bytes.

The [independent audit report](document-formats-audit.md) records the complete review,
severity classification, exact validation results and remaining limits.
