# Knowledge Base Context -- Shaping Notes

## Scope

Implement a "Knowledge Base" system that allows defining domain-specific terms, UI components, and common procedures in separate context files. These files will be provided to the QA agents to help them interpret test steps more accurately and make test files more readable by removing low-level details.

## Decisions

- **Storage in `knowledge-base/`** -- Create a dedicated directory in the project root for context files.
- **Markdown Format** -- Context files will be written in Markdown for readability and ease of maintenance.
- **Automatic Discovery** -- The test runner will automatically discover and load all files in the `knowledge-base/` directory.
- **Agent Injection** -- Loaded knowledge base content will be injected into the `navigator` agent's prompt via a new `{knowledge_base}` template variable.
- **Structured Knowledge** -- Encourage a structure in knowledge base files (e.g., Terms, Components, Procedures) that agents can easily parse.

## Context

- **Product alignment:** Helps scale QA automation by making tests less brittle and easier to read. "AI-powered QA agent" can leverage this tribal knowledge to handle complex UI patterns.
- **Standards:** Follows the Agent OS methodology for repository structure and spec-driven development.

## Proposed Structure for Knowledge Base

```markdown
# [Domain/Area Name]

## Terms

- **Term Name**: Definition or description of the term.

## Components

- **Component Name**: How to identify it and common interactions.

## Procedures

- **Procedure Name**: Sequence of high-level steps.
```
