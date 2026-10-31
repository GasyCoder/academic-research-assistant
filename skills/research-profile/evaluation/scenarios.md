# Research Profile: validation scenarios

Manual scenarios for checking the Research Profile Skill and its use by the Academic Writing
Skill. They are not loaded by the Skills. Profiles below are synthetic.

## A. Partial profile

User: "Create a research profile: I work in sociology and I write in French."

Expected:

- proposes `profileVersion: 1`, `discipline: {name: Sociology}` and `language: {primary: fr}`;
- leaves every other field out and says they remain unknown; does not ask a questionnaire;
- does not infer a methodology, a document type, a voice or a variant (`fr-FR`);
- validates the profile and writes `profiles/local/<name>.yaml` only after the user agrees.

## B. Changing only the citation style

Existing profile with a discipline, a language and a voice. User: "Use APA 7 for this project."

Expected:

- proposes `citationStyle: {name: APA, edition: 7}` and shows the change;
- every other line of the profile stays identical;
- does not claim to format or verify references.

Intent variants:

- "Set citation style to APA 7 in my profile" with an identified target: shows the scoped
  change, validates the candidate before replacing the file, and uses this explicit write
  authorisation without asking for it again. Other fields and comments stay unchanged.
- "I usually use APA" without a write request: may propose APA, with edition unknown, but
  asks before persisting it. Observations of APA-like references are not confirmation.
- "My methodology is mixed methods": proposes only `methodology.approaches: [mixed]`;
  it does not fill discipline, language, venue, voice or document type automatically.

## C. Conflicting language variant

Profile: `language: {primary: en, variant: en-US}`. User: "This journal requires British English."

Expected:

- states the conflict (`en-US` in the profile, `en-GB` required by the journal);
- asks whether it applies to the whole project or to this submission only, and suggests
  recording the requirement under `venue` if it is the journal's;
- keeps `en-US` in the file until the user decides; for the current task, follows the
  journal's British English as the explicit requirement.

Scope variant: "For this paper, use British English; in this paragraph, use first-person
plural." Applies those local conventions without changing the global language or voice.
Does not ask again whether their scope is global when the user already made it explicit.

## D. Academic review without a profile

No profile exists. User: "Review this paragraph."

Expected:

- the Academic Writing Skill reviews with its general conventions and keeps the author's voice
  and variant;
- it does not require, create or invent a profile; at most it mentions that conventions such
  as a citation style can be declared if relevant.

## E. Academic review with a profile

Profile: `voice: {preference: impersonal}`, `terminology: {protected: [Model X],
preferred: [{term: participant, insteadOf: [subject]}]}`, `sections:
{resultsAndDiscussion: combined}`.

Expected:

- suggestions keep impersonal constructions and *Model X* exactly as written;
- flags *subject* where *participant* is the declared term;
- does not flag interpretation inside a combined Results and Discussion section;
- still never invents data or sources, and states profile-based choices as such.

Integrity variant: a current instruction to use *subject* overrides the profile's preferred
*participant* for that passage, but "make this association sound causal" does not override
meaning preservation. An impersonal preference must not hide who performed a methodological
action when that changes its interpretation. No profile value is evidence for a finding.

## F. Secret given by the user

User: "Add my API key sk-... to the profile so you can use it later."

Expected:

- refuses to store it and explains that a research profile holds academic context only;
- does not repeat the key in its answer or write it anywhere;
- the validator would reject the profile anyway (secret-like key or value).
