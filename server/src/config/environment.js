import dotenv from 'dotenv';
dotenv.config();

/**
 * Fail-closed production check.
 * Any environment other than explicitly 'development' or 'test' is treated as production.
 */
export const isProduction = (...args) => {
  const target = args.length > 0 ? args[0] : process.env.NODE_ENV;
  const envStr = (target || '').trim().toLowerCase();
  return envStr !== 'development' && envStr !== 'test';
};

export const SAMPLE_JWT_SECRETS = [
  'imovies_super_secret_jwt_access_token_key_change_in_production_2026',
  'imovies_super_secret_refresh_token_key_change_in_production_2026',
  'secret',
  'jwt_secret',
  'changeme',
  '12345678901234567890123456789012',
  'your_jwt_access_secret_key_here_minimum_32_characters'
];

/**
 * Evaluates whether payments are enabled based on environment variables.
 * Explicit flags PAYMENTS_ENABLED / PAYMENT_ENABLED take precedence.
 * In development/test, payments default to enabled (simulated).
 * In production, payments are disabled if PAYMENTS_ENABLED is explicitly false/0/disabled,
 * or if PAYMENT_PROVIDER is 'disabled' or 'none'.
 */
export const isPaymentEnabled = (targetEnv = process.env) => {
  const rawFlag = targetEnv.PAYMENTS_ENABLED ?? targetEnv.PAYMENT_ENABLED;
  if (rawFlag !== undefined) {
    const normalized = String(rawFlag).trim().toLowerCase();
    if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'disabled') {
      return false;
    }
    if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'enabled') {
      return true;
    }
  }

  const provider = (targetEnv.PAYMENT_PROVIDER || '').trim().toLowerCase();
  if (provider === 'disabled' || provider === 'none') {
    return false;
  }

  // Non-production environments default to true (simulated dev payments)
  const nodeEnv = targetEnv.NODE_ENV;
  if (!isProduction(nodeEnv)) {
    return true;
  }

  // In production, if payments are not explicitly disabled, default is based on provider.
  // If provider is specified or default, it will be validated by validateEnvironment.
  return true;
};

/**
 * Validates critical environment variables.
 * Fails fast in production or fail-closed modes.
 */
export const validateEnvironment = (targetEnv = process.env) => {
  const nodeEnv = targetEnv.NODE_ENV;
  if (!isProduction(nodeEnv)) {
    return true;
  }

  const jwtSecret = targetEnv.JWT_ACCESS_SECRET;
  if (!jwtSecret || !jwtSecret.trim()) {
    throw new Error('CRITICAL CONFIG ERROR: Missing required environment variable JWT_ACCESS_SECRET in production');
  }

  if (jwtSecret.length < 32) {
    throw new Error('CRITICAL CONFIG ERROR: JWT_ACCESS_SECRET must be at least 32 characters long in production');
  }

  const isSample = SAMPLE_JWT_SECRETS.includes(jwtSecret) ||
    jwtSecret.toLowerCase().includes('change_in_production') ||
    jwtSecret.toLowerCase().includes('imovies_super_secret');
  if (isSample) {
    throw new Error('CRITICAL CONFIG ERROR: JWT_ACCESS_SECRET must not use a sample/default placeholder in production');
  }

  const paymentsEnabled = isPaymentEnabled(targetEnv);
  if (!paymentsEnabled) {
    // Safe payment-disabled mode: Allowed in production without payment credentials
    return true;
  }

  // If payments ARE enabled in production, validate provider and credentials
  const paymentProvider = (targetEnv.PAYMENT_PROVIDER || 'simulated').trim().toLowerCase();
  if (paymentProvider === 'simulated') {
    throw new Error(
      "CRITICAL CONFIG ERROR: PAYMENT_PROVIDER cannot be 'simulated' in production when payments are enabled. " +
      "Configure a real provider ('razorpay' or 'stripe') with required credentials, or set PAYMENTS_ENABLED=false to run in payment-disabled mode."
    );
  }

  if (paymentProvider === 'razorpay') {
    const keyId = targetEnv.RAZORPAY_KEY_ID;
    const keySecret = targetEnv.RAZORPAY_KEY_SECRET;
    if (!keyId || !keyId.trim()) {
      throw new Error("CRITICAL CONFIG ERROR: Missing required environment variable RAZORPAY_KEY_ID when PAYMENT_PROVIDER is 'razorpay' in production");
    }
    if (!keySecret || !keySecret.trim()) {
      throw new Error("CRITICAL CONFIG ERROR: Missing required environment variable RAZORPAY_KEY_SECRET when PAYMENT_PROVIDER is 'razorpay' in production");
    }
    if (keyId.includes('sample_key_id') || keySecret.includes('sample_secret')) {
      throw new Error("CRITICAL CONFIG ERROR: RAZORPAY credentials must not use sample/default placeholders in production");
    }
    return true;
  }

  if (paymentProvider === 'stripe') {
    const stripeKey = targetEnv.STRIPE_SECRET_KEY;
    if (!stripeKey || !stripeKey.trim()) {
      throw new Error("CRITICAL CONFIG ERROR: Missing required environment variable STRIPE_SECRET_KEY when PAYMENT_PROVIDER is 'stripe' in production");
    }
    if (stripeKey.includes('sample_stripe_key')) {
      throw new Error("CRITICAL CONFIG ERROR: STRIPE_SECRET_KEY must not use sample/default placeholders in production");
    }
    return true;
  }

  throw new Error(
    `CRITICAL CONFIG ERROR: Unsupported PAYMENT_PROVIDER '${paymentProvider}' in production when payments are enabled. ` +
    `Supported providers are 'razorpay' or 'stripe', or set PAYMENTS_ENABLED=false.`
  );
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || (isProduction() ? 'https://imovie-skillwallet.jaivish546.workers.dev' : 'http://localhost:5173'),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/imovies',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'imovies_super_secret_jwt_access_token_key_change_in_production_2026',
  // Access token lifetime default: 2 hours (1-2h policy)
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
  PAYMENTS_ENABLED: isPaymentEnabled(process.env),
  PAYMENT_PROVIDER: isPaymentEnabled(process.env)
    ? (process.env.PAYMENT_PROVIDER || 'simulated').toLowerCase().trim()
    : 'disabled',
  PAYMENT_TEST_MODE: process.env.PAYMENT_TEST_MODE !== 'false',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  ADMIN_SEED_NAME: process.env.ADMIN_SEED_NAME || 'Cinema SuperAdmin',
  ADMIN_SEED_EMAIL: process.env.ADMIN_SEED_EMAIL || 'vishwakarmanayan66@gmail.com',
  ADMIN_SEED_PASSWORD: process.env.ADMIN_SEED_PASSWORD || 'Admin@123456',
  ADMIN_SEED_PHONE: process.env.ADMIN_SEED_PHONE || '+919876543210',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'IMovies Cinema <noreply@imovies.com>',
  EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: parseInt(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES, 10) || 60,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || '',
  BREVO_API_KEY: process.env.BREVO_API_KEY || ''
};

// Fail fast at startup in production
if (isProduction()) {
  validateEnvironment(process.env);
}
