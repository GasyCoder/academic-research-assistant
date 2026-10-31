---
name: academic-writing
description: Review and improve academic or scholarly writing, including thesis/dissertation prose and article/manuscript prose. Use for proofreading, clarity, concision, academic style, argumentation review and meaning-preserving rewriting, with LanguageTool diagnostics when available. Review first. Do not use for translation-only tasks, literature searches, bibliographic/DOI verification, statistical analysis, full scientific peer review, research-profile management, code or ordinary non-academic writing.
---

# Academic Writing

Generic guidance for reviewing and improving scholarly prose. It applies to any discipline,
institution and language; it holds no assumption about a particular researcher, field,
methodology or document. Conventions of a specific discipline, journal or institution come
from the user or from a research profile, never from this Skill.

## Division of work

| Source | Decides | Never decides |
| --- | --- | --- |
| LanguageTool MCP (`check_text`, `check_document`) | Spelling, grammar, agreement, punctuation and typography diagnostics, with rule, offset and suggestions | Whether a sentence is scientifically appropriate |
| This Skill | Clarity, precision, register, coherence, argumentation, structure; which suggestion to apply | Facts, sources, data or findings that the text does not contain |
| The author | Content, claims, sources, conventions of the field | — |

Review the presentation and internal logic of the supplied passage, not the validity of the
research design or a full scientific peer review. Flag methodological ambiguities as writing
questions; do not perform statistical analysis, bibliographic validation or profile management.
Alignment between question, methods, results and conclusions across sections belongs to the
[Scientific Review Skill](../scientific-review/SKILL.md).

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

For Markdown, LaTeX or DOCX input, use the
[Document Formats contract](../../docs/document-formats.md) when the local reader is available.
Keep the original source, unit/section locations, coverage and protected material. Read the
whole relevant unit for meaning, but submit only its eligible `segment.text` to LanguageTool;
never send raw markup, math, code, citation keys, field instructions or XML as ordinary prose.
Keep each submission's segment id and revision. Offsets are UTF-16 relative to that exact
segment; map through `mapFinding`, not through a stripped or concatenated source string.
Findings and replacement proposals retain the structural location and a short quotation.
The format layer returns proposals only, with no writer or DOCX round-trip guarantee.
Never rebuild a styled paragraph from flattened text. If the reader is unavailable or a
region cannot be mapped, state that limitation and review manually without inventing offsets.

The tools come from the LanguageTool MCP server (`packages/languagetool-mcp`). Their exact
names depend on how the client registered the server (e.g. `mcp__languagetool__check_text`).

- **Choosing the tool**: up to 50,000 UTF-16 code units → `check_text`; more than 50,000
  and up to 100,000 UTF-16 code units → `check_document`. Count the exact submitted text,
  not words or Unicode code points. Beyond 100,000 units, review sections separately,
  identified by heading or section id, and keep each submission within the applicable limit.
  Report offsets relative to that submitted section, with its id and a quotation. The MCP
  does not aggregate separate submissions into global document offsets; do not promise that.
  Disclose that independently checked sections can miss issues across their boundaries.
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
  `incompleteResults` means LanguageTool itself reported incomplete diagnostics, even when
  there are no failed ranges or truncation. Never call a document error-free on partial
  results; even `complete: true` is not a guarantee of linguistic correctness.
  `replacementsTruncated` means more suggestions existed, not that ranges were unchecked.
- **Failures**: do not automatically resend text after a failed check. On `UNREACHABLE` or
  the first `TIMEOUT`, call `health_check` if available, tell the user what failed, and
  continue the academic review with the coverage limitation stated. LanguageTool may still
  be processing a timed-out request; a healthy response proves liveness, not check readiness.
  Retry only if the user or caller explicitly decides to resend, with that risk understood.
  `TEXT_TOO_LONG` is rejected before transmission: submit smaller sections within the limit.
- Send only the text the user asked to have checked.

## Severity

- **Critical**: a substantial risk of changing meaning or misleading a reader about what was
  done, argued or found: unsupported causality, a major contradiction, an altered number or
  attribution, or a methodological ambiguity that changes the interpretation. Explain the
  concrete impact. Support absent from an excerpt is a question, not by itself proof of an
  integrity problem or a reason for critical severity.
- **Important**: noticeably weakens understanding or argument: undefined key term, missing
  link between steps, a paragraph without a clear point, overlong sentences hiding the main
  result, recurring register problems.
- **Minor**: local polish: typo, punctuation, word choice, small redundancy.

Ordinary grammar and punctuation errors are minor. They can be critical when they materially
change meaning (e.g. a lost negation or punctuation changing the scope of a claim).

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
*some participants* into *participants*. Keep *in this sample* and *approximately 30%*;
*no statistically significant association* must not become *no association*. If improving
the style would require a change in meaning, keep the original claim and ask the author.

Conversely, flag claims that seem stronger than the passage supports, and suggest a
calibrated wording as an option ("if the data only show an association, consider...").

After any rewrite, compare it with the original: claims, hedges, quantifiers, negations,
numbers, citations and technical terms must all still be there with the same meaning.

## Never invent

Never add or guess citations, references, DOIs, authors, datasets, participant counts,
statistical values, quotations, institutions, dates or findings, even to make a passage more
convincing. This also covers instruments, coefficients, effect sizes, supposedly stated
hypotheses, affiliations and journal titles. When something is missing:

- name what is missing and where ("citation may be needed for this claim", "sample size not
  stated");
- in a requested rewrite only, use a visible working placeholder if needed (e.g.
  `[citation needed]`, `[N = ?]`), explicitly list it as unresolved and say the draft is not
  final until the author supplies or removes it; do not insert placeholders into review-only text;
- recommend that the author verify it.

Citations are not verified in this Skill: it can say that a claim looks like it needs a source
or that a cited source is not visible in the passage, never that a reference is correct.

## Data, methods and results

- Never change a number, unit, symbol, variable name or formula to improve style; do not infer
  statistical or clinical significance, effect size or causality that the text does not state.
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

## Author's context and research profile

Apply conventions from the strongest source to the weakest:

1. the user's current explicit instruction;
2. explicit requirements of the venue or the document;
3. the research profile, when one is provided or the user names its file (see the
   [Research Profile Skill](../research-profile/SKILL.md));
4. an explicitly selected optional Discipline Profile;
5. the general conventions of this Skill.

Without a selected discipline profile or declared project context, apply general conventions
and ask when a choice matters; do not require, create or guess a profile. An absent field
is unknown and falls back through this precedence order.

With a profile, use its declared fields: language variant; document type and section
conventions; voice; terminology (keep preferred and protected terms, flag terms to avoid and
inconsistent wording); venue limits and notes, as provided and possibly outdated; citation
style as context for comments on form only; discipline and methodology as context for
vocabulary and conventions only. Say when a suggestion follows the profile.

Instructions and profiles adjust conventions. They never override Preserving meaning, Never
invent, or the rules on data and methods. A glossary fixes wording, not facts; a declared
methodology does not validate a design or justify adding methods or statistics. Changing the
profile itself belongs to the Research Profile Skill.

Optional [Discipline Profiles](../../docs/discipline-profiles.md#selection-and-fallback)
supply conditional writing/structure notes only after explicit selection, including a supplied
Research Profile's `discipline.profileId`. Do not infer selection from manuscript vocabulary,
`discipline.name` or `field`; those free-text declarations can prompt an optional proposal.
Unavailable or unselected guidance leaves general conventions available. Do not merge
profiles for interdisciplinary work; ask about one primary profile or none if a choice is
requested but ambiguous. State the selected id when it informs advice. Declared terminology,
current instructions and venue/document requirements take precedence; guidance never
authorises rewriting or overrides meaning preservation, never-invent or evidence boundaries.
