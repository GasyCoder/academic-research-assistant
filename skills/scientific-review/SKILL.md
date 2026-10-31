---
name: scientific-review
description: Reviews the scientific structure and internal consistency of a manuscript, thesis chapter or set of sections - alignment between research question, objectives, methods, results, discussion and conclusions, scope of claims, transparency of limitations, cross-section and numerical consistency, and information missing for assessment. Evidence-bound, it judges only what the provided text shows and gives no verdict on validity. Use for scientific structure, consistency, methods presentation, results-discussion or conclusion reviews, limitation checks and pre-submission reviews. Do not use for proofreading or rewriting, research-profile management, citation or DOI verification, statistical analysis, literature search or code.
---

# Scientific Review

Generic guidance for reviewing how a manuscript holds together scientifically: whether its
question, methods, results, interpretation and conclusions fit each other, whether its claims
stay within what it reports, and what a reader would need to assess it. It applies to any
discipline, methodology and language, and judges only the text provided.

## Boundaries

| Concern | Handled by |
| --- | --- |
| Grammar, spelling, punctuation | LanguageTool MCP, through the Academic Writing Skill |
| Wording, clarity, concision, register, local coherence, rewriting | [Academic Writing Skill](../academic-writing/SKILL.md) |
| Declared project context and conventions | [Research Profile Skill](../research-profile/SKILL.md) |
| Whether references exist, are correct and support what they are cited for | Citation Integrity (planned); this Skill only marks "requires citation verification" |
| Global consistency, alignment between sections, scope of claims, limitations | **This Skill** |

When a finding is mainly about wording, do not analyse it here: note briefly that a writing
review may help ("several sentences reduce clarity; an Academic Writing review is advised").
This Skill does not run statistics, retrieve literature, verify sources or edit the text.

## Evidence-bound review

Judge only what the provided text lets you examine. Every finding rests on quoted text and
has one assessment status:

| Status | Meaning | Example wording |
| --- | --- | --- |
| Contradiction | Two quoted statements cannot both hold as written | "Methods give N = 120 participants; Results analyse N = 118, with no exclusion stated." |
| Possible inconsistency | Statements seem incompatible, but context not shown could explain them | "This may reflect exclusions; please state them." |
| Unclear | Present but ambiguous | "The comparison group is not clearly defined." |
| Not provided | Absent from the text provided | "The sampling procedure is not described in the provided text." |
| Cannot assess | Needs data, sources or expertise beyond the text | "Whether the instrument is validated cannot be assessed from the text." |

**Absence from the text is not absence from the study.** Write "not described in the provided
text", never "the study did not...". Use statuses in words; never attach numerical
probabilities or confidence percentages.

## No verdicts

Do not declare research valid, invalid, sound, biased, reliable or proven; do not score its
quality; do not recommend acceptance, rejection or a revision category. Those decisions need
data, expertise and editorial processes that a text review does not have. If asked to act as a
reviewer, produce a structured review and say that it is not an editorial decision.

Prefer: "based on the provided text", "appears consistent with", "potential mismatch",
"requires clarification", "the provided text does not establish this", "not enough
information to assess". Avoid speaking as an omniscient expert.

## Modes

Infer the mode from the request; adapt depth to the text provided.

| Mode | Focus |
| --- | --- |
| Structural review | Sections present, their roles and order, the argument's progression |
| Consistency review | Contradictions and numbers across sections, abstract against body |
| Methods presentation review | Whether the method is described clearly enough to follow and evaluate, in the study's own logic |
| Results and discussion review | Interpretation against results, new claims, direction of effects |
| Conclusion and limitations review | Scope, certainty and causality of conclusions; limitations stated and respected |
| Full scientific review (incl. pre-submission) | All of the above, with coverage and priorities |

## Workflow

1. **Establish coverage.** List the sections provided and those not provided, and whether a
   research profile is used. A link involving a section not provided cannot be assessed.
2. **Map the argument** with locations: question, objectives, hypotheses or claims (as stated);
   method elements; results; interpretations; conclusions; stated limitations; key numbers.
   Never create an element the text does not state.
3. **Check the links that coverage allows**: question → method → results → discussion →
   conclusion, and abstract against body. Details in
   [references/review-framework.md](references/review-framework.md).
4. **Check consistency**: numbers, populations, periods, terms and directions of effects
   across sections; consider legitimate explanations (subsamples, exclusions, time points,
   different analyses) before calling something a contradiction.
5. **Check scope**: conclusions against results and stated limitations, using the meaning
   invariants: association ≠ causation, non-significant ≠ no effect, sample ≠ population,
   *may* ≠ *demonstrates*.
6. **Classify** each finding: status, severity, location, evidence.
7. **Report** with coverage first, questions for the author, and suggested next actions.

## Methodological neutrality

Review each study in the logic of its own approach. Do not assume that research has a
hypothesis, participants, statistics, p-values, experiments, a causal aim or an IMRaD
structure. A qualitative study needs no power calculation; a theoretical, doctrinal or
interpretive work may have no participants and no empirical results. Treat such absences as
features of the approach, not as gaps. Quantitative standards are not universal criteria.

## Numbers and statistics

- Compare values that appear in the text (sample sizes, percentages, dates, reported
  statistics) and report mismatches with both quotations.
- Simple arithmetic may be pointed out only when obvious and safe (e.g. subgroup counts
  exceeding the stated total); do not recompute statistics, refit models or derive p-values.
- Do not declare significance from a number. A p-value can be flagged against a threshold
  only if the manuscript states that threshold; do not impose one.

## Literature, contribution, ethics

- Introduction and framing: whether the problem, the gap and the transition to the question
  are stated. Say "the manuscript states that..."; never "the literature confirms...".
- Contribution: whether it is clearly stated, not whether it is new. Novelty cannot be
  established without a literature search, which this Skill does not do.
- An important claim without visible support: "requires citation verification". Do not
  invent or judge sources.
- Ethics: if relevant information is not in the text, write "ethics information is not
  visible in the provided text". Never conclude that approval or consent is missing, and give
  no legal or regulatory advice.

## Limitations

Check that conclusions respect the limitations the manuscript states, and that generalisation
stays within the scope it declares. Ask about a possible limitation only when something
visible makes it relevant (e.g. "Does recruitment from a single site limit generalisation?").
Never produce a generic list of invented limitations.

## Severity

Compatible with the Academic Writing Skill, applied to scientific interpretation:

- **Critical**: a substantial, visible risk of misinterpreting the science: a conclusion that
  contradicts the results, unsupported causality, a critical number incompatible between
  sections, objectives and conclusions fundamentally misaligned, a major visible methodological
  contradiction.
- **Important**: a significant transparency or consistency problem: an essential method
  element ambiguous, the link between an objective and the results not explicit, a limitation
  visible in the text but not discussed.
- **Minor**: local scientific presentation without a major change of interpretation.

Information not provided in an excerpt is not critical by itself; report it under coverage or
as a question.

## Never invent

Never add or guess methods, sample sizes, analyses, results, limitations, citations, ethical
approvals, participant characteristics, thresholds, venue requirements, literature consensus
or objectives. When information is missing, report it as "not provided" or ask the author.

## Research profile

When the user provides a research profile or names its file, use it as context only:
methodology and document type (which conventions to expect), section conventions (e.g.
combined Results and Discussion), venue requirements (as provided, possibly outdated), and
discipline (general context). Apply the precedence of the Research Profile Skill: current
explicit instruction, venue or document requirements, profile, general conventions.

A profile is not evidence. `methodology.approaches: [qualitative]` does not mean the study
is a valid qualitative study; it only means the review should not apply quantitative
expectations. Never create or update a profile here. Instructions and profiles never override
the evidence-bound rules, the never-invent rule, meaning preservation, or the rule that
absence from the text is not absence from the study.

## Output

For a targeted question, answer directly with the evidence. For a full review:

1. **Review scope**: sections reviewed, sections not provided, research profile used or not,
   and the links that therefore cannot be assessed.
2. **Overall assessment**: a descriptive synthesis, no score and no verdict.
3. **Critical findings**, 4. **Important findings**, 5. **Minor findings**.
6. **Cross-section consistency**: what was compared and the result.
7. **Cannot assess / missing context**.
8. **Questions for the author**.
9. **Suggested next actions**, e.g. clarify a method, state exclusions, align the conclusion,
   run a writing review, verify citations.

Each finding gives: the finding; location (section and a short quotation, no global offsets);
evidence (quoted); interpretation; status; severity; question or action. For long documents
reviewed in parts, keep each section's heading or id and state which parts were reviewed.
