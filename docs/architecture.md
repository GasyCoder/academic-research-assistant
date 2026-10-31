# Architecture

## Core principle

Academic Research Assistant separates technical capabilities from academic reasoning.

```text
AI Client
   |
   +-- Academic Skills
   |      |
   |      +-- Academic Writing
   |      +-- Scientific Review
   |      +-- Research Profile
   |      +-- Citation Integrity
   |
   +-- MCP Tools
          |
          +-- LanguageTool MCP
                 |
                 +-- Local LanguageTool Server
```

## Layers

### MCP tools

Deterministic technical capabilities, such as linguistic analysis.

MCP servers contain no academic-domain reasoning: they know nothing about
thesis structure, citation styles, disciplines, methodologies, universities
or research topics.

### Academic Skills

Academic reasoning and contextual guidance. Skills interpret discipline,
methodology, document type, academic language, citation style and journal
requirements, and decide how to use the results returned by MCP tools.

### Research Profile

Dynamic, project-specific context of the researcher. It is configurable and
never hard-coded into reusable Skills or MCP servers.

### Discipline Profiles

Optional, versioned, non-personal YAML guidance in `profiles/disciplines/`, separate from
project context. A Research Profile can explicitly select one primary profile through
`discipline.profileId`; existing profiles remain valid without it. No selection is inferred
from manuscript content, and unavailable guidance falls back to general Skill conventions.
There is no multi-profile merge engine or new MCP tool.

For conventions: current explicit instruction > venue/document requirement > Research
Profile > Discipline Profile > generic Skill conventions. Never-invent, evidence-bound
reasoning, meaning preservation and absence ≠ nonexistence remain overriding invariants.
Discipline guidance is conditional context, never evidence or a scientific-validity rule.
Selection, schema and validation: [discipline-profiles.md](discipline-profiles.md).
