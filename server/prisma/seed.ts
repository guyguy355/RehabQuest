import { PrismaClient, Difficulty, PlanStatus, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const demoPassword = 'password123';

const exerciseData = [
  {
    key: 'heelSlides',
    name: 'Heel Slides',
    targetArea: 'Knee',
    difficulty: Difficulty.EASY,
    defaultSets: 3,
    defaultReps: 12,
    defaultDurationSeconds: 60,
    description: 'Improves knee mobility and range of motion.',
    instructions:
      'Lie on your back with your legs straight. Slowly slide your heel toward your body by bending your knee, then return to the starting position.',
    safetyNotes: 'Move slowly and stop if pain becomes sharp or unusual.',
  },
  {
    key: 'quadSets',
    name: 'Quad Sets',
    targetArea: 'Knee',
    difficulty: Difficulty.EASY,
    defaultSets: 3,
    defaultReps: 10,
    defaultDurationSeconds: 45,
    description: 'Activates and strengthens the quadriceps.',
    instructions:
      'Sit or lie with your leg straight. Tighten the muscle on the front of your thigh and press the back of your knee gently toward the floor. Hold briefly, then relax.',
    safetyNotes: 'Keep the contraction controlled and avoid forcing the knee.',
  },
  {
    key: 'gluteBridges',
    name: 'Glute Bridges',
    targetArea: 'Hip / Knee Support',
    difficulty: Difficulty.MEDIUM,
    defaultSets: 3,
    defaultReps: 12,
    defaultDurationSeconds: 75,
    description: 'Strengthens glutes and supports knee stability.',
    instructions:
      'Lie on your back with knees bent and feet flat on the floor. Tighten your glutes and lift your hips until your body forms a straight line from shoulders to knees. Lower slowly.',
    safetyNotes: 'Avoid arching your lower back.',
  },
  {
    key: 'anklePumps',
    name: 'Ankle Pumps',
    targetArea: 'Ankle / Circulation',
    difficulty: Difficulty.EASY,
    defaultSets: 2,
    defaultReps: 20,
    defaultDurationSeconds: 60,
    description: 'Promotes ankle mobility and circulation.',
    instructions: 'Move your foot up and down slowly while keeping your leg relaxed.',
    safetyNotes: 'Keep the movement gentle and controlled.',
  },
] as const;

const badgeData = [
  {
    name: 'First Quest Completed',
    description: 'Completed your first daily rehab quest.',
    conditionType: 'FIRST_QUEST_COMPLETED',
  },
  {
    name: '3 Day Streak',
    description: 'Completed rehab quests for 3 days in a row.',
    conditionType: 'THREE_DAY_STREAK',
  },
  {
    name: 'Consistency Hero',
    description: "Completed today's rehab quest and kept your streak alive.",
    conditionType: 'CONSISTENCY_HERO',
  },
  {
    name: '7 Day Streak',
    description: 'Complete rehab quests for 7 days in a row.',
    conditionType: 'SEVEN_DAY_STREAK',
  },
  {
    name: 'Pain Logger',
    description: 'Submit pain reports after 10 completed exercises.',
    conditionType: 'PAIN_LOGGER',
  },
];

async function clearDemoData() {
  await prisma.therapistPatient.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.taskCompletion.deleteMany();
  await prisma.rehabTask.deleteMany();
  await prisma.rehabPlan.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'physio@rehabquest.com',
          'therapist@rehabquest.com',
          'patient@rehabquest.com',
          'admin@rehabquest.com',
        ],
      },
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  await clearDemoData();

  const therapistUser = await prisma.user.create({
    data: {
      name: 'Dr. Amit Levi',
      email: 'therapist@rehabquest.com',
      passwordHash,
      role: Role.THERAPIST,
    },
  });

  const patientUser = await prisma.user.create({
    data: {
      name: 'Guy Abramovich',
      email: 'patient@rehabquest.com',
      passwordHash,
      role: Role.PATIENT,
    },
  });

  await prisma.user.create({
    data: {
      name: 'RehabQuest Admin',
      email: 'admin@rehabquest.com',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const patientProfile = await prisma.patientProfile.create({
    data: {
      userId: patientUser.id,
      physioId: therapistUser.id,
      injuryType: 'Knee rehabilitation',
      currentStage: 'Strength & stability',
    },
  });

  const exercises = new Map<string, { id: string }>();

  for (const exercise of exerciseData) {
    const createdExercise = await prisma.exercise.create({
      data: {
        title: exercise.name,
        bodyPart: exercise.targetArea,
        difficulty: exercise.difficulty,
        sets: exercise.defaultSets,
        reps: exercise.defaultReps,
        durationSeconds: exercise.defaultDurationSeconds,
        description: exercise.description,
        createdById: therapistUser.id,
      },
      select: {
        id: true,
      },
    });

    exercises.set(exercise.key, createdExercise);
  }

  const rehabPlan = await prisma.rehabPlan.create({
    data: {
      patientId: patientProfile.id,
      physioId: therapistUser.id,
      title: 'Knee Stability Phase 1',
      injuryType: 'Knee rehabilitation',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-28T00:00:00.000Z'),
      status: PlanStatus.ACTIVE,
    },
  });

  const heelSlidesTask = await prisma.rehabTask.create({
    data: {
      planId: rehabPlan.id,
      exerciseId: getExerciseId(exercises, 'heelSlides'),
      dayNumber: 1,
      sets: 3,
      reps: 12,
      durationSeconds: 60,
      orderIndex: 1,
    },
  });

  const quadSetsTask = await prisma.rehabTask.create({
    data: {
      planId: rehabPlan.id,
      exerciseId: getExerciseId(exercises, 'quadSets'),
      dayNumber: 1,
      sets: 3,
      reps: 10,
      durationSeconds: 45,
      orderIndex: 2,
    },
  });

  const gluteBridgesTask = await prisma.rehabTask.create({
    data: {
      planId: rehabPlan.id,
      exerciseId: getExerciseId(exercises, 'gluteBridges'),
      dayNumber: 1,
      sets: 3,
      reps: 12,
      durationSeconds: 75,
      orderIndex: 3,
    },
  });

  await prisma.taskCompletion.createMany({
    data: [
      {
        taskId: heelSlidesTask.id,
        patientId: patientProfile.id,
        painLevel: 3,
        notes: 'Felt okay, slight stiffness.',
      },
      {
        taskId: quadSetsTask.id,
        patientId: patientProfile.id,
        painLevel: 2,
        notes: 'No major discomfort.',
      },
      {
        taskId: gluteBridgesTask.id,
        patientId: patientProfile.id,
        painLevel: 4,
        notes: 'Mild discomfort near the end.',
      },
    ],
  });

  const badges = new Map<string, { id: string }>();

  for (const badge of badgeData) {
    const createdBadge = await prisma.badge.create({
      data: badge,
      select: {
        id: true,
      },
    });

    badges.set(badge.name, createdBadge);
  }

  await prisma.userBadge.createMany({
    data: ['First Quest Completed', '3 Day Streak', 'Consistency Hero'].map((badgeName) => ({
      userId: patientUser.id,
      badgeId: getBadgeId(badges, badgeName),
    })),
  });

  await prisma.therapistPatient.create({
    data: {
      therapistId: therapistUser.id,
      patientId: patientUser.id,
    },
  });

  console.log('RehabQuest demo seed data created successfully.');
}

function getExerciseId(exercises: Map<string, { id: string }>, key: string) {
  const exercise = exercises.get(key);

  if (!exercise) {
    throw new Error(`Missing exercise in seed data: ${key}`);
  }

  return exercise.id;
}

function getBadgeId(badges: Map<string, { id: string }>, name: string) {
  const badge = badges.get(name);

  if (!badge) {
    throw new Error(`Missing badge in seed data: ${name}`);
  }

  return badge.id;
}

main()
  .catch((error) => {
    console.error('Failed to seed RehabQuest demo data.');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
