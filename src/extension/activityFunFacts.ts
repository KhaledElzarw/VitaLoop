import {
  type BuiltinReminderId,
  type ReminderDefinition,
} from "../domain/schemas";

type TenActivityFacts = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export const activityFunFactsByReminderId = {
  hydration: [
    "Water helps your body regulate temperature, so a small sip can be useful before you feel thirsty.",
    "Your body uses water to lubricate and cushion joints, including during a long desk day.",
    "Water helps carry nutrients through your bloodstream and move everyday waste out of the body.",
    "Plain water has zero calories, making it an easy default between coffee or sweet drinks.",
    "Thirst can lag behind fluid needs, so tiny sips help hydration stay low effort.",
    "A bottle in sight turns hydration into a visual cue, not another task to remember.",
    "Hydrating foods like fruit, soup, and yogurt can contribute to your daily fluid intake.",
    "Pale yellow urine is often a simple clue that your hydration is in a comfortable range.",
    "Moderate caffeine can fit many adult routines, while water still makes a steady baseline.",
    "Dry indoor air, sweating, or packed meetings can make a quick water break more useful.",
  ],
  "eye-strain": [
    "The 20-20-20 reset is simple: every 20 minutes, look about 20 feet away for 20 seconds.",
    "People often blink less during screen work, so a break is a good moment for a few full blinks.",
    "Looking farther away lets the focusing muscles used for close screens relax for a moment.",
    "A screen slightly below eye level can feel easier because your eyelids cover more of the eye.",
    "Glare makes eyes work harder, so shifting a lamp or screen angle can help quickly.",
    "Bumping text size up one notch can reduce squinting without changing your whole setup.",
    "Dust and fingerprints add visual haze, so a quick screen wipe can make reading easier.",
    "Contact lens wearers may notice screen dryness sooner; blinking breaks can be extra useful.",
    "Eye comfort often improves when screen brightness roughly matches the room around you.",
    "Distant-focus breaks help your eyes reset without needing to stop work for long.",
  ],
  stretch: [
    "Stretching supports range of motion, which can make everyday reaching and turning easier.",
    "Warm muscles usually stretch more comfortably, so gentle movement first is a good start.",
    "A stretch should feel mild, not sharp; backing off still counts as useful movement.",
    "Slow breathing during a stretch can help you avoid bracing your shoulders.",
    "Short stretch breaks can be useful even when you do not have time for a workout.",
    "Dynamic stretches use movement, while static stretches hold one position for a short time.",
    "Hips and chest often tighten during long sitting, so small openers can feel refreshing.",
    "Balanced stretching means giving both sides similar attention, even when one feels tighter.",
    "Gentle mobility can wake up joints before you ask them for bigger movement.",
    "Flexibility changes gradually, so consistency beats one heroic stretch session.",
  ],
  "stand-walk": [
    "Adults who sit less and move more can gain health benefits, even with light activity.",
    "A two-minute walk can be enough to change scenery and reset your attention.",
    "Walking activates large leg muscles, making it a simple way to break up sitting.",
    "Standing for a moment lets you check whether your chair and desk still feel right.",
    "Small movement snacks add up best when they are easy and repeatable.",
    "A short walk to refill water pairs two wellness cues in one quick loop.",
    "Light movement after a long focus block can make the next task feel less abrupt.",
    "Taking stairs or a longer route can add movement without scheduling a workout.",
    "Gentle walking is adjustable: a slow pace still counts as a break from sitting.",
    "Movement breaks can be quiet; pacing during a call works if your space allows.",
  ],
  posture: [
    "Neutral posture usually means relaxed shoulders, elbows near your body, and straight wrists.",
    "Your best posture is often your next posture; changing position matters during long sessions.",
    "Keeping your screen near eye level can reduce the urge to crane your neck forward.",
    "Feet supported on the floor or a footrest can make sitting feel steadier.",
    "A keyboard close enough to keep elbows relaxed can reduce shoulder shrugging.",
    "Wrists tend to feel better when they stay in line with your forearms while typing.",
    "Looking down at a laptop for long stretches can pull your head and shoulders forward.",
    "A tiny shoulder roll can reveal tension before it turns into your default posture.",
    "Bringing work closer to you is often easier than leaning your body toward the work.",
    "Posture checks are not about sitting perfectly; they are quick chances to reduce strain.",
  ],
  "breathing-reset": [
    "Slow breathing is a relaxation technique that can cue your body to settle.",
    "Longer exhales can make a breathing break feel calmer without needing extra time.",
    "Diaphragmatic breathing focuses on slow, deep breaths that move the belly more than the chest.",
    "Counting breaths gives your attention a simple anchor when your mind is crowded.",
    "Relaxation techniques can include deep breathing, guided imagery, or muscle release.",
    "Three steady breaths can create a real pause before you answer a message.",
    "Breathing through the nose can naturally slow the pace for many people.",
    "Dropping your shoulders before a breath gives your rib cage a little more room.",
    "A breathing reset works best when it feels comfortable, not forced.",
    "Pairing a breath with a hand on your chest or belly can make the cue easier to notice.",
  ],
} satisfies Partial<Record<BuiltinReminderId, TenActivityFacts>>;

function hasActivityFunFacts(
  reminderId: ReminderDefinition["id"],
): reminderId is keyof typeof activityFunFactsByReminderId {
  return reminderId in activityFunFactsByReminderId;
}

function normalizeFactSeed(factSeed: number) {
  if (!Number.isFinite(factSeed)) {
    return 0;
  }

  return Math.min(Math.max(factSeed, 0), 0.999_999);
}

export function getActivityFunFact(
  reminder: ReminderDefinition,
  factSeed = Math.random(),
) {
  if (!hasActivityFunFacts(reminder.id)) {
    return reminder.description;
  }

  const facts = activityFunFactsByReminderId[reminder.id];
  const factIndex = Math.floor(normalizeFactSeed(factSeed) * facts.length);

  return facts[factIndex];
}
