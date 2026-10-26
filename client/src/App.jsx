import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { checkAuth } from './store/authSlice.js';
import { Server } from 'lucide-react';

// Layouts
import { MainLayout } from './layouts/MainLayout.jsx';
import { AdminLayout } from './layouts/AdminLayout.jsx';

// Route Guards
import { ProtectedRoute } from './components/common/ProtectedRoute.jsx';
import { AdminRoute } from './components/common/AdminRoute.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';

// Public Pages
import { HomePage } from './pages/HomePage.jsx';
import { MoviesPage } from './pages/MoviesPage.jsx';
import { MovieDetailsPage } from './pages/MovieDetailsPage.jsx';
import { TheatresPage } from './pages/TheatresPage.jsx';
import { SeatSelectionPage } from './pages/SeatSelectionPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { VerifyEmailPage } from './pages/VerifyEmailPage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

// Authenticated User Pages
import { BookingConfirmationPage } from './pages/BookingConfirmationPage.jsx';
import { UserBookingsPage } from './pages/UserBookingsPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx';
import { AdminMoviesPage } from './pages/admin/AdminMoviesPage.jsx';
import { AdminTheatresPage } from './pages/admin/AdminTheatresPage.jsx';
import { AdminShowsPage } from './pages/admin/AdminShowsPage.jsx';
import { AdminBookingsPage } from './pages/admin/AdminBookingsPage.jsx';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.jsx';

export const App = () => {
  const dispatch = useDispatch();
  const [wakeUpMessage, setWakeUpMessage] = useState(null);

  useEffect(() => {
    // Check session on initial load
    dispatch(checkAuth());

    // Listen to global auth-expired event from API interceptor
    const handleAuthExpired = () => {
      dispatch(checkAuth());
    };
    window.addEventListener('auth-expired', handleAuthExpired);

    // Listen to Render cold-start wake up event
    const handleWakeUp = (e) => {
      if (e.detail?.isWaking) {
        setWakeUpMessage(e.detail.message || 'Cinema server is waking up from sleep. Please hold on...');
      } else {
        setWakeUpMessage(null);
      }
    };
    window.addEventListener('server-wake-up', handleWakeUp);

    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
      window.removeEventListener('server-wake-up', handleWakeUp);
    };
  }, [dispatch]);

  return (
    <ErrorBoundary>
      {wakeUpMessage && (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x mb-4 px-4 py-3 bg-danger text-white rounded-3 shadow-lg d-flex align-items-center gap-3 border border-light border-opacity-25 animate__animated animate__fadeInUp"
          style={{ zIndex: 9999, maxWidth: '90vw' }}
        >
          <div className="spinner-border spinner-border-sm text-light flex-shrink-0" role="status" />
          <span className="small fw-semibold">{wakeUpMessage}</span>
        </div>
      )}
      <Routes>
        {/* Main Customer Layout */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="movies" element={<MoviesPage />} />
          <Route path="movies/:id" element={<MovieDetailsPage />} />
          <Route path="theatres" element={<TheatresPage />} />
          <Route path="book/:showId" element={<SeatSelectionPage />} />

          {/* Protected Customer Routes */}
          <Route
            path="booking-confirmation/:id"
            element={
              <ProtectedRoute>
                <BookingConfirmationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="my-bookings"
            element={
              <ProtectedRoute>
                <UserBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Auth Routes */}
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Protected Administration Layout */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="movies" element={<AdminMoviesPage />} />
          <Route path="theatres" element={<AdminTheatresPage />} />
          <Route path="shows" element={<AdminShowsPage />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
};

export default App;
