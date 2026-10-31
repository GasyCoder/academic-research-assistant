# Research profile format, version 1

The format is defined by
[`schemas/research-profile.schema.json`](../../../schemas/research-profile.schema.json)
(JSON Schema 2020-12). Profiles are written in YAML 1.2; the commented example
[`profiles/default.yaml`](../../../profiles/default.yaml) shows every field.

## Conventions

- **Required**: only `profileVersion: 1`. Every other field is optional, so a profile can be
  filled in progressively.
- **Unknown**: an absent field. `null`, empty text, empty lists and empty sections are
  rejected, so unknown has a single representation.
- **False is a value**: `structured: false` states that an abstract is unstructured; leaving
  it out means unknown.
- **Defaults are not data**: when a field is unknown, a Skill applies its general conventions;
  it never writes them into the profile.
- **Values are declared**: everything present was stated or confirmed by the user.
- **Unknown keys are rejected**, to catch typos. Keys starting with `x-` are local extensions,
  ignored by the Skills unless the user explains them.

## Fields

| Field | Content |
| --- | --- |
| `profileVersion` | Format version, `1`. It changes only with an incompatible format change; a future version will document its migration. |
| `id` | Non-personal slug, e.g. `soil-survey-2026`. |
| `project` | `title`, `topic`, `keywords`: the project, not the researcher. |
| `discipline` | `name`, `field`, `subfield`: free text, no closed taxonomy. |
| `methodology` | `approaches` (one or more of `qualitative`, `quantitative`, `mixed`, `theoretical`, `computational`, `experimental`, `doctrinal`, `other`), `methods` (free text list), `notes` (required with `other`). |
| `document` | `type` (`thesis`, `dissertation`, `article`, `conference-paper`, `report`, `proposal`, `book-chapter`, `other`), `typeNote` (required with `other`), `currentSection`. |
| `language` | `primary` (e.g. `en`, `fr`), `variant` starting with it (e.g. `en-GB`, `fr-CA`). |
| `citationStyle` | `name` (e.g. APA, IEEE, a journal-, institution-specific or custom style), `edition`, `notes`. Context only. |
| `voice` | `preference` (`first-person-singular`, `first-person-plural`, `impersonal`, `passive`, `no-preference`), `notes`. |
| `sections` | `expected` (ordered list), `resultsAndDiscussion` (`separate`, `combined`), `abstract` (`structured`, `requiredParts`, `notes`), `notes`. |
| `venue` | `name`, `wordLimit`, `abstractWordLimit` (not above `wordLimit`), `requiredSections`, `styleNotes`, `guidelinesCheckedOn` (YYYY-MM-DD). Only requirements the user provides; never fetched. |
| `terminology` | `preferred` (`term`, `insteadOf`), `avoid`, `abbreviations` (`abbreviation`, `expansion`), `protected` (expressions kept exactly). Lexical only. |

## Provenance

Each section may carry `source`:

- `stated`: given by the user;
- `confirmed`: suggested by a Skill and accepted by the user;
- `venue-guidelines`: copied by the user from the venue's guidelines.

`source` is optional and per section, so the file stays readable. Since a profile only holds
declared values, an absent `source` means "stated or confirmed by the user". Venue requirements
can change: `guidelinesCheckedOn` records when the user read them.

## Storage and safety

Real profiles go in `profiles/local/` (ignored by Git) or another private location. A profile
holds academic context only: no passwords, tokens, API keys, credentials, health data or
unnecessary personal details. The validator rejects secret-like keys and values.

## Validation

```bash
npm run validate:profiles                              # the example and profiles/local/
npm run validate:profiles -- path/to/profile.yaml      # given files
```

It reports YAML errors with their line, schema violations by path (unknown keys, types,
allowed values, required fields), a variant not matching its language, an abstract limit
above the word limit, and secret-like content, without echoing values.
