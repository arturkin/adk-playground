# References for Test Recorder

## Similar Implementations

### generate command

- **Location**: `src/index.ts` (lines 280-353)
- **Relevance**: Shows how to structure a CLI command that produces test files
- **Key patterns**: `setOutputDir()`, browser launch, Commander.js options

### formatTestMarkdown + slugify

- **Location**: `src/tools/planning.ts`
- **Relevance**: Must be exported and reused to produce test markdown files
- **Key patterns**: `formatTestMarkdown(data)` accepts typed input, returns markdown string

### planner agent

- **Location**: `src/agents/planner.ts`
- **Relevance**: Example of how the navigator model is used for generation tasks
- **Key patterns**: `config.models.navigator` for model selection

### Viewport presets

- **Location**: `src/constants.ts` — `DEFAULT_VIEWPORTS` array
- **Relevance**: resolveViewportSize() uses these to get width/height for codegen
