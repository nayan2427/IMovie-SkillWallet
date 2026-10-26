import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/authSlice.js';
import { LoginPage } from '../pages/LoginPage.jsx';

const renderLoginPage = (authState = {}) => {
  const store = configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        authErrorCode: null,
        unverifiedEmail: null,
        ...authState
      }
    }
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </Provider>
  );
};

describe('LoginPage Security & UI Tests', () => {
  it('does NOT render Demo User or Demo Admin buttons on the public sign in page', () => {
    renderLoginPage();

    expect(screen.queryByRole('button', { name: /demo user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /demo admin/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/quick demo credentials/i)).not.toBeInTheDocument();
  });

  it('renders email, password, sign in button, and register link', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /register here/i })).toBeInTheDocument();
  });

  it('renders clearly visible Forgot Password? link pointing to /forgot-password', () => {
    renderLoginPage();

    const forgotLink = screen.getByRole('link', { name: /forgot password\?/i });
    expect(forgotLink).toBeInTheDocument();
    expect(forgotLink.getAttribute('href')).toBe('/forgot-password');
  });

  it('displays warning and verification link when email is not verified', () => {
    renderLoginPage({
      authErrorCode: 'EMAIL_NOT_VERIFIED',
      unverifiedEmail: 'unverified@example.com'
    });

    expect(screen.getByText(/email verification required/i)).toBeInTheDocument();
    const verifyNowBtn = screen.getByRole('link', { name: /verify email now/i });
    expect(verifyNowBtn).toBeInTheDocument();
    expect(verifyNowBtn.getAttribute('href')).toContain('/verify-email?email=unverified%40example.com');
  });
});
