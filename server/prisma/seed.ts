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
import { PlanStatus, PrismaClient, XpReason, type Difficulty } from '@prisma/client';
import bcrypt from 'bcrypt';
import { addDays, type DateKey, localDateKey, toDbDate, weekday } from '../src/lib/dates.js';
import { buildDays, type CompletionLite, needsReview, qualifyingBadges, SESSION_BONUS_XP, TASK_XP, tasksOn } from '../src/services/progress.js';

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

type PlanSeed = {
  title: string;
  condition: string;
  startOffset: number; // days from today
  lengthDays: number;
  trainingWeekdays: number[];
  notes: string;
  tasks: { key: string; sets: number; reps: number; durationSeconds: number; notes?: string; startOffsetInPlan?: number }[];
  // How the patient behaved on past training days.
  history?: { adherence: number; painBase: number; painTrend: number; events?: Record<number, 'missed' | 'stop' | 'hard' | 'pain'> };
  reviewedBefore?: number; // records older than this many days are already reviewed
};

async function cleanup() {
  const demoUsers = await prisma.user.findMany({ where: { email: { endsWith: DEMO_DOMAIN } }, select: { id: true } });
  const ids = demoUsers.map((user) => user.id);
  if (ids.length === 0) return;

  await prisma.rehabPlan.deleteMany({ where: { OR: [{ therapistId: { in: ids } }, { patientId: { in: ids } }] } });
  await prisma.exercise.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function createPlanWithHistory(therapistId: string, patientId: string, exercises: Map<string, string>, seed: PlanSeed, random: () => number, today: DateKey) {
  const startDate = addDays(today, seed.startOffset);
  const endDate = addDays(startDate, seed.lengthDays - 1);

  const plan = await prisma.rehabPlan.create({
    data: {
      patientId,
      therapistId,
      title: seed.title,
      condition: seed.condition,
      startDate: toDbDate(startDate),
      endDate: toDbDate(endDate),
      trainingWeekdays: seed.trainingWeekdays,
      therapistNotes: seed.notes,
      status: PlanStatus.ACTIVE,
      createdAt: new Date(`${addDays(startDate, -1)}T09:00:00Z`),
      tasks: {
        create: seed.tasks.map((task, index) => ({
          exerciseId: exercises.get(task.key)!,
          sets: task.sets,
          reps: task.reps,
          durationSeconds: task.durationSeconds,
          notes: task.notes ?? null,
          orderIndex: index,
          activeFrom: toDbDate(addDays(startDate, task.startOffsetInPlan ?? 0)),
        })),
      },
    },
    include: { tasks: true },
  });

  if (!seed.history) return;

  const schedule = {
    startDate,
    endDate,
    trainingWeekdays: seed.trainingWeekdays,
    tasks: plan.tasks.map((task) => ({ ...task, activeFrom: task.activeFrom.toISOString().slice(0, 10), activeUntil: null })),
  };
  const lite: CompletionLite[] = [];
  const earned = new Set<string>();
  let trainingIndex = 0;

  for (let date = startDate; date < today; date = addDays(date, 1)) {
    const tasks = tasksOn(schedule, date);
    if (!seed.trainingWeekdays.includes(weekday(date)) || tasks.length === 0) continue;
    trainingIndex += 1;

    const event = seed.history.events?.[trainingIndex];
    if (event === 'missed' || (!event && random() > seed.history.adherence)) continue;

    const daysAgo = Math.round((toDbDate(today).getTime() - toDbDate(date).getTime()) / 86_400_000);
    const progress = trainingIndex / 20;

    for (const [index, task] of tasks.entries()) {
      const basePain = Math.max(0, Math.min(10, Math.round(seed.history.painBase + seed.history.painTrend * progress + (random() * 2 - 1))));
      let status: 'COMPLETED' | 'STOPPED' = 'COMPLETED';
      let painLevel = basePain;
      let difficulty: 'TOO_EASY' | 'JUST_RIGHT' | 'TOO_HARD' = random() > 0.85 ? 'TOO_EASY' : 'JUST_RIGHT';
      let notes: string | null = null;

      if (event === 'stop' && index === tasks.length - 1) {
        status = 'STOPPED';
        painLevel = 7;
        notes = 'Sharp pain on the outside of the knee, so I stopped.';
      } else if (event === 'hard' && index === 0) {
        difficulty = 'TOO_HARD';
        painLevel = Math.max(painLevel, 5);
        notes = 'Hard to finish the last set.';
      } else if (event === 'pain' && index === 0) {
        painLevel = 7;
        notes = 'Shoulder ached afterwards for about an hour.';
      } else if (random() > 0.8) {
        notes = ['Felt easier than last time.', 'A bit stiff in the morning.', 'Did it after a short walk.'][Math.floor(random() * 3)];
      }

      const xp = status === 'COMPLETED' ? TASK_XP : 0;
      const flagged = needsReview({ status, painLevel, difficulty });
      const completedAt = new Date(`${date}T${String(14 + index).padStart(2, '0')}:${String(Math.floor(random() * 50) + 5).padStart(2, '0')}:00Z`);

      await prisma.taskCompletion.create({
        data: {
          taskId: task.id,
          patientId,
          sessionDate: toDbDate(date),
          status,
          painLevel,
          difficulty,
          notes,
          prescribedSets: task.sets,
          prescribedReps: task.reps,
          prescribedDurationSecs: task.durationSeconds,
          xpAwarded: xp,
          needsReview: flagged,
          reviewedAt: flagged && seed.reviewedBefore !== undefined && daysAgo > seed.reviewedBefore ? new Date(completedAt.getTime() + 86_400_000) : null,
          reviewedById: flagged && seed.reviewedBefore !== undefined && daysAgo > seed.reviewedBefore ? therapistId : null,
          completedAt,
        },
      });

      if (xp > 0) {
        await prisma.xpEvent.create({ data: { userId: patientId, amount: xp, reason: XpReason.TASK_COMPLETED, sourceKey: `task:${task.id}:${date}`, sessionDate: toDbDate(date), createdAt: completedAt } });
      }
      lite.push({ taskId: task.id, sessionDate: date, status });
    }

    // Same rules as the API: session bonus once the day is finished, then achievements.
    const days = buildDays(schedule, lite, date);
    if (days.find((day) => day.date === date)?.state === 'done') {
      await prisma.xpEvent.create({ data: { userId: patientId, amount: SESSION_BONUS_XP, reason: XpReason.SESSION_COMPLETED, sourceKey: `session:${plan.id}:${date}`, sessionDate: toDbDate(date) } });
      for (const badgeId of qualifyingBadges(days, date)) {
        if (earned.has(badgeId)) continue;
        earned.add(badgeId);
        await prisma.userBadge.create({ data: { userId: patientId, badgeId, earnedAt: new Date(`${date}T16:00:00Z`) } });
      }
    }
  }
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

  const library = async (therapistId: string) => {
    const map = new Map<string, string>();
    for (const { key, ...exercise } of LIBRARY) {
      const created = await prisma.exercise.create({ data: { ...exercise, createdById: therapistId } });
      map.set(key, created.id);
    }
    return map;
  };
  const danaExercises = await library(dana.id);
  const omerExercises = await library(omer.id);

  // Maya: steady progress, one symptom stop and one "too hard" (still open for review), session waiting today.
  await createPlanWithHistory(dana.id, maya.id, danaExercises, {
    title: 'Knee strength — phase 2',
    condition: 'Knee (post-surgery, week 7)',
    startOffset: -20,
    lengthDays: 56,
    trainingWeekdays: fiveDayWeek,
    notes: 'Move slowly and stop if pain goes above 5/10. Ice for 10 minutes afterwards if the knee feels warm.',
    tasks: [
      { key: 'heel', sets: 2, reps: 12, durationSeconds: 60, notes: 'Use a towel under the heel.' },
      { key: 'quad', sets: 3, reps: 10, durationSeconds: 45 },
      { key: 'bridge', sets: 2, reps: 10, durationSeconds: 60 },
      { key: 'step', sets: 2, reps: 6, durationSeconds: 90, notes: 'Lowest step only.', startOffsetInPlan: 14 },
    ],
    history: { adherence: 0.95, painBase: 4, painTrend: -2, events: { 3: 'missed', 7: 'hard', 11: 'stop' } },
    reviewedBefore: 6,
  }, rng(1), today);

  // Yossi: lower adherence and higher pain, several open review items.
  await createPlanWithHistory(dana.id, yossi.id, danaExercises, {
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
  }, rng(2), today);

  // Rina: plan starts tomorrow (shows the "starts soon" state).
  await createPlanWithHistory(dana.id, rina.id, danaExercises, {
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
  await createPlanWithHistory(omer.id, tal.id, omerExercises, {
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
      { senderId: dana.id, receiverId: maya.id, text: 'Nice work this week, Maya. I added step-ups on the lowest step — go slowly.', createdAt: new Date(`${addDays(today, -6)}T09:10:00Z`) },
      { senderId: maya.id, receiverId: dana.id, text: 'Thanks! The knee felt warm after the last session, I iced it.', createdAt: new Date(`${addDays(today, -5)}T17:40:00Z`) },
    ],
  });

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
