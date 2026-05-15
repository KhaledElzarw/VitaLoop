# VitaLoop

VitaLoop is a recurring wellness companion for busy people. It helps users remember small self-care actions throughout the day through calm, practical wellness nudges.

VitaLoop is a wellness companion, not a medical app.

## Local Development

Install dependencies:

```bash
npm install
```

Start the web app:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Run tests:

```bash
npm test -- --run
```

Run lint:

```bash
npm run lint
```

## Chrome Extension MVP

Build the web app and extension pages:

```bash
npm run build
```

Load the local extension in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select Load unpacked.
4. Choose the `dist` folder.
5. Test the VitaLoop popup and Options page manually.

The MVP stores settings with `chrome.storage.local` only. It does not include
content scripts, browser notifications, alarms, a background service worker,
host permissions, backend services, analytics, external APIs, or page reading.

## Current Architecture

- React, TypeScript, and Vite provide the web foundation.
- The app uses simple React tab state for Home, Reminders, Settings, Backlog, Watch Preview, and About.
- Zod schemas define reminder definitions and app settings.
- Mocked reminder data covers hydration, eye strain, stretch, stand/walk, posture, breathing reset, sleep routine, and mood/energy check-in.
- Settings use safe local defaults and a small localStorage-backed service for quiet hours, reminder intensity, workday window, timezone, and preferred reminder categories.
- Pure scheduling helpers calculate quiet-hour blocks, workday eligibility, intensity-adjusted frequencies, and simulated next reminder times without timers or notification APIs.
- Reminder actions are simulated in app state for now: done, snooze, and skip once do not persist history or trigger notifications.
- A minimal Manifest V3 Chrome extension MVP builds popup and options pages from the shared reminder settings, scheduling, and action logic.
- Vitest with React Testing Library covers the app shell, navigation, reminders, backlog categories, and settings schema behavior.
- Styling is minimal custom CSS with a mobile-first shell and bottom navigation.
- Data is local and mocked. There are no backend services, analytics SDKs, payments, accounts, external API calls, or real notification permissions.

## Future iOS and Android Path

Capacitor is configured with `appName: "VitaLoop"`, `appId: "com.vitaloop.app"`, and `webDir: "dist"` so the web app can later be packaged for iOS and Android.

The current foundation intentionally does not generate `ios/` or `android/` folders. Native shells should be added only when mobile validation is explicitly requested.

During future native packaging, Capacitor Preferences can replace browser localStorage for app settings without changing the user-facing settings model.

## Future Apple Watch Strategy

The Apple Watch direction is a future native SwiftUI companion app after the core mobile experience is stable. It should stay focused on glanceable reminders and simple done, snooze, or skip actions, with a clear WatchConnectivity contract before implementation.

No watchOS source is included in this web foundation.

## Product Positioning

VitaLoop is calm, useful, and practical. It supports everyday self-care reminders such as hydration, eye strain breaks, stretching, standing or walking, posture checks, breathing and stress resets, sleep routine nudges, and mood or energy check-ins.

VitaLoop supports general wellness routines and everyday self-care reminders. It is not medical advice, diagnosis, treatment, or emergency guidance.
