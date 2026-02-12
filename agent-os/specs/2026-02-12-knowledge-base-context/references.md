# Knowledge Base Context -- References

## Impacted Files

- **`src/config/schema.ts`**: Add `knowledgeBaseDir` to configuration.
- **`src/config/index.ts`**: Initialize `knowledgeBaseDir` from environment or default.
- **`src/tests/discovery.ts`**: Add utility to load knowledge base files.
- **`src/tests/runner.ts`**: Pass loaded knowledge base to agent session state.
- **`src/agents/navigator.ts`**: Update instruction to include `{knowledge_base}`.
- **`src/agents/validator.ts`**: Consider if validator also needs knowledge base context.
- **`package.json`**: No changes needed.
- **`.env`**: Add `KNOWLEDGE_BASE_DIR` (optional).

## New Files

- **`knowledge-base/`**: Directory for context files.
- **`knowledge-base/general.md`**: Initial general terms.
- **`knowledge-base/guidetoiceland.md`**: Specific knowledge for the main target site.
