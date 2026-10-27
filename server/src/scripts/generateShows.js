import { connectDB, disconnectDB } from '../config/db.js';
import { Movie } from '../models/Movie.js';
import { Theatre } from '../models/Theatre.js';
import { Screen } from '../models/Screen.js';
import { Show } from '../models/Show.js';
import { ShowSeat } from '../models/ShowSeat.js';
import { Booking } from '../models/Booking.js';
import { seatReservationService } from '../services/seatReservationService.js';
import { MOVIE_STATUS, SHOW_STATUS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_DIR = path.resolve(__dirname, '../../manifests');

// Indian cinema venue timezone (Asia/Kolkata is UTC+05:30)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Idempotent show schedule generator.
 * Schedules shows exclusively for active "now_showing" movies across active screens,
 * aligning with standard cinema show slots in Asia/Kolkata (IST).
 *
 * @param {Object} options
 * @param {number} [options.days=7] - Number of days ahead to ensure show coverage
 * @param {boolean} [options.dryRun=false] - When true, simulates generation without writing to database
 * @param {boolean} [options.closeConnection=true] - Close Mongoose connection after execution
 * @param {boolean} [options.verbose=true] - Log details to console/logger
 * @returns {Promise<Object>} Detailed execution summary
 */
export const generateUpcomingShows = async ({
  days = 7,
  dryRun = false,
  closeConnection = true,
  verbose = true
} = {}) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    if (verbose) {
      console.log('\n=============================================================');
      console.log(`🎬 IMOVIES UPCOMING SHOWTIME GENERATOR [${dryRun ? 'DRY-RUN MODE' : 'LIVE WRITE'}]`);
      console.log('=============================================================');
    }

    // 1. Fetch eligible movies (strictly NOW_SHOWING, never COMING_SOON or ARCHIVED)
    const eligibleMovies = await Movie.find({ status: MOVIE_STATUS.NOW_SHOWING }).sort({ releaseDate: -1 });
    if (eligibleMovies.length === 0) {
      const msg = 'No "now_showing" movies found in catalog. Cannot schedule shows without active movies.';
      if (verbose) console.warn(`⚠️ ${msg}`);
      if (closeConnection) await disconnectDB();
      return { success: false, reason: msg, created: 0, skipped: 0, proposed: 0 };
    }

    // 2. Fetch active theatres & their active screens
    const activeTheatres = await Theatre.find({ isActive: true });
    if (activeTheatres.length === 0) {
      const msg = 'No active theatres found. Cannot schedule shows without theatres.';
      if (verbose) console.warn(`⚠️ ${msg}`);
      if (closeConnection) await disconnectDB();
      return { success: false, reason: msg, created: 0, skipped: 0, proposed: 0 };
    }

    const theatreIds = activeTheatres.map((t) => t._id);
    const activeScreens = await Screen.find({ theatre: { $in: theatreIds }, isActive: true });
    if (activeScreens.length === 0) {
      const msg = 'No active screens found across active theatres.';
      if (verbose) console.warn(`⚠️ ${msg}`);
      if (closeConnection) await disconnectDB();
      return { success: false, reason: msg, created: 0, skipped: 0, proposed: 0 };
    }

    // Standard daily showtime slots in Asia/Kolkata (IST)
    const standardShowTimes = [
      { hours: 10, minutes: 0 },   // Morning Matinee (10:00 AM IST) -> 04:30 UTC
      { hours: 14, minutes: 30 },  // Afternoon Feature (02:30 PM IST) -> 09:00 UTC
      { hours: 18, minutes: 45 },  // Prime Evening (06:45 PM IST) -> 13:15 UTC
      { hours: 22, minutes: 15 }   // Late Night (10:15 PM IST) -> 16:45 UTC
    ];

    // Compute current calendar date in Asia/Kolkata
    const nowUtcMs = Date.now();
    const istNow = new Date(nowUtcMs + IST_OFFSET_MS);
    const baseYear = istNow.getUTCFullYear();
    const baseMonth = istNow.getUTCMonth();
    const baseDay = istNow.getUTCDate();

    let proposedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let seatsInitializedCount = 0;
    const createdShowIds = [];
    const createdShowRecords = [];

    const windowStartUtc = new Date(Date.UTC(baseYear, baseMonth, baseDay, 0, 0, 0, 0) - IST_OFFSET_MS);
    const windowEndUtc = new Date(Date.UTC(baseYear, baseMonth, baseDay + days, 0, 0, 0, 0) - IST_OFFSET_MS);

    // Count existing shows in window
    const existingShowsInWindow = await Show.countDocuments({
      startTime: { $gte: windowStartUtc, $lt: windowEndUtc }
    });

    const startDateStr = `${baseYear}-${String(baseMonth + 1).padStart(2, '0')}-${String(baseDay).padStart(2, '0')}`;
    const endTarget = new Date(Date.UTC(baseYear, baseMonth, baseDay + (days - 1)));
    const endDateStr = `${endTarget.getUTCFullYear()}-${String(endTarget.getUTCMonth() + 1).padStart(2, '0')}-${String(endTarget.getUTCDate()).padStart(2, '0')}`;

    if (verbose) {
      console.log(`📅 Target Window (IST): ${startDateStr} to ${endDateStr} (${days} days)`);
      console.log(`🎥 Eligible Movies:     ${eligibleMovies.length} now_showing title(s)`);
      console.log(`🏛️ Active Theatres:     ${activeTheatres.length} venue(s)`);
      console.log(`🖥️ Active Screens:      ${activeScreens.length} auditorium(s)`);
      console.log(`📊 Existing Shows:      ${existingShowsInWindow} show(s) already in window\n`);
    }

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const targetDateUtc = new Date(Date.UTC(baseYear, baseMonth, baseDay + dayOffset));
      const targetYear = targetDateUtc.getUTCFullYear();
      const targetMonth = targetDateUtc.getUTCMonth();
      const targetDay = targetDateUtc.getUTCDate();

      for (let sIdx = 0; sIdx < activeScreens.length; sIdx++) {
        const screen = activeScreens[sIdx];
        // Rotate movies across screens so each title gets balanced screenings
        const movie = eligibleMovies[(sIdx + dayOffset) % eligibleMovies.length];
        const movieDuration = movie.duration || 120;

        for (const slot of standardShowTimes) {
          // Construct start time strictly in Asia/Kolkata venue timezone
          const startTime = new Date(Date.UTC(targetYear, targetMonth, targetDay, slot.hours, slot.minutes, 0, 0) - IST_OFFSET_MS);

          // Never schedule shows in the past
          if (startTime.getTime() <= nowUtcMs) {
            skippedCount++;
            continue;
          }

          const durationMs = (movieDuration + 30) * 60 * 1000;
          const endTime = new Date(startTime.getTime() + durationMs);

          // Duplicate prevention check:
          // 1. Exact match on same screen at same startTime
          const exactShow = await Show.findOne({
            screen: screen._id,
            startTime
          });

          if (exactShow) {
            skippedCount++;
            continue;
          }

          // 2. Overlap conflict check: ensure screen is not occupied during this window
          const overlappingShow = await Show.findOne({
            screen: screen._id,
            status: { $ne: SHOW_STATUS.CANCELLED },
            $or: [
              { startTime: { $lt: endTime, $gte: startTime } },
              { endTime: { $gt: startTime, $lte: endTime } },
              { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
            ]
          });

          if (overlappingShow) {
            skippedCount++;
            continue;
          }

          if (dryRun) {
            proposedCount++;
          } else {
            const basePrice = 220;
            const newShow = await Show.create({
              movie: movie._id,
              theatre: screen.theatre,
              screen: screen._id,
              startTime,
              endTime,
              basePrice,
              seatPricing: {
                silver: 200,
                gold: 260,
                platinum: 360
              },
              status: SHOW_STATUS.SCHEDULED
            });

            // Initialize authoritative seat records for the auditorium
            await seatReservationService.initializeShowSeats(newShow._id);
            createdCount++;
            createdShowIds.push(newShow._id.toString());
            createdShowRecords.push({
              showId: newShow._id.toString(),
              movieTitle: movie.title,
              theatreId: screen.theatre.toString(),
              screenId: screen._id.toString(),
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString()
            });
            seatsInitializedCount += screen.totalSeats || 60;
          }
        }
      }
    }

    let manifestPath = null;
    if (!dryRun && createdShowIds.length > 0) {
      if (!fs.existsSync(MANIFEST_DIR)) {
        fs.mkdirSync(MANIFEST_DIR, { recursive: true });
      }
      const batchTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `generation-manifest-${batchTimestamp}.json`;
      manifestPath = path.join(MANIFEST_DIR, filename);

      const manifestData = {
        batchId: `batch_${batchTimestamp}`,
        generatedAt: new Date().toISOString(),
        days,
        dateRange: `${startDateStr} to ${endDateStr}`,
        createdCount,
        seatsInitializedCount,
        showIds: createdShowIds,
        shows: createdShowRecords
      };

      fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf-8');
      if (verbose) {
        console.log(`📝 Generation Manifest Saved: ${manifestPath}`);
      }
    }

    const summary = {
      success: true,
      dryRun,
      days,
      dateRange: `${startDateStr} to ${endDateStr}`,
      eligibleMovies: eligibleMovies.length,
      screens: activeScreens.length,
      existingShowsInWindow,
      proposed: proposedCount,
      created: createdCount,
      skipped: skippedCount,
      seatsInitialized: seatsInitializedCount,
      manifestPath
    };

    if (verbose) {
      console.log('-------------------------------------------------------------');
      console.log('📋 EXECUTION SUMMARY');
      console.log('-------------------------------------------------------------');
      console.table([
        { Metric: 'Target Days', Value: days },
        { Metric: 'Mode', Value: dryRun ? 'DRY RUN (no DB writes)' : 'LIVE COMMITTED' },
        { Metric: 'Shows Existing in Window', Value: existingShowsInWindow },
        { Metric: dryRun ? 'Shows Proposed' : 'Shows Created', Value: dryRun ? proposedCount : createdCount },
        { Metric: 'Shows Skipped (Conflict/Existing/Past)', Value: skippedCount },
        { Metric: 'Seats Initialized', Value: seatsInitializedCount },
        { Metric: 'Manifest File', Value: manifestPath || 'N/A (Dry Run)' }
      ]);
      console.log('=============================================================\n');
    }

    if (closeConnection) {
      await disconnectDB();
    }

    return summary;
  } catch (error) {
    logger.error('Show generation failed:', error.stack || error.message);
    if (closeConnection) {
      await disconnectDB();
    }
    throw error;
  }
};

/**
 * Safely rolls back a previously generated show batch using its exact manifest.
 * Guarantees that no shows with active customer bookings or held seats can be deleted.
 *
 * @param {Object} options
 * @param {string} options.manifestPath - Path to the batch manifest JSON file
 * @param {boolean} [options.dryRun=true] - When true, simulates rollback without deletions
 * @param {boolean} [options.closeConnection=true] - Close Mongoose connection after execution
 * @param {boolean} [options.verbose=true] - Log details to console
 * @returns {Promise<Object>} Rollback result summary
 */
export const rollbackShowBatch = async ({
  manifestPath,
  dryRun = true,
  closeConnection = true,
  verbose = true
} = {}) => {
  try {
    if (!manifestPath || !fs.existsSync(manifestPath)) {
      throw new Error(`Invalid manifest file path: "${manifestPath}". File does not exist.`);
    }

    const rawData = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(rawData);

    if (!Array.isArray(manifest.showIds) || manifest.showIds.length === 0) {
      throw new Error(`Manifest "${manifestPath}" contains no valid show IDs.`);
    }

    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    if (verbose) {
      console.log('\n=============================================================');
      console.log(`🛡️ SAFE SHOW BATCH ROLLBACK [${dryRun ? 'DRY-RUN' : 'LIVE DELETION'}]`);
      console.log(`Manifest: ${path.basename(manifestPath)} (${manifest.showIds.length} shows)`);
      console.log('=============================================================');
    }

    // 1. Verify existence of shows
    const existingShows = await Show.find({ _id: { $in: manifest.showIds } });
    const existingShowIds = existingShows.map((s) => s._id.toString());

    // 2. CRITICAL SAFETY GUARD: Verify zero customer bookings exist
    const activeBookings = await Booking.find({
      show: { $in: existingShowIds },
      status: { $ne: 'cancelled' }
    });

    if (activeBookings.length > 0) {
      const errorMsg = `ROLLBACK ABORTED: Found ${activeBookings.length} active customer booking(s) associated with shows in this batch. To prevent data corruption, rollback is prohibited.`;
      if (verbose) console.error(`❌ ${errorMsg}`);
      if (closeConnection) await disconnectDB();
      return { success: false, reason: errorMsg, activeBookingsCount: activeBookings.length };
    }

    // 3. Verify zero seats are currently held or linked to bookings
    const bookedOrHeldSeats = await ShowSeat.find({
      show: { $in: existingShowIds },
      $or: [
        { booking: { $ne: null } },
        { heldBy: { $ne: null } }
      ]
    });

    if (bookedOrHeldSeats.length > 0) {
      const errorMsg = `ROLLBACK ABORTED: Found ${bookedOrHeldSeats.length} seat(s) currently held or booked. Cannot proceed with deletion.`;
      if (verbose) console.error(`❌ ${errorMsg}`);
      if (closeConnection) await disconnectDB();
      return { success: false, reason: errorMsg, heldSeatsCount: bookedOrHeldSeats.length };
    }

    if (dryRun) {
      const seatsCount = await ShowSeat.countDocuments({
        show: { $in: existingShowIds },
        booking: null,
        heldBy: null
      });

      if (verbose) {
        console.log(`[DRY-RUN] Verified safe: 0 bookings and 0 held seats.`);
        console.log(`[DRY-RUN] Proposed for deletion: ${existingShows.length} shows and ${seatsCount} associated seats.`);
      }

      if (closeConnection) await disconnectDB();
      return {
        success: true,
        dryRun: true,
        manifestBatchId: manifest.batchId,
        showsFound: existingShows.length,
        seatsProposedToDelete: seatsCount
      };
    }

    // Live deletion: delete seats first, then shows
    const deletedSeatsRes = await ShowSeat.deleteMany({
      show: { $in: existingShowIds },
      booking: null,
      heldBy: null
    });

    const deletedShowsRes = await Show.deleteMany({
      _id: { $in: existingShowIds }
    });

    if (verbose) {
      console.log(`✅ Rollback Successful: Deleted ${deletedShowsRes.deletedCount} shows and ${deletedSeatsRes.deletedCount} seats.`);
    }

    if (closeConnection) await disconnectDB();
    return {
      success: true,
      dryRun: false,
      manifestBatchId: manifest.batchId,
      showsDeleted: deletedShowsRes.deletedCount,
      seatsDeleted: deletedSeatsRes.deletedCount
    };
  } catch (error) {
    logger.error('Rollback failed:', error.stack || error.message);
    if (closeConnection) await disconnectDB();
    throw error;
  }
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const rollbackArg = args.find((a) => a.startsWith('--rollback='));

  if (rollbackArg) {
    const manifestPath = rollbackArg.split('=')[1];
    rollbackShowBatch({ manifestPath, dryRun: isDryRun, closeConnection: true })
      .then((res) => {
        process.exit(res.success ? 0 : 1);
      })
      .catch((err) => {
        console.error('Fatal rollback error:', err.message);
        process.exit(1);
      });
  } else {
    const daysArg = args.find((a) => a.startsWith('--days='));
    const parsedDays = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;
    const days = isNaN(parsedDays) || parsedDays <= 0 ? 7 : parsedDays;

    generateUpcomingShows({ days, dryRun: isDryRun, closeConnection: true })
      .then((result) => {
        process.exit(result.success ? 0 : 1);
      })
      .catch((err) => {
        console.error('Fatal execution error:', err.message);
        process.exit(1);
      });
  }
}
