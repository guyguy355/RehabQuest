import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AIProgressSummaryPage } from '../pages/AIProgressSummaryPage';
import { BadgesPage } from '../pages/BadgesPage';
import { CreateRehabPlanPage } from '../pages/CreateRehabPlanPage';
import { DailyQuestPage } from '../pages/DailyQuestPage';
import { ExerciseDetailsPage } from '../pages/ExerciseDetailsPage';
import { ExerciseLibraryPage } from '../pages/ExerciseLibraryPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
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
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
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
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    path: '/patient/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <PatientDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/daily-quest',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <DailyQuestPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/quest',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <DailyQuestPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/exercises/:exerciseId',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <ExerciseDetailsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/exercise/:exerciseId',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <ExerciseDetailsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/pain-report',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <PainReportPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/pain-report/:exerciseId',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <PainReportPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/quest-completed',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <QuestCompletedPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/progress',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <ProgressPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/patient/badges',
    element: (
      <ProtectedRoute allowedRoles={['PATIENT']}>
        <BadgesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <PhysioDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/patients',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <PatientsListPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/patient-links',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <TherapistPatientsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/therapist/patients',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <TherapistPatientsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/patients/:patientId',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <PatientProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/patients/:patientId/ai-summary',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <AIProgressSummaryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/plans/new',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <CreateRehabPlanPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/exercises',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <ExerciseLibraryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/custom-exercises',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <TherapistExercisesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/therapist/exercises',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <TherapistExercisesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/physio/ai-summary',
    element: (
      <ProtectedRoute allowedRoles={['THERAPIST']}>
        <AIProgressSummaryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
