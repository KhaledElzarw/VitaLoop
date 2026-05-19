# Chromium Extension Notification Reliability

VitaLoop reminder notifications use the standard Chromium extension
`chrome.notifications` API with local `chrome.alarms` scheduling. This keeps the
feature local, opt-in, and compatible with Chromium-based browsers such as
Chrome, Edge, Brave, Atlas, and compatible Chromium browsers.

## What VitaLoop Controls

- VitaLoop controls the notification title, message, context text, packaged icon
  asset, and the two action buttons: Done and Snooze.
- VitaLoop requests persistent display with `requireInteraction: true`.
- VitaLoop can clear a notification after the user clicks the notification or an
  action button.
- VitaLoop keeps permissions limited to `storage`, `alarms`, and
  `notifications`.

## Platform Limits

- The operating system and browser control the native notification banner
  layout, icon placement, app attribution, button rendering, timeout behavior,
  and notification center behavior.
- `requireInteraction: true` is a best-effort browser request. macOS, Windows,
  Focus, Do Not Disturb, per-browser notification settings, and browser-specific
  native notification behavior can still affect visibility.
- Chromium extension notifications expose at most two action buttons in the
  current VitaLoop design. VitaLoop uses those buttons for Done and Snooze.
- Native notification banners cannot host VitaLoop HTML, React components,
  custom dropdowns, animated timers, or fully custom macOS-style surfaces.
- `chrome.alarms` is useful for background scheduling, but alarm delivery can be
  delayed by the browser or operating system. It should not be used for
  second-perfect notification countdown UI.

## Manual Validation Checklist

1. Build the extension with `npm run build`.
2. Reload the unpacked `dist` extension in the target Chromium-based browser.
3. Open VitaLoop Options and confirm proactive reminders are enabled.
4. Select Send test notification.
5. Confirm the notification uses VitaLoop copy, the VitaLoop brand logo, and the
   Done and Snooze actions.
6. If the browser reports success but no banner appears, check system
   notification settings for the active browser and its alert helper, then check
   Focus or Do Not Disturb.
7. Repeat in at least one additional Chromium-based browser when practical.

## References

- Chrome Extensions `chrome.notifications` API:
  <https://developer.chrome.com/docs/extensions/reference/api/notifications>
- Chrome Extensions notification guide:
  <https://developer.chrome.com/docs/extensions/develop/ui/notify-users>
- Chrome Extensions `chrome.alarms` API:
  <https://developer.chrome.com/docs/extensions/reference/api/alarms>
- macOS notification settings:
  <https://support.apple.com/guide/mac-help/notifications-settings-mh40583/mac>
- Windows notification settings:
  <https://support.microsoft.com/windows/notifications-and-do-not-disturb-in-windows-feeca47f-0baf-5680-16f0-8801db1a8466>
