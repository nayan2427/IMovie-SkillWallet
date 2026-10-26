import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emailService } from '../src/services/emailService.js';
import { env } from '../src/config/environment.js';

describe('Brevo HTTPS API & Email Provider Switch Suite', () => {
  const originalEnv = { ...process.env };
  let originalFetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalFetch = global.fetch;
    process.env = { ...originalEnv };
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_PROVIDER;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Provider Resolution & Switch', () => {
    it('defaults to "brevo" when BREVO_API_KEY is present', () => {
      process.env.BREVO_API_KEY = 'xkeysib-mock-api-key-12345';
      delete process.env.EMAIL_PROVIDER;

      expect(emailService.getProvider()).toBe('brevo');
    });

    it('falls back to "smtp" when BREVO_API_KEY is absent and EMAIL_PROVIDER is unset', () => {
      delete process.env.BREVO_API_KEY;
      delete process.env.EMAIL_PROVIDER;

      expect(emailService.getProvider()).toBe('smtp');
    });

    it('honors explicit EMAIL_PROVIDER=brevo even without apiKey configured yet', () => {
      process.env.EMAIL_PROVIDER = 'brevo';
      delete process.env.BREVO_API_KEY;

      expect(emailService.getProvider()).toBe('brevo');
    });

    it('honors explicit EMAIL_PROVIDER=smtp even if BREVO_API_KEY is set', () => {
      process.env.EMAIL_PROVIDER = 'smtp';
      process.env.BREVO_API_KEY = 'xkeysib-mock-key';

      expect(emailService.getProvider()).toBe('smtp');
    });
  });

  describe('2. Sender Parsing from EMAIL_FROM', () => {
    it('correctly parses "Name" <email> format', () => {
      const sender = emailService.parseSender('"IMovies Cinema" <noreply@imovies.com>');
      expect(sender).toEqual({ name: 'IMovies Cinema', email: 'noreply@imovies.com' });
    });

    it('correctly parses unquoted Name <email> format', () => {
      const sender = emailService.parseSender('IMovies BoxOffice <tickets@imovies.com>');
      expect(sender).toEqual({ name: 'IMovies BoxOffice', email: 'tickets@imovies.com' });
    });

    it('correctly handles raw email address without name brackets', () => {
      const sender = emailService.parseSender('custom_cinema@gmail.com');
      expect(sender.name).toBe('IMovies Cinema');
      expect(sender.email).toBe('custom_cinema@gmail.com');
    });
  });

  describe('3. Successful Send via Brevo HTTPS API', () => {
    it('sends email to Brevo API with correct headers and JSON body', async () => {
      const testApiKey = 'xkeysib-test-secret-key-99999';
      process.env.BREVO_API_KEY = testApiKey;
      process.env.EMAIL_FROM = 'IMovies Official <cinema@imovies.com>';

      let capturedUrl = '';
      let capturedOptions = {};

      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<brevo-success-message-id-12345@smtp-relay.mailin.fr>' })
        };
      });

      const result = await emailService.sendMail({
        to: 'customer@example.com',
        name: 'Jane Doe',
        subject: 'Welcome to IMovies',
        html: '<p>Hello World</p>',
        text: 'Hello World'
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('brevo');
      expect(result.messageId).toBe('<brevo-success-message-id-12345@smtp-relay.mailin.fr>');

      // Verify URL and Headers
      expect(capturedUrl).toBe('https://api.brevo.com/v3/smtp/email');
      expect(capturedOptions.method).toBe('POST');
      expect(capturedOptions.headers['api-key']).toBe(testApiKey);
      expect(capturedOptions.headers['content-type']).toBe('application/json');
      expect(capturedOptions.headers.accept).toBe('application/json');

      // Verify Body format
      const body = JSON.parse(capturedOptions.body);
      expect(body.sender).toEqual({ name: 'IMovies Official', email: 'cinema@imovies.com' });
      expect(body.to).toEqual([{ email: 'customer@example.com', name: 'Jane Doe' }]);
      expect(body.subject).toBe('Welcome to IMovies');
      expect(body.htmlContent).toBe('<p>Hello World</p>');
      expect(body.textContent).toBe('Hello World');
    });

    it('supports attachments formatted as base64 for Brevo payload', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-attachment-test-key';

      let capturedBody = null;
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<msg-with-attachment@brevo>' })
        };
      });

      const bufferContent = Buffer.from('fake-qr-code-png-data');
      await emailService.sendMail({
        to: 'tickets@example.com',
        name: 'Ticket Holder',
        subject: 'Your QR Ticket',
        html: '<p>Ticket</p>',
        text: 'Ticket',
        attachments: [
          {
            filename: 'ticket-qr.png',
            content: bufferContent
          }
        ]
      });

      expect(capturedBody.attachment).toBeDefined();
      expect(capturedBody.attachment.length).toBe(1);
      expect(capturedBody.attachment[0].name).toBe('ticket-qr.png');
      expect(capturedBody.attachment[0].content).toBe(bufferContent.toString('base64'));
    });
  });

  describe('4. Brevo 4xx and 5xx Failure Handling', () => {
    it('throws error with status 400 and Brevo error message without exposing API key', async () => {
      const secretKey = 'xkeysib-sensitive-token-to-hide';
      process.env.BREVO_API_KEY = secretKey;

      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({
            code: 'invalid_parameter',
            message: `Key ${secretKey} sender domain is not validated`
          })
        };
      });

      let caughtError = null;
      try {
        await emailService.sendMail({
          to: 'invalid@example.com',
          name: 'Invalid User',
          subject: 'Test Subject',
          html: '<p>Test</p>',
          text: 'Test'
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.message).toContain('Brevo API Error (400)');
      expect(caughtError.message).toContain('sender domain is not validated');
      // Secret key must NEVER be leaked in the error message
      expect(caughtError.message).not.toContain(secretKey);
      expect(caughtError.message).toContain('[REDACTED]');
    });

    it('throws error with status 500 when Brevo responds with internal server error', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-key-server-err';

      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Brevo transactional engine temporarily unavailable' })
        };
      });

      await expect(
        emailService.sendMail({
          to: 'test@example.com',
          name: 'Test',
          subject: 'Subject',
          html: '<p>Hi</p>',
          text: 'Hi'
        })
      ).rejects.toThrow(/Brevo API Error \(500\).*temporarily unavailable/);
    });
  });

  describe('5. Fallback to SMTP Path When BREVO_API_KEY Is Absent', () => {
    it('routes through SMTP/mock transporter and does NOT call fetch when BREVO_API_KEY is absent', async () => {
      delete process.env.BREVO_API_KEY;
      delete process.env.EMAIL_PROVIDER;

      global.fetch = vi.fn();

      const result = await emailService.sendMail({
        to: 'fallback_recipient@example.com',
        name: 'Local Dev',
        subject: 'Local SMTP Test',
        html: '<p>Local</p>',
        text: 'Local'
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.provider).toBe('smtp');
    });
  });

  describe('6. Shared Routing Across All Application Email Types', () => {
    it('sendVerificationEmail routes through Brevo when BREVO_API_KEY is configured', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-verify-key';

      let calledUrl = '';
      let calledPayload = null;

      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        calledUrl = url;
        calledPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<verify-otp-brevo-id>' })
        };
      });

      const res = await emailService.sendVerificationEmail({
        to: 'newuser@example.com',
        name: 'New Candidate',
        token: 'token12345',
        otp: '849201'
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(calledUrl).toBe('https://api.brevo.com/v3/smtp/email');
      expect(calledPayload.subject).toBe('Verify Your IMovies Account');
      expect(calledPayload.htmlContent).toContain('849201');
      expect(calledPayload.textContent).toContain('849201');
      expect(res.provider).toBe('brevo');
    });

    it('sendPasswordResetEmail routes through Brevo when BREVO_API_KEY is configured', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-reset-key';

      let calledPayload = null;
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        calledPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<pwd-reset-brevo-id>' })
        };
      });

      const res = await emailService.sendPasswordResetEmail({
        to: 'user_reset@example.com',
        name: 'Reset Candidate',
        resetToken: 'secure_reset_token_xyz'
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(calledPayload.subject).toBe('Reset Your IMovies Password');
      expect(calledPayload.htmlContent).toContain('secure_reset_token_xyz');
      expect(res.provider).toBe('brevo');
    });

    it('sendBookingConfirmationEmail routes through Brevo when BREVO_API_KEY is configured', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-booking-key';

      let calledPayload = null;
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        calledPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({ messageId: '<booking-confirm-brevo-id>' })
        };
      });

      const mockBooking = {
        bookingReference: 'IMV-987654',
        grandTotal: 500,
        show: {
          movie: { title: 'Dune: Part Two' },
          theatre: { name: 'PVR IMAX', city: 'Mumbai' },
          screen: { name: 'Screen 1', screenType: 'IMAX 3D' },
          startTime: new Date()
        },
        seats: [{ seatNumber: 'E10', category: 'Premium' }]
      };

      const res = await emailService.sendBookingConfirmationEmail({
        to: 'cinema_fan@example.com',
        name: 'Cinema Fan',
        booking: mockBooking
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(calledPayload.subject).toContain('IMV-987654');
      expect(calledPayload.htmlContent).toContain('Dune: Part Two');
      expect(res.success).toBe(true);
      expect(res.provider).toBe('brevo');
    });

    it('propagates Brevo errors during verification so registration fails safely', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-failing-key';

      global.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ message: 'Invalid API key provided' })
        };
      });

      await expect(
        emailService.sendVerificationEmail({
          to: 'fail_user@example.com',
          name: 'Fail Candidate',
          token: 'fail_token',
          otp: '111111'
        })
      ).rejects.toThrow(/Failed to deliver verification email.*Brevo API Error \(401\)/);
    });
  });
});
