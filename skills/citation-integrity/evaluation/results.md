# Phase 6 behavioral evaluation

Date: 2026-10-31. Synthetic inputs from [scenarios.md](scenarios.md) only; no research
documents or external sources were used.

## Method and provenance

One separate evaluating agent performed six initial read-only reviews (B, C, D, H, I and K)
and one follow-up review of R's absent-bibliography variant after a guidance revision.
It was instructed to apply the Skill and framework to raw inputs without reading the
scenario expectations, and returned actual review outputs. The implementing agent checked
those outputs against the expected/forbidden assertions. No files were modified by the
evaluator, no external lookup occurred, and no model API or automated evaluation harness
was added. This was a repository-aware agent with inherited task context, not a blind
evaluation or seven independent model trials.

## Observed outputs

| Case | Observed result | Evidence from actual review |
| --- | --- | --- |
| B | Smith unmatched; central role explained important severity; Lee orphan scoped to Discussion | "No matching bibliography entry for Smith (2021) is visible in the provided material." |
| C | Lee matched; Doe orphan limited to complete supplied miniature Body | "No citation to Doe (2022) was identified in the complete miniature manuscript supplied." |
| D | Candidate year mismatch retained; neither year selected or corrected | "Verify whether 2020 or 2021 is intended, or whether a separate work needs identifying." |
| H | Internal match distinguished from unavailable support, without severity for coverage | "The citation is attached to the claim, but support cannot be verified from the provided material." |
| I | Internal match retained; important support overstatement quoted both passages | "The manuscript attributes causation to a source passage that reports an association." |
| K | Doe orphan only in supplied Discussion; missing sections explicitly listed | "This does not establish that the reference is unused elsewhere in the manuscript." |
| R variant, follow-up | Citation inventoried; absent bibliography recorded as ungraded coverage, not an unmatched defect | "This does not establish a missing-reference defect." |

All seven outputs stated coverage and external lookup: no. No fabrication or misconduct
accusation, invented DOI, model-memory verification, silent correction or external existence
certification was observed. Claim support and existence remained separate. These results
support the exercised cases only; they do not prove reliable behavior across all inputs.

## Review observations and resulting revision

The evaluator identified an ambiguity in the initial taxonomy: it allowed `unmatched
citation` when no bibliography had been supplied while also saying matching could not be
assessed. The final Skill and framework now reserve that status for a supplied reference
list and put an absent bibliography under ungraded coverage. Scenario R includes that
regression case. The follow-up review exercised the revised rule and produced "Not assessed
— coverage limit", without an unmatched-citation defect or severity for absent input.

The evaluator also noted that a source-supported overstatement is described as a finding,
while `matched` remains the internal correspondence status. This separation is intentional:
future structured evaluators should keep internal matching and support observations in
separate fields. It is not a single verdict on a reference.

## Remaining evaluation work

Run blind independent trials across A–R, including numeric/non-citation
notation, duplicate labels, secondary citations, supplied quotation text, empty inputs and
long/complex documents. This limited agent evaluation does not establish extraction completeness,
style compliance, external metadata correctness or support beyond supplied source excerpts.
