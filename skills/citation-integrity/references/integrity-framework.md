# Citation integrity framework

Use with the [Skill workflow](../SKILL.md#workflow) when matching references or reviewing
attribution. All comparisons are confined to supplied materials. The
[status taxonomy](../SKILL.md#status-taxonomy), [severity rules](../SKILL.md#severity) and
coverage contract apply independently to each relation.

## Author-date matching

- `(Smith, 2020)` and `Smith (2020)` can both correspond to a visible Smith 2020 entry.
  `(Smith & Lee, 2020)` requires compatible visible author information, not just a shared
  year. Retain name particles, compound surnames, diacritics and group authors; do not
  erase meaningful distinctions to force a match.
- `(Smith et al., 2020)` may match a multi-author entry beginning with Smith. Do not search
  for literal `et al.` in the bibliography. More than one compatible entry stays ambiguous.
  Truncated author lists limit what can be established.
- Keep suffixes: `(Smith, 2020a)` and `(Smith, 2020b)` identify different candidates.
  With both entries visible, `(Smith, 2020)` is `ambiguous match`, never an arbitrary choice.
- Split `(Smith, 2020; Lee, 2021; Doe, 2022)` into three checks. A missing candidate for one
  does not invalidate the others. Preserve grouped years and each suffix if present.
- For `Smith (2021)` against an otherwise plausible Smith 2020 entry, report
  `metadata mismatch in the provided materials`, quoting both years. A shared surname
  alone is insufficient: retain unrelated candidates as unmatched/ambiguous. Do not assert
  that the two works must be identical or choose the correct year.
- Compare author names and other visible fields together. An author disagreement between
  a clearly linked numeric citation/named attribution and its entry can be a metadata
  mismatch; weak name similarity is only a candidate, not proof of identity.

## Numeric and note-based styles

- In clear bibliographic context, `[4]` refers to label 4; `[2, 5]` to 2 and 5;
  `[3–7]` to 3, 4, 5, 6, 7 inclusive. Keep the original range and each resulting target.
- Match explicit reference labels, not row positions. A missing label in a cited range
  affects that target only. Repeated labels pointing to different entries are ambiguous;
  gaps alone do not prove a missing work. Flag order disagreements only under an explicit
  requirement or a clearly visible numbering convention and sufficient coverage.
- A bracketed number can be an array index, equation label or other notation. Use surrounding
  prose and the supplied reference system; if unclear, state uncertainty before counting it
  as a citation. Malformed, reversed or impractically large ranges need clarification, not
  guessed expansion or an unbounded inventory.
- Footnotes and endnotes may carry citations. Follow visible markers to supplied notes and
  entries; distinguish explanatory notes from source notes. Resolve shortened references
  or `ibid.` only when the necessary antecedent is supplied and unambiguous. If notes or
  antecedents are absent, state the coverage limit. No universal Chicago/OSCOLA parser.

## Absent entries and partial coverage

For an unmatched citation: "No matching bibliography entry is visible in the provided
material." If no bibliography was supplied, put correspondence under coverage as not
assessed, rather than assigning `unmatched citation`; do not treat the absence of a reference
list from the input as a manuscript defect.

For an orphan reference: "No matching in-text citation was identified in the supplied
sections." With Discussion and bibliography only, never say "This reference is unused in
the manuscript." Unreadable or ambiguous citation forms also limit the orphan judgement.
Report which portions were actually inspected; do not equate a partial inventory with a
complete scan.

## Visible metadata, DOI and URL

Inventory visible fields as supplied. Flag missing bibliographic fields only when the
declared style, explicit user instruction or a clearly visible document convention gives
a reasonable basis. Name that basis. With unknown style, describe what is visible instead
of declaring an entry noncompliant; do not assume every work needs a DOI or page range.

DOI forms such as `https://doi.org/10.xxxx/abc` and `doi:10.xxxx/abc` may yield the same
comparison string after removing the explicit wrapper and surrounding whitespace. These
are synthetic strings, not verified identifiers. Retain originals and disclose the
normalisation. Do not strip characters inside an identifier, guess a suffix or silently
repair punctuation that may belong to it. Syntax resemblance is not existence verification.

The same visible DOI on two otherwise different entries is a metadata conflict or possible
duplicate, not proof of identity. Unless an authorized provider lookup was actually performed,
state "DOI existence has not been externally verified." For optional provider evidence, follow
the [external metadata workflow](../SKILL.md#optional-external-metadata-evidence), retain its
provenance, ambiguity and disagreements, and distinguish it from internal/source-content
evidence. Inventory URLs without opening them, testing accessibility, following redirects
or saying "URL valid" from appearance. A familiar-looking work still needs external evidence;
metadata agreement alone cannot certify claim support.

## Duplicates

Compare authors, year, title and visible DOI together. Similar spelling, shared author/year
or a repeated DOI suggests `possible duplicate`; editions, versions and distinct works can
share some fields. Use `duplicate` only for demonstrable repetition of the same visible
entry, quoting both locations. Conflicting titles or years remain visible disagreements.
Never merge, delete, renumber or fill in metadata automatically.

## Attribution and claim support

Identify separately the manuscript claim, named author, attached citation, bibliography
candidate, and any supplied source passage. `Smith argues that X (Jones, 2020)` can justify
"The relationship between the named author and the citation is unclear." Do not invent
what either author said. An uncited claim can be flagged for clarification when its wording
makes attribution relevant, without asserting that no supporting source exists.

Without source content: `support cannot assess`; "support cannot be verified from the
provided materials" and **source-content verification required**. An internally `matched`
citation or a detailed abstract supplied as metadata does not establish support from the
full article. If an abstract is supplied as source content, compare only what that abstract
actually says and state its limited coverage. Confirm source identity from supplied labels
or metadata; if identity is unclear, retain a candidate relation and ask.

With identifiable supplied source content, compare:

| Dimension | Compare source says ↔ manuscript says |
| --- | --- |
| Meaning and direction | Same proposition, direction of effect, negation and attribution? |
| Certainty | `may` ≠ `demonstrates`; preserve hedges and conditions |
| Causality | Association ≠ causation; no inferred experimental support |
| Population and scope | Sample ≠ population; retain setting, period and limits |
| Numbers | Preserve values, units, denominators and qualifiers; approximately ≠ exact |

For a paraphrase, quote the relevant wording from both passages, explain the observed
support mismatch or apparent alignment, and limit the conclusion to those passages. Do not
certify the source's truth or assume an excerpt represents all findings. Numerical precision
changes may need a question about rounding rather than a categorical contradiction.

## Direct and secondary quotations

Preserve a direct quotation exactly. Identify the attached reference and visible page or
other locator; never invent one. Without original source content: "quotation accuracy
cannot be verified", `support cannot assess`, **source-content verification required**.
With the relevant source passage supplied, compare wording and visible omissions in context;
do not silently repair a discrepancy or judge plagiarism. A missing locator is a form
finding only when the declared requirement/convention reasonably calls for one.

For `Smith (1990, as cited in Jones, 2020)`, retain original Smith and consulted/intermediary
Jones as separate roles. Match the secondary source to its candidate entry. Do not demand
a directly consulted Smith entry without an applicable supplied requirement, or imply that
Smith was consulted directly. A supplied Jones passage reporting Smith allows comparison
with Jones only, not verification against Smith's unseen original. Where the chain is
unclear: "It is unclear whether the original source was consulted directly." Never make
an automatic accusation of citation laundering or misconduct.
