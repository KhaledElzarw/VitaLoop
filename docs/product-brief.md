# VitaLoop Product Brief

## Product Vision

VitaLoop helps busy people remember small self-care actions throughout the day through recurring wellness nudges that feel calm, practical, and easy to act on.

The product should reduce the friction of remembering healthy breaks without turning wellness into a complex tracking system. VitaLoop should feel supportive and lightweight, with user-controlled reminders and gentle language.

## Target User

VitaLoop is for people with full schedules who often lose track of basic self-care during work, study, travel, caregiving, or long screen-heavy days.

Primary users may include:

- Desk workers who forget hydration, movement, or eye breaks.
- Students balancing study sessions and screen time.
- Remote workers who need structure around breaks and routine.
- Busy caregivers or professionals who want lightweight reminders without heavy setup.

## Problem Statement

Many people intend to drink water, rest their eyes, stretch, stand, breathe, check posture, wind down for sleep, or notice their mood and energy, but these actions are easy to forget during focused or stressful days.

Existing habit tools can feel too rigid, too clinical, too noisy, or too focused on streaks. VitaLoop should focus on useful, recurring nudges that are simple to configure and easy to ignore, snooze, or complete.

## MVP Scope

The MVP should include:

- A minimal responsive app shell.
- Home, Reminders, Settings, Backlog, Watch Preview, and About screens.
- Core reminder categories for hydration, eye strain, stretch, and stand/walk.
- Gentle reminder copy and wellness-safe product language.
- Basic settings planning for quiet hours, workday window, reminder intensity, and preferred categories.
- Pure scheduling helper planning for calculating upcoming reminders.
- Local-first data direction for preferences and reminder state.
- Capacitor readiness without generating native iOS or Android folders during initial web implementation.

## Non-Goals

The MVP should not include:

- Medical claims, diagnosis, treatment, clinical advice, or emergency guidance.
- Accounts, cloud sync, backend services, analytics, payments, or external services.
- Native iOS, Android, or watchOS source until explicitly requested.
- AI personalization until the core reminder experience is proven.
- Complex habit scoring, competitive streak pressure, or clinical tracking.
- Any feature that requires collecting sensitive data without a clear product need and privacy plan.

## Wellness Safety and Disclaimer Direction

VitaLoop should consistently present itself as a wellness companion, not a medical device or medical advice tool.

Safety copy should:

- Use supportive, optional language.
- Avoid guarantees or outcome claims.
- Avoid disease, diagnosis, treatment, prevention, or clinical phrasing.
- Remind users that VitaLoop is for general wellness support only.
- Encourage users to consult qualified professionals for medical concerns when appropriate.

Example direction:

> VitaLoop supports general wellness routines and everyday self-care reminders. It is not medical advice, diagnosis, treatment, or emergency guidance.

## Future iOS/Android Path Through Capacitor

VitaLoop can later use Capacitor to package the web app for iOS and Android.

Near-term mobile direction:

- Add Capacitor configuration only when the web scaffold exists.
- Avoid generating `ios/` or `android/` folders until native validation is explicitly requested.
- Keep reminder logic platform-independent so it can be tested outside native shells.
- Plan mobile local notifications separately from browser notifications.
- Validate native builds only after the product has a stable web baseline.

## Future Apple Watch Path Through Native SwiftUI Companion App

The Apple Watch path should be a native SwiftUI companion app, planned after the core mobile experience is stable.

Future watch direction:

- Use a small companion experience focused on glanceable reminders.
- Support done, snooze, and skip actions.
- Consider gentle haptics for reminders.
- Define a WatchConnectivity contract before implementation.
- Keep watch behavior aligned with user preferences, quiet hours, and reminder intensity.
- Avoid building watchOS source until explicitly requested.
