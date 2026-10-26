import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../config/db.js';
import { env, isProduction } from '../config/environment.js';
import { User } from '../models/User.js';
import { ROLES } from '../utils/constants.js';
import { logger } from '../utils/logger.js';

export const ensureAdminUser = async ({ updatePassword = false } = {}) => {
  const email = (env.ADMIN_SEED_EMAIL || 'vishwakarmanayan66@gmail.com').toLowerCase().trim();
  if (!email) return null;

  let existing = await User.findOne({ email });

  if (!existing) {
    // Check if a legacy default admin account exists to migrate
    const legacyAdmin = await User.findOne({ email: 'admin@imovies.com' });
    if (legacyAdmin) {
      logger.info(`Found legacy admin account ('admin@imovies.com'). Migrating email to ${email}...`);
      legacyAdmin.email = email;
      existing = legacyAdmin;
    }
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, salt);

  if (existing) {
    let changed = false;
    if (existing.role !== ROLES.ADMIN) {
      existing.role = ROLES.ADMIN;
      changed = true;
    }
    if (!existing.isEmailVerified || !existing.isVerified || !existing.emailVerified) {
      existing.isEmailVerified = true;
      existing.isVerified = true;
      existing.emailVerified = true;
      existing.emailVerifiedAt = existing.emailVerifiedAt || new Date();
      changed = true;
    }
    if (existing.accountStatus !== 'active') {
      existing.accountStatus = 'active';
      changed = true;
    }
    if (updatePassword) {
      existing.passwordHash = passwordHash;
      changed = true;
    }
    if (changed) {
      await existing.save();
      logger.info(`====================================================`);
      logger.info(`👑 Admin privileges ensured in persistent database!`);
      logger.info(`Email: ${existing.email}`);
      logger.info(`Role: ${existing.role}`);
      if (updatePassword) {
        logger.info(`Password: [Synchronized with ADMIN_SEED_PASSWORD]`);
      }
      logger.info(`====================================================`);
    } else {
      logger.info(`👑 Admin user ${email} is active and verified with role: admin.`);
    }
    return existing;
  } else {
    // In production, require explicit ALLOW_PRODUCTION_SEED=true to seed new accounts
    if (isProduction() && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
      logger.info(`ℹ️ Administrator account ${email} not found in database. Register via the portal to claim it.`);
      return null;
    }

    const adminUser = await User.create({
      name: env.ADMIN_SEED_NAME || 'Cinema SuperAdmin',
      email,
      passwordHash,
      phone: env.ADMIN_SEED_PHONE || '+919876543210',
      role: ROLES.ADMIN,
      accountStatus: 'active',
      isEmailVerified: true,
      isVerified: true,
      emailVerified: true,
      emailVerifiedAt: new Date()
    });

    logger.info(`====================================================`);
    logger.info(`🎉 Successfully created initial Administrator account:`);
    logger.info(`Email: ${adminUser.email}`);
    logger.info(`Role: ${adminUser.role}`);
    logger.info(`====================================================`);
    return adminUser;
  }
};

export const createAdmin = async () => {
  try {
    if (isProduction()) {
      if (process.env.ALLOW_PRODUCTION_SEED !== 'true') {
        throw new Error('CRITICAL SECURITY GUARD: Production admin seeding is blocked. Set ALLOW_PRODUCTION_SEED=true to override.');
      }
      if (!env.ADMIN_SEED_PASSWORD || env.ADMIN_SEED_PASSWORD.length < 14 || env.ADMIN_SEED_PASSWORD === 'Admin@123456') {
        throw new Error('CRITICAL SECURITY GUARD: Production admin seeding requires ADMIN_SEED_PASSWORD to be at least 14 characters and non-default.');
      }
    }

    await connectDB();
    await ensureAdminUser({ updatePassword: true });
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    logger.error('Failed to create admin user:', error.message);
    process.exit(1);
  }
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  createAdmin();
}
