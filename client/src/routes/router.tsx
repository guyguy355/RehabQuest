import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AIProgressSummaryPage } from '../pages/AIProgressSummaryPage';
import { BadgesPage } from '../pages/BadgesPage';
import { CreateRehabPlanPage } from '../pages/CreateRehabPlanPage';
import { DailyQuestPage } from '../pages/DailyQuestPage';
import { ExerciseDetailsPage } from '../pages/ExerciseDetailsPage';
import { ExerciseLibraryPage } from '../pages/ExerciseLibraryPage';
import { LoginPage } from '../pages/LoginPage';
import { PainReportPage } from '../pages/PainReportPage';
import { PatientDashboardPage } from '../pages/PatientDashboardPage';
import { PatientProfilePage } from '../pages/PatientProfilePage';
import { PatientsListPage } from '../pages/PatientsListPage';
import { PhysioDashboardPage } from '../pages/PhysioDashboardPage';
import { ProgressPage } from '../pages/ProgressPage';
import { RegisterPage } from '../pages/RegisterPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/patient/dashboard" replace />,
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
    path: '/patient/exercises/:exerciseId',
    element: <ExerciseDetailsPage />,
  },
  {
    path: '/patient/pain-report',
    element: <PainReportPage />,
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
    path: '/physio/patients/:patientId',
    element: <PatientProfilePage />,
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
    path: '/physio/ai-summary',
    element: <AIProgressSummaryPage />,
  },
  {
    path: '*',
    element: <Navigate to="/patient/dashboard" replace />,
  },
]);
