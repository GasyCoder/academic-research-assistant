---
name: research-profile
description: Creates, reviews and updates a research profile, the declared context of a research project (discipline, methodology, document type, language variant, citation style, voice, section conventions, venue requirements, terminology) that academic Skills read to adapt their advice. Use when the user wants to configure or show their research profile, choose or list optional Discipline Profiles, set their discipline, citation style or writing conventions, update methodology context, or see what the profile is missing. Do not use to correct or review text, check citations, analyse data, search literature or translate.
---

# Research Profile

A research profile is **declared context**: what the user has stated or confirmed about a
research project, for the academic Skills to read. It is a YAML file, validated against
[`schemas/research-profile.schema.json`](../../schemas/research-profile.schema.json); the fields
and conventions are described in [references/profile-format.md](references/profile-format.md).

A profile does not correct text, judge whether research is valid, define a methodology,
verify citations, call LanguageTool, or remember things implicitly. It holds no personal
data and no secrets.

## Where profiles live

- `profiles/default.yaml`: the versioned example, never a real project.
- `profiles/local/<name>.yaml`: real profiles, ignored by Git. Use another path only if the
  user gives one. Never propose committing a real profile.

## Rules

1. **Explicit over inferred.** Write only what the user states or confirms. A value guessed
   from a text, a name, an institution, a location or an earlier document is a question to
   ask ("The draft reports p-values; is the approach quantitative?"), not a value to store.
2. **Absent means unknown.** Leave unknown fields out. Never write `null`, empty values or a
   default as if it were a fact: if the citation style is unknown, do not write APA.
3. **Minimal changes.** An update touches only the fields the user's statement concerns.
   "Use APA 7 for this project" sets `citationStyle`, nothing else.
4. **Nothing silently.** Show the change (the YAML lines before and after). An explicit
   request to create or update an identified profile authorises that specific write; do not
   ask for the same permission again. A casual preference or an ambiguous target is not a
   write request: propose the change and clarify before persisting it. Respect file permissions.
5. **Valid before written.** Validate the candidate in memory with `validateProfile` from
   `scripts/validate-profiles.mjs`, or validate a temporary candidate outside the versioned
   tree with `npm run validate:profiles -- <candidate>`, before replacing the target file.
   If the validator cannot run, check against the format reference and disclose that limitation.
6. **No secrets or unneeded personal data.** Refuse to store passwords, tokens, API keys,
   credentials, health data or personal details. Say why, and suggest keeping them out of the
   profile. Never repeat a supplied secret in the answer, diff or candidate file. The validator
   checks credential-like keys and known value formats; it is not a general privacy detector.

## Creating a profile

1. Collect what the user has explicitly provided; ask only for what the current task needs.
   There is no mandatory questionnaire: a profile with `profileVersion: 1` and one field is
   valid, and it can be enriched later.
2. Normalise only unambiguous values (e.g. "British English" → `language: {primary: en,
   variant: en-GB}`); ask when a mapping is uncertain.
3. Present the profile, listing what stays unknown, then validate and write it with consent.

## Reviewing a profile

Read the file, report validation problems, summarise what is declared, and list the unknown
fields that matter for the user's next task, e.g. the venue's word limit before trimming an
article. Do not insist on filling fields the task does not need.

## Updating a profile

Change only the concerned fields, keep everything else byte for byte, show the diff, validate,
and write with consent. Set `source` only when the user says where values come from.

## Conflicts

When new information contradicts the profile (e.g. the profile says `en-US` and the user says
the journal requires British English):

1. state both values and where each comes from;
2. use the stated scope (project, document, section or current task); ask only if it is
   unclear. A document- or section-specific instruction does not change the global profile;
3. for a global update, show the diff and apply the write-authorisation rule above. Keep the
   stored values while scope or consent remains unresolved; follow the explicit local
   instruction for the task without persisting that exception.

## Precedence

Skills that read a profile apply, from strongest to weakest:

1. the user's current explicit instruction;
2. explicit requirements of the venue or the document;
3. the research profile;
4. an explicitly selected optional Discipline Profile;
5. the Skill's general conventions.

This order applies to conventions and preferences only. No instruction or profile value can
override the integrity rules of the academic Skills: never invent sources, data or findings;
preserve meaning; never change numbers, citations or methods silently. A profile is not
evidence: a glossary fixes wording, not facts, and a declared methodology does not make a
design valid or allow adding methods or statistics.

## What a profile changes

| Field | Effect on the academic Skills |
| --- | --- |
| `language` | Writing language and variant for the document and LanguageTool checks; explanations still follow the user's language; availability is checked with `get_supported_languages` |
| `document`, `sections` | Expected structure, e.g. whether Results and Discussion are combined |
| `voice` | Person and voice kept or suggested in revisions |
| `citationStyle` | Context for comments on citation form; no formatting engine and no reference checks |
| `methodology`, `discipline` | Vocabulary and conventions to expect; never grounds for judging the research |
| `discipline.profileId` | Optional explicit selection of one primary generic Discipline Profile; it does not populate project fields |
| `venue` | Word limits, required sections, style notes, as provided by the user and dated by `guidelinesCheckedOn` |
| `terminology` | Preferred and protected terms kept consistent; terms to avoid flagged |

Discipline guidance lives separately from the Research Profile; citation verification and
venue guideline retrieval are not part of this Skill.

## Optional discipline guidance

Read [discipline-profiles.md](../../docs/discipline-profiles.md) when listing, selecting or
explaining the generic profiles in [profiles/disciplines](../../profiles/disciplines/).
These are project-maintained conditional conventions, not official rules or evidence.
Show available ids/labels from the current validated catalog rather than guessing a list.

A user can explicitly select an id or declared alias for the current task, or request a
specific update to `discipline.profileId`. Store the stable id only under the existing
write-authorisation and validation rules. A clear request to set this field in an identified
profile already authorises that write; do not reconfirm it. Declaring `discipline.name` or
`field` alone can support a proposal, but does not silently select or persist guidance.
Never infer discipline from manuscript keywords or auto-fill project fields from guidance.

Use exact ids or whole declared aliases with the documented normalisation. Unknown choices
fall back to general conventions; do not choose the nearest discipline, generate guidance,
or reject an otherwise valid Research Profile because its id is unavailable. For ambiguous
or interdisciplinary choices, ask for one primary profile or none and continue independent
work with general conventions. Do not merge multiple profiles. An explicit request to use
none overrides a stored id for that task; remove the field only if a persistent update is
requested. Report which profile was selected or that none was used. Profiles never override
the precedence or integrity invariants above.
