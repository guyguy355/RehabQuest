import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '../features/auth/AuthPages';
import { LandingPage, NotFoundPage } from '../features/LandingPage';
import { LearnPage } from '../features/patient/LearnPage';
import { PatientHome } from '../features/patient/PatientHome';
import { PatientMessagesPage, ProfilePage } from '../features/patient/ProfilePage';
import { ProgressPage } from '../features/patient/ProgressPage';
import { SessionCompletePage } from '../features/patient/SessionCompletePage';
import { SessionPage } from '../features/patient/SessionPage';
import { EducationPage } from '../features/therapist/EducationPage';
import { ExerciseLibraryPage } from '../features/therapist/ExerciseLibraryPage';
import { PatientDetailPage } from '../features/therapist/PatientDetailPage';
import { NewPlanPage } from '../features/therapist/NewPlanPage';
import { PlanEditorPage } from '../features/therapist/PlanEditorPage';
import { PlanPreviewPage } from '../features/therapist/PlanPreviewPage';
import { TemplateEditorPage, TemplatesPage } from '../features/therapist/TemplatesPage';
import { VersionHistoryPage } from '../features/therapist/VersionHistoryPage';
import { ReviewsPage } from '../features/therapist/ReviewList';
import { TherapistHome } from '../features/therapist/TherapistHome';
import { AuthProvider } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';
import { PatientShell, TherapistShell } from './Shells';
import { ToastProvider } from '../ui/Toast';
import { I18nProvider } from '../i18n';
import { PreferencesProvider, PreferencesSync } from './preferences';
import { UnreadProvider } from './unread';
import { NotificationsPage } from '../features/shared/NotificationsPage';

function Root() {
  return (
    <I18nProvider>
      <PreferencesProvider>
      <AuthProvider>
        <ToastProvider>
          <PreferencesSync />
          <UnreadProvider>
            <Outlet />
          </UnreadProvider>
        </ToastProvider>
      </AuthProvider>
      </PreferencesProvider>
    </I18nProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        path: '/patient',
        element: (
          <ProtectedRoute role="PATIENT">
            <PatientShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <PatientHome /> },
          { path: 'session', element: <SessionPage /> },
          { path: 'session/complete', element: <SessionCompletePage /> },
          { path: 'progress', element: <ProgressPage /> },
          { path: 'messages', element: <PatientMessagesPage /> },
          { path: 'learn', element: <LearnPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'notifications', element: <NotificationsPage /> },
        ],
      },
      {
        path: '/therapist',
        element: (
          <ProtectedRoute role="THERAPIST">
            <TherapistShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <TherapistHome /> },
          { path: 'reviews', element: <ReviewsPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'exercises', element: <ExerciseLibraryPage /> },
          { path: 'education', element: <EducationPage /> },
          { path: 'patients/:patientId', element: <PatientDetailPage /> },
          { path: 'patients/:patientId/plans/new', element: <NewPlanPage /> },
          { path: 'plan-versions/:versionId', element: <PlanEditorPage /> },
          { path: 'plan-versions/:versionId/preview', element: <PlanPreviewPage /> },
          { path: 'plans/:planId/versions', element: <VersionHistoryPage /> },
          { path: 'templates', element: <TemplatesPage /> },
          { path: 'templates/new', element: <TemplateEditorPage /> },
          { path: 'templates/:templateId', element: <TemplateEditorPage /> },
        ],
      },
      // Old URLs from the previous version of the app.
      { path: '/patient/dashboard', element: <Navigate to="/patient" replace /> },
      { path: '/physio/*', element: <Navigate to="/therapist" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
