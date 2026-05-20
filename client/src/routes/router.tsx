import { createBrowserRouter } from 'react-router-dom';
import { AIProgressSummaryPage } from '../pages/AIProgressSummaryPage';
import { BadgesPage } from '../pages/BadgesPage';
import { CreateRehabPlanPage } from '../pages/CreateRehabPlanPage';
import { DailyQuestPage } from '../pages/DailyQuestPage';
import { ExerciseDetailsPage } from '../pages/ExerciseDetailsPage';
import { ExerciseLibraryPage } from '../pages/ExerciseLibraryPage';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PainReportPage } from '../pages/PainReportPage';
import { PatientDashboardPage } from '../pages/PatientDashboardPage';
import { PatientProfilePage } from '../pages/PatientProfilePage';
import { PatientsListPage } from '../pages/PatientsListPage';
import { PhysioDashboardPage } from '../pages/PhysioDashboardPage';
import { ProgressPage } from '../pages/ProgressPage';
import { QuestCompletedPage } from '../pages/QuestCompletedPage';
import { RegisterPage } from '../pages/RegisterPage';
import { TherapistPatientsPage } from '../pages/TherapistPatientsPage';
import { TherapistExercisesPage } from '../pages/TherapistExercisesPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/patient/dashboard',
    element: <PatientDashboardPage />,
  },
  {
    path: '/patient/daily-quest',
    element: <DailyQuestPage />,
  },
  {
    path: '/patient/quest',
    element: <DailyQuestPage />,
  },
  {
    path: '/patient/exercises/:exerciseId',
    element: <ExerciseDetailsPage />,
  },
  {
    path: '/patient/exercise/:exerciseId',
    element: <ExerciseDetailsPage />,
  },
  {
    path: '/patient/pain-report',
    element: <PainReportPage />,
  },
  {
    path: '/patient/pain-report/:exerciseId',
    element: <PainReportPage />,
  },
  {
    path: '/patient/quest-completed',
    element: <QuestCompletedPage />,
  },
  {
    path: '/patient/progress',
    element: <ProgressPage />,
  },
  {
    path: '/patient/badges',
    element: <BadgesPage />,
  },
  {
    path: '/physio/dashboard',
    element: <PhysioDashboardPage />,
  },
  {
    path: '/physio/patients',
    element: <PatientsListPage />,
  },
  {
    path: '/physio/patient-links',
    element: <TherapistPatientsPage />,
  },
  {
    path: '/therapist/patients',
    element: <TherapistPatientsPage />,
  },
  {
    path: '/physio/patients/:patientId',
    element: <PatientProfilePage />,
  },
  {
    path: '/physio/patients/:patientId/ai-summary',
    element: <AIProgressSummaryPage />,
  },
  {
    path: '/physio/plans/new',
    element: <CreateRehabPlanPage />,
  },
  {
    path: '/physio/exercises',
    element: <ExerciseLibraryPage />,
  },
  {
    path: '/physio/custom-exercises',
    element: <TherapistExercisesPage />,
  },
  {
    path: '/therapist/exercises',
    element: <TherapistExercisesPage />,
  },
  {
    path: '/physio/ai-summary',
    element: <AIProgressSummaryPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
