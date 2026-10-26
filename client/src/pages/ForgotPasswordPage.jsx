import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Film, Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { authService } from '../services/authService.js';
import { toast } from 'react-toastify';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.forgotPassword({ email: email.trim() });
      setSubmitted(true);
      toast.success(res.message || 'Password reset request submitted successfully.');
    } catch (err) {
      // Show rate limit or server error if applicable, otherwise keep enumeration neutral
      if (err.response?.status === 429) {
        setErrorMessage(err.message || 'Too many reset requests. Please wait a few minutes before trying again.');
      } else {
        // Still display the confirmation state to protect against user enumeration
        setSubmitted(true);
      }
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
          <h2 className="fw-bold text-light mb-1">Reset Your Password</h2>
          <p className="text-muted small">
            Enter your registered email address to receive a secure password reset link.
          </p>
        </div>

        {errorMessage && (
          <div className="alert alert-danger py-2 px-3 small border-0 mb-4 d-flex align-items-center gap-2">
            <AlertCircle size={18} className="flex-shrink-0" />
            <div>{errorMessage}</div>
          </div>
        )}

        {submitted ? (
          <div className="text-center py-3">
            <div className="d-inline-flex bg-success bg-opacity-25 p-3 rounded-circle text-success mb-3">
              <CheckCircle2 size={44} />
            </div>
            <h4 className="fw-bold text-light mb-2">Check Your Email</h4>
            <p className="text-muted small mb-4">
              If an account with <strong className="text-light">{email}</strong> exists, a password reset link has been sent to your inbox.
              The link is valid for <strong>15 minutes</strong>. Please check your spam folder if you do not see it shortly.
            </p>
            <div className="d-flex flex-column gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
              >
                Send to a different email
              </button>
              <Link to="/login" className="btn btn-cinema py-2 d-flex align-items-center justify-content-center gap-2">
                <ArrowLeft size={16} /> Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="forgot-email-input" className="form-label text-muted small">Registered Email Address</label>
              <div className="input-group">
                <span className="input-group-text bg-black border-secondary text-muted">
                  <Mail size={16} />
                </span>
                <input
                  id="forgot-email-input"
                  type="email"
                  required
                  className="form-control bg-black border-secondary text-light py-2"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="form-text text-muted small mt-2" style={{ fontSize: '0.75rem' }}>
                We will email you a secure, single-use link to set a new password.
              </div>
            </div>

            <button
              id="forgot-submit-btn"
              type="submit"
              className="btn btn-cinema w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              ) : (
                <>
                  Send Reset Link <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="text-center pt-2 border-top border-secondary border-opacity-25">
              <Link to="/login" className="text-muted text-decoration-none small d-inline-flex align-items-center gap-1 hover-light">
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
