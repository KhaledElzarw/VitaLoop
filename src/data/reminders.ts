import {
  reminderDefinitionSchema,
  type ReminderDefinition,
} from "../domain/schemas";

export const reminders: ReminderDefinition[] = reminderDefinitionSchema
  .array()
  .parse([
    {
      id: "hydration",
      title: "Hydration",
      cadenceMinutes: 90,
      prompt: "Pause for a sip of water when it fits your moment.",
      enabledByDefault: true,
    },
    {
      id: "eye-strain",
      title: "Eye strain",
      cadenceMinutes: 45,
      prompt: "Look away from the screen and soften your focus.",
      enabledByDefault: true,
    },
    {
      id: "stretch",
      title: "Stretch",
      cadenceMinutes: 120,
      prompt: "Take a light stretch break to reset your posture.",
      enabledByDefault: true,
    },
    {
      id: "stand-walk",
      title: "Stand/walk",
      cadenceMinutes: 60,
      prompt: "Stand up or take a short walk if your day allows.",
      enabledByDefault: true,
    },
    {
      id: "posture",
      title: "Posture",
      cadenceMinutes: 75,
      prompt: "Notice your shoulders, neck, and sitting position.",
      enabledByDefault: false,
    },
    {
      id: "breathing-reset",
      title: "Breathing reset",
      cadenceMinutes: 180,
      prompt: "Take a few calm breaths before returning to your task.",
      enabledByDefault: false,
    },
    {
      id: "sleep-routine",
      title: "Sleep routine",
      cadenceMinutes: 1440,
      prompt: "Start winding down with a small evening routine.",
      enabledByDefault: false,
    },
    {
      id: "mood-energy",
      title: "Mood/energy check-in",
      cadenceMinutes: 240,
      prompt: "Check in with how you feel and what you need next.",
      enabledByDefault: false,
    },
  ]);
