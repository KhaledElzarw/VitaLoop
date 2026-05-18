# VitaLoop Product Backlog

## Completed Increments

- [x] MVP reminder experience: Today overview, next wellness nudge, reminder category cards, selected reminder details, and Reminders empty/error states.
- [x] Settings and storage foundation: Zod settings schema, safe defaults, localStorage service, Settings save/reset UI, and invalid stored data fallback.
- [x] Reminder scheduling core: pure quiet-hours/workday checks, intensity-adjusted frequencies, next reminder calculation, and simulated next timing in Home and Reminders.
- [x] Simulated reminder actions: in-app done, snooze, and skip once actions with deterministic local state and no persistence or notification APIs.
- [x] Accessibility basics: named landmarks, one active screen heading, skip link, keyboard-reachable controls, and live status messages.
- [x] Mobile visual polish: calmer palette, improved card hierarchy, selected reminder state, status treatments, and bottom navigation polish.
- [x] Chromium extension MVP shell: Manifest V3 popup/options pages, local extension settings storage, and no content scripts, background worker, notifications, alarms, host permissions, backend, analytics, or external APIs.
- [x] Unlocked Chromium background reminders: opt-in Manifest V3 service worker, `chrome.alarms` scheduling, local `chrome.notifications`, popup status, options controls, and no content scripts, host permissions, backend, analytics, accounts, payments, or cloud sync.
- [x] macOS-inspired extension UI polish: compact frosted popup, grouped settings pane, clear proactive reminder status, and CSS-only visual treatment without external or Apple assets.

## P0 Foundation

- Repository bootstrap
- AGENTS.md project instructions
- Product brief
- Product backlog
- React + TypeScript + Vite scaffold
- Minimal responsive app shell
- Capacitor config only, without native folders
- Basic test/lint/build setup
- README setup instructions

## P0 Core Screens

- Home
- Reminders
- Settings
- Backlog
- Watch Preview
- About

## P0 Reminder Categories

- Hydration
- Eye strain
- Stretch
- Stand/walk

## P1 Reminder Categories

- Posture
- Breathing/stress reset
- Sleep routine
- Mood/energy check-in
- Custom reminder

## P1 Settings

- Quiet hours
- Workday window
- Reminder intensity
- Preferred categories
- Reset to defaults

## P1 Reminder Engine

- Pure scheduling helpers
- Next reminder calculation
- Snooze
- Skip once
- Enable/disable reminder
- Reminder history

## P1 UX

- Empty states
- Loading states
- Error states
- Gentle copy
- Responsive mobile-first layout
- Accessibility basics

## P1 Local Storage

- Settings persistence
- Reminder preferences persistence
- Safe defaults
- Invalid data fallback

## P2 Notifications

- Browser notification planning
- Opt-in Chromium browser notifications
- Mobile local notification planning
- Permission UX
- Notification copy

## P2 Chromium Extension

- Popup MVP
- Options page MVP
- Local extension settings storage
- Manual load-unpacked validation
- Opt-in background reminder worker without page reading
- Alarm scheduling without host permissions

## P2 Mobile Packaging

- Capacitor iOS shell
- Capacitor Android shell
- App icon/splash planning
- Native validation checklist

## P2 Apple Watch

- Watch companion product plan
- WatchConnectivity contract
- Haptic reminder concept
- Done/snooze/skip actions
- Native SwiftUI prototype

## P2 Smart Behavior

- AI personalized reminder timing
- Busy-day adaptive reminders
- Smart frequency learning
- Habit streaks
- Weekly wellness summary

## P3 Backend/Cloud

- Account system
- Cloud sync
- Backup/export
- Privacy controls
- Team/workplace wellness mode

## P3 Monetization

- No monetization is planned for the current unlocked extension experience.
- Any future monetization strategy requires explicit approval before design or implementation.

## P3 Analytics

- Privacy-conscious product analytics
- Engagement dashboard
- Reminder completion rates
- Churn/friction signals
