# Scientific review framework

Detailed checks for steps 3 to 5 of the [Scientific Review workflow](../SKILL.md#workflow).
Apply only the checks that the sections provided allow, in the logic of the study's own
approach. Every check yields a finding with evidence and a status, or nothing.
Apply [severity](../SKILL.md#severity) independently of status: absence from an excerpt is
normally an ungraded coverage limit, not an important or critical defect.

## Argument chains

The review follows the chain a document actually uses. IMRaD is one chain among others:

| Kind of work | Typical chain |
| --- | --- |
| Empirical (quantitative, qualitative, mixed) | question or objectives → design, data, analysis → results or findings → interpretation → conclusions |
| Experimental or computational | problem → model, system or protocol → experiments or evaluation → results → conclusions |
| Theoretical or conceptual | problem → premises and definitions → reasoning → propositions → implications |
| Doctrinal or interpretive | question → sources and interpretive approach → analysis → position → implications |

Use the document's own section names; map them to the chain instead of imposing headings.

## Question, objectives, claims

- Are the question, objectives, hypotheses or central claims stated? If not stated in the text
  provided: "not provided", not a defect of the study.
- Are they consistent with each other (scope, population, concepts)?
- Do the visible results address each visible objective? Does the conclusion go beyond them?

## Question → method

- Based on the description provided, does the method appear able to address the question?
- Does the population, corpus, material or case match the scope of the question?
- Do the concepts or variables studied match those in the objectives?
- Phrase as "the method appears aligned with...", "the text does not provide enough
  information to assess...". Never certify methodological validity.

Presentation elements to look for, when the approach uses them: design; population, sample,
corpus or cases; variables or concepts; instruments or materials; procedure; analysis;
inclusion and exclusion criteria; ethics information when the text mentions it. Not every
approach needs every element.

## Method → results

- Do the results concern the variables or concepts announced?
- Are the analyses reported in the results described in the method provided?
- Do results appear without a visible corresponding method, or does an announced procedure
  produce no visible result? Absence from an excerpt is not absence from the study: ask.

## Results → discussion

- Does the discussion interpret the results actually reported?
- Does it introduce findings, effects or comparisons not shown in the results?
- Do the direction and size of effects in the interpretation match the results?
- A discussion need not restate every result; check the claims it makes.

## Results → conclusions

The most important link. Look for a conclusion that:

- is stronger than the results (*suggests* → *demonstrates*, *may* → *does*);
- adds causality to an association or a sequence;
- generalises beyond the sample, setting, period or conditions studied;
- turns a non-significant result into the absence of an effect;
- drops an approximation qualifier: ask about intended precision rather than treating a
  possibly rounded percentage as automatically contradictory or silently changing it;
- drops a limitation stated earlier, or changes the degree of certainty.

Quote both the result and the conclusion. Example:

- Finding: the conclusion overstates causality.
- Evidence: Results, "X was associated with Y"; Conclusion, "X causes Y".
- Interpretation: the conclusion strengthens an association into causation.

## Abstract against body

When both are provided, compare objective, method, population or sample, principal results,
critical numbers and conclusions. Report different numbers, a different objective, a stronger
conclusion or a differently described method, quoting both places. Do not assume information
the body does not give. An abstract can omit body details without contradicting them; normal
brevity alone is not a finding.

## Numerical and factual consistency

- Compare sample sizes, percentages, dates, periods, group sizes and reported statistics
  between sections. First identify whether they concern the same measure, denominator,
  population, period and analysis; a recruited sample and an analysed sample can differ.
- Before calling a difference a contradiction, consider explanations the text may allow:
  exclusions or attrition, subsamples, different time points, different analyses, rounding.
  If none is stated, ask ("Results report N = 118 against N = 120 in Methods; were two
  participants excluded?"). Never suggest misconduct.
- Only obvious, safe arithmetic (e.g. group counts exceeding the stated total). No
  recalculation of statistics.

## Limitations

- Are limitations stated? If the section is not provided, say so.
- Do the conclusions respect them? A declared single-site sample with a universal conclusion
  is a scope finding.
- Ask about a limitation only when something visible makes it relevant; never list generic
  limitations.

## Correct and incorrect phrasing

| Incorrect | Correct |
| --- | --- |
| The study did not use a sampling procedure. | The sampling procedure is not described in the provided text. |
| The methodology is invalid. | Based on the description provided, it is unclear how the method addresses the second objective. |
| The literature confirms this. | The manuscript states this; the claim requires citation verification. |
| This study is novel. | The claimed contribution is stated in the introduction; its novelty cannot be assessed here. |
| Ethical approval is missing. | Ethics information is not visible in the provided text. |
| The p-value of .06 is not significant. | The text calls p = .06 significant while stating a .05 threshold. |
