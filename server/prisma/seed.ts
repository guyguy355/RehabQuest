/**
 * Demo seed (development / local demo only).
 *
 * - Only touches accounts whose email ends with @rehabquest.example (a reserved
 *   domain). Those accounts and everything they own are deleted and re-created;
 *   no other data in the database is read or changed.
 * - Refuses to run when NODE_ENV=production or against the marked test database.
 * - All people and records are fictional. History is generated relative to
 *   "today" so the demo always shows a session to do today.
 *
 * Run: npm run db:seed   (password for every demo account: Demo1234!)
 */
import { PrismaClient, type Difficulty } from '@prisma/client';
import bcrypt from 'bcrypt';
import { addDays, localDateKey, toDbDate, weekday } from '../src/lib/dates.js';
import { countAchievements, isCosmeticUnlocked, weekStartOf } from '../src/services/gamification.js';
import { createVersionedPlan, type LibraryEntry } from './demo-plan.js';

const prisma = new PrismaClient();
const DEMO_DOMAIN = '@rehabquest.example';
const DEMO_PASSWORD = 'Demo1234!';
const TZ = 'Asia/Jerusalem';
const BADGES = [
  { id: 'first-session', name: 'First Step', description: 'Finished your first planned session.', icon: 'footprints' },
  { id: 'steady-three', name: 'Steady Rhythm', description: 'Finished 3 planned sessions in a row. Rest days never break the rhythm.', icon: 'waves' },
  { id: 'full-week', name: 'Full Week', description: 'Finished every planned session in one plan week.', icon: 'calendar-check' },
  { id: 'halfway', name: 'Halfway There', description: 'Finished half of the planned sessions in a plan.', icon: 'flag' },
  { id: 'plan-complete', name: 'Plan Finisher', description: 'Finished the last planned session of a plan.', icon: 'trophy' },
  { id: 'weekly-goal', name: 'Week Goal Met', description: 'Reached your weekly session goal in one week.', icon: 'target' },
  { id: 'weekly-goal-4', name: 'Four Good Weeks', description: 'Reached your weekly session goal in four different weeks.', icon: 'calendar-heart' },
  { id: 'welcome-back', name: 'Welcome Back', description: 'Finished a planned session after missing three or more planned sessions in a row.', icon: 'sunrise' },
  { id: 'first-check-in', name: 'Checked In', description: 'Sent your first weekly check-in.', icon: 'clipboard-check' },
  { id: 'check-in-4', name: 'Regular Check-ins', description: 'Sent weekly check-ins in four different weeks.', icon: 'notebook-pen' },
  { id: 'first-milestone', name: 'Milestone Reached', description: 'Your therapist confirmed your first milestone.', icon: 'mountain' },
];

// Deterministic pseudo-random numbers so every seed run looks the same.
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ExerciseSeed = {
  key: string;
  title: string;
  description: string;
  instructions: string;
  safetyNotes: string;
  bodyPart: string;
  difficulty: Difficulty;
  sets: number;
  reps: number;
  durationSeconds: number;
};

const LIBRARY: ExerciseSeed[] = [
  { key: 'heel', title: 'Heel slides', bodyPart: 'Knee', difficulty: 'EASY', sets: 2, reps: 10, durationSeconds: 60, description: 'Gently restores knee bending.', instructions: 'Lie on your back with legs straight.\nSlide one heel toward you, bending the knee as far as is comfortable.\nPause for two seconds, then slide back.', safetyNotes: 'Mild stretching is fine. Stop if the pain is sharp.' },
  { key: 'quad', title: 'Quad sets', bodyPart: 'Knee', difficulty: 'EASY', sets: 3, reps: 10, durationSeconds: 45, description: 'Wakes up the thigh muscle that supports the knee.', instructions: 'Sit with your leg straight.\nTighten the front of your thigh and press the back of the knee down.\nHold for 5 seconds, then relax.', safetyNotes: 'Breathe normally while holding.' },
  { key: 'bridge', title: 'Glute bridge', bodyPart: 'Hip', difficulty: 'MEDIUM', sets: 2, reps: 12, durationSeconds: 60, description: 'Strengthens the hips to support the knees.', instructions: 'Lie on your back, knees bent, feet flat.\nSqueeze your glutes and lift your hips.\nLower slowly.', safetyNotes: 'Keep your lower back neutral, do not arch.' },
  { key: 'slr', title: 'Straight-leg raise', bodyPart: 'Knee', difficulty: 'MEDIUM', sets: 2, reps: 10, durationSeconds: 60, description: 'Builds thigh strength without bending the knee.', instructions: 'Lie on your back, one knee bent.\nTighten the straight leg and lift it to the height of the other knee.\nLower slowly.', safetyNotes: 'Keep the lifted knee straight.' },
  { key: 'step', title: 'Step-ups', bodyPart: 'Knee', difficulty: 'MEDIUM', sets: 2, reps: 8, durationSeconds: 90, description: 'Practises stairs in a controlled way.', instructions: 'Stand in front of a low step, holding a rail.\nStep up with the treated leg, then step down slowly.', safetyNotes: 'Use a rail. Choose a low step first.' },
  { key: 'calf', title: 'Calf raises', bodyPart: 'Ankle', difficulty: 'EASY', sets: 2, reps: 12, durationSeconds: 45, description: 'Strengthens the calf and ankle.', instructions: 'Hold a counter.\nRise onto your toes, pause, then lower slowly.', safetyNotes: 'Hold on for balance.' },
  { key: 'balance', title: 'Single-leg balance', bodyPart: 'Ankle', difficulty: 'MEDIUM', sets: 3, reps: 1, durationSeconds: 30, description: 'Improves balance and ankle control.', instructions: 'Stand next to a counter.\nLift one foot and balance for 30 seconds.', safetyNotes: 'Keep a hand near the counter.' },
  { key: 'pendulum', title: 'Shoulder pendulum', bodyPart: 'Shoulder', difficulty: 'EASY', sets: 2, reps: 10, durationSeconds: 60, description: 'Relaxed shoulder movement to ease stiffness.', instructions: 'Lean on a table with your good arm.\nLet the other arm hang and swing it in small circles.', safetyNotes: 'Let gravity do the work; do not force the movement.' },
  { key: 'wall', title: 'Wall slides', bodyPart: 'Shoulder', difficulty: 'EASY', sets: 2, reps: 8, durationSeconds: 60, description: 'Gently increases shoulder range.', instructions: 'Face a wall with your hands on it.\nSlide your hands up as far as comfortable, then back down.', safetyNotes: 'Stop below the point of pain.' },
  { key: 'rotation', title: 'Band external rotation', bodyPart: 'Shoulder', difficulty: 'MEDIUM', sets: 2, reps: 10, durationSeconds: 60, description: 'Strengthens the rotator cuff.', instructions: 'Hold a light band, elbow at your side bent 90°.\nRotate your forearm outward, then back slowly.', safetyNotes: 'Use the lightest band.' },
];

async function cleanup() {
  const demoUsers = await prisma.user.findMany({ where: { email: { endsWith: DEMO_DOMAIN } }, select: { id: true } });
  const ids = demoUsers.map((user) => user.id);
  if (ids.length === 0) return;

  // Children first: completions reference version items; plans reference users; exercises are restricted.
  await prisma.taskCompletion.deleteMany({ where: { patientId: { in: ids } } });
  await prisma.rehabPlan.deleteMany({ where: { OR: [{ therapistId: { in: ids } }, { patientId: { in: ids } }] } });
  await prisma.programTemplate.deleteMany({ where: { therapistId: { in: ids } } });
  await prisma.exercise.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.auditEvent.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { patientId: { in: ids } }] } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed never runs with NODE_ENV=production.');
  }

  const [db] = await prisma.$queryRaw<{ name: string; comment: string | null }[]>`
    SELECT current_database() AS name, shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = current_database()`;
  if (db.comment === 'rehabquest-test-database') {
    throw new Error('Refusing to seed the test database. Point DATABASE_URL at the development database.');
  }

  console.log(`Seeding demo accounts (${DEMO_DOMAIN}) into database "${db.name}"…`);
  await cleanup();

  for (const badge of BADGES) {
    await prisma.badge.upsert({ where: { id: badge.id }, create: badge, update: badge });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const today = localDateKey(TZ);
  const dow = weekday(today);
  // Two rest days per week, chosen so that today is always a training day for the main demo patient.
  const fiveDayWeek = [0, 1, 2, 3, 4, 5, 6].filter((day) => day !== (dow + 2) % 7 && day !== (dow + 5) % 7);
  const threeDayWeek = [dow, (dow + 2) % 7, (dow + 4) % 7].sort();

  const user = (name: string, local: string, role: 'PATIENT' | 'THERAPIST', careCode: string | null = null) =>
    prisma.user.create({ data: { name, email: `${local}${DEMO_DOMAIN}`, passwordHash, role, timezone: TZ, careCode } });

  const dana = await user('Dana Cohen, PT', 'therapist', 'THERAPIST');
  const omer = await user('Omer Katz, PT', 'therapist2', 'THERAPIST');
  const maya = await user('Maya Levi', 'maya', 'PATIENT', 'A1B2C3D4');
  const yossi = await user('Yossi Mizrahi', 'yossi', 'PATIENT', 'B2C3D4E5');
  const rina = await user('Rina Ben-David', 'rina', 'PATIENT', 'C3D4E5F6');
  const avi = await user('Avi Peretz', 'avi', 'PATIENT', 'D4E5F6A7');
  await user('Noa Friedman', 'noa', 'PATIENT', 'C0FFEE42'); // not linked yet: used to demo linking
  const tal = await user('Tal Shapira', 'tal', 'PATIENT', 'E5F6A7B8');

  for (const patient of [maya, yossi, rina, avi]) {
    await prisma.therapistPatient.create({ data: { therapistId: dana.id, patientId: patient.id, createdAt: new Date(`${addDays(today, -30)}T08:00:00Z`) } });
  }
  await prisma.therapistPatient.create({ data: { therapistId: omer.id, patientId: tal.id } });

  // The demo library entries are copies of these starter-catalog entries (see src/data/exercise-catalog.ts).
  const CATALOG_KEYS: Record<string, string> = {
    heel: 'knee-heel-slides',
    quad: 'knee-quad-sets',
    bridge: 'hip-glute-bridge',
    slr: 'knee-straight-leg-raise',
    step: 'knee-step-ups',
    calf: 'ankle-calf-raises',
    balance: 'ankle-single-leg-balance',
    pendulum: 'shoulder-pendulum',
    wall: 'shoulder-wall-slides',
    rotation: 'shoulder-band-external-rotation',
  };
  const library = async (therapistId: string) => {
    const map = new Map<string, LibraryEntry>();
    for (const { key, ...exercise } of LIBRARY) {
      const created = await prisma.exercise.create({ data: { ...exercise, catalogKey: CATALOG_KEYS[key], createdById: therapistId } });
      map.set(key, created);
    }
    return map;
  };
  const danaExercises = await library(dana.id);
  const omerExercises = await library(omer.id);

  // Reusable templates for Dana (fictional, non-clinical sample content).
  const template = (title: string, condition: string, trainingWeekdays: number[], durationWeeks: number, items: { key: string; sets: number; reps: number; durationSeconds: number; holdSeconds?: number; restSeconds?: number }[]) =>
    prisma.programTemplate.create({
      data: {
        therapistId: dana.id,
        title,
        condition,
        description: 'Sample template for the demo. Adjust to each patient.',
        trainingWeekdays,
        durationWeeks,
        items: { create: items.map((item, index) => ({ exerciseId: danaExercises.get(item.key)!.id, orderIndex: index, sets: item.sets, reps: item.reps, durationSeconds: item.durationSeconds, holdSeconds: item.holdSeconds ?? null, restSeconds: item.restSeconds ?? null })) },
      },
    });
  await template('Knee — early strength', 'Knee', [0, 2, 4], 4, [
    { key: 'heel', sets: 2, reps: 10, durationSeconds: 60 },
    { key: 'quad', sets: 3, reps: 10, durationSeconds: 45, holdSeconds: 5, restSeconds: 30 },
    { key: 'slr', sets: 2, reps: 8, durationSeconds: 60, restSeconds: 45 },
  ]);
  await template('Shoulder — gentle mobility', 'Shoulder', [1, 3, 5], 3, [
    { key: 'pendulum', sets: 2, reps: 10, durationSeconds: 60 },
    { key: 'wall', sets: 2, reps: 8, durationSeconds: 60, restSeconds: 30 },
  ]);

  // Maya: steady progress, one symptom stop and one "too hard" (still open for review), session waiting today.
  const mayaPlan = await createVersionedPlan(prisma, dana.id, maya.id, danaExercises, {
    weeklyGoal: 4,
    title: 'Knee strength — phase 2',
    condition: 'Knee (post-surgery, week 7)',
    startOffset: -20,
    lengthDays: 56,
    trainingWeekdays: fiveDayWeek,
    notes: 'Move slowly and stop if pain goes above 5/10. Ice for 10 minutes afterwards if the knee feels warm.',
    tasks: [
      { key: 'heel', sets: 2, reps: 12, durationSeconds: 60, notes: 'Use a towel under the heel.' },
      { key: 'quad', sets: 3, reps: 10, durationSeconds: 45, holdSeconds: 5, restSeconds: 30 },
      { key: 'bridge', sets: 2, reps: 10, durationSeconds: 60, holdSeconds: 3, restSeconds: 45 },
      { key: 'step', sets: 2, reps: 6, durationSeconds: 90, notes: 'Lowest step only.', startOffsetInPlan: 14 },
    ],
    history: { adherence: 0.95, painBase: 4, painTrend: -2, events: { 3: 'missed', 5: 'partial', 7: 'hard', 9: 'skip', 11: 'stop' } },
    reviewedBefore: 6,
  }, rng(1), today);

  // Yossi: lower adherence and higher pain, several open review items.
  await createVersionedPlan(prisma, dana.id, yossi.id, danaExercises, {
    title: 'Shoulder mobility',
    condition: 'Shoulder (stiffness)',
    startOffset: -15,
    lengthDays: 42,
    trainingWeekdays: threeDayWeek,
    notes: 'Gentle range of motion only. No weights yet.',
    tasks: [
      { key: 'pendulum', sets: 2, reps: 10, durationSeconds: 60 },
      { key: 'wall', sets: 2, reps: 8, durationSeconds: 60 },
    ],
    history: { adherence: 0.55, painBase: 5, painTrend: 1, events: { 2: 'pain', 5: 'pain' } },
    pauses: [{ startOffset: 4, endOffset: 6 }],
  }, rng(2), today);

  // Rina: plan starts tomorrow (shows the "starts soon" state).
  await createVersionedPlan(prisma, dana.id, rina.id, danaExercises, {
    title: 'Ankle stability',
    condition: 'Ankle (sprain, recovering)',
    startOffset: 1,
    lengthDays: 28,
    trainingWeekdays: [0, 2, 4],
    notes: 'Balance work next to a counter.',
    tasks: [
      { key: 'calf', sets: 2, reps: 12, durationSeconds: 45 },
      { key: 'balance', sets: 3, reps: 1, durationSeconds: 30 },
    ],
  }, rng(3), today);

  // Tal (other therapist): proves data isolation between therapists.
  await createVersionedPlan(prisma, omer.id, tal.id, omerExercises, {
    title: 'Return to running',
    condition: 'Knee',
    startOffset: -10,
    lengthDays: 30,
    trainingWeekdays: [1, 3, 5],
    notes: 'Other therapist’s plan.',
    tasks: [{ key: 'calf', sets: 3, reps: 15, durationSeconds: 60 }],
    history: { adherence: 0.9, painBase: 2, painTrend: 0 },
  }, rng(4), today);

  await prisma.message.createMany({
    data: [
      { senderId: dana.id, receiverId: maya.id, text: 'Nice work this week, Maya. I added step-ups on the lowest step — go slowly.', createdAt: new Date(`${addDays(today, -6)}T09:10:00Z`), readAt: new Date(`${addDays(today, -6)}T12:00:00Z`) },
      { senderId: maya.id, receiverId: dana.id, text: 'Thanks! The knee felt warm after the last session, I iced it.', createdAt: new Date(`${addDays(today, -5)}T17:40:00Z`), readAt: new Date(`${addDays(today, -5)}T19:00:00Z`) },
    ],
  });
  // An unanswered patient question (unread for Dana) → appears in the review workspace.
  const question = await prisma.message.create({
    data: { senderId: yossi.id, receiverId: dana.id, text: 'Should the wall slides feel like a stretch in the front of the shoulder?', createdAt: new Date(`${addDays(today, -1)}T18:20:00Z`) },
  });
  await prisma.reviewItem.create({
    data: { therapistId: dana.id, patientId: yossi.id, kind: 'UNANSWERED_MESSAGE', sourceType: 'MESSAGE', sourceId: question.id, dedupeKey: `unanswered:${question.id}`, reasons: ['Patient message without a reply'], firstEventAt: question.createdAt, lastEventAt: question.createdAt },
  });
  await prisma.patientNotificationPreference.create({ data: { userId: maya.id, dailyExerciseRemindersEnabled: true, reminderTime: '09:00', quietHoursStart: '22:00', quietHoursEnd: '07:00' } });

  // ---- Stage 3: goals, measurements, check-ins, education (fictional demo content) ----
  const at = (offset: number, time = '10:00') => new Date(`${addDays(today, offset)}T${time}:00Z`);
  const kneeBend = await prisma.measurementDefinition.create({
    data: { patientId: maya.id, therapistId: dana.id, name: 'Knee bend (right)', unit: '°', direction: 'HIGHER_IS_BETTER', minValue: 0, maxValue: 160, createdAt: at(-21) },
  });
  for (const [offset, value] of [[-20, 95], [-13, 104], [-6, 112.5], [-1, 118]] as const) {
    await prisma.measurement.create({ data: { definitionId: kneeBend.id, patientId: maya.id, recordedById: dana.id, source: 'THERAPIST', value, measuredOn: toDbDate(addDays(today, offset)), createdAt: at(offset, '11:00') } });
  }
  await prisma.goal.create({
    data: { patientId: maya.id, therapistId: dana.id, title: 'Bend the knee enough to ride a bike again', kind: 'MEASUREMENT', definitionId: kneeBend.id, baselineValue: 95, targetValue: 125, targetDate: toDbDate(addDays(today, 30)), createdAt: at(-20) },
  });
  await prisma.goal.create({
    data: {
      patientId: maya.id,
      therapistId: dana.id,
      title: 'Climb the stairs at home without holding the rail',
      description: 'We build up step by step. Tell me if the knee feels unstable.',
      kind: 'FUNCTIONAL',
      targetDate: toDbDate(addDays(today, 35)),
      createdAt: at(-20),
      milestones: {
        create: [
          { title: 'Step-ups on the lowest step, 2 × 6', orderIndex: 0, achievedAt: at(-5, '12:00'), achievedById: dana.id, note: 'Good control on both legs.' },
          { title: 'One flight of stairs with one hand on the rail', orderIndex: 1, targetDate: toDbDate(addDays(today, 14)) },
          { title: 'One flight of stairs without the rail', orderIndex: 2, targetDate: toDbDate(addDays(today, 35)) },
        ],
      },
    },
  });

  // Weekly check-ins for the last two weeks (this week left open for the demo). One answer left blank on purpose.
  const thisWeek = weekStartOf(today);
  await prisma.weeklyCheckIn.create({ data: { patientId: maya.id, weekStart: toDbDate(addDays(thisWeek, -14)), painTypical: 4, painWorst: 6, activityLimit: 5, confidence: 3, note: 'Stairs are still hard in the evening.', submittedAt: at(-14 + 6, '19:00') } });
  await prisma.weeklyCheckIn.create({ data: { patientId: maya.id, weekStart: toDbDate(addDays(thisWeek, -7)), painTypical: 3, painWorst: null, activityLimit: 3, confidence: 4, note: null, submittedAt: at(-7 + 6, '19:00') } });

  // Achievements that depend on counts: same rules as the API (services/gamification.ts).
  const metWeeks = await prisma.weeklyGoalWeek.findMany({ where: { userId: maya.id }, orderBy: { metAt: 'asc' } });
  const checkIns = await prisma.weeklyCheckIn.findMany({ where: { patientId: maya.id }, orderBy: { submittedAt: 'asc' } });
  const earnedAt: Record<string, Date | undefined> = {
    'weekly-goal': metWeeks[0]?.metAt,
    'weekly-goal-4': metWeeks[3]?.metAt,
    'first-check-in': checkIns[0]?.submittedAt,
    'check-in-4': checkIns[3]?.submittedAt,
    'first-milestone': at(-5, '12:00'),
  };
  for (const badgeId of countAchievements({ weeksGoalMet: metWeeks.length, checkInWeeks: checkIns.length, confirmedMilestones: 1 })) {
    await prisma.userBadge.createMany({ data: [{ userId: maya.id, badgeId, earnedAt: earnedAt[badgeId] ?? new Date() }], skipDuplicates: true });
  }
  const mayaBadges = (await prisma.userBadge.findMany({ where: { userId: maya.id } })).map((badge) => badge.badgeId);
  await prisma.userPreference.create({ data: { userId: maya.id, weeklySessionGoal: 4, mascotCosmetic: isCosmeticUnlocked('scarf', mayaBadges) ? 'scarf' : 'classic' } });

  // Education cards: one updated after Maya read it (shows "Updated since you read it"), one unread.
  const soreness = await prisma.educationCard.create({
    data: {
      ownerId: dana.id,
      latestVersion: 2,
      lockVersion: 1,
      createdAt: at(-15),
      versions: {
        create: [
          { number: 1, title: 'Why some soreness after exercise is expected', body: 'Mild soreness for a day after a new exercise is common while muscles adapt.\n\nIt should ease within 24 hours.', readingMinutes: 1, createdById: dana.id, createdAt: at(-15) },
          {
            number: 2,
            title: 'Why some soreness after exercise is expected',
            body: 'Mild soreness for a day after a new exercise is common while muscles adapt.\n\n- It should ease within 24 hours.\n- Sharp pain, swelling or pain that gets worse is different: stop the exercise and send me a message.\n\nThis card is general information, not a diagnosis.',
            readingMinutes: 2,
            createdById: dana.id,
            createdAt: at(-2),
          },
        ],
      },
    },
    include: { versions: true },
  });
  const ice = await prisma.educationCard.create({
    data: {
      ownerId: dana.id,
      createdAt: at(-10),
      versions: {
        create: [{ number: 1, title: 'Using ice after your session', body: 'If the knee feels warm after exercise, you can use a cold pack for about 10 minutes.\n\n- Wrap it in a thin towel; never put ice directly on the skin.\n- Skip it if you have reduced feeling in the area.', readingMinutes: 1, createdById: dana.id, createdAt: at(-10) }],
      },
    },
  });
  const mayaSoreness = await prisma.educationAssignment.create({ data: { cardId: soreness.id, patientId: maya.id, therapistId: dana.id, taskId: mayaPlan.taskIds.get('step') ?? null, note: 'Read this before the step-ups.', assignedAt: at(-6) } });
  await prisma.educationAcknowledgment.create({ data: { assignmentId: mayaSoreness.id, versionId: soreness.versions.find((version) => version.number === 1)!.id, acknowledgedAt: at(-5, '18:00') } });
  await prisma.educationAssignment.create({ data: { cardId: ice.id, patientId: maya.id, therapistId: dana.id, assignedAt: at(-3) } });
  await prisma.educationAssignment.create({ data: { cardId: soreness.id, patientId: yossi.id, therapistId: dana.id, assignedAt: at(-4) } });

  void avi;
  console.log('Demo data ready. Accounts (password Demo1234!):');
  console.log(`  therapist${DEMO_DOMAIN}  (Dana — 4 patients)`);
  console.log(`  maya${DEMO_DOMAIN}       (patient with a session today)`);
  console.log(`  yossi${DEMO_DOMAIN}, rina${DEMO_DOMAIN}, avi${DEMO_DOMAIN} (other states)`);
  console.log(`  noa${DEMO_DOMAIN}        (not linked; care code C0FFEE42)`);
  console.log(`  therapist2${DEMO_DOMAIN} (Omer — separate practice)`);
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
