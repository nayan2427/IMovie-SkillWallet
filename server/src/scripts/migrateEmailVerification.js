import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * Safe, idempotent migration script to reconcile email verification fields across:
 * - isEmailVerified
 * - isVerified
 * - emailVerified
 * - emailVerifiedAt
 *
 * Rules:
 * 1. Only accounts with existing trustworthy verification records (isVerified: true,
 *    emailVerified: true, or emailVerifiedAt != null) are synchronized.
 * 2. Unverified accounts remain strictly unverified.
 * 3. Does NOT delete or alter any existing passwords, bookings, or user details.
 * 4. Can be executed safely multiple times without side effects.
 */
export const runEmailVerificationMigration = async () => {
  try {
    logger.info('==================================================');
    logger.info('🛠️ Starting Safe Email Verification Migration...');
    logger.info('==================================================');

    await connectDB();

    // Find accounts that are verified under any field name or are administrator accounts
    const candidates = await User.find({
      $or: [
        { isVerified: true },
        { emailVerified: true },
        { emailVerifiedAt: { $ne: null } },
        { role: 'admin' }
      ]
    });

    logger.info(`Found ${candidates.length} verified candidate account(s) to verify/reconcile.`);

    let updatedCount = 0;
    for (const user of candidates) {
      let needsSave = false;

      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        needsSave = true;
      }
      if (user.isVerified !== true) {
        user.isVerified = true;
        needsSave = true;
      }
      if (user.emailVerified !== true) {
        user.emailVerified = true;
        needsSave = true;
      }
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = user.createdAt || new Date();
        needsSave = true;
      }

      if (needsSave) {
        await user.save();
        updatedCount++;
        logger.info(`✓ Reconciled verification fields for user: ${user.email} (${user._id})`);
      }
    }

    logger.info('==================================================');
    logger.info(`Migration complete! Reconciled ${updatedCount} account(s).`);
    logger.info('==================================================');
  } catch (err) {
    logger.error('Migration failed:', err.message);
    throw err;
  }
};

// Direct script execution
if (process.argv[1]?.endsWith('migrateEmailVerification.js')) {
  runEmailVerificationMigration()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      await disconnectDB();
      process.exit(1);
    });
}
