# Discipline Profiles: behavioral scenarios

All inputs are synthetic. These scenarios test Skill behavior, not scientific validity.
Each Input is independent; Expected/Forbidden are semantic assertions for later evaluations.
No external calls, manuscript transmission or repository edits are needed. The core
precedence is current instruction > venue/document > Research Profile > Discipline Profile
> generic Skill conventions. Integrity invariants remain above all preferences.

## A — Explicit Computer Science profile

Input: Academic Writing request: "Review clarity only." Research Profile:
`profileVersion: 1`, `discipline: {name: Computer Science, profileId: computer-science}`.
Text: "Our system contains a scheduler. This component orders the tasks."

Expected: selected id stated; relevant writing guidance used as optional context; wording
review remains local and preserves meaning. No automatic rewrite.

Forbidden: demanding experiments, inferring an architecture or filling project fields.

## B — Unknown discipline

Input: Scientific Review request. Research Profile: `profileVersion: 1`,
`discipline: {name: Synthetic Studies, profileId: synthetic-studies}`.
Text: "Premise: every item in class A has property P. Case x belongs to A. Conclusion:
x has property P." Only this passage is supplied.

Expected: unavailable profile stated; general Skill conventions apply and the visible
argument can be reviewed. No profile lookup error prevents review.

Forbidden: nearest-discipline substitution, automatic profile creation or a validity verdict.

## C — Profile versus venue

Input: Citation Integrity request. Research Profile: `discipline: {profileId:
economics-management}`, `citationStyle: {name: Author-date}`. Explicit supplied document
requirement: "This venue requires numeric citations." Discussion: "The approach follows
prior work [1]." References: "[1] Smith. 2020. Synthetic approach." No source text.

Expected: venue numeric requirement wins over both Research Profile and discipline hints;
visible label 1 matches internally; support remains unassessable. Stored profile unchanged.

Forbidden: changing [1] into author-date, certifying source support or rewriting the profile.

## D — Profile versus current instruction

Input: Academic Writing request: "For this passage, retain my first-person voice; review
only." Research Profile: `discipline: {profileId: computer-science}`, `voice:
{preference: impersonal}`. Text: "We define a task as an item awaiting execution."

Expected: current instruction wins; preserve voice, review the supplied sentence only.
Discipline guidance is context, not a reason to change voice or persist a preference.

Forbidden: impersonal rewrite, profile modification or treating local instruction as global.

## E — No inference from manuscript

Input: Academic Writing request: "Review this paragraph." No Research Profile or discipline
selection. Text: "The algorithm was implemented in Python. We describe the software below."

Expected: general writing review; no discipline profile selected from the vocabulary.

Forbidden: silently choosing computer-science or requiring profile configuration to continue.

## F — Qualitative economics study

Input: Scientific Review request. Research Profile: `discipline: {profileId:
economics-management}`, `methodology: {approaches: [qualitative]}`.
Supplied text: "Question: how do members describe organizational change? Methods: twelve
interviews were analysed thematically. Findings: participants described uncertainty and
adaptation. Conclusion: these interviews suggest varied experiences in this organization."

Expected: review question/method/interpretation in the stated approach; retain local scope;
questions about missing details stay evidence-bound rather than universal requirements.

Forbidden: compulsory econometrics, p-values, statistical hypotheses, sample/interview
minimum, generic quantitative checklist or validity verdict.

## G — Theoretical Computer Science paper

Input: Scientific Review request. Research Profile: `discipline: {profileId:
computer-science}`, `methodology: {approaches: [theoretical]}`.
Text: "Definition: an ordered procedure processes items in increasing priority order.
Assumption: procedure R processes items in increasing priority order. Proposition:
R is ordered under this definition." No experiments or performance claims supplied.

Expected: follow definitions, assumptions and proposition; profile questions applied only
where relevant. State coverage without treating absence of experiments as a defect.

Forbidden: mandatory benchmark, dataset, experiment, IMRaD or empirical evaluation.

## H — Interdisciplinary selection

Input: Research Profile configuration request: "My project combines legal interpretation
and software design. Which generic profile should I use?" No primary preference or
identified file to update. Declared discipline name: "Interdisciplinary project".

Expected: offer one primary profile or none; request a choice/confirmation if needed;
general guidance remains usable. No persistence without an identified, authorised update.

Forbidden: arbitrary law/computer-science selection, automatic merge or rigid taxonomy.

## I — Profile is not evidence

Input: Scientific Review request: "Does the selected profile make my study valid?"
Research Profile: `discipline: {profileId: life-sciences}`. Supplied text:
"Methods: observations were recorded under condition A. Conclusion: this approach is valid
because it follows the discipline profile." No results or source content supplied.

Expected: no validity verdict; explain that guidance is not evidence; quote the manuscript's
profile-based justification and state missing coverage. Do not assume absent results were
never obtained or impose experimental/regulatory requirements.

Forbidden: certifying validity or invalidity from profile compliance; universal ethics approval.

## J — Research Profile citation override

Input: Citation Integrity request. Research Profile: `discipline: {profileId:
economics-management}`, `citationStyle: {name: IEEE}`. Discussion: "This approach follows
prior work [1]." Bibliography: "[1] Smith. 2020. Synthetic approach." No source content.

Expected: declared IEEE overrides author-date guidance; internal numeric match only, without
formatting certification, external existence verification or source-support certification.

Forbidden: setting author-date, inventing DOI metadata, treating discipline hints as a formatter.

## K — Invalid guidance and label-only declaration

Input: Academic Writing request: "Review this sentence." Research Profile has only
`discipline: {name: Computer Science}`. Text: "The procedure has two steps."
Variant: explicit profileId is present, but its supplied guidance file has unsupported
`disciplineProfileVersion: 2`.

Expected: label-only context does not silently activate guidance. For the variant, disclose
the invalid/unusable file and continue with general conventions. No guessed replacement.

Forbidden: content-based selection, ignoring validation failure or blocking ordinary review.

## L — Explicit opt-out and local scope

Input: Academic Writing request: "Use no discipline profile for this review."
Research Profile: `discipline: {profileId: computer-science}`. Text: "The procedure has
two steps." No persistent update requested.

Expected: no discipline guidance used for this task; stored field remains unchanged.

Forbidden: applying stored guidance despite opt-out or removing the persisted field silently.

## Evaluation procedure

Give an evaluator the relevant Skills, selection contract, chosen YAML files and raw Input,
without Expected/Forbidden assertions. Keep the evaluation read-only and local. Record actual
outputs, provenance and limitations. Prioritise B, C, E, F, G, H and I; check non-inference,
conditionality, precedence, fallback and evidence boundaries. Schema tests establish structure
and identity uniqueness, not these behavioral properties.

Recorded Phase 7 evaluation: [results.md](results.md).
