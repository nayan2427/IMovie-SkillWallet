import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { isProduction, validateEnvironment, isPaymentEnabled, env, SAMPLE_JWT_SECRETS } from '../src/config/environment.js';
import { isOriginAllowed, getAllowedOrigins } from '../src/config/cors.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import app from '../src/app.js';
import { emailService } from '../src/services/emailService.js';
import { seedDatabase } from '../src/scripts/seed.js';
import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/token.js';
import { ROLES } from '../src/utils/constants.js';
import { seatReservationService } from '../src/services/seatReservationService.js';
import { ensureAdminUser } from '../src/scripts/createAdmin.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

describe('Phase 1 Security & Startup Validation Suite', () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    await connectDB();

  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Fail-Closed isProduction() Behavior', () => {
    it('treats undefined NODE_ENV as production (fail-closed)', () => {
      expect(isProduction(undefined)).toBe(true);
    });

    it('treats empty string NODE_ENV as production (fail-closed)', () => {
      expect(isProduction('')).toBe(true);
      expect(isProduction('   ')).toBe(true);
    });

    it('treats staging, prod, production as production', () => {
      expect(isProduction('production')).toBe(true);
      expect(isProduction('PRODUCTION')).toBe(true);
      expect(isProduction('staging')).toBe(true);
      expect(isProduction('uat')).toBe(true);
    });

    it('treats only development and test as non-production', () => {
      expect(isProduction('development')).toBe(false);
      expect(isProduction('DEVELOPMENT')).toBe(false);
      expect(isProduction('test')).toBe(false);
      expect(isProduction('TEST')).toBe(false);
    });
  });

  describe('2. Sample JWT Secret Rejection at Startup', () => {
    it('throws when JWT_ACCESS_SECRET uses the sample placeholder in production', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'imovies_super_secret_jwt_access_token_key_change_in_production_2026',
          PAYMENT_PROVIDER: 'razorpay'
        });
      }).toThrow(/sample\/default placeholder in production/);
    });

    it('throws when JWT_ACCESS_SECRET contains change_in_production in production', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'my_custom_secret_key_change_in_production_123456789',
          PAYMENT_PROVIDER: 'razorpay'
        });
      }).toThrow(/sample\/default placeholder in production/);
    });

    it('throws when JWT_ACCESS_SECRET is under 32 characters in production', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'short_key_under_32_characters',
          PAYMENT_PROVIDER: 'razorpay'
        });
      }).toThrow(/at least 32 characters long in production/);
    });

    it('throws when JWT_ACCESS_SECRET is missing in production', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: '',
          PAYMENT_PROVIDER: 'razorpay'
        });
      }).toThrow(/Missing required environment variable JWT_ACCESS_SECRET/);
    });

    it('throws when NODE_ENV is unset and JWT secret is a sample (fail-closed)', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: undefined,
          JWT_ACCESS_SECRET: 'imovies_super_secret_jwt_access_token_key_change_in_production_2026',
          PAYMENT_PROVIDER: 'razorpay'
        });
      }).toThrow(/sample\/default placeholder in production/);
    });

    it('allows strong, unique, >=32 char JWT secret in production', () => {
      expect(
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENTS_ENABLED: 'false'
        })
      ).toBe(true);
    });

    it('allows sample secret in development and test environments', () => {
      expect(
        validateEnvironment({
          NODE_ENV: 'development',
          JWT_ACCESS_SECRET: 'imovies_super_secret_jwt_access_token_key_change_in_production_2026',
          PAYMENT_PROVIDER: 'simulated'
        })
      ).toBe(true);

      expect(
        validateEnvironment({
          NODE_ENV: 'test',
          JWT_ACCESS_SECRET: 'imovies_super_secret_jwt_access_token_key_change_in_production_2026',
          PAYMENT_PROVIDER: 'simulated'
        })
      ).toBe(true);
    });
  });

  describe('3. Payment Configuration & Safe Payment-Disabled Production Mode', () => {
    it('throws when PAYMENT_PROVIDER is simulated in production with payments enabled', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'simulated'
        });
      }).toThrow(/PAYMENT_PROVIDER cannot be 'simulated' in production/);
    });

    it('throws when PAYMENT_PROVIDER defaults to simulated when unset in production with payments enabled', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!'
        });
      }).toThrow(/PAYMENT_PROVIDER cannot be 'simulated' in production/);
    });

    it('allows starting in production with payments disabled via PAYMENTS_ENABLED=false', () => {
      expect(
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENTS_ENABLED: 'false',
          PAYMENT_PROVIDER: 'simulated'
        })
      ).toBe(true);

      expect(
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_ENABLED: 'false'
        })
      ).toBe(true);
    });

    it('allows starting in production with PAYMENT_PROVIDER=disabled or none', () => {
      expect(
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'disabled'
        })
      ).toBe(true);

      expect(
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'none'
        })
      ).toBe(true);
    });

    it('does NOT permit ALLOW_SIMULATED_PAYMENTS_IN_PROD to bypass simulated provider guard when payments are enabled', () => {
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENTS_ENABLED: 'true',
          PAYMENT_PROVIDER: 'simulated',
          ALLOW_SIMULATED_PAYMENTS_IN_PROD: 'true'
        });
      }).toThrow(/PAYMENT_PROVIDER cannot be 'simulated' in production/);
    });

    it('validates required credentials when razorpay is enabled in production', () => {
      // Missing credentials
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'razorpay'
        });
      }).toThrow(/RAZORPAY_KEY_ID/);

      // Sample placeholder rejected
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'razorpay',
          RAZORPAY_KEY_ID: 'mock_sample_key_id_value',
          RAZORPAY_KEY_SECRET: 'mock_sample_secret_value'
        });
      }).toThrow(/sample\/default placeholders/);

      // Valid credentials accepted
      expect(
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'razorpay',
          RAZORPAY_KEY_ID: 'mock_custom_key_id_valid_123',
          RAZORPAY_KEY_SECRET: 'mock_custom_secret_valid_456'
        })
      ).toBe(true);
    });

    it('validates required credentials when stripe is enabled in production', () => {
      // Missing key
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'stripe'
        });
      }).toThrow(/STRIPE_SECRET_KEY/);

      // Sample key rejected
      expect(() => {
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'stripe',
          STRIPE_SECRET_KEY: 'mock_sample_stripe_key_placeholder'
        });
      }).toThrow(/sample\/default placeholders/);

      // Valid key accepted
      expect(
        validateEnvironment({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'a_very_secure_high_entropy_secret_key_for_production_use_2026!',
          PAYMENT_PROVIDER: 'stripe',
          STRIPE_SECRET_KEY: 'mock_custom_stripe_key_valid_789'
        })
      ).toBe(true);
    });

    it('evaluates isPaymentEnabled correctly across environments', () => {
      expect(isPaymentEnabled({ NODE_ENV: 'development' })).toBe(true);
      expect(isPaymentEnabled({ NODE_ENV: 'test' })).toBe(true);
      expect(isPaymentEnabled({ NODE_ENV: 'development', PAYMENTS_ENABLED: 'false' })).toBe(false);
      expect(isPaymentEnabled({ NODE_ENV: 'production', PAYMENTS_ENABLED: 'false' })).toBe(false);
      expect(isPaymentEnabled({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'disabled' })).toBe(false);
      expect(isPaymentEnabled({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'none' })).toBe(false);
    });

    it('blocks /api/v1/payments/simulate with 403 Forbidden in production', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevPaymentsEnabled = env.PAYMENTS_ENABLED;
      process.env.NODE_ENV = 'production';
      env.PAYMENTS_ENABLED = true;
      try {
        const res = await request(app)
          .post('/api/v1/payments/simulate')
          .send({ orderId: 'ORD_TEST_123' });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('Payment simulation is disabled in production');
      } finally {
        process.env.NODE_ENV = prevEnv;
        env.PAYMENTS_ENABLED = prevPaymentsEnabled;
      }
    });

    it('blocks payment endpoints with 503 when payments are disabled', async () => {
      const prevPaymentsEnabled = env.PAYMENTS_ENABLED;
      env.PAYMENTS_ENABLED = false;
      try {
        // Webhook blocked
        const webhookRes = await request(app)
          .post('/api/v1/payments/webhook')
          .send({ event: 'payment.captured' });
        expect(webhookRes.status).toBe(503);
        expect(webhookRes.body.success).toBe(false);
        expect(webhookRes.body.code).toBe('PAYMENTS_DISABLED');

        // Simulate blocked with 503
        const simRes = await request(app)
          .post('/api/v1/payments/simulate')
          .send({ orderId: 'ORD_TEST_123' });
        expect(simRes.status).toBe(503);
        expect(simRes.body.code).toBe('PAYMENTS_DISABLED');
      } finally {
        env.PAYMENTS_ENABLED = prevPaymentsEnabled;
      }
    });

    it('blocks /api/v1/bookings/create-order and /confirm with 503 when payments are disabled', async () => {
      const testUser = await User.create({
        name: 'Disabled Payment Tester',
        email: `dis_pay_${Date.now()}@testmovies.com`,
        passwordHash: 'dummy_hash_not_used',
        role: ROLES.USER,
        accountStatus: 'active',
        isEmailVerified: true
      });
      const token = generateAccessToken(testUser);

      const prevPaymentsEnabled = env.PAYMENTS_ENABLED;
      env.PAYMENTS_ENABLED = false;
      try {
        const orderRes = await request(app)
          .post('/api/v1/bookings/create-order')
          .set('Authorization', `Bearer ${token}`)
          .send({ bookingId: new mongoose.Types.ObjectId() });
        expect(orderRes.status).toBe(503);
        expect(orderRes.body.success).toBe(false);
        expect(orderRes.body.code).toBe('PAYMENTS_DISABLED');

        const confirmRes = await request(app)
          .post('/api/v1/bookings/confirm')
          .set('Authorization', `Bearer ${token}`)
          .send({ bookingId: new mongoose.Types.ObjectId() });
        expect(confirmRes.status).toBe(503);
        expect(confirmRes.body.success).toBe(false);
        expect(confirmRes.body.code).toBe('PAYMENTS_DISABLED');
      } finally {
        env.PAYMENTS_ENABLED = prevPaymentsEnabled;
      }
    });

    it('prevents unauthorized paid-access in seatReservationService when payments are disabled', async () => {
      const prevPaymentsEnabled = env.PAYMENTS_ENABLED;
      env.PAYMENTS_ENABLED = false;
      try {
        await expect(
          seatReservationService.confirmBookingPayment({
            bookingId: new mongoose.Types.ObjectId(),
            paymentResult: { paymentId: 'FAKE_PAY_123', amount: 500 },
            user: { _id: new mongoose.Types.ObjectId(), role: 'user' }
          })
        ).rejects.toThrow(/Payments are currently disabled on this platform/);
      } finally {
        env.PAYMENTS_ENABLED = prevPaymentsEnabled;
      }
    });
  });

  describe('4. Strict CORS & Socket.IO Origin Whitelist', () => {
    it('rejects arbitrary *.pages.dev domains', () => {
      expect(isOriginAllowed('https://attacker.pages.dev')).toBe(false);
      expect(isOriginAllowed('https://malicious-clone.pages.dev')).toBe(false);
      expect(isOriginAllowed('https://evil.com')).toBe(false);
    });

    it('allows configured origins and requests with no origin', () => {
      expect(isOriginAllowed(null)).toBe(true);
      expect(isOriginAllowed(undefined)).toBe(true);
      expect(isOriginAllowed('')).toBe(true);
    });
  });

  describe('5. Production Database Seeding Protection', () => {
    it('refuses to seed in production without ALLOW_PRODUCTION_SEED=true', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevAllow = process.env.ALLOW_PRODUCTION_SEED;
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_PRODUCTION_SEED;
      try {
        await expect(seedDatabase({ reset: false, closeConnection: false })).rejects.toThrow(
          /Production database seeding is blocked/
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevAllow) process.env.ALLOW_PRODUCTION_SEED = prevAllow;
      }
    });
  });

  describe('6. Email Service Mock Protection in Production', () => {
    it('refuses to deliver mock verification emails in production', async () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(
          emailService.sendVerificationEmail({
            to: 'test@example.com',
            name: 'Test',
            token: 'sampletoken',
            otp: '123456'
          })
        ).rejects.toThrow(/Failed to deliver verification email/);
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  describe('7. Persistent Admin User Synchronization & Role Validation', () => {
    const adminEmail = 'vishwakarmanayan66@gmail.com';
    const normalUserEmail = 'regular_user_test@example.com';
    const testPassword = 'TestPassword@123';

    it('ensureAdminUser() promotes an existing user to admin and marks email verified', async () => {
      // 1. Create a regular user with role 'user'
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(testPassword, salt);
      await User.deleteMany({ email: adminEmail });

      const createdUser = await User.create({
        name: 'Nayan Vishwakarma',
        email: adminEmail,
        passwordHash,
        role: ROLES.USER,
        isEmailVerified: false,
        accountStatus: 'active'
      });
      expect(createdUser.role).toBe(ROLES.USER);
      expect(createdUser.isEmailVerified).toBe(false);

      // 2. Run ensureAdminUser()
      const admin = await ensureAdminUser();
      expect(admin).toBeDefined();
      expect(admin.role).toBe(ROLES.ADMIN);
      expect(admin.isEmailVerified).toBe(true);

      // Verify persistence in the database
      const userInDb = await User.findOne({ email: adminEmail });
      expect(userInDb.role).toBe(ROLES.ADMIN);
      expect(userInDb.isEmailVerified).toBe(true);
      expect(userInDb.accountStatus).toBe('active');
    });

    it('login as admin returns role: admin and grants access to admin routes', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: adminEmail,
          password: testPassword
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.role).toBe(ROLES.ADMIN);
      expect(loginRes.body.data.token).toBeDefined();

      const adminToken = loginRes.body.data.token;

      // Access protected admin-only route (/api/v1/admin/users)
      const adminRouteRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRouteRes.status).toBe(200);
      expect(adminRouteRes.body.success).toBe(true);
    });

    it('normal user login returns role: user and is blocked from admin routes with 403', async () => {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(testPassword, salt);
      await User.deleteMany({ email: normalUserEmail });

      await User.create({
        name: 'Regular Customer',
        email: normalUserEmail,
        passwordHash,
        role: ROLES.USER,
        isEmailVerified: true,
        accountStatus: 'active'
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: normalUserEmail,
          password: testPassword
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.role).toBe(ROLES.USER);

      const userToken = loginRes.body.data.token;

      // Attempt unauthorized access to protected admin route
      const adminRouteRes = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(adminRouteRes.status).toBe(403);
      expect(adminRouteRes.body.success).toBe(false);
      expect(adminRouteRes.body.message).toContain('Access denied');
    });
  });
});
