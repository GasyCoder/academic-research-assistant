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
