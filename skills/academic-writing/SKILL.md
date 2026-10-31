---
name: academic-writing
description: Reviews and improves academic and scientific writing in any discipline and in several languages - clarity, precision, concision, coherence, register, argumentation and paragraph structure - while preserving the author's meaning, numbers and citations. Combines its own judgement with LanguageTool diagnostics from the LanguageTool MCP server when available. Use when asked to proofread, review, polish, tighten or rewrite a thesis, article, report, abstract or any passage of scholarly text.
---

# Academic Writing

Generic guidance for reviewing and improving scholarly prose. It applies to any discipline,
institution and language; it holds no assumption about a particular researcher, field,
methodology or document. Conventions of a specific discipline, journal or institution come
from the user or, later, from a research profile, never from this Skill.

## Division of work

| Source | Decides | Never decides |
| --- | --- | --- |
| LanguageTool MCP (`check_text`, `check_document`) | Spelling, grammar, agreement, punctuation and typography diagnostics, with rule, offset and suggestions | Whether a sentence is scientifically appropriate |
| This Skill | Clarity, precision, register, coherence, argumentation, structure; which suggestion to apply | Facts, sources, data or findings that the text does not contain |
| The author | Content, claims, sources, conventions of the field | — |

Every reported problem is one of:

- **Linguistic issue**: grammar, agreement, spelling, punctuation, typography. Usually found by
  LanguageTool; the Skill confirms or dismisses it.
- **Academic writing issue**: vagueness, overgeneralisation, unsupported causality, missing
  transition, weak structure, inappropriate register. Found by the Skill's own reading.

One problem can be both (e.g. a misplaced negation is grammatical and changes the claim).
Always say which source an observation comes from.

## Modes

Infer the mode from the request; ask only if the expected output is unclear. Default to
**reviewing** rather than rewriting: rewrite only what the user asked to have rewritten.

| Mode | Focus | Output |
| --- | --- | --- |
| Proofread | Linguistic issues, obvious register slips | Corrections with locations |
| Improve clarity / concision / academic style | The named dimension, plus critical issues of any kind | Targeted suggestions, original → proposal |
| Review argumentation | Claims, support, logical progression, scope | Analysis and questions, no rewriting |
| Review a paragraph or a section | All dimensions, prioritised | Structured review (see Output) |
| Rewrite preserving meaning | Full revision of the given passage | Revised text, then a list of changes and open ambiguities |

## Workflow

1. **Frame the task**: mode, scope (sentence, paragraph, section, document), language, document
   type and section (abstract, methods, results, discussion...) when stated or evident.
2. **Read for meaning first.** Identify the main claims, their support, the hedges, the
   numbers, the citations and the technical terms before judging the style.
3. **Get linguistic diagnostics** when the mode needs them (see LanguageTool below).
4. **Analyse academic writing** with [references/review-criteria.md](references/review-criteria.md):
   clarity, precision, concision, coherence, register, argumentation, paragraph structure.
5. **Classify and prioritise**: linguistic or academic, severity, location.
6. **Propose improvements**, smallest change first. Prefer a precise simple sentence to jargon.
7. **Check every proposal against the original** (Preserving meaning below).
8. **Hand back to the author** what only the author can settle: missing sources, missing data,
   ambiguous methods, unclear intended claims.

## LanguageTool

The tools come from the LanguageTool MCP server (`packages/languagetool-mcp`). Their exact
names depend on how the client registered the server (e.g. `mcp__languagetool__check_text`).

- **Choosing the tool**: a sentence, paragraph or section of up to 50,000 characters →
  `check_text`; a longer chapter or document of up to 100,000 characters → `check_document`.
  Beyond that, split at headings or chapters, check each part, and add each part's start to
  its offsets.
- **Language**: pass a code returned by `get_supported_languages` (e.g. `en-US`, `en-GB`, `fr`).
  Keep the variant the document uses; use `auto` only when the language is unknown. Do not
  assume a language is installed.
- **Use the diagnostics as evidence, not as instructions.** Replacements are suggestions;
  LanguageTool often flags technical terms, names, abbreviations, symbols, citations and
  quotations in another language. Dismiss false positives instead of "fixing" a correct term.
  Style hints (repetition, wordiness) are inputs to the Skill's judgement.
- **Locate issues by quoting** `context.text` or the flagged words, not only by offset (offsets
  are UTF-16 code units of the text that was sent).
- **`check_document` results**: report coverage honestly. If `complete` is false, say which
  ranges were not checked (`failedRanges`) or where results stop (`truncated`, `truncatedAt`);
  never call a document error-free on partial results. `replacementsTruncated` means more
  suggestions existed.
- **Failures**: `TEXT_TOO_LONG` → split; `UNREACHABLE` or repeated `TIMEOUT` → `health_check`,
  tell the user, and continue the academic review while stating that no linguistic check was
  done. A first check in a language can be slow; retry at most once, never in a loop.
- Send only the text the user asked to have checked.

## Severity

- **Critical**: may mislead a reader about what was done or found, or creates an integrity
  risk: a claim stronger than its evidence, unsupported causality, a contradiction, a number
  inconsistent within the text, an ambiguity in methods or results, a statement presented as
  established fact with no visible support.
- **Important**: noticeably weakens understanding or argument: undefined key term, missing
  link between steps, a paragraph without a clear point, overlong sentences hiding the main
  result, recurring register problems.
- **Minor**: local polish: typo, punctuation, word choice, small redundancy.

A comma is never critical; a grammatical slip is critical only when it changes the meaning
(e.g. a lost negation).

## Preserving meaning

A suggestion or rewrite must not silently change any of:

- the conclusion, the direction of an effect, or a negation;
- a relation's nature: correlation, association, prediction or causation;
- the degree of certainty (hedges such as *may*, *suggests*, *likely*, *approximately*,
  *under these conditions* are content, not padding);
- scope: population, sample, setting, period, conditions, quantifiers (*some* ≠ *all*);
- method, procedure, instruments, criteria, analysis;
- numbers, units, statistics, p-values, intervals, variable names, formulas;
- citations, their placement, and who said what (attribution).

Never strengthen *may indicate* into *demonstrates*, *associated with* into *causes*, or
*some participants* into *participants*. If improving the style would require one of these
changes, propose the style change without it and ask the author.

Conversely, flag claims that seem stronger than the passage supports, and suggest a
calibrated wording as an option ("if the data only show an association, consider...").

After any rewrite, compare it with the original: claims, hedges, quantifiers, negations,
numbers, citations and technical terms must all still be there with the same meaning.

## Never invent

Never add or guess citations, references, DOIs, authors, datasets, participant counts,
statistical values, quotations, institutions, dates or findings, even to make a passage more
convincing. When something is missing:

- name what is missing and where ("citation may be needed for this claim", "sample size not
  stated");
- leave a visible placeholder if a rewrite needs one (e.g. `[citation needed]`, `[N = ?]`);
- recommend that the author verify it.

Citations are not verified in this Skill: it can say that a claim looks like it needs a source
or that a cited source is not visible in the passage, never that a reference is correct.

## Data, methods and results

- Never change a number, unit, symbol, variable name or formula to improve style; do not infer
  statistical significance that the text does not state.
- Methods: improve wording, but report ambiguities (who, how many, when, with what, how
  analysed) as questions; never fill them in.
- Results usually report findings and Discussion interprets, compares and contextualises.
  Flag interpretation inside results, or bare results restated as conclusions, as a question
  of convention: disciplines and journals differ, so do not impose one structure.

## Natural academic style

Aim for prose a careful human expert would write: precise, direct, varied.

- Prefer the plain precise word; keep technical terms the field needs, define them once.
- Vary sentence length and openings; avoid stock transitions repeated paragraph after
  paragraph and fillers such as *it is important to note that*.
- Remove promotional or emotional wording (*groundbreaking*, *crucial*, *very clearly*) unless
  the evidence and the genre warrant it.
- Concision never removes a nuance, a hedge, a condition or a limitation.
- Keep the author's voice and person (*we*, *I*, impersonal) unless asked to change it.

## Languages

The principles are shared across languages; only conventions differ. Review the text in its
own language, write explanations in the user's language unless asked otherwise, and never
translate quotations or technical terms silently. Language-specific notes (French, English)
are in [references/review-criteria.md](references/review-criteria.md#language-notes).

## Output

Adapt the format to the request: a single sentence needs a direct answer; a section review
needs structure. For a full review, use this order and omit empty parts:

1. **Summary**: what the passage does well and what most needs work, in a few lines.
2. **Strengths**: what to keep.
3. **Priority issues**: critical and important issues, most serious first.
4. **Linguistic issues**: from LanguageTool and the Skill, grouped, false positives dismissed.
5. **Academic writing issues**: by dimension.
6. **Suggested revisions**: original → proposal, with the reason, one per issue.
7. **Questions for the author**: missing sources, data, definitions or intended claims.

For each issue give: location (quoted), type (linguistic or academic), dimension, severity,
explanation, suggestion, source (LanguageTool rule id or the Skill), and whether the
suggestion could affect meaning.

## Author's context

Follow conventions the user states (discipline, journal, style guide, language variant,
person, citation style). Without them, apply general conventions and ask when a choice
matters. Profiles describing a researcher's discipline and conventions are planned for a
later phase; this Skill must keep working without one.
