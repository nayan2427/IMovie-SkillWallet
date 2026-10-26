import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/token.js';

describe('Reverification & Security In-Depth Test Suite', () => {
  const legacyIsVerifiedEmail = 'legacy_is_verified@example.com';
  const legacyEmailVerifiedEmail = 'legacy_email_verified@example.com';
  const legacyVerifiedAtEmail = 'legacy_verified_at@example.com';
  const gmailDotEmail = 'john.cinema.fan@gmail.com';
  const emailChangeUserEmail = 'change_my_email@example.com';
  const newEmailTarget = 'brand_new_email@example.com';
  const adminTestUserEmail = 'regular_user_attempt@example.com';
  const forgotResetEmail = 'forgot_reset_target@example.com';

  const defaultPassword = 'SecurePassword@123';

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({
      email: {
        $in: [
          legacyIsVerifiedEmail,
          legacyEmailVerifiedEmail,
          legacyVerifiedAtEmail,
          'johncinemafan@gmail.com',
          'john.cinema.fan@gmail.com',
          emailChangeUserEmail,
          newEmailTarget,
          adminTestUserEmail,
          forgotResetEmail,
          'unverified_forgot@example.com'
        ]
      }
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // 1. Account with ONLY legacy `isVerified: true` in MongoDB (isEmailVerified was false or missing)
    await User.collection.insertOne({
      name: 'Legacy isVerified User',
      email: legacyIsVerifiedEmail,
      passwordHash,
      role: 'user',
      isVerified: true,
      isEmailVerified: false,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 2. Account with ONLY legacy `emailVerified: true` in MongoDB
    await User.collection.insertOne({
      name: 'Legacy emailVerified User',
      email: legacyEmailVerifiedEmail,
      passwordHash,
      role: 'user',
      emailVerified: true,
      isEmailVerified: false,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 3. Account with ONLY `emailVerifiedAt` timestamp in MongoDB
    await User.collection.insertOne({
      name: 'Legacy verifiedAt User',
      email: legacyVerifiedAtEmail,
      passwordHash,
      role: 'user',
      emailVerifiedAt: new Date(),
      isEmailVerified: false,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 4. Gmail account with dots
    await User.create({
      name: 'Gmail Dot User',
      email: 'johncinemafan@gmail.com',
      passwordHash,
      role: 'user',
      isEmailVerified: true,
      isVerified: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      tokenVersion: 0
    });

    // 5. Account for email change test
    await User.create({
      name: 'Email Change Candidate',
      email: emailChangeUserEmail,
      passwordHash,
      role: 'user',
      isEmailVerified: true,
      isVerified: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      tokenVersion: 0
    });

    // 6. Account for forgot/reset password
    await User.create({
      name: 'Forgot Reset Candidate',
      email: forgotResetEmail,
      passwordHash,
      role: 'user',
      isEmailVerified: true,
      isVerified: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      tokenVersion: 0
    });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: {
        $in: [
          legacyIsVerifiedEmail,
          legacyEmailVerifiedEmail,
          legacyVerifiedAtEmail,
          'johncinemafan@gmail.com',
          'john.cinema.fan@gmail.com',
          emailChangeUserEmail,
          newEmailTarget,
          adminTestUserEmail,
          forgotResetEmail,
          'unverified_forgot@example.com'
        ]
      }
    });
    await disconnectDB();
  });

  describe('Task 3: Account Reverification Bug Fix', () => {
    it('allows a legacy user with isVerified: true to sign in and auto-heals isEmailVerified', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: legacyIsVerifiedEmail,
          password: defaultPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.isEmailVerified).toBe(true);
      expect(res.body.data.user.isVerified).toBe(true);
      expect(res.body.data.user.emailVerified).toBe(true);

      // Verify persistence in the database
      const userInDb = await User.findOne({ email: legacyIsVerifiedEmail });
      expect(userInDb.isEmailVerified).toBe(true);
      expect(userInDb.isVerified).toBe(true);
      expect(userInDb.emailVerified).toBe(true);
      expect(userInDb.emailVerifiedAt).toBeDefined();
    });

    it('allows a legacy user with emailVerified: true to sign in without reverification', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: legacyEmailVerifiedEmail,
          password: defaultPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.isEmailVerified).toBe(true);
    });

    it('allows a legacy user with emailVerifiedAt timestamp to sign in without reverification', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: legacyVerifiedAtEmail,
          password: defaultPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.isEmailVerified).toBe(true);
    });

    it('allows a verified user to access protected routes across multiple requests without reverification', async () => {
      const user = await User.findOne({ email: legacyIsVerifiedEmail });
      const token = generateAccessToken(user);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.isEmailVerified).toBe(true);
      expect(res.body.data.user.isVerified).toBe(true);
      expect(res.body.data.user.emailVerified).toBe(true);
    });
  });

  describe('Gmail Normalization & Alias Tolerance', () => {
    it('allows a user registered as johncinemafan@gmail.com to log in with john.cinema.fan@gmail.com', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'john.cinema.fan@gmail.com',
          password: defaultPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('johncinemafan@gmail.com');
    });

    it('allows a user registered as johncinemafan@gmail.com to log in with john.cinema.fan@googlemail.com', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'john.cinema.fan@googlemail.com',
          password: defaultPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('johncinemafan@gmail.com');
    });
  });

  describe('Task 1: Role Escalation Prevention', () => {
    it('strictly ignores role parameter during public registration and creates role "user"', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Hacker Attempting Admin',
          email: adminTestUserEmail,
          password: defaultPassword,
          confirmPassword: defaultPassword,
          role: 'admin' // Attempted privilege escalation
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const createdUser = await User.findOne({ email: adminTestUserEmail });
      expect(createdUser).toBeDefined();
      expect(createdUser.role).toBe('user');
      expect(createdUser.role).not.toBe('admin');
    });

    it('forbids ordinary users from accessing admin routes', async () => {
      const normalUser = await User.findOne({ email: legacyIsVerifiedEmail });
      const token = generateAccessToken(normalUser);

      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Task 3: Email Change Reverification', () => {
    it('resets verification fields to false when user updates their email in profile', async () => {
      const user = await User.findOne({ email: emailChangeUserEmail });
      expect(user.isEmailVerified).toBe(true);
      const token = generateAccessToken(user);

      const res = await request(app)
        .patch('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: newEmailTarget
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresVerification).toBe(true);
      expect(res.body.data.user.email).toBe(newEmailTarget);
      expect(res.body.data.user.isEmailVerified).toBe(false);
      expect(res.body.data.user.isVerified).toBe(false);
      expect(res.body.data.user.emailVerified).toBe(false);

      // Verify the updated user in database is now unverified
      const updatedUser = await User.findOne({ email: newEmailTarget });
      expect(updatedUser.isEmailVerified).toBe(false);
      expect(updatedUser.isVerified).toBe(false);
      expect(updatedUser.emailVerified).toBe(false);
      expect(updatedUser.emailVerificationTokenHash).toBeDefined();

      // Verify old email can no longer log in
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: emailChangeUserEmail,
          password: defaultPassword
        });
      expect(oldLoginRes.status).toBe(401);

      // Verify new email cannot log in until verified
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: newEmailTarget,
          password: defaultPassword
        });
      expect(newLoginRes.status).toBe(403);
      expect(newLoginRes.body.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  describe('Task 4: Forgot & Reset Password Flow', () => {
    it('returns a neutral success response for non-existent email on forgot-password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: 'definitely_nonexistent_9999@example.com'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/account.*exists/i);
    });

    it('returns the same neutral success response for existing email on forgot-password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: forgotResetEmail
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/account.*exists/i);

      // Check DB has hash and expiry
      const user = await User.findOne({ email: forgotResetEmail });
      expect(user.passwordResetTokenHash).toBeDefined();
      expect(user.passwordResetExpiresAt).toBeDefined();
      expect(new Date(user.passwordResetExpiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects password reset with an invalid or tampered token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid_raw_token_xyz_1234567890abcdef',
          password: 'NewStrongPassword@123',
          confirmPassword: 'NewStrongPassword@123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or.*expired/i);
    });

    it('allows password reset with a valid token, and enforces single-use invalidation', async () => {
      // Generate a known raw token and store its sha256 hash in DB
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await User.updateOne(
        { email: forgotResetEmail },
        {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000)
        }
      );

      const initialUser = await User.findOne({ email: forgotResetEmail });
      const initialTokenVersion = initialUser.tokenVersion || 0;

      // 1. Reset with valid token
      const newPassword = 'BrandNewPassword@456';
      const resetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: newPassword,
          confirmPassword: newPassword
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.message).toMatch(/password.*reset/i);

      // Check tokenVersion incremented (session invalidation)
      const updatedUser = await User.findOne({ email: forgotResetEmail });
      expect(updatedUser.tokenVersion).toBe(initialTokenVersion + 1);
      expect(updatedUser.passwordResetTokenHash).toBeFalsy();
      expect(updatedUser.passwordResetExpiresAt).toBeFalsy();

      // Check old password no longer works
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: forgotResetEmail,
          password: defaultPassword
        });
      expect(oldLoginRes.status).toBe(401);

      // Check new password works
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: forgotResetEmail,
          password: newPassword
        });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);

      // 2. Attempt token reuse (replay attack)
      const reuseRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'AnotherPassword@789',
          confirmPassword: 'AnotherPassword@789'
        });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.success).toBe(false);
      expect(reuseRes.body.message).toMatch(/invalid or.*expired/i);
    });

    it('rejects password reset when token has expired', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Set expiry in the past
      await User.updateOne(
        { email: forgotResetEmail },
        {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() - 60 * 1000)
        }
      );

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          password: 'YetAnotherPassword@999',
          confirmPassword: 'YetAnotherPassword@999'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or.*expired/i);
    });
  });
});
