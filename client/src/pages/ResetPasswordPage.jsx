import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Film, Lock, CheckCircle2, AlertCircle, ArrowLeft, KeyRound, LogIn } from 'lucide-react';
import { authService } from '../services/authService.js';
import { toast } from 'react-toastify';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tokenParam = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!tokenParam) {
      setErrorMessage('Missing password reset token. Please request a new password reset link.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter a new password.');
      return;
    }

    if (password.length < 10) {
      setErrorMessage('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both password fields.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.resetPassword({
        token: tokenParam.trim(),
        password,
        confirmPassword
      });
      setResetSuccess(true);
      toast.success(res.message || 'Password has been reset successfully! You can now log in.');
    } catch (err) {
      const msg = err.message || 'Failed to reset password. The reset link may be invalid or expired.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5 d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
      <div
        className="bg-dark p-4 p-md-5 rounded-4 border border-secondary border-opacity-25 shadow-lg w-100"
        style={{ maxWidth: '480px' }}
      >
        {/* IMovies Branding Header */}
        <div className="text-center mb-4">
          <div className="d-inline-flex bg-danger p-3 rounded-3 mb-3 shadow">
            <Film size={28} className="text-white" />
          </div>
          <h2 className="fw-bold text-light mb-1">Set New Password</h2>
          <p className="text-muted small">
            {emailParam ? (
              <>Choose a strong new password for <strong className="text-light">{emailParam}</strong></>
            ) : (
              'Choose a secure new password for your IMovies account'
            )}
          </p>
        </div>

        {/* State 1: Success */}
        {resetSuccess ? (
          <div className="text-center py-3">
            <div className="d-inline-flex bg-success bg-opacity-25 p-3 rounded-circle text-success mb-3">
              <CheckCircle2 size={48} />
            </div>
            <h4 className="fw-bold text-light mb-2">Password Reset Successful!</h4>
            <p className="text-muted small mb-4">
              Your password has been securely updated. You can now sign in with your new credentials and access your bookings.
            </p>
            <button
              id="proceed-to-login-btn"
              type="button"
              className="btn btn-cinema w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              onClick={() => navigate('/login')}
            >
              <LogIn size={18} /> Sign In to IMovies
            </button>
          </div>
        ) : (
          <>
            {/* Missing token alert */}
            {!tokenParam && (
              <div className="alert alert-warning py-2 px-3 small border-0 mb-4 d-flex align-items-center gap-2">
                <AlertCircle size={18} className="flex-shrink-0" />
                <div>
                  No password reset token was detected. Please check the link from your email or{' '}
                  <Link to="/forgot-password" className="text-dark fw-bold text-decoration-underline">
                    request a new reset link
                  </Link>.
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="alert alert-danger py-2 px-3 small border-0 mb-4 d-flex align-items-start gap-2">
                <AlertCircle size={18} className="flex-shrink-0 mt-1" />
                <div>{errorMessage}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* New Password */}
              <div className="mb-3">
                <label htmlFor="reset-password-input" className="form-label text-muted small">New Password (at least 10 characters)</label>
                <div className="input-group">
                  <span className="input-group-text bg-black border-secondary text-muted">
                    <Lock size={16} />
                  </span>
                  <input
                    id="reset-password-input"
                    type="password"
                    required
                    minLength={10}
                    className="form-control bg-black border-secondary text-light py-2"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || !tokenParam}
                  />
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="mb-4">
                <label htmlFor="reset-confirm-password-input" className="form-label text-muted small">Confirm New Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-black border-secondary text-muted">
                    <Lock size={16} />
                  </span>
                  <input
                    id="reset-confirm-password-input"
                    type="password"
                    required
                    minLength={10}
                    className={`form-control bg-black text-light py-2 border-secondary ${
                      confirmPassword && password !== confirmPassword ? 'is-invalid border-danger' : ''
                    }`}
                    placeholder="••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading || !tokenParam}
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <div className="text-danger small mt-1" style={{ fontSize: '0.75rem' }}>
                    Passwords do not match
                  </div>
                )}
              </div>

              <button
                id="reset-submit-btn"
                type="submit"
                className="btn btn-cinema w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
                disabled={loading || !tokenParam || !password || password !== confirmPassword}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                ) : (
                  <>
                    <KeyRound size={18} /> Reset Password
                  </>
                )}
              </button>

              <div className="text-center pt-2 border-top border-secondary border-opacity-25">
                <Link to="/login" className="text-muted text-decoration-none small d-inline-flex align-items-center gap-1 hover-light">
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
