import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordPage } from '../pages/ResetPasswordPage.jsx';
import { authService } from '../services/authService.js';

vi.mock('../services/authService.js', () => ({
  authService: {
    resetPassword: vi.fn()
  }
}));

describe('ResetPasswordPage Component Tests', () => {
  it('displays warning when reset token is missing from URL', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/no password reset token was detected/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new reset link/i })).toBeInTheDocument();
  });

  it('renders password and confirm password inputs when token is present', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=valid_test_token_123&email=test@example.com']}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password \(at least 10 characters\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('shows error if passwords do not match', async () => {
    render(
      <MemoryRouter initialEntries={['/reset-password?token=valid_test_token_123']}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    const passInput = screen.getByLabelText(/new password \(at least 10 characters\)/i);
    const confirmInput = screen.getByLabelText(/confirm new password/i);

    fireEvent.change(passInput, { target: { value: 'Secret@12345' } });
    fireEvent.change(confirmInput, { target: { value: 'DifferentPassword123' } });

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('successfully resets password and shows success state', async () => {
    authService.resetPassword.mockResolvedValueOnce({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });

    render(
      <MemoryRouter initialEntries={['/reset-password?token=valid_test_token_123']}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    const passInput = screen.getByLabelText(/new password \(at least 10 characters\)/i);
    const confirmInput = screen.getByLabelText(/confirm new password/i);
    const submitBtn = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passInput, { target: { value: 'NewSecurePassword@123' } });
    fireEvent.change(confirmInput, { target: { value: 'NewSecurePassword@123' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/password reset successful!/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in to imovies/i })).toBeInTheDocument();
    });

    expect(authService.resetPassword).toHaveBeenCalledWith({
      token: 'valid_test_token_123',
      password: 'NewSecurePassword@123',
      confirmPassword: 'NewSecurePassword@123'
    });
  });

  it('handles server rejection for expired or invalid token', async () => {
    authService.resetPassword.mockRejectedValueOnce(new Error('Invalid or expired password reset token.'));

    render(
      <MemoryRouter initialEntries={['/reset-password?token=expired_token']}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    const passInput = screen.getByLabelText(/new password \(at least 10 characters\)/i);
    const confirmInput = screen.getByLabelText(/confirm new password/i);
    const submitBtn = screen.getByRole('button', { name: /reset password/i });

    fireEvent.change(passInput, { target: { value: 'NewSecurePassword@123' } });
    fireEvent.change(confirmInput, { target: { value: 'NewSecurePassword@123' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/invalid or expired password reset token/i)).toBeInTheDocument();
    });
  });
});
