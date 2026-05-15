# Codex Project Instructions

## Repository Purpose

This repository contains the VitaLoop product code and documentation.

VitaLoop is a recurring wellness companion for busy people. It helps users remember small self-care actions throughout the day through recurring wellness nudges, including hydration reminders, eye strain breaks, stretching, standing or walking, posture checks, breathing and stress resets, sleep routine nudges, and mood or energy check-ins.

Use `VitaLoop` for the user-facing product and app name. Use `vitaloop` for technical identifiers, directory names, package names, repository names, and future bundle identifiers.

VitaLoop is not a medical app. It must not make medical claims or provide diagnosis, treatment, clinical advice, or emergency guidance.

## Branch and Commit Rules

- Start new work from the latest `main` branch unless the user explicitly requests otherwise.
- Use short, descriptive branches such as `codex/fix-<bug>`, `codex/feature-<feature>`, `codex/refactor-<area>`, `codex/test-<area>`, `codex/docs-<topic>`, `codex/audit-<topic>`, `codex/release-<version>`, `codex/hotfix-<issue>`, or `codex/misc-<issue>`.
- Keep branches medium-sized and reviewable.
- Commit only completed, validated work.
- Use conventional commit messages unless the task specifies a different message.
- Do not rewrite user work or revert changes you did not make without explicit approval.

## Validation Rules

- Run the relevant validation commands before committing.
- For documentation-only changes, run at minimum `git diff --check`.
- For implementation changes, run the available lint, typecheck, test, and build commands.
- If a validation command cannot be run because tooling is not installed or does not exist yet, report that clearly.
- Do not claim validation passed unless it was actually run.

## Testing Rules

- Add or update tests with behavior changes.
- Keep tests focused on user-visible behavior and critical logic.
- Maintain the existing coverage target. If the repository has 100% coverage, preserve 100%.
- Prefer deterministic tests over timing-dependent tests.
- Cover edge cases for scheduling, storage fallback, invalid data, accessibility-critical flows, and safety-sensitive copy.

## Security Rules

- Do not commit secrets, tokens, private keys, credentials, or local environment files.
- Keep `.env` files local unless an example file is explicitly needed.
- Avoid unnecessary dependencies.
- Treat reminder data, preferences, mood or energy check-ins, and usage history as sensitive user data.
- Prefer local-first behavior until cloud sync or accounts are explicitly requested.
- Do not add analytics, payment, backend, or external service integrations without explicit approval.

## Medical/Wellness Safety Rules

- Use supportive wellness language only.
- Do not describe VitaLoop as a medical device, clinical tool, treatment tool, diagnostic tool, or therapy replacement.
- Do not make claims that reminders prevent, treat, diagnose, or cure health conditions.
- Do not provide medical advice or emergency advice.
- Encourage users to seek qualified professional help for medical concerns in general safety copy when appropriate.
- Keep reminders gentle, optional, and user-controlled.

## Minimal-Code Rules

- Prefer the simplest implementation that fully satisfies the requested behavior.
- Do not add speculative abstractions, unused components, unused hooks, unused helpers, placeholder services, or future-only code unless explicitly requested.
- Do not introduce a dependency when a small local helper is sufficient.
- Do not create generic frameworks for one current use case.
- Keep functions small, readable, and testable.
- Prefer clear code over clever code.
- Avoid code golf, dense one-liners, or overly compressed logic.
- Remove dead code, unused imports, unused files, redundant types, and obsolete comments.
- Keep UI components focused and avoid premature design-system expansion.
- Every new file must have a clear current purpose.
- Every abstraction must have at least two clear current uses unless it isolates platform behavior, storage, time, or external integration.

## Stop Conditions

Stop and ask for clarification before modifying files when:

- Meaningful existing project files are present and the task expects an empty or harmless directory.
- The requested change would materially alter production behavior and the desired behavior is ambiguous.
- The request would introduce medical claims, clinical advice, emergency guidance, or regulated-health positioning.
- The request would add backend services, analytics, payments, accounts, cloud sync, native folders, or package dependencies without explicit approval.
- The required changes fall outside the approved file scope.
- A command would be destructive, rewrite history, or discard user changes.

## Definition of Done

- The requested behavior or documentation change is complete.
- Changes are limited to the approved scope.
- Required validation has been run and reported.
- Tests are added or updated when behavior changes.
- The repository remains free of secrets and generated artifacts.
- Documentation reflects the current project state.
- One clean commit is created when the task asks for a commit.
