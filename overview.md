│ Project Overview & Assessment: ADK-QA                                                                                                                           │
│                                                                                                                                                                 │
│ What This Project Is                                                                                                                                            │
│                                                                                                                                                                 │
│ ADK-QA is an AI-powered QA automation tool that uses Google Gemini LLMs + Google Agent Development Kit (ADK) to autonomously test web applications — without    │
│ CSS/XPath selectors. Instead of brittle selectors, it injects visual bounding-box markers (Set-of-Mark prompting) onto pages and lets the LLM "see" and         │
│ interact with elements by their visual IDs.                                                                                                                     │
│                                                                                                                                                                 │
│ Core Architecture                                                                                                                                               │
│                                                                                                                                                                 │
│ A 4-phase multi-agent pipeline orchestrated by a custom BaseAgent:                                                                                              │
│                                                                                                                                                                 │
│ 1. Navigator (LlmAgent in LoopAgent, max 20 iterations) — browses the web via Puppeteer tools, guided by screenshots with visual markers                        │
│ 2. Validator (LlmAgent) — takes a fresh screenshot and evaluates each assertion independently                                                                   │
│ 3. Evaluator (LlmAgent) — audits the validator for rubber-stamping; can override PASS→FAIL                                                                      │
│ 4. Reporter (LlmAgent) — generates structured QA report                                                                                                         │
│                                                                                                                                                                 │
│ Two Modes                                                                                                                                                       │
│                                                                                                                                                                 │
│ - Manual: bun start manual "Go to X and check Y" — ad-hoc QA task                                                                                               │
│ - Automated: bun start auto — runs markdown-defined test suites headlessly                                                                                      │
│                                                                                                                                                                 │
│ Self-Correction (3 levels)                                                                                                                                      │
│                                                                                                                                                                 │
│ 1. Within-run: retry strategies when interactions fail                                                                                                          │
│ 2. Cross-run: failure lessons stored in .qa-lessons/ and injected into future prompts                                                                           │
│ 3. Test-level: suggests corrections to test definitions after 3+ consecutive failures                                                                           │
│                                                                                                                                                                 │
│ ---                                                                                                                                                             │
│ Tech Stack Assessment                                                                                                                                           │
│                                                                                                                                                                 │
│ ┌─────────────────┬─────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────┐                           │
│ │      Layer      │                         Choice                          │                        Verdict                        │                           │
│ ├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤                           │
│ │ Language        │ TypeScript                                              │ Good — strong typing for complex agent state          │                           │
│ ├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤                           │
│ │ Runtime         │ Bun                                                     │ Good — fast, native TS, good DX                       │                           │
│ ├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤                           │
│ │ LLM             │ Google Gemini (2.5-flash default, migrating to 3-flash) │ Reasonable — multimodal (screenshots), cost-effective │                           │
│ ├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤                           │
│ │ Agent Framework │ Google ADK (@google/adk v0.5)                           │ See analysis below                                    │                           │
│ ├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤                           │
│ │ Browser         │ Puppeteer v24                                           │ Good — battle-tested, headless Chrome                 │                           │
│ ├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤                           │
│ │ CLI             │ Commander.js                                            │ Fine for the scope                                    │                           │
│ ├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤                           │
│ │ Schema          │ Zod v4                                                  │ Good — runtime validation                             │                           │
│ ├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤                           │
│ │ Testing         │ Bun test runner                                         │ Minimal — only 1 unit test exists                     │                           │
│ └─────────────────┴─────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────┘                           │
│                                                                                                                                                                 │
│ ---                                                                                                                                                             │
│ Is Google ADK the Right Tool?                                                                                                                                   │
│                                                                                                                                                                 │
│ What ADK gives you                                                                                                                                              │
│                                                                                                                                                                 │
│ - LlmAgent with tool binding and prompt management                                                                                                              │
│ - LoopAgent for iterative navigation                                                                                                                            │
│ - BaseAgent for custom orchestration                                                                                                                            │
│ - Session state management                                                                                                                                      │
│ - beforeModelCallback / afterModelCallback hooks (used for screenshot injection)                                                                                │
│ - InMemoryRunner for execution                                                                                                                                  │
│                                                                                                                                                                 │
│ Where ADK creates friction                                                                                                                                      │
│                                                                                                                                                                 │
│ Based on the spec history, ADK has caused significant headaches:                                                                                                │
│                                                                                                                                                                 │
│ 1. State propagation bugs (2026-02-12-fix-test-validation): outputKey didn't propagate correctly in custom BaseAgent, requiring manual state plumbing           │
│ 2. Gemini 3 + streaming + tools = empty responses (ADK Issue #4090, 2026-03-05-1200 spec): A known ADK bug that required workarounds                            │
│ (emptyResponseNudgeCallback)                                                                                                                                    │
│ 3. Rapid breaking changes: In ~5 weeks, you went through ADK 0.3→0.4→0.5, each with API renames (ToolContext→CallbackContext→Context)                           │
│ 4. Rubber-stamping required a whole extra agent: The validator agent was too easily fooled, requiring an Evaluator agent as a patch — this is more of an LLM    │
│ reliability issue than ADK's fault, but ADK didn't help prevent it                                                                                              │
│                                                                                                                                                                 │
│ Alternatives to consider                                                                                                                                        │
│                                                                                                                                                                 │
│ ┌──────────────────────────────────┬────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┐  │
│ │           Alternative            │                              Pros                              │                          Cons                          │  │
│ ├──────────────────────────────────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤  │
│ │ No framework (raw Gemini API     │ Full control, no breaking API changes, simpler debugging       │ More boilerplate for tool binding and conversation     │  │
│ │ calls)                           │                                                                │ management                                             │  │
│ ├──────────────────────────────────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤  │
│ │ LangGraph (JS)                   │ Mature graph-based orchestration, good state management        │ Heavier dependency, LangChain ecosystem complexity     │  │
│ ├──────────────────────────────────┼────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤  │
│ │ Custom lightweight orchestrator  │ Tailored to your exact 4-phase pipeline, no external           │ More code to maintain                                  │  │
│ │                                  │ dependency churn                                               │                                                        │  │
│ └──────────────────────────────────┴────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┘  │
│                                                                                                                                                                 │
│ My assessment: ADK is young and unstable (3 breaking releases in 5 weeks). Your pipeline is actually quite simple — a fixed 4-phase sequence. You don't use     │
│ ADK's more advanced features (parallel agents, dynamic routing, A2A). A thin custom orchestrator calling the Gemini API directly would give you more stability  │
│ and fewer surprises. That said, ADK is improving rapidly and betting on Google's ecosystem has long-term benefits if you plan to use more ADK features later.   │
│                                                                                                                                                                 │
│ Verdict: ADK is a defensible choice but comes with real costs. You've already invested heavily and built workarounds. Switching now would be disruptive with    │
│ low ROI unless ADK instability becomes blocking.                                                                                                                │
│                                                                                                                                                                 │
│ ---                                                                                                                                                             │
│ Is the Visual Tagging (Set-of-Mark) Approach Sound?                                                                                                             │
│                                                                                                                                                                 │
│ Yes — this is the strongest part of the project. Set-of-Mark prompting is a well-researched technique for grounding LLM actions in visual UIs. Your             │
│ implementation:                                                                                                                                                 │
│                                                                                                                                                                 │
│ - Red bounding boxes + numeric IDs for interactive elements                                                                                                     │
│ - Blue bounding boxes + T-prefixed IDs for text nodes                                                                                                           │
│ - 40-node cap with priority sorting for text                                                                                                                    │
│ - Force single-tab behavior                                                                                                                                     │
│                                                                                                                                                                 │
│ This is fundamentally more robust than selector-based approaches because:                                                                                       │
│ 1. Visual markers survive CSS/DOM changes that break selectors                                                                                                  │
│ 2. The LLM sees the page as a user would, with augmented labels                                                                                                 │
│ 3. Text node highlighting (added Mar 10) significantly improved the agent's ability to validate content                                                         │
│                                                                                                                                                                 │
│ One risk: This depends entirely on Gemini's vision capabilities. If model quality regresses (which happened with Gemini 3's empty response issue), the whole    │
│ system breaks. Consider having a fallback model configuration.                                                                                                  │
│                                                                                                                                                                 │
│ ---                                                                                                                                                             │
│ Is the Spec-Driven Development (SDD) Methodology Working?                                                                                                       │
│                                                                                                                                                                 │
│ Looking at the 10 specs in agent-os/specs/:                                                                                                                     │
│                                                                                                                                                                 │
│ Strengths:                                                                                                                                                      │
│ - Excellent traceability — every change has a clear "why" documented                                                                                            │
│ - The shape.md → plan.md → references.md structure forces upfront thinking                                                                                      │
│ - Task checklists with verification steps prevent half-done work                                                                                                │
│ - AI agents (you, me) can pick up context from specs without extensive onboarding                                                                               │
│                                                                                                                                                                 │
│ Concerns:                                                                                                                                                       │
│ - Overhead for small changes: The MIME type fix (fix-click-mime-mismatch) was a 1-line change that got a full 3-file spec. The spec took longer to write than   │
│ the fix.                                                                                                                                                        │
│ - Standards are empty: agent-os/standards/index.yml has no content despite being referenced as a key artifact                                                   │
│ - Some specs are tightly coupled: The Feb 12 burst (5 specs in one day) suggests the MVP refactoring spec was too ambitious and spawned emergency fix specs     │
│                                                                                                                                                                 │
│ Verdict: SDD is valuable for this project, especially since AI agents work on it. The overhead for trivial changes is a minor cost. The empty standards file    │
│ should be populated.                                                                                                                                            │
│                                                                                                                                                                 │
│ ---                                                                                                                                                             │
│ Current State & Active Work                                                                                                                                     │
│                                                                                                                                                                 │
│ Completed (Phase 1 MVP): Everything works                                                                                                                       │
│                                                                                                                                                                 │
│ - Multi-agent pipeline (Navigator → Validator → Evaluator → Reporter)                                                                                           │
│ - Visual element tagging (interactive + text nodes)                                                                                                             │
│ - Markdown test definitions with per-step assertions                                                                                                            │
│ - 3-level self-correction pipeline                                                                                                                              │
│ - Regression detection                                                                                                                                          │
│ - Model configuration tracking                                                                                                                                  │
│ - Knowledge base system                                                                                                                                         │
│                                                                                                                                                                 │
│ In Progress (staged in git)                                                                                                                                     │
│                                                                                                                                                                 │
│ 1. Dependency update (2026-03-18-update-all-dependencies) — completed, all 8 tests pass                                                                         │
│ 2. Gemini 3 model migration (2026-03-18-migrate-gemini3-models) — 4/5 tasks done, verification pending                                                          │
│                                                                                                                                                                 │
│ Phase 2 (planned, not started)                                                                                                                                  │
│                                                                                                                                                                 │
│ - Results dashboard                                                                                                                                             │
│ - Advanced failure analysis                                                                                                                                     │
│ - Asana integration                                                                                                                                             │
│ - Auto-fix pipeline (Claude Code / Gemini CLI integration)                                                                                                      │
│ - Plugin system                                                                                                                                                 │
│                                                                                                                                                                 │
│ ---                                                                                                                                                             │
│ Things That Look Good                                                                                                                                           │
│                                                                                                                                                                 │
│ 1. Visual tagging approach — genuinely innovative and more robust than selectors                                                                                │
│ 2. Multi-signal status determination — combining validator text + recorded assertions + step assertions + bug severity + evaluator override is thorough         │
│ 3. Presence/absence safeguard — auto-correcting contradictions (evidence says "not found" but passed=true) is clever                                            │
│ 4. Self-correction pipeline — the 3-level learning system is well-designed                                                                                      │
│ 5. Negative test cases — having purpose-built failing tests prevents rubber-stamping                                                                            │
│ 6. Eval framework — measuring accuracy across positive and negative cases                                                                                       │
│                                                                                                                                                                 │
│ Things to Watch                                                                                                                                                 │
│                                                                                                                                                                 │
│ 1. ADK instability — 3 breaking releases in 5 weeks; budget time for upgrades                                                                                   │
│ 2. Only 1 unit test — the visual tagger test is the only automated test; the rest is E2E via the QA tool itself                                                 │
│ 3. Target site dependency — all tests target guidetoiceland.is; if the site changes, tests break (by design, but worth noting)                                  │
│ 4. ESLint migration skipped — still on ESLint 8, flat config migration deferred                                                                                 │
│ 5. Empty standards — agent-os/standards/index.yml should be populated with the patterns already in AGENTS.md                                                    │
│ 6. _helpers.ts naming — violates the "no underscore-prefixed names" rule in AGENTS.md                                                                           │
│                                                                                                                                                                 │
│ ---                                                                                                                                                             │
│ Conclusion                                                                                                                                                      │
│                                                                                                                                                                 │
│ This is a well-architected project solving a real problem. The core approach (visual tagging + multi-agent validation + self-correction) is sound and genuinely │
│  differentiated. The tech stack choices are reasonable — Google ADK is the riskiest dependency due to its immaturity, but you've built effective workarounds.   │
│ The spec-driven development methodology provides excellent traceability and AI-readability.                                                                     │
│                                                                                                                                                                 │
│ The project is in a strong position with Phase 1 complete and two maintenance specs wrapping up. The Phase 2 roadmap is ambitious but well-scoped.
