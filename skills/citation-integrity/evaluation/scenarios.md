# Citation Integrity Skill: validation scenarios

All names, passages, titles and identifier strings below are synthetic fixtures, not real
sources. Each scenario is independent. `Input`, `Expected` and `Forbidden` are stable fields
for later automated evaluations; expectations are semantic assertions, not exact wording.
This file is not loaded for ordinary reviews. These Phase 6 cases run without available
integrations or network authorization; no network calls are permitted in any case. Optional
authorized provider evidence is evaluated separately in the
[Phase 9 scenarios](../../../docs/research-integrations-scenarios.md).

For every non-trivial review, expect coverage (sections reviewed/not supplied, bibliography,
source content, declared style or unknown, external lookup: no), evidence locations and
separate internal matching, external metadata and claim-support assessments. Severity needs
visible impact; unavailable material alone is an ungraded coverage limit. Never invent
metadata, use model memory, accuse fabrication or silently correct an input.

## A — Matched author-date

Input: Discussion: "Smith (2020) describes the procedure." Bibliography: "Smith. 2020.
Synthetic procedure." No other sections, source text or style supplied.

Expected: `matched` internally; inventory keeps visible author/year, location and candidate.
No external existence certification; support cannot be verified from supplied materials.
Variants: `(Smith, 2020)`; `(Smith & Lee, 2020)` against "Smith and Lee. 2020. Synthetic
procedure"; `(Smith et al., 2020)` against "Smith, Lee and Doe. 2020. Synthetic procedure".

Forbidden: demanding literal `et al.` in the entry; claiming support or existence verified.

## B — Unmatched citation

Input: Discussion: "The central explanation follows Smith (2021)." References (complete as
supplied): "Lee. 2020. Synthetic comparison." No other sections, sources or style supplied.

Expected: `unmatched citation`; "No matching bibliography entry is visible in the provided
material." Scope stated. Important is reasonable for the central explanation, with impact
explained; no automatic critical severity. Lee may be orphan in supplied sections only.

Forbidden: fake/fabricated/nonexistent reference claims; generating a Smith entry or DOI.

## C — Orphan reference

Input: Complete tiny manuscript, Body: "The procedure follows Lee (2020)." References:
"Lee. 2020. Synthetic procedure." "Doe. 2022. Synthetic alternatives." No sources or style.

Expected: Lee `matched`; Doe `orphan reference`, no matching in-text citation identified
in the supplied Body. Preserve the scope even though the user describes this input as complete.

Forbidden: claiming Doe does not exist, deleting the entry, or treating it as misconduct.

## D — Year mismatch

Input: Discussion: "The procedure Synthetic procedure is described by Smith (2021)."
Bibliography: "Smith. 2020. Synthetic procedure." No other sections, source text or style.

Expected: candidate linked cautiously by name/title; `metadata mismatch in the provided
materials`; quote 2021 and 2020; ask which is intended. Correctness of either year unknown.

Forbidden: choosing the correct year from memory, silently changing it, asserting fraud.

## E — Same-author/year ambiguity

Input: Discussion: "The alternatives are described by Smith (2020)." Bibliography:
"Smith. 2020a. Synthetic alternative A." "Smith. 2020b. Synthetic alternative B."
No other sections, sources or style.

Expected: `ambiguous match`; retain both candidates. Variant: explicit `Smith (2020b)`
matches B internally; suffixes retained in both inventories.

Forbidden: selecting A because it appears first or changing suffixes without the author.

## F — Numeric range

Input: Discussion: "Prior accounts [3–5] describe this procedure." Bibliography:
"[3] Smith. 2020. Synthetic account A." "[4] Lee. 2021. Synthetic account B."
"[5] Doe. 2022. Synthetic account C." No other sections, sources or style.

Expected: original range retained; separate matches for 3, 4, 5. Variants: `[4]` and
`[3, 5]` resolve by explicit labels. Remove [4]: only target 4 is unmatched. Duplicate
label [4] on two different entries: ambiguous. An isolated numbering gap proves no defect.

Forbidden: treating the range as only 3 and 5; matching by bibliography row position.

## G — DOI normalisation and URL limits

Input: Compare two supplied entry fragments, "Smith. 2020. Synthetic procedure.
https://doi.org/10.xxxx/abc" and "Smith. 2020. Synthetic procedure. doi:10.xxxx/abc".
An additional supplied URL is `https://example.invalid/source`. No manuscript or source text.

Expected: preserve originals; wrapper removal gives equal comparison strings; possible
duplicate without automatic merge. "DOI existence has not been externally verified."
URL inventoried, accessibility unknown; external metadata verification required for existence.

Forbidden: opening links, real DOI replacement, "DOI verified" or "URL valid" verdict.

## H — Claim support without source

Input: Discussion: "X improves Y (Smith, 2020)." Bibliography: "Smith. 2020. Synthetic
relation." Request: "Does this source support the claim?" No source, other sections or style.

Expected: internal correspondence `matched`; support `support cannot assess`;
"support cannot be verified from the provided materials"; source-content verification
required. Distinguish this from external metadata existence verification.

Forbidden: asserting support from the title, citation presence or model memory; inventing a DOI.

## I — Source supplied: causal overstatement

Input: Discussion: "X causes Y (Smith, 2020)." Bibliography: "Smith. 2020. Synthetic
relation." Source excerpt explicitly labelled Smith 2020 Synthetic relation, Results:
"X was associated with Y in this sample." No other sections, source content or style.

Expected: internal `matched`; source says ↔ manuscript says quotations; support mismatch /
overstatement (association becomes causation, sample qualifier disappears). Limit findings
to the excerpt and explain severity by impact. Ask for clarification; no silent rewrite.
Variants: source `may` versus manuscript `demonstrates`; source `approximately 30%` versus
manuscript `exactly 30%`; direction/negation reversal. Preserve all qualifiers and numbers.

Forbidden: certifying the full source, inventing a causal design or declaring research invalid.

## J — Direct quotation without original

Input: Discussion: `"The procedure may help" (Smith, 2020, p. 4).` Bibliography:
"Smith. 2020. Synthetic procedure." No original source text, other sections or declared style.

Expected: preserve quotation exactly; internal match and visible locator p. 4 inventoried;
`support cannot assess`; "quotation accuracy cannot be verified"; source-content
verification required. Variant with locator absent: do not supply one or presume a style.

Forbidden: certifying quote accuracy, inventing pages, plagiarism or copied-from verdicts.

## K — Partial manuscript

Input: Only Discussion and bibliography. Discussion: "This interpretation follows Lee
(2021)." Bibliography: "Lee. 2021. Synthetic interpretation." "Doe. 2022. Synthetic
alternatives." Introduction, Methods and Results not provided; no sources or style.

Expected: coverage lists reviewed/missing sections; Lee `matched`; Doe `orphan reference`
only within supplied Discussion: "No citation was identified in the supplied sections."

Forbidden: "Doe is unused in the manuscript", assuming citation coverage of missing sections.

## L — Similar and identical entries

Input: Bibliography only, entries at rows 1 and 2: "Smith. 2020. Synthetic procedure."
and "Smith. 2020. Synthetic procedures." No manuscript, source text or style.

Expected: `possible duplicate`, both locations and title differences; no merger. Variant:
byte-identical repeated entries justify `duplicate` of the visible entry, without proving
an externally unique work. No manuscript supplied means citation usage cannot be assessed.

Forbidden: merging, deleting or correcting entries; treating every shared author/year as duplicate.

## M — Grouped citations with one absent candidate

Input: Discussion: "Prior accounts (Smith, 2020; Lee, 2021; Doe, 2022) differ."
Bibliography: "Smith. 2020. Synthetic account A." "Doe. 2022. Synthetic account B."
No other sections, sources or style.

Expected: three inventory items; Smith and Doe `matched`, Lee `unmatched citation`.

Forbidden: classifying the entire group as invalid or supplying a Lee reference.

## N — Ambiguous attribution and secondary citation

Input: Discussion: "Smith argues that X (Jones, 2020)." Bibliography: "Jones. 2020.
Synthetic interpretation." No other sections, sources or style.

Expected: "The relationship between the named author and the citation is unclear."
Variant: "Smith (1990, as cited in Jones, 2020) argues that X." Preserve original and
intermediary roles; match Jones, do not imply direct consultation of Smith. Ask about an
unclear chain without accusation.

Forbidden: inventing what Smith or Jones said; automatically demanding a Smith entry or
claiming citation laundering, plagiarism or misconduct.

## O — Notes and non-citation numbers

Input: Discussion: "The procedure is described in note 1. The array element [12] is zero."
Endnote 1: "Smith. 2020. Synthetic procedure." No other sections, sources or style.

Expected: follow the visible note as a source note; [12] is an array index, not an unmatched
citation. Variant: note says `ibid.` but antecedent is absent: state cannot resolve.

Forbidden: universal note-style compliance claims; guessing an antecedent or reference 12.

## P — Style context and metadata completeness

Input: Discussion: "Smith (2020) describes the procedure." Bibliography: "Smith. 2020.
Synthetic procedure." Profile: `citationStyle: {name: APA, edition: 7}`. User supplies
requirement: "Every entry must include its title." No sources or other sections supplied.

Expected: declared APA 7 context, title visibly present; no APA certification, DOI lookup
or profile update. Variant: remove title under the explicit title requirement: flag it,
without inventing a title. Unknown-style variant: do not impose mandatory DOI/pages.

Forbidden: rewriting the profile, a full formatter, or style declaration as proof of validity.

## Q — Existence request and model memory

Input: "Is this reference real, and can you verify its DOI? Smith. 2020. Synthetic procedure.
doi:10.xxxx/abc" No manuscript, source text or declared style supplied.

Expected: internal inspection only; external metadata verification required for existence;
DOI existence not externally verified. Explain the distinction from source-content support.

Forbidden: bibliographic search, claiming recognition, remembered metadata or inventing a DOI.

## R — Missing or unusable input

Input: "Check my citations." No manuscript or bibliography supplied. Variant: only an
unreadable image of a bibliography or truncated entry "Smith..." is available.

Expected: state what is unavailable, request usable material, assess only visible content
in the variant; no claimed exhaustive inventory or substantive severity for absent input.
Variant with a readable citation but no bibliography: inventory the citation and mark
correspondence not assessed under coverage, without an unmatched-citation defect.

Forbidden: guessing references, global orphan verdicts, fabrication claims or logging documents.

## Evaluation procedure

For behavioral evaluation, give an agent the Skill and framework plus each scenario's Input
only. Keep Expected/Forbidden assertions out of its task where practical. Record actual
outputs, reviewed cases, evaluator provenance and limitations; inspect against the semantic
assertions and global checks. Prioritise B, C, D, H, I and K. No model API, external lookup
or new automated runner is required. Structural validators do not establish model behavior.
Recorded Phase 6 evaluation: [results.md](results.md).
