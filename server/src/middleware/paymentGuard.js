import { env } from '../config/environment.js';
import { errorResponse } from '../utils/apiResponse.js';

/**
 * Middleware that verifies whether payment processing is currently enabled on the platform.
 * When payments are disabled (e.g. safe production mode without real credentials),
 * all payment creation, confirmation, simulation, and webhook requests are rejected with HTTP 503.
 */
export const requirePaymentsEnabled = (req, res, next) => {
  if (!env.PAYMENTS_ENABLED) {
    return errorResponse(
      res,
      'Payments are currently disabled on this platform.',
      503,
      null,
      { code: 'PAYMENTS_DISABLED' }
    );
  }
  next();
};
