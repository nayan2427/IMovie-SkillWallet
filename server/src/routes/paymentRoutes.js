import { Router } from 'express';
import { getPaymentStatus, simulatePayment, handlePaymentWebhook } from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePaymentsEnabled } from '../middleware/paymentGuard.js';
import { isProduction, env } from '../config/environment.js';
import { errorResponse } from '../utils/apiResponse.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import { getPaymentStatusValidator, simulatePaymentValidator } from '../validators/paymentValidator.js';

const router = Router();

// Webhook endpoint with raw-body signature verification and replay protection (unauthenticated)
router.post('/webhook', requirePaymentsEnabled, handlePaymentWebhook);

// Payment simulation route guards:
// 1. If payments are disabled, return 503
// 2. In production, unconditionally disable simulated payments with 403
router.use('/simulate', requirePaymentsEnabled, (req, res, next) => {
  if (isProduction()) {
    return errorResponse(res, 'Payment simulation is disabled in production.', 403);
  }
  next();
});

router.use(authenticate);

router.get('/:id/status', getPaymentStatusValidator, getPaymentStatus);
router.post('/simulate', paymentLimiter, simulatePaymentValidator, simulatePayment);

export default router;
