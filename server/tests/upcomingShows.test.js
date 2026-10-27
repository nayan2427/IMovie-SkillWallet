import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Movie } from '../src/models/Movie.js';
import { Theatre } from '../src/models/Theatre.js';
import { Screen } from '../src/models/Screen.js';
import { Show } from '../src/models/Show.js';
import { ShowSeat } from '../src/models/ShowSeat.js';
import { Booking } from '../src/models/Booking.js';
import { User } from '../src/models/User.js';
import { seatReservationService } from '../src/services/seatReservationService.js';
import { generateUpcomingShows, rollbackShowBatch } from '../src/scripts/generateShows.js';
import { MOVIE_STATUS, SHOW_STATUS, BOOKING_STATUS, PAYMENT_STATUS, ROLES } from '../src/utils/constants.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/environment.js';
import fs from 'fs';

describe('Upcoming Shows & Calendar Boundary In-Depth Test Suite', () => {
  let admin;
  let adminToken;
  let testUser;
  let userToken;
  let testTheatre;
  let testScreen;
  let nowShowingMovie;
  let comingSoonMovie;

  beforeAll(async () => {
    await connectDB();

    const timestamp = Date.now();

    // Setup Test Admin
    admin = await User.create({
      name: 'Upcoming Shows Admin',
      email: `admin_upcoming_${timestamp}@cinema.test`,
      passwordHash: 'hashed_password_123',
      phone: `+91987${String(timestamp).slice(-7)}`,
      role: ROLES.ADMIN,
      isEmailVerified: true,
      accountStatus: 'active'
    });
    adminToken = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role, tokenVersion: 0 },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // Setup Test User
    testUser = await User.create({
      name: 'Upcoming Shows User',
      email: `user_upcoming_${timestamp}@cinema.test`,
      passwordHash: 'hashed_password_123',
      phone: `+91986${String(timestamp).slice(-7)}`,
      role: ROLES.USER,
      isEmailVerified: true,
      accountStatus: 'active'
    });
    userToken = jwt.sign(
      { id: testUser._id, email: testUser.email, role: testUser.role, tokenVersion: 0 },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    // Setup Movies
    nowShowingMovie = await Movie.create({
      title: `Dune: Part Two ${timestamp}`,
      slug: `dune-part-two-${timestamp}`,
      synopsis: 'Paul Atreides unites with the Fremen while seeking revenge.',
      posterUrl: 'https://example.com/poster.jpg',
      genres: ['Sci-Fi', 'Adventure'],
      languages: ['English', 'Hindi'],
      duration: 166,
      releaseDate: new Date('2024-03-01'),
      certification: 'UA',
      director: 'Denis Villeneuve',
      rating: 9.0,
      status: MOVIE_STATUS.NOW_SHOWING
    });

    comingSoonMovie = await Movie.create({
      title: `Avatar 3: Fire and Ash ${timestamp}`,
      slug: `avatar-3-fire-and-ash-${timestamp}`,
      synopsis: 'Exploration of the hostile Ash People tribe of Na\'vi on Pandora.',
      posterUrl: 'https://example.com/avatar3.jpg',
      genres: ['Sci-Fi', 'Action'],
      languages: ['English'],
      duration: 180,
      releaseDate: new Date('2025-12-19'),
      certification: 'UA',
      director: 'James Cameron',
      rating: 8.5,
      status: MOVIE_STATUS.COMING_SOON
    });

    // Setup Theatre & Screen
    testTheatre = await Theatre.create({
      name: `IMovies Flagship Phoenix ${timestamp}`,
      slug: `imovies-flagship-phoenix-${timestamp}`,
      address: 'Lower Parel',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400013',
      isActive: true
    });

    testScreen = await Screen.create({
      theatre: testTheatre._id,
      name: 'Audi 1 - IMAX Laser',
      screenType: 'IMAX',
      totalSeats: 6,
      seatingLayout: {
        rows: [
          {
            rowLetter: 'A',
            category: 'SILVER',
            priceMultiplier: 1.0,
            seats: [
              { seatNumber: 'A1', number: 1, isAisle: false },
              { seatNumber: 'A2', number: 2, isAisle: false },
              { seatNumber: 'A3', number: 3, isAisle: false }
            ]
          },
          {
            rowLetter: 'B',
            category: 'GOLD',
            priceMultiplier: 1.3,
            seats: [
              { seatNumber: 'B1', number: 1, isAisle: false },
              { seatNumber: 'B2', number: 2, isAisle: false },
              { seatNumber: 'B3', number: 3, isAisle: false }
            ]
          }
        ]
      },
      isActive: true
    });
  });

  afterAll(async () => {
    // Clean up only our created records
    if (testScreen) {
      const shows = await Show.find({ screen: testScreen._id });
      const showIds = shows.map((s) => s._id);
      await Booking.deleteMany({ show: { $in: showIds } });
      await ShowSeat.deleteMany({ show: { $in: showIds } });
      await Show.deleteMany({ screen: testScreen._id });
      await Screen.deleteOne({ _id: testScreen._id });
    }
    if (testTheatre) await Theatre.deleteOne({ _id: testTheatre._id });
    if (nowShowingMovie) await Movie.deleteOne({ _id: nowShowingMovie._id });
    if (comingSoonMovie) await Movie.deleteOne({ _id: comingSoonMovie._id });
    if (admin) await User.deleteOne({ _id: admin._id });
    if (testUser) await User.deleteOne({ _id: testUser._id });
    await disconnectDB();
  });

  beforeEach(async () => {
    // Only clean shows and seats attached to testScreen to maintain concurrency safety
    if (testScreen) {
      const shows = await Show.find({ screen: testScreen._id });
      const showIds = shows.map((s) => s._id);
      await Booking.deleteMany({ show: { $in: showIds } });
      await ShowSeat.deleteMany({ show: { $in: showIds } });
      await Show.deleteMany({ screen: testScreen._id });
    }
  });

  describe('1. Date-Filtered Show Discovery (`GET /api/v1/shows?date=YYYY-MM-DD`)', () => {
    it('accurately queries boundary instants of the venue calendar day in Asia/Kolkata', async () => {
      // Test Date: 2026-10-27
      // 00:00:00.000 IST = 2026-10-26T18:30:00.000Z
      // 05:29:59.000 IST = 2026-10-26T23:59:59.000Z
      // 05:30:00.000 IST = 2026-10-27T00:00:00.000Z
      // 23:59:59.000 IST = 2026-10-27T18:29:59.000Z
      // Next day first instant (2026-10-28 00:00:00 IST) = 2026-10-27T18:30:00.000Z

      const midnightIst = await Show.create({
        movie: nowShowingMovie._id,
        theatre: testTheatre._id,
        screen: testScreen._id,
        startTime: new Date('2026-10-26T18:30:00.000Z'),
        endTime: new Date('2026-10-26T21:00:00.000Z'),
        basePrice: 200,
        seatPricing: { silver: 200, gold: 260, platinum: 360 },
        status: SHOW_STATUS.SCHEDULED
      });

      const earlyMorningIst = await Show.create({
        movie: nowShowingMovie._id,
        theatre: testTheatre._id,
        screen: testScreen._id,
        startTime: new Date('2026-10-26T23:59:59.000Z'),
        endTime: new Date('2026-10-27T02:00:00.000Z'),
        basePrice: 200,
        seatPricing: { silver: 200, gold: 260, platinum: 360 },
        status: SHOW_STATUS.SCHEDULED
      });

      const dayBoundaryIst = await Show.create({
        movie: nowShowingMovie._id,
        theatre: testTheatre._id,
        screen: testScreen._id,
        startTime: new Date('2026-10-27T00:00:00.000Z'),
        endTime: new Date('2026-10-27T02:30:00.000Z'),
        basePrice: 200,
        seatPricing: { silver: 200, gold: 260, platinum: 360 },
        status: SHOW_STATUS.SCHEDULED
      });

      const endOfDayIst = await Show.create({
        movie: nowShowingMovie._id,
        theatre: testTheatre._id,
        screen: testScreen._id,
        startTime: new Date('2026-10-27T18:29:59.000Z'),
        endTime: new Date('2026-10-27T21:00:00.000Z'),
        basePrice: 200,
        seatPricing: { silver: 200, gold: 260, platinum: 360 },
        status: SHOW_STATUS.SCHEDULED
      });

      const nextDayMidnightIst = await Show.create({
        movie: nowShowingMovie._id,
        theatre: testTheatre._id,
        screen: testScreen._id,
        startTime: new Date('2026-10-27T18:30:00.000Z'),
        endTime: new Date('2026-10-27T21:00:00.000Z'),
        basePrice: 200,
        seatPricing: { silver: 200, gold: 260, platinum: 360 },
        status: SHOW_STATUS.SCHEDULED
      });

      // 1. Query for 2026-10-27
      const res = await request(app)
        .get('/api/v1/shows')
        .query({ movieId: nowShowingMovie._id.toString(), date: '2026-10-27' });

      expect(res.status).toBe(200);
      const returnedIds = res.body.data.map((s) => s._id.toString());

      // All 4 shows belonging to Oct 27 IST must match
      expect(returnedIds).toContain(midnightIst._id.toString());
      expect(returnedIds).toContain(earlyMorningIst._id.toString());
      expect(returnedIds).toContain(dayBoundaryIst._id.toString());
      expect(returnedIds).toContain(endOfDayIst._id.toString());

      // Next day midnight show (Oct 28 00:00 IST) MUST NOT LEAK into Oct 27
      expect(returnedIds).not.toContain(nextDayMidnightIst._id.toString());

      // 2. Query for 2026-10-28
      const resNextDay = await request(app)
        .get('/api/v1/shows')
        .query({ movieId: nowShowingMovie._id.toString(), date: '2026-10-28' });

      expect(resNextDay.status).toBe(200);
      const nextDayIds = resNextDay.body.data.map((s) => s._id.toString());

      // Next day show MUST match on Oct 28
      expect(nextDayIds).toContain(nextDayMidnightIst._id.toString());
      // Shows from Oct 27 must not appear on Oct 28
      expect(nextDayIds).not.toContain(endOfDayIst._id.toString());
    });

    it('returns empty array when no shows are scheduled for the requested date', async () => {
      const res = await request(app)
        .get('/api/v1/shows')
        .query({ movieId: nowShowingMovie._id.toString(), date: '2026-10-30' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('rejects malformed date parameter with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/shows')
        .query({ date: 'invalid-date' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid date format. Expected YYYY-MM-DD.');
    });

    it('rejects non-existent calendar date with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/v1/shows')
        .query({ date: '2026-02-31' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid calendar date.');
    });
  });

  describe('2. Show Scheduling Eligibility & Overlap Protection (`POST /api/v1/shows`)', () => {
    it('rejects scheduling shows for coming_soon movies', async () => {
      const startTime = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/shows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          movie: comingSoonMovie._id.toString(),
          theatre: testTheatre._id.toString(),
          screen: testScreen._id.toString(),
          startTime,
          basePrice: 250
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Only "now_showing" movies are eligible');
    });

    it('rejects scheduling a show on a screen belonging to a different theatre', async () => {
      const otherTheatre = await Theatre.create({
        name: `IMovies South Mumbai ${Date.now()}`,
        slug: `imovies-south-mumbai-${Date.now()}`,
        address: 'Colaba',
        city: 'Mumbai',
        isActive: true
      });

      const startTime = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/shows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          movie: nowShowingMovie._id.toString(),
          theatre: otherTheatre._id.toString(),
          screen: testScreen._id.toString(),
          startTime,
          basePrice: 250
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Screen does not belong to the specified theatre');

      await Theatre.deleteOne({ _id: otherTheatre._id });
    });

    it('successfully creates show and initializes seats for now_showing movie', async () => {
      const startTime = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/shows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          movie: nowShowingMovie._id.toString(),
          theatre: testTheatre._id.toString(),
          screen: testScreen._id.toString(),
          startTime,
          basePrice: 220
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const createdShowId = res.body.data._id;

      // Verify authoritative show seats were generated
      const seatsCount = await ShowSeat.countDocuments({ show: createdShowId });
      expect(seatsCount).toBe(6);
    });

    it('rejects overlapping shows on the same screen', async () => {
      const baseTime = Date.now() + 72 * 3600 * 1000;
      const start1 = new Date(baseTime);
      const end1 = new Date(baseTime + 3 * 3600 * 1000);

      // Create first show
      await Show.create({
        movie: nowShowingMovie._id,
        theatre: testTheatre._id,
        screen: testScreen._id,
        startTime: start1,
        endTime: end1,
        basePrice: 200,
        seatPricing: { silver: 200, gold: 260, platinum: 360 },
        status: SHOW_STATUS.SCHEDULED
      });

      // Try creating overlapping show 1 hour later
      const start2 = new Date(baseTime + 1 * 3600 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/shows')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          movie: nowShowingMovie._id.toString(),
          theatre: testTheatre._id.toString(),
          screen: testScreen._id.toString(),
          startTime: start2,
          basePrice: 200
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('conflict');
    });
  });

  describe('3. Booking Protection for Unreleased Movies (`POST /api/v1/bookings/hold`)', () => {
    it('blocks seat holds for a show whose movie is coming_soon', async () => {
      const futureTime = new Date(Date.now() + 24 * 3600 * 1000);
      const unreleasedShow = await Show.create({
        movie: comingSoonMovie._id,
        theatre: testTheatre._id,
        screen: testScreen._id,
        startTime: futureTime,
        endTime: new Date(futureTime.getTime() + 180 * 60 * 1000),
        basePrice: 200,
        seatPricing: { silver: 200, gold: 260, platinum: 360 },
        status: SHOW_STATUS.SCHEDULED
      });
      await seatReservationService.initializeShowSeats(unreleasedShow._id);

      const res = await request(app)
        .post('/api/v1/bookings/hold')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          showId: unreleasedShow._id.toString(),
          seats: ['A1']
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Bookings are not yet open');
    });
  });

  describe('4. Idempotent Upcoming Show Generator (`generateUpcomingShows`)', () => {
    it('dry run mode proposes shows without creating database records', async () => {
      const initialCount = await Show.countDocuments({ screen: testScreen._id });

      const summary = await generateUpcomingShows({
        days: 3,
        dryRun: true,
        closeConnection: false,
        verbose: false
      });

      expect(summary.success).toBe(true);
      expect(summary.dryRun).toBe(true);
      expect(summary.proposed).toBeGreaterThan(0);
      expect(summary.created).toBe(0);

      // Verify zero shows were written to MongoDB for testScreen
      const count = await Show.countDocuments({ screen: testScreen._id });
      expect(count).toBe(initialCount);
    });

    it('live run creates shows, seat inventories, and records a batch manifest', async () => {
      const summary = await generateUpcomingShows({
        days: 2,
        dryRun: false,
        closeConnection: false,
        verbose: false
      });

      expect(summary.success).toBe(true);
      expect(summary.created).toBeGreaterThan(0);
      expect(summary.seatsInitialized).toBeGreaterThan(0);
      expect(summary.manifestPath).toBeTruthy();
      expect(fs.existsSync(summary.manifestPath)).toBe(true);

      // Clean up manifest file after check
      if (fs.existsSync(summary.manifestPath)) {
        fs.unlinkSync(summary.manifestPath);
      }
    });

    it('subsequent execution is 100% idempotent and creates zero duplicates', async () => {
      // First run: populate shows
      const firstRun = await generateUpcomingShows({
        days: 2,
        dryRun: false,
        closeConnection: false,
        verbose: false
      });
      expect(firstRun.created).toBeGreaterThan(0);

      const countAfterFirst = await Show.countDocuments();

      // Second run: should detect existing shows and create 0 new shows
      const secondRun = await generateUpcomingShows({
        days: 2,
        dryRun: false,
        closeConnection: false,
        verbose: false
      });

      expect(secondRun.created).toBe(0);
      expect(secondRun.skipped).toBeGreaterThanOrEqual(firstRun.created);

      // Total show count in DB must remain identical
      const countAfterSecond = await Show.countDocuments();
      expect(countAfterSecond).toBe(countAfterFirst);

      if (firstRun.manifestPath && fs.existsSync(firstRun.manifestPath)) {
        fs.unlinkSync(firstRun.manifestPath);
      }
    });

    it('preserves existing shows and customer booking relationships completely', async () => {
      // 1. Create a pre-existing show on testScreen
      const preStartTime = new Date(Date.now() + 30 * 3600 * 1000);
      const preEndTime = new Date(preStartTime.getTime() + 180 * 60 * 1000);
      const preShow = await Show.create({
        movie: nowShowingMovie._id,
        theatre: testTheatre._id,
        screen: testScreen._id,
        startTime: preStartTime,
        endTime: preEndTime,
        basePrice: 220,
        seatPricing: { silver: 200, gold: 260, platinum: 360 },
        status: SHOW_STATUS.SCHEDULED
      });
      await seatReservationService.initializeShowSeats(preShow._id);

      // 2. Attach a customer booking
      const existingBooking = await Booking.create({
        bookingReference: `TEST-BK-${Date.now()}`,
        user: testUser._id,
        show: preShow._id,
        seats: [
          {
            seatNumber: 'A1',
            category: 'SILVER',
            price: 200
          }
        ],
        totalAmount: 200,
        convenienceFee: 36,
        grandTotal: 236,
        status: BOOKING_STATUS.CONFIRMED,
        paymentStatus: PAYMENT_STATUS.COMPLETED
      });

      // Mark seat as booked
      await ShowSeat.updateOne(
        { show: preShow._id, seatNumber: 'A1' },
        { status: 'booked', booking: existingBooking._id }
      );

      // 3. Run upcoming show generator
      const genResult = await generateUpcomingShows({
        days: 2,
        dryRun: false,
        closeConnection: false,
        verbose: false
      });
      expect(genResult.success).toBe(true);

      // 4. Verify existing show, booking, and booked seat remain untouched
      const verifyShow = await Show.findById(preShow._id);
      expect(verifyShow).not.toBeNull();
      expect(verifyShow.status).toBe(SHOW_STATUS.SCHEDULED);

      const verifySeat = await ShowSeat.findOne({ show: preShow._id, seatNumber: 'A1' });
      expect(verifySeat.status).toBe('booked');
      expect(verifySeat.booking.toString()).toBe(existingBooking._id.toString());

      const verifyBooking = await Booking.findById(existingBooking._id);
      expect(verifyBooking.status).toBe(BOOKING_STATUS.CONFIRMED);

      if (genResult.manifestPath && fs.existsSync(genResult.manifestPath)) {
        fs.unlinkSync(genResult.manifestPath);
      }
    });
  });

  describe('5. Safe Manifest-Based Rollback (`rollbackShowBatch`)', () => {
    it('aborts rollback if customer bookings exist for any show in the batch', async () => {
      // 1. Generate a small batch
      const genSummary = await generateUpcomingShows({
        days: 1,
        dryRun: false,
        closeConnection: false,
        verbose: false
      });
      expect(genSummary.manifestPath).toBeTruthy();

      const manifest = JSON.parse(fs.readFileSync(genSummary.manifestPath, 'utf-8'));
      const targetShowId = manifest.showIds[0];

      // 2. Add a customer booking to the first show in the batch
      const booking = await Booking.create({
        bookingReference: `TEST-RB-${Date.now()}`,
        user: testUser._id,
        show: targetShowId,
        seats: [{ seatNumber: 'A1', category: 'SILVER', price: 200 }],
        totalAmount: 200,
        convenienceFee: 36,
        grandTotal: 236,
        status: BOOKING_STATUS.CONFIRMED,
        paymentStatus: PAYMENT_STATUS.COMPLETED
      });

      // 3. Attempt rollback -> MUST ABORT
      const rollbackResult = await rollbackShowBatch({
        manifestPath: genSummary.manifestPath,
        dryRun: false,
        closeConnection: false,
        verbose: false
      });

      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.reason).toContain('ROLLBACK ABORTED');
      expect(rollbackResult.activeBookingsCount).toBe(1);

      // 4. Shows must still exist in DB
      const showStillExists = await Show.findById(targetShowId);
      expect(showStillExists).not.toBeNull();

      // Clean up booking
      await Booking.deleteOne({ _id: booking._id });

      // Clean up manifest file
      if (fs.existsSync(genSummary.manifestPath)) {
        fs.unlinkSync(genSummary.manifestPath);
      }
    });

    it('performs clean dry-run and live rollback when zero customer bookings exist', async () => {
      // 1. Generate batch
      const genSummary = await generateUpcomingShows({
        days: 1,
        dryRun: false,
        closeConnection: false,
        verbose: false
      });

      // 2. Dry-run rollback
      const dryRunRes = await rollbackShowBatch({
        manifestPath: genSummary.manifestPath,
        dryRun: true,
        closeConnection: false,
        verbose: false
      });
      expect(dryRunRes.success).toBe(true);
      expect(dryRunRes.dryRun).toBe(true);
      expect(dryRunRes.showsFound).toBe(genSummary.created);

      // Verify zero shows were deleted during dry-run
      const manifest = JSON.parse(fs.readFileSync(genSummary.manifestPath, 'utf-8'));
      const showCountDry = await Show.countDocuments({ _id: { $in: manifest.showIds } });
      expect(showCountDry).toBe(manifest.showIds.length);

      // 3. Live rollback
      const liveRes = await rollbackShowBatch({
        manifestPath: genSummary.manifestPath,
        dryRun: false,
        closeConnection: false,
        verbose: false
      });
      expect(liveRes.success).toBe(true);
      expect(liveRes.dryRun).toBe(false);
      expect(liveRes.showsDeleted).toBe(manifest.showIds.length);

      // 4. Verify shows and seats are gone
      const remainingShows = await Show.countDocuments({ _id: { $in: manifest.showIds } });
      expect(remainingShows).toBe(0);
      const remainingSeats = await ShowSeat.countDocuments({ show: { $in: manifest.showIds } });
      expect(remainingSeats).toBe(0);

      // Clean up manifest file
      if (fs.existsSync(genSummary.manifestPath)) {
        fs.unlinkSync(genSummary.manifestPath);
      }
    });
  });
});
