# Academic Writing Skill: validation scenarios

Manual scenarios for checking the Skill's behaviour after a change. They are not loaded by the
Skill. Run each one in an MCP client where the Skill and the LanguageTool MCP server are
available, and compare the answer with the expected behaviour. The passages are synthetic.

## 1. Grammatically incorrect paragraph

> The results of the survey shows that participant was satisfied with the new procedure, and
> the response rate were high.

Request: "Proofread this."

Expected:

- calls `check_text` (short passage) with an English code from `get_supported_languages`;
- reports the agreement errors as **linguistic** issues, with their LanguageTool rule ids;
- corrects *participant was* without deciding whether one or several participants were meant:
  asks, or offers both readings;
- no academic rewrite of the passage, since only proofreading was requested.

## 2. Correct but academically weak paragraph

> This topic is very important and a lot of researchers have talked about it. Many things
> influence the outcome, and our approach is clearly much better than the others.

Request: "Review this paragraph."

Expected:

- LanguageTool finds little or nothing; the review still reports **academic** issues: vague
  wording (*a lot of researchers*, *many things*), unsupported comparative claim (*clearly much
  better*), missing support;
- marks *clearly much better than the others* as important or critical (unsupported claim);
- "citation may be needed" for the reference to prior research; no invented authors or
  references;
- questions for the author: which factors, compared with which approaches, on what evidence.

## 3. Excessive causal claim

> Students who used the online platform obtained higher grades. Therefore, the platform causes
> better learning outcomes.

Request: "Improve the academic style."

Expected:

- flags the causal claim as **critical**: the passage only reports an association;
- proposes a calibrated wording as an option (e.g. *was associated with higher grades*) and
  asks whether the design supports a causal claim;
- does not silently keep *causes*, and does not invent a study design or a control group.

## 4. Text with statistics

> The intervention group improved by 12.4 points (SD = 3.1, p = .03), which proves the
> intervention is extremely effective for all patients.

Request: "Rewrite this sentence in a more academic style."

Expected:

- keeps *12.4*, *SD = 3.1* and *p = .03* exactly;
- flags *proves*, *extremely effective* and *for all patients* as stronger than one result
  supports (overgeneralisation of scope and certainty);
- does not add an effect size, confidence interval or sample size; asks for them if needed.

## 5. Text with an existing citation

> Prior work reported similar effects (Author et al., 2019), although the samples were small.

Request: "Make this more concise."

Expected:

- keeps the citation exactly, attached to the same claim;
- keeps the limitation *although the samples were small*: concision must not remove it;
- does not claim to have verified the reference, and adds no other reference.

## 6. French text

> Les résultats montre que la méthode est efficace dans tout les cas, ce qui prouve sans aucun
> doute son intérêt.

Request: "Relis et améliore ce paragraphe."

Expected:

- calls `check_text` with `fr` and reports the agreement errors (*montre*, *tout les*) as
  linguistic issues;
- answers in French, and flags *dans tous les cas* and *prouve sans aucun doute* as an
  overgeneralisation (academic issue);
- proposes a hedged wording (e.g. *suggèrent*), labelled as a change in certainty for the
  author to confirm.

## 7. English text with a language variant

> The organisation analysed the behaviour of the model, but the color scheme of the figures
> was not standardized.

Request: "Proofread this for a British English journal."

Expected:

- calls `check_text` with `en-GB`, as the user stated the variant;
- reports *color* and *standardized* as variant inconsistencies (minor);
- does not change the meaning or the technical terms.

## 8. Long document

A chapter of about 80,000 characters.

Request: "Check the language of this chapter and point out the main writing problems."

Expected:

- calls `check_document` (more than 50,000 characters), not `check_text`;
- reports coverage: if `complete` is false, names the ranges in `failedRanges` or the
  `truncatedAt` offset, and does not call the chapter error-free;
- groups linguistic issues instead of listing every one, and prioritises a few academic issues
  across sections;
- does not rewrite the whole chapter, since a review was requested.

For a document over 100,000 characters, it splits at headings, checks each part with
`check_document` and reports offsets relative to the whole document.

## Checks that apply to every scenario

- No invented citation, reference, DOI, author, dataset, number, quotation or finding.
- Numbers, citations, hedges, quantifiers and technical terms survive any rewrite unchanged,
  unless the author agrees to a flagged change.
- Each issue says whether it is linguistic or academic, its severity and its source.
- If LanguageTool is unavailable, the answer says so and still gives the academic review.
