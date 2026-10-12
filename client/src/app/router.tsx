import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '../features/auth/AuthPages';
import { LandingPage, NotFoundPage } from '../features/LandingPage';
import { PatientHome } from '../features/patient/PatientHome';
import { PatientMessagesPage, ProfilePage } from '../features/patient/ProfilePage';
import { ProgressPage } from '../features/patient/ProgressPage';
import { SessionCompletePage } from '../features/patient/SessionCompletePage';
import { SessionPage } from '../features/patient/SessionPage';
import { ExerciseLibraryPage } from '../features/therapist/ExerciseLibraryPage';
import { PatientDetailPage } from '../features/therapist/PatientDetailPage';
import { PlanEditorPage } from '../features/therapist/PlanEditorPage';
import { ReviewsPage } from '../features/therapist/ReviewList';
import { TherapistHome } from '../features/therapist/TherapistHome';
import { AuthProvider } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';
import { PatientShell, TherapistShell } from './Shells';
import { ToastProvider } from '../ui/Toast';

function Root() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </AuthProvider>
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
          { path: 'profile', element: <ProfilePage /> },
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
          { path: 'exercises', element: <ExerciseLibraryPage /> },
          { path: 'patients/:patientId', element: <PatientDetailPage /> },
          { path: 'patients/:patientId/plans/new', element: <PlanEditorPage /> },
          { path: 'plans/:planId/edit', element: <PlanEditorPage /> },
        ],
      },
      // Old URLs from the previous version of the app.
      { path: '/patient/dashboard', element: <Navigate to="/patient" replace /> },
      { path: '/physio/*', element: <Navigate to="/therapist" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
