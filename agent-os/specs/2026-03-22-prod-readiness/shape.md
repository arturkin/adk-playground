# Production Readiness — Shaping Notes

## Scope

Prepare ADK-QA for production by adding structured logging with GCP Cloud Logging, improving GitHub Actions secrets management, and making CI output production-grade with log grouping and job summaries.

## Decisions

- **Logger architecture**: Custom lightweight logger with transport pattern (console, CI, GCP) — replaces unused winston dependency
- **GCP auth**: Base64-encoded service account JSON key stored in GH Actions secrets — no GCP Secret Manager needed since runtime is GH Actions only
- **CI output**: GitHub Actions `::group::` markers for collapsible test sections, `$GITHUB_STEP_SUMMARY` for test results, `::error::`/`::warning::` annotations
- **Transport selection**: Automatic based on env — console always, CI when `CI=true`, GCP when `GCP_PROJECT_ID` is set
- **Graceful degradation**: GCP transport no-ops when credentials not configured

## Context

- **Visuals:** None
- **References:** No existing codebase references — designed from scratch
- **Product alignment:** Aligns with roadmap Phase 2 "Observability & Analytics" and tech-stack's GCP infrastructure direction
