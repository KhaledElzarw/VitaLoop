# VitaLoop

VitaLoop is a recurring wellness companion for busy people. It helps users remember small self-care actions throughout the day through calm, practical wellness nudges.

## Current Status

This repository is in pre-implementation bootstrap. It currently contains product documentation, backlog planning, repository rules, and minimal-code Codex instructions.

No app source code, package manifest, dependencies, native mobile folders, backend services, analytics, payments, or external integrations have been added yet.

## Product Positioning

VitaLoop is calm, useful, and practical. It supports everyday self-care reminders such as hydration, eye strain breaks, stretching, standing or walking, posture checks, breathing and stress resets, sleep routine nudges, and mood or energy check-ins.

VitaLoop is a wellness companion, not a medical app.

## Local Development

Local development tooling has not been scaffolded yet.

Planned next implementation step:

```bash
# Future task: scaffold React + TypeScript + Vite
```

Do not install packages or create a package manifest until the implementation scaffold is explicitly requested.

## Validation

Current documentation-only validation:

```bash
git status --short
git diff --check
```

Future implementation validation should include the available lint, typecheck, test, and build commands after tooling exists.

## Roadmap Summary

- P0: Repository bootstrap, product documentation, backlog, React + TypeScript + Vite scaffold, responsive app shell, Capacitor config without native folders, basic validation tooling, README setup instructions.
- P0: Core screens for Home, Reminders, Settings, Backlog, Watch Preview, and About.
- P0: Reminder categories for hydration, eye strain, stretch, and stand/walk.
- P1: Additional reminder categories, settings, pure reminder engine helpers, local storage, accessibility basics, and responsive UX states.
- P2: Notification planning, mobile packaging, and Apple Watch companion planning.
- P3: Backend/cloud, monetization, and privacy-conscious analytics.

## Safety Note

VitaLoop is a wellness companion. It is not a medical device, diagnostic tool, treatment tool, or medical advice product. It should not be used for diagnosis, treatment, clinical decision-making, or emergency situations.
