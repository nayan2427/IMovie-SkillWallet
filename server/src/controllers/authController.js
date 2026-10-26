import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { generateAccessToken } from '../utils/token.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { ROLES } from '../utils/constants.js';
import { generateVerificationToken, generateVerificationOtp, hashVerificationValue } from '../utils/crypto.js';
import { emailService } from '../services/emailService.js';
import { env, isProduction } from '../config/environment.js';
import { logger } from '../utils/logger.js';

// Rate limiting & Progressive delay state
// Dynamically generate dummy bcrypt hash at startup with cost factor 12
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

const MAX_MAP_SIZE = 10000;
const loginAttempts = new Map();
const forgotPasswordAttempts = new Map();

const enforceMapCapacity = (map, maxSize = MAX_MAP_SIZE) => {
  if (map.size >= maxSize) {
    const keysToDelete = [];
    const iter = map.keys();
    for (let i = 0; i < 1000; i++) {
      const nextKey = iter.next().value;
      if (nextKey) keysToDelete.push(nextKey);
      else break;
    }
    for (const k of keysToDelete) {
      map.delete(k);
    }
  }
};

const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
};

const trackLoginAttempt = async (req, email) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;

  for (const [k, v] of loginAttempts.entries()) {
    if (now - v.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(k);
    }
  }

  const ipKey = `ip:${ip}`;
  const emailKey = `email:${(email || '').toLowerCase().trim()}`;

  const ipRecord = loginAttempts.get(ipKey) || { count: 0, firstAttempt: now };
  const emailRecord = loginAttempts.get(emailKey) || { count: 0, firstAttempt: now };

  if (emailRecord.count >= 10 || ipRecord.count >= 30) {
    const error = new Error('Too many login attempts. Please try again in 15 minutes.');
    error.statusCode = 429;
    throw error;
  }

  const currentAttempts = Math.max(emailRecord.count, ipRecord.count);
  if (currentAttempts >= 2) {
    const delayMs = Math.min(2000, (currentAttempts - 1) * 300);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
};

const recordFailedLogin = (req, email) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const ipKey = `ip:${ip}`;
  const emailKey = `email:${(email || '').toLowerCase().trim()}`;

  const ipRecord = loginAttempts.get(ipKey) || { count: 0, firstAttempt: now };
  const emailRecord = loginAttempts.get(emailKey) || { count: 0, firstAttempt: now };

  ipRecord.count += 1;
  loginAttempts.set(ipKey, ipRecord);

  emailRecord.count += 1;
  loginAttempts.set(emailKey, emailRecord);
  enforceMapCapacity(loginAttempts);
};

const clearLoginAttempts = (req, email) => {
  const emailKey = `email:${(email || '').toLowerCase().trim()}`;
  loginAttempts.delete(emailKey);
};

const checkForgotPasswordRateLimit = (req, email) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const WINDOW_MS = 15 * 60 * 1000;

  for (const [k, v] of forgotPasswordAttempts.entries()) {
    if (now - v.firstAttempt > WINDOW_MS) {
      forgotPasswordAttempts.delete(k);
    }
  }

  const ipKey = `fp_ip:${ip}`;
  const emailKey = `fp_email:${(email || '').toLowerCase().trim()}`;

  const ipRecord = forgotPasswordAttempts.get(ipKey) || { count: 0, firstAttempt: now };
  const emailRecord = forgotPasswordAttempts.get(emailKey) || { count: 0, firstAttempt: now };

  if (emailRecord.count >= 5 || ipRecord.count >= 20) {
    const error = new Error('Too many password reset requests. Please try again later.');
    error.statusCode = 429;
    throw error;
  }

  ipRecord.count += 1;
  emailRecord.count += 1;
  forgotPasswordAttempts.set(ipKey, ipRecord);
  forgotPasswordAttempts.set(emailKey, emailRecord);
  enforceMapCapacity(forgotPasswordAttempts);
};

/**
 * Helper to look up a user by email with case-insensitivity, trim,
 * and Gmail dot / googlemail alias tolerance.
 */
export const findUserByEmail = async (email) => {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.toLowerCase().trim();

  // 1. Direct query with normalized email
  let user = await User.findOne({ email: normalized });
  if (user) return user;

  // 2. Gmail / Googlemail dot & alias tolerance:
  // In Gmail, user.name@gmail.com and username@gmail.com are the same account.
  // If an existing account was saved with or without dots, match flexibly.
  if (normalized.includes('@gmail.com') || normalized.includes('@googlemail.com')) {
    const [localPart] = normalized.split('@');
    const localClean = localPart.replace(/\+.*$/, '').replace(/\./g, '');
    const pattern = '^' + localClean.split('').join('\\.?') + '(\\+[^@]*)?@(gmail|googlemail)\\.com$';
    try {
      user = await User.findOne({ email: { $regex: new RegExp(pattern, 'i') } });
      if (user) return user;
    } catch (e) {
      // Fallback
    }
  }

  return null;
};

export const isUserVerified = (user) => {
  if (!user) return false;
  if (typeof user.isVerifiedAccount === 'function') {
    return user.isVerifiedAccount();
  }
  return Boolean(user.isEmailVerified || user.isVerified || user.emailVerified || user.emailVerifiedAt != null);
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      // Dummy hashing to equalize CPU timing against user enumeration
      await bcrypt.hash(password, 12);
      // Respond identically to prevent email enumeration
      return successResponse(
        res,
        {
          user: {
            email: normalizedEmail,
            isEmailVerified: false,
            isVerified: false,
            emailVerified: false
          },
          email: normalizedEmail,
          requiresVerification: true
        },
        'Registration successful! A verification email has been sent to your email address.',
        201
      );
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate cryptographically secure email verification token and 6-digit OTP
    const verificationToken = generateVerificationToken();
    const verificationOtp = generateVerificationOtp();
    const tokenHash = hashVerificationValue(verificationToken);
    const otpHash = hashVerificationValue(verificationOtp);

    const ttlMinutes = parseInt(env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES, 10) || 60;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      phone: phone ? phone.trim() : '',
      role: ROLES.USER,
      tokenVersion: 0,
      isEmailVerified: false,
      isVerified: false,
      emailVerified: false,
      emailVerifiedAt: null,
      emailVerificationTokenHash: tokenHash,
      emailVerificationOtpHash: otpHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationAttempts: 0,
      emailVerificationLockedUntil: null,
      emailVerificationLastSentAt: new Date()
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: verificationToken,
        otp: verificationOtp
      });
    } catch (emailErr) {
      if (isProduction()) {
        // Rollback created user in production so we do not leave half-created orphan accounts
        await User.findByIdAndDelete(user._id);
        logger.error('Registration aborted: SMTP delivery failed in production. Rolled back half-created account.');
        const err = new Error('Failed to deliver verification email. Account registration could not be completed.');
        err.statusCode = 502;
        throw err;
      } else {
        logger.error('Failed to send verification email on registration (dev/test):', emailErr.message);
      }
    }

    // Do NOT issue access token or set auth cookie for unverified accounts
    return successResponse(
      res,
      {
        user: user.toSafeObject(),
        email: user.email,
        requiresVerification: true
      },
      'Registration successful! A verification email has been sent to your email address.',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token, email, otp } = req.body;

    // Flow 1: Token-based verification (from clickable email link)
    if (token) {
      const tokenHash = hashVerificationValue(token);
      const user = await User.findOne({ emailVerificationTokenHash: tokenHash });

      if (!user) {
        // If email was also passed, check if the account is already verified
        if (email) {
          const verifiedUser = await findUserByEmail(email);
          if (verifiedUser && isUserVerified(verifiedUser)) {
            return successResponse(res, { user: verifiedUser.toSafeObject() }, 'Email is already verified. You can now log in.');
          }
        }
        return errorResponse(res, 'Invalid or expired verification link. Please request a new verification email.', 400, null, 'INVALID_TOKEN');
      }

      // Check token expiration
      if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < new Date()) {
        return errorResponse(res, 'Verification link has expired. Please request a new one.', 400, null, 'TOKEN_EXPIRED');
      }

      // Mark user as verified and invalidate token/OTP fields
      user.isEmailVerified = true;
      user.isVerified = true;
      user.emailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
      user.emailVerificationTokenHash = null;
      user.emailVerificationOtpHash = null;
      user.emailVerificationExpiresAt = null;
      user.emailVerificationAttempts = 0;
      user.emailVerificationLockedUntil = null;
      await user.save();

      return successResponse(
        res,
        { user: user.toSafeObject() },
        'Your email address has been verified successfully! You can now log in.'
      );
    }

    // Flow 2: 6-Digit OTP verification
    if (otp && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const user = await findUserByEmail(normalizedEmail);

      if (!user) {
        return errorResponse(res, 'No account found with this email address.', 404);
      }

      if (isUserVerified(user)) {
        return successResponse(res, { user: user.toSafeObject() }, 'Email is already verified. You can log in.');
      }

      // Check if temporarily locked
      if (user.emailVerificationLockedUntil && user.emailVerificationLockedUntil > new Date()) {
        const retryMinutes = Math.max(1, Math.ceil((user.emailVerificationLockedUntil.getTime() - Date.now()) / (60 * 1000)));
        return errorResponse(
          res,
          `Too many failed attempts. Verification is temporarily locked for ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
          429,
          null,
          'TOO_MANY_ATTEMPTS'
        );
      }

      // Check expiration
      if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
        return errorResponse(res, 'Verification code has expired. Please request a new one.', 400, null, 'OTP_EXPIRED');
      }

      const submittedOtpHash = hashVerificationValue(otp);

      // Atomically check threshold and increment attempt counter (prevents race conditions)
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          emailVerificationAttempts: { $lt: 5 },
          $or: [
            { emailVerificationLockedUntil: null },
            { emailVerificationLockedUntil: { $lte: new Date() } }
          ]
        },
        {
          $inc: { emailVerificationAttempts: 1 }
        },
        { new: true }
      );

      if (!updatedUser) {
        // Parallel attempt or threshold reached: activate 15-minute temporary cooldown (no hard lockout)
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await User.findByIdAndUpdate(user._id, { emailVerificationLockedUntil: lockUntil });
        return errorResponse(
          res,
          'Maximum verification attempts exceeded. Verification is temporarily locked for 15 minutes.',
          429,
          null,
          'TOO_MANY_ATTEMPTS'
        );
      }

      // Constant-time hash comparison
      const isMatch = Boolean(
        user.emailVerificationOtpHash &&
        user.emailVerificationOtpHash.length === submittedOtpHash.length &&
        crypto.timingSafeEqual(
          Buffer.from(user.emailVerificationOtpHash, 'utf-8'),
          Buffer.from(submittedOtpHash, 'utf-8')
        )
      );

      if (!isMatch) {
        const attemptsUsed = updatedUser.emailVerificationAttempts;
        if (attemptsUsed >= 5) {
          await User.findByIdAndUpdate(user._id, {
            emailVerificationLockedUntil: new Date(Date.now() + 15 * 60 * 1000)
          });
        }
        const remainingAttempts = Math.max(0, 5 - attemptsUsed);
        return errorResponse(
          res,
          `Invalid verification code. ${remainingAttempts} attempts remaining.`,
          400,
          null,
          { code: 'INVALID_OTP', attemptsRemaining: remainingAttempts }
        );
      }

      // Mark user as verified and invalidate token/OTP
      updatedUser.isEmailVerified = true;
      updatedUser.isVerified = true;
      updatedUser.emailVerified = true;
      updatedUser.emailVerifiedAt = updatedUser.emailVerifiedAt || new Date();
      updatedUser.emailVerificationTokenHash = null;
      updatedUser.emailVerificationOtpHash = null;
      updatedUser.emailVerificationExpiresAt = null;
      updatedUser.emailVerificationAttempts = 0;
      updatedUser.emailVerificationLockedUntil = null;
      await updatedUser.save();

      return successResponse(
        res,
        { user: updatedUser.toSafeObject() },
        'Your email address has been verified successfully! You can now log in.'
      );
    }

    return errorResponse(res, 'Either a verification token or an email with 6-digit OTP code must be provided.', 400);
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, 'Email address is required.', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(normalizedEmail);

    // Prevent user enumeration: generic success if user doesn't exist or is already verified
    if (!user || isUserVerified(user)) {
      return successResponse(
        res,
        null,
        'If an account with that email address exists and is unverified, a verification email has been sent.'
      );
    }

    // Enforce cooldown between resend requests (60 seconds)
    const COOLDOWN_SECONDS = 60;
    if (user.emailVerificationLastSentAt) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(user.emailVerificationLastSentAt).getTime()) / 1000);
      if (elapsedSeconds < COOLDOWN_SECONDS) {
        const retryAfter = COOLDOWN_SECONDS - elapsedSeconds;
        return errorResponse(
          res,
          `Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before requesting another verification email.`,
          429,
          null,
          { code: 'COOLDOWN_ACTIVE', retryAfter }
        );
      }
    }

    // Generate new token & OTP and reset attempt counter & locks
    const verificationToken = generateVerificationToken();
    const verificationOtp = generateVerificationOtp();
    const tokenHash = hashVerificationValue(verificationToken);
    const otpHash = hashVerificationValue(verificationOtp);
    const ttlMinutes = parseInt(env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES, 10) || 60;

    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationOtpHash = otpHash;
    user.emailVerificationExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    user.emailVerificationAttempts = 0;
    user.emailVerificationLockedUntil = null;
    user.emailVerificationLastSentAt = new Date();
    await user.save();

    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      token: verificationToken,
      otp: verificationOtp
    });

    return successResponse(res, null, 'A new verification email has been sent to your email address.');
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, 'Email address is required.', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    checkForgotPasswordRateLimit(req, normalizedEmail);

    const user = await findUserByEmail(normalizedEmail);
    const genericMsg = 'If an account with that email address exists, a password reset link has been sent.';

    if (!user || user.accountStatus !== 'active') {
      // Dummy work to equalize CPU timing
      await bcrypt.hash(normalizedEmail, 10);
      return successResponse(res, null, genericMsg);
    }

    // Generate 32-byte secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetTokenHash = resetTokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    try {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetToken
      });
    } catch (err) {
      logger.error('Failed to send password reset email:', err.message);
    }

    return successResponse(res, null, genericMsg);
  } catch (error) {
    if (error.statusCode === 429) {
      return errorResponse(res, error.message, 429);
    }
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return errorResponse(res, 'Reset token and new password are required.', 400);
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      $or: [
        { passwordResetTokenHash: resetTokenHash },
        { passwordResetToken: token }
      ],
      $and: [
        {
          $or: [
            { passwordResetExpiresAt: { $gt: new Date() } },
            { passwordResetExpires: { $gt: new Date() } }
          ]
        }
      ]
    });

    if (!user || user.accountStatus !== 'active') {
      return errorResponse(res, 'Invalid or expired password reset token.', 400);
    }

    const salt = await bcrypt.genSalt(12);
    user.passwordHash = await bcrypt.hash(password, salt);
    // Single-use token enforcement: clear token and expiry immediately
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all prior sessions immediately
    await user.save();

    return successResponse(res, null, 'Password has been reset successfully. Please log in with your new password.');
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();

    // Check progressive delay and rate limit before processing credentials
    await trackLoginAttempt(req, normalizedEmail);

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      // Dummy bcrypt for unknown users to equalize timing against enumeration
      await bcrypt.compare(password || '', DUMMY_BCRYPT_HASH);
      recordFailedLogin(req, normalizedEmail);
      logger.warn(`[AUTH] Login failed: User not found for email '${normalizedEmail}' from IP ${getClientIp(req)}`);
      return errorResponse(res, 'Invalid email or password credentials.', 401);
    }

    // Verify password FIRST before checking verification or account status
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      recordFailedLogin(req, normalizedEmail);
      logger.warn(`[AUTH] Login failed: Password mismatch for user ID ${user._id} ('${normalizedEmail}') from IP ${getClientIp(req)}`);
      return errorResponse(res, 'Invalid email or password credentials.', 401);
    }

    // Check verification status across isEmailVerified, isVerified, emailVerified
    const verified = isUserVerified(user);
    if (!verified) {
      logger.warn(`[AUTH] Login blocked: Email not verified for user ID ${user._id} ('${normalizedEmail}')`);
      return errorResponse(
        res,
        'Your email address is not verified. Please verify your email before logging in.',
        403,
        null,
        {
          code: 'EMAIL_NOT_VERIFIED',
          email: user.email
        }
      );
    }

    // If verified but legacy record didn't have isEmailVerified: true, heal it now
    if (!user.isEmailVerified || !user.isVerified || !user.emailVerified) {
      user.isEmailVerified = true;
      user.isVerified = true;
      user.emailVerified = true;
      if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
      await user.save();
    }

    // Reject suspended/deleted users
    if (user.accountStatus !== 'active') {
      logger.warn(`[AUTH] Login blocked: Inactive account status '${user.accountStatus}' for user ID ${user._id} ('${normalizedEmail}')`);
      return errorResponse(res, 'Your account is suspended or inactive. Please contact customer support.', 403);
    }

    // Clear failed login attempts on successful authentication
    clearLoginAttempts(req, normalizedEmail);

    // Rehash at login: upgrade bcrypt rounds to 12 if previously lower
    try {
      const rounds = bcrypt.getRounds(user.passwordHash);
      if (rounds < 12) {
        const upgradedSalt = await bcrypt.genSalt(12);
        user.passwordHash = await bcrypt.hash(password, upgradedSalt);
        await user.save();
        logger.info(`Upgraded bcrypt salt rounds to 12 for user ${user._id}`);
      }
    } catch (hashErr) {
      // Continue even if rounds reading fails
    }

    // Self-heal: ensure configured administrator account holds admin role in persistent DB
    const adminSeedEmail = (env.ADMIN_SEED_EMAIL || 'vishwakarmanayan66@gmail.com').toLowerCase().trim();
    if (normalizedEmail === adminSeedEmail && user.role !== ROLES.ADMIN) {
      user.role = ROLES.ADMIN;
      await user.save();
      logger.info(`[AUTH] Synchronized administrator role for configured admin email '${normalizedEmail}' in database.`);
    }

    const token = generateAccessToken(user);

    // Always issue HTTP-only auth cookie with cross-site production support
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: isProduction() ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logger.info(`[AUTH] Login successful for user ${user._id} ('${normalizedEmail}', role: ${user.role})`);

    return successResponse(
      res,
      {
        user: user.toSafeObject(),
        token
      },
      'Welcome back! Login successful.'
    );
  } catch (error) {
    if (error.statusCode === 429) {
      logger.warn(`[AUTH] Login rate limit exceeded for request from IP ${getClientIp(req)}`);
      return errorResponse(res, error.message, 429);
    }
    next(error);
  }
};

export const getMe = async (req, res) => {
  return successResponse(res, { user: req.user.toSafeObject() });
};

export const logout = async (req, res) => {
  // Invalidate session across devices by incrementing tokenVersion
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
  }

  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'none' : 'lax'
  });
  return successResponse(res, null, 'Logged out successfully.');
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (avatar !== undefined) user.avatar = avatar;

    let emailChanged = false;
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== user.email) {
        // Verify no other account has this email
        const existing = await findUserByEmail(normalizedEmail);
        if (existing && existing._id.toString() !== user._id.toString()) {
          return errorResponse(res, 'This email address is already registered to another account.', 409);
        }

        // Email address changed: require re-verification before treating as verified
        emailChanged = true;
        user.email = normalizedEmail;
        user.isEmailVerified = false;
        user.isVerified = false;
        user.emailVerified = false;
        user.emailVerifiedAt = null;

        const verificationToken = generateVerificationToken();
        const verificationOtp = generateVerificationOtp();
        const tokenHash = hashVerificationValue(verificationToken);
        const otpHash = hashVerificationValue(verificationOtp);
        const ttlMinutes = parseInt(env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES, 10) || 60;

        user.emailVerificationTokenHash = tokenHash;
        user.emailVerificationOtpHash = otpHash;
        user.emailVerificationExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
        user.emailVerificationAttempts = 0;
        user.emailVerificationLockedUntil = null;
        user.emailVerificationLastSentAt = new Date();
        user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate older sessions

        try {
          await emailService.sendVerificationEmail({
            to: user.email,
            name: user.name,
            token: verificationToken,
            otp: verificationOtp
          });
        } catch (emailErr) {
          logger.error('Failed to send verification email on profile email change:', emailErr.message);
        }
      }
    }

    await user.save();
    const message = emailChanged
      ? 'Profile updated. A verification email has been sent to your new email address. Please verify your email.'
      : 'Profile updated successfully.';

    return successResponse(res, { user: user.toSafeObject(), emailChanged, requiresVerification: emailChanged }, message);
  } catch (error) {
    next(error);
  }
};
