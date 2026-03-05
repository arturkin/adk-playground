# Knowledge Base Context -- Execution Plan

## Task 1: Update Configuration

1.  **File: `src/config/schema.ts`**
    - Add `knowledgeBaseDir` to `ConfigSchema` with default value `./knowledge-base`.
2.  **File: `src/config/index.ts`**
    - Map `KNOWLEDGE_BASE_DIR` environment variable to `knowledgeBaseDir` in config.

## Task 2: Implement Knowledge Base Loader

1.  **File: `src/tests/discovery.ts`**
    - Implement `loadKnowledgeBase(dir: string): Promise<string>` that reads all `.md` files in the directory and concatenates them with appropriate headers.

## Task 3: Inject Knowledge Base into Agents

1.  **File: `src/agents/navigator.ts`**
    - Add `{knowledge_base}` to the instruction.
2.  **File: `src/agents/validator.ts`**
    - Add `{knowledge_base}` to the instruction (validator might need to know what a "tour card" is).
3.  **File: `src/agents/reporter.ts`**
    - Add `{knowledge_base}` to the instruction (reporter might use it for better descriptions).

## Task 4: Pass Knowledge Base to Session State

1.  **File: `src/tests/runner.ts`**
    - In `runTestCase`, load knowledge base using `loadKnowledgeBase`.
    - Pass it to `runner.sessionService.createSession` in the `state` object as `knowledge_base`.

## Task 5: Create Initial Knowledge Base Files

1.  **Create `knowledge-base/general.md`** with common web terms.
2.  **Create `knowledge-base/guidetoiceland.md`** with site-specific terms (e.g., "booking widget", "tours tab").

## Task 6: Refactor Tests to Use Knowledge Base

1.  **Update `tests/search-tour.md`** and `tests/search-car-rental.md` to use the defined terms, making steps more concise.

## Task 7: Verification

1.  **Run `bun run build`** to ensure everything compiles.
2.  **Run `bun run test:auto`** to verify that tests still pass (or fail correctly) with the new knowledge base context.
3.  **Manually inspect agent logs** to confirm `{knowledge_base}` is being correctly injected.
