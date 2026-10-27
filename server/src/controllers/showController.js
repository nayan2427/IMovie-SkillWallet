import { Show } from '../models/Show.js';
import { Screen } from '../models/Screen.js';
import { Movie } from '../models/Movie.js';
import { ShowSeat } from '../models/ShowSeat.js';
import { seatReservationService } from '../services/seatReservationService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export const getShows = async (req, res, next) => {
  try {
    const { movieId, theatreId, city, date, status = 'scheduled' } = req.query;
    const query = {};

    if (movieId) query.movie = movieId;
    if (theatreId) query.theatre = theatreId;
    if (status && status !== 'all') query.status = status;

    if (date) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (!match) {
        return errorResponse(res, 'Invalid date format. Expected YYYY-MM-DD.', 400);
      }

      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const parsedUtc = new Date(Date.UTC(year, month, day));

      if (
        parsedUtc.getUTCFullYear() !== year ||
        parsedUtc.getUTCMonth() !== month ||
        parsedUtc.getUTCDate() !== day
      ) {
        return errorResponse(res, 'Invalid calendar date.', 400);
      }

      // Indian cinema venue timezone (IST is UTC+05:30, offset = +330 minutes):
      // Start of venue day (00:00:00.000 IST) = 18:30:00.000 UTC of (day - 1)
      // End of venue day   (23:59:59.999 IST) = 18:29:59.999 UTC of current day
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - IST_OFFSET_MS);
      const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - IST_OFFSET_MS);
      query.startTime = { $gte: startOfDay, $lte: endOfDay };
    }

    let showsQuery = Show.find(query)
      .populate('movie')
      .populate('theatre')
      .populate('screen')
      .sort({ startTime: 1 });

    const shows = await showsQuery.exec();

    // Filter by theatre city if specified
    const filteredShows = city && city !== 'all'
      ? shows.filter((s) => s.theatre?.city?.toLowerCase() === city.toLowerCase())
      : shows;

    return successResponse(res, filteredShows);
  } catch (error) {
    next(error);
  }
};

export const getShowById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const show = await Show.findById(id)
      .populate('movie')
      .populate('theatre')
      .populate('screen');

    if (!show) {
      return errorResponse(res, 'Show not found.', 404);
    }

    return successResponse(res, show);
  } catch (error) {
    next(error);
  }
};

export const createShow = async (req, res, next) => {
  try {
    const { movie: movieId, theatre: theatreId, screen: screenId, startTime, endTime, basePrice, seatPricing, status } = req.body;

    if (!movieId || !theatreId || !screenId || !startTime) {
      return errorResponse(res, 'Movie, theatre, screen, and startTime are required.', 400);
    }

    const movie = await Movie.findById(movieId);
    if (!movie) {
      return errorResponse(res, 'Movie not found.', 404);
    }
    if (movie.status !== 'now_showing') {
      return errorResponse(
        res,
        `Cannot schedule shows for movie "${movie.title}" with status "${movie.status}". Only "now_showing" movies are eligible for scheduling.`,
        400
      );
    }

    const screen = await Screen.findById(screenId);
    if (!screen) {
      return errorResponse(res, 'Screen not found.', 404);
    }
    if (screen.theatre.toString() !== theatreId.toString()) {
      return errorResponse(res, 'Screen does not belong to the specified theatre.', 400);
    }

    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return errorResponse(res, 'Invalid show start time.', 400);
    }

    let end = endTime ? new Date(endTime) : null;
    if (!end || isNaN(end.getTime())) {
      // Calculate end time based on movie duration + 30 mins intermission & cleaning
      const durationMs = (movie.duration + 30) * 60 * 1000;
      end = new Date(start.getTime() + durationMs);
    }

    if (start >= end) {
      return errorResponse(res, 'Show start time must be before end time.', 400);
    }

    // Overlap validation: check if another show is scheduled on this screen during this time window
    const overlappingShow = await Show.findOne({
      screen: screenId,
      status: { $ne: 'cancelled' },
      $or: [
        { startTime: { $lt: end, $gte: start } },
        { endTime: { $gt: start, $lte: end } },
        { startTime: { $lte: start }, endTime: { $gte: end } }
      ]
    });

    if (overlappingShow) {
      return errorResponse(
        res,
        `Scheduling conflict: An overlapping show is already scheduled on this screen from ${overlappingShow.startTime.toLocaleTimeString()} to ${overlappingShow.endTime.toLocaleTimeString()}.`,
        409
      );
    }

    const calculatedBasePrice = Number(basePrice) || 200;
    const pricing = seatPricing || {
      silver: calculatedBasePrice,
      gold: Math.round(calculatedBasePrice * 1.3),
      platinum: Math.round(calculatedBasePrice * 1.8)
    };

    const show = await Show.create({
      movie: movieId,
      theatre: theatreId,
      screen: screenId,
      startTime: start,
      endTime: end,
      basePrice: calculatedBasePrice,
      seatPricing: pricing,
      status: status || 'scheduled'
    });

    // Populate show seats inventory for this show immediately
    await seatReservationService.initializeShowSeats(show._id);

    const populatedShow = await Show.findById(show._id)
      .populate('movie')
      .populate('theatre')
      .populate('screen');

    return successResponse(res, populatedShow, 'Show scheduled successfully and seat inventory generated.', 201);
  } catch (error) {
    next(error);
  }
};

export const updateShow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, basePrice, seatPricing, status } = req.body;

    const show = await Show.findById(id);
    if (!show) {
      return errorResponse(res, 'Show not found.', 404);
    }

    const start = startTime ? new Date(startTime) : show.startTime;
    const end = endTime ? new Date(endTime) : show.endTime;

    if (startTime || endTime) {
      const overlapping = await Show.findOne({
        _id: { $ne: id },
        screen: show.screen,
        status: { $ne: 'cancelled' },
        $or: [
          { startTime: { $lt: end, $gte: start } },
          { endTime: { $gt: start, $lte: end } },
          { startTime: { $lte: start }, endTime: { $gte: end } }
        ]
      });

      if (overlapping) {
        return errorResponse(res, 'Scheduling conflict: Screen is already in use by another show during this time.', 409);
      }
      show.startTime = start;
      show.endTime = end;
    }

    if (basePrice) show.basePrice = Number(basePrice);
    if (seatPricing) show.seatPricing = seatPricing;
    if (status) show.status = status;

    await show.save();
    return successResponse(res, show, 'Show updated successfully.');
  } catch (error) {
    next(error);
  }
};

export const deleteShow = async (req, res, next) => {
  try {
    const { id } = req.params;
    const show = await Show.findByIdAndDelete(id);
    if (!show) {
      return errorResponse(res, 'Show not found.', 404);
    }
    await ShowSeat.deleteMany({ show: id });
    return successResponse(res, null, 'Show and seat inventory deleted successfully.');
  } catch (error) {
    next(error);
  }
};
