import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.jsx';
import { authService } from '../services/authService.js';

vi.mock('../services/authService.js', () => ({
  authService: {
    forgotPassword: vi.fn()
  }
}));

describe('ForgotPasswordPage Component Tests', () => {
  it('renders branding header, email input, submit button and back to login link', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/reset your password/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument();
  });

  it('shows neutral confirmation message on submission to prevent account enumeration', async () => {
    authService.forgotPassword.mockResolvedValueOnce({
      success: true,
      message: 'If an account with that email address exists, a password reset link has been sent.'
    });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('name@example.com');
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      expect(screen.getByText(/user@example.com/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /return to sign in/i })).toBeInTheDocument();
    });

    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' });
  });

  it('handles rate limiting 429 response gracefully', async () => {
    const error = new Error('Too many password reset requests. Please try again later.');
    error.response = { status: 429 };
    authService.forgotPassword.mockRejectedValueOnce(error);

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('name@example.com');
    fireEvent.change(emailInput, { target: { value: 'rate-limited@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /send reset link/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/too many password reset requests/i)).toBeInTheDocument();
    });
  });
});
