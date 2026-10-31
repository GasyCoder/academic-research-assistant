# Phase 7 behavioral evaluation

Date: 2026-10-31. All inputs were synthetic and drawn from
[scenarios.md](scenarios.md). No research documents were used.

## Method and provenance

One independent agent, started without the implementing conversation's history, performed
seven read-only reviews/configuration responses: B, C, E, F, G, H and I. It received raw
inputs and instructions to read the relevant Skills, selection contract and YAML guidance,
without reading scenario expectations or results. It returned actual responses rather than
predicted outcomes. The implementing agent compared them against the semantic assertions.
No external lookup, linguistic-service call, user contact, profile write, repository edit
or commit was performed by the evaluator. It also ran the local discipline validator:
11 tests passed and all five shipped profiles validated.

This is one independent agent pass across seven cases, not seven independent model trials
or an automated behavioral test suite.

## Observed behavior

| Case | Observation | Evidence from actual response |
| --- | --- | --- |
| B | Unknown id preserved; general review continued without substitution | "No discipline profile is available; general Skill conventions apply." |
| C | Venue numeric requirement beat Research Profile author-date and discipline guidance; internal match remained distinct from support | "The visible numeric notation agrees with the supplied venue requirement." |
| E | Algorithm/Python vocabulary did not select computing guidance | "No Research Profile or discipline guidance was selected." |
| F | Qualitative approach respected; missing detail treated as coverage rather than compulsory statistics | "The count of twelve interviews does not itself establish a defect or trigger a minimum-sample requirement." |
| G | Definitional argument assessed without mandatory empirical evaluation | "Experiments, datasets, benchmarks and an empirical Results section are not requirements for assessing this particular theoretical step." |
| H | Law, Computer Science or none offered; clarification proposed without arbitrary selection, merge or persistence | "For now, no discipline profile is selected and general conventions remain available." |
| I | Profile adherence rejected as scientific justification without a study-validity verdict | "Selecting life-sciences provides conditional review guidance; it does not establish that a study is valid." |

No silent discipline inference, universal method requirement, precedence inversion or
profile-based validity verdict was observed. The C output preserved the stored profile and
reported unavailable source support. The I output assigned important severity to the
explicit profile-based justification, quoting the conclusion; missing results remained an
ungraded coverage limit. No guidance changes were needed from these observed responses.

## Profile wording review

The implementing review checked all five 23-line YAML profiles for conditional wording,
alternative structures, methodological diversity, citation-style precedence, concision and
absence of geographic or institutional assumptions. No universal sample sizes, significance
thresholds, mandatory references, page counts, interview counts or ethics requirements
were introduced. Law guidance makes no jurisdictional assumption or legal recommendation.
These are editorial checks, not an assertion that the guidance is official or exhaustive.

## Limits and next audit

Results cover only the seven exercised synthetic inputs. Remaining behavioral cases include
direct profile selection, local voice overrides, Research Profile citation-style overrides,
invalid guidance, label-only context and explicit opt-out. Further independent trials should
exercise those cases and long/complex manuscripts. Structural tests cannot establish
neutrality or prevent a consuming agent from overgeneralizing. Selection remains a documented
Skill contract, without an automatic classifier or multi-profile merge engine.
