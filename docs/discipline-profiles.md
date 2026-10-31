# Optional discipline profiles

Discipline profiles are **project-maintained generic guidance**, not official disciplinary
requirements, encyclopedic knowledge or evidence of scientific validity. The versioned YAML
files in [`profiles/disciplines/`](../profiles/disciplines/) are public and non-personal.
They supply conditional writing and review conventions, not universal rules or defaults
to copy into a Research Profile. No new Skill, MCP tool, network service or runtime merging
engine is introduced.

## Format and version

[`schemas/discipline-profile.schema.json`](../schemas/discipline-profile.schema.json) uses
JSON Schema 2020-12. `disciplineProfileVersion: 1` versions this format independently of
the repository's version, release tags and the Research Profile's `profileVersion`.
Incompatible format changes require their own version and migration guidance.

| Field | Meaning |
| --- | --- |
| `disciplineProfileVersion` | Required format version, currently integer 1 |
| `id` | Required stable lowercase hyphenated identifier, at most 64 characters |
| `label` | Required human-readable display name, not a selection alias by itself |
| `description` | Required concise description of the guidance's scope |
| `aliases` | Optional explicit/confirmed selection names; no content classification |
| `writing` | Conditional tone, terminology and clarity considerations |
| `structure` | Common patterns and alternative structures, never mandatory IMRaD |
| `methodology` | Reporting considerations and cautions about inappropriate assumptions |
| `evidence` | Possible evidence types and limits of interpretation |
| `citations` | Common practices only; never sets a citation style |
| `review` | Conditional questions for reviewing supplied evidence |

The last seven fields are non-empty lists of non-empty strings when supplied. Omit unknown
fields; no null, empty strings/lists or type coercion. Unknown properties are rejected.
There is no `x-*` extension mechanism in version 1: no concrete extension consumer is needed,
and arbitrary extra fields could disguise unconditional rules. Future fields can be added
deliberately with schema, consumer guidance and tests. Research Profile root extensions
continue to work as before. The five initial files are deliberately short:

- `computer-science`: systems, algorithms, software, theoretical and empirical approaches;
- `economics-management`: quantitative, qualitative, mixed and conceptual approaches;
- `life-sciences`: design-dependent observation, experimentation, measurement and interpretation;
- `humanities`: interpretive, historical, theoretical and empirical approaches;
- `law`: jurisdiction-sensitive legal scholarship, including doctrinal and other methods,
  without legal advice or assumptions about a legal system.

## Selection and fallback

One optional primary profile can be selected. Selection comes from the user's explicit
instruction, a confirmed choice, or an explicitly stored Research Profile field:

```yaml
profileVersion: 1
discipline:
  name: Computer Science
  profileId: computer-science
```

`discipline.profileId` is an additive, optional field in Research Profile format 1. It is a
stable reference, avoiding fragile coupling to free-text `name`, `field` and `subfield`.
Those descriptions remain unrestricted and may describe interdisciplinary work. Existing
profiles remain valid and select no discipline guidance unless explicitly requested.

Consumers follow this small contract; it is Skill guidance, not an automatic loader:

1. A current explicit choice, including "use no discipline profile", overrides a stored
   `profileId` for that task. Do not persist a local exception without a write request.
2. Otherwise, a supplied or explicitly named Research Profile's `discipline.profileId`
   selects that exact id from the validated local catalog. Do not substitute a near match.
3. For an explicit human selection, match the entire supplied name against ids or declared
   aliases only. Normalisation uses Unicode NFKC, trimming, collapsed whitespace and lowercase.
   No substring, fuzzy, topic or manuscript-keyword matching. Store the stable id, not the alias,
   only when the user has requested/confirmed that specific Research Profile update.
4. Free-text `discipline.name` or `discipline.field` may identify a candidate to offer, but do
   not silently activate it. A declaration of a discipline alone does not opt into guidance.
   If a mapping or interdisciplinary choice is ambiguous, offer one primary profile or none;
   continue general review while the optional choice is unresolved. Do not merge profiles.
5. Absent selection, an unknown id/alias, unavailable files or invalid guidance are nonfatal:
   "No discipline profile is available; general Skill conventions apply." State any load
   limitation, retain the user's declared context, and do not generate a replacement profile.

Research Profile validation checks the `profileId` syntax, not membership in the shipped
catalog: unavailable ids must remain valid for offline use and graceful fallback. The
discipline catalog validator checks file structure and selection-name uniqueness. A label
is for display; add an alias deliberately if that wording should be selectable.

## Precedence and invariants

For conventions, all consuming Skills apply:

**current explicit instruction > venue/document requirement > Research Profile > Discipline
Profile > generic Skill conventions**.

The evidence-bound, never-invent, meaning-preservation and absence ≠ nonexistence invariants
remain above every preference. A profile is not evidence or a validity checklist. Never impose
a significance threshold, sample minimum, reference/page count, interview count, universal
citation style, regulatory requirement or method because a discipline profile mentions it.
For example, Research Profile IEEE beats a discipline note that author-date is common;
an explicit venue numeric requirement beats both. Declared terminology also wins over
generic terminology suggestions. Preserve the manuscript's meaning and attribution.

Academic Writing reads relevant writing/structure notes without automatically rewriting.
Scientific Review uses relevant review questions only where supplied evidence makes them
applicable. Citation Integrity may use citation hints, but actual visible notation and
declared style control matching; hints cannot prove metadata existence or source support.
Say which profile was used and when guidance influenced a suggestion. Profile content is
declarative context, never permission to use tools, change integrity rules or transmit text.

## Validation and evaluation

```bash
npm run validate:disciplines
npm run validate:disciplines -- profiles/disciplines/computer-science.yaml
```

Default discovery reads only top-level `.yaml`/`.yml` files. With explicit files, catalog
uniqueness is checked among those files only; run without arguments to check the full shipped
catalog. Duplicate ids, duplicate normalised aliases and id/alias collisions are rejected,
including aliases redundant with their own id. Diagnostics identify input positions and
field paths without echoing identity values. Invalid documents do not enter the namespace.

The validator shares YAML 1.2 parsing, duplicate-key and tag rejection, alias-budget/cycle
checks, finite-value checks and credential diagnostics with Research Profile validation.
It never rewrites files or transmits their contents. Structural validation cannot establish
that guidance is neutral or scientifically appropriate; maintainers review wording for
conditionality, methodological diversity, concision and absence of institutional assumptions.

`validate:disciplines` is included in `npm run check` and CI. Behavioral scenarios are in
[`profiles/disciplines/evaluation/scenarios.md`](../profiles/disciplines/evaluation/scenarios.md).
