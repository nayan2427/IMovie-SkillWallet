# iMovie Project Technical Analysis Report

**Document Version**: 1.0.0  
**Date of Audit & Analysis**: October 26, 2026  
**Auditor / Architect**: Senior Software Architect, Full-Stack Developer & Security Engineer  
**Repository**: `nayan2427/IMovie-SkillWallet` (Monorepo: `client/`, `server/`, `docs/`)  
**Status**: VERIFIED against codebase, schemas, routes, controllers, and 148 automated tests (104 backend + 44 frontend)

---

## 1. Project Overview

**iMovie** (branded as **IMovies**) is an enterprise-grade full-stack cinema management and real-time movie ticket booking platform. It is NOT Apple's video editing software.

The application allows moviegoers to discover movies, browse multi-city theatres, inspect auditorium screen formats (IMAX, 4DX, Dolby Atmos), reserve seats on an interactive seat map with live WebSocket updates, complete simulated or gateway payments, and receive printable e-tickets with verifiable QR codes. Concurrently, it empowers cinema administrators to manage movies, venues, screens, seating tiers, show scheduling with automated conflict detection, customer booking audits, and user accounts.

### Key Architectural Strengths
- **Server-Authoritative Concurrency Control**: Prevents double-booking through atomic conditional MongoDB operations (`modifiedCount` validation with automatic rollback).
- **Transient Seat Reservation Lifecycle**: 8-minute reservation holds backed by an in-memory / scheduled background worker (`seatExpiryJob.js`, 15-second interval) and on-the-fly lazy evaluation.
- **Dual-Mode Cryptographic Verification**: Email verification via both SHA-256 hashed 32-byte tokens (one-click links) and 6-digit numeric OTPs.
- **Bi-directional WebSocket Rooms**: Real-time seat updates scoped strictly to show-specific rooms (`show:${showId}`) using Socket.IO.
- **Payment Abstraction**: Modular payment service with an interactive sandbox simulator and Razorpay order/signature verification.

---

## 2. Verified Technology Stack

| Layer / Concern | Technology | Version | Evidence / Source File |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | 18.3.1 | [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L19) |
| **Frontend Build Tool** | Vite | 6.4.5 (overridden) | [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L33), [package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/package.json#L32) |
| **Client Routing** | React Router DOM | 7.18.4 (v6 style `<Routes>`) | [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L22), [client/src/App.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/App.jsx#L2) |
| **Client State Management** | Redux Toolkit | 2.2.7 | [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L14), [client/src/store/index.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/store/index.js) |
| **HTTP Client** | Axios | 1.7.4 | [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L15), [client/src/services/api.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/services/api.js#L1) |
| **Styling & Theme** | Bootstrap + Custom CSS Tokens | 5.3.3 | [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L16), [client/src/styles/index.css](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/styles/index.css) |
| **Icons & Visuals** | Lucide React, Canvas Confetti | 0.428.0, 1.9.3 | [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L18) |
| **Backend Runtime** | Node.js (tested on v22 LTS) | ^22.0.0 | [package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/package.json#L3), [README.md](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/README.md#L3) |
| **Web Server Framework** | Express.js | 4.19.2 (ES Modules) | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L22), [server/src/app.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/app.js#L1) |
| **Database & ODM** | MongoDB with Mongoose | 8.5.2 | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L28) |
| **Real-Time Communication** | Socket.IO (Server & Client) | 4.7.5 | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L33), [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L24) |
| **Authentication & Tokens** | JWT (jsonwebtoken) & bcryptjs | 9.0.2, 2.4.3 | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L18-L27) |
| **Security Middleware** | Helmet, express-mongo-sanitize, express-rate-limit | 7.1.0, 2.2.0, 7.3.1 | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L23-L26) |
| **Validation Layer** | express-validator | 7.1.0 | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L25) |
| **File Upload Handling** | Multer | 2.5.0 | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L30) |
| **Barcode / QR Code** | QRCode | 1.5.3 | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L32) |
| **Transactional Email** | Brevo HTTPS API + Nodemailer SMTP | 10.1.7 | [server/src/services/emailService.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/services/emailService.js#L1) |
| **Automated Testing** | Vitest, Supertest, RTL, MongoMemoryServer | 2.0.5, 7.0.0, 16.0.0 | [server/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/package.json#L36-L40), [client/package.json](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/package.json#L27-L35) |
| **Deployment Targets** | Cloudflare Pages / Workers + Render Web Service + MongoDB Atlas | N/A | [wrangler.jsonc](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/wrangler.jsonc), [client/public/_redirects](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/public/_redirects) |

---

## 3. Project Folder Structure

```
IMovie-SkillWallet/
├── .gitignore
├── AUDIT_REPORT.md             # Security, architectural & UI audit findings
├── PROJECT_REPORT.md           # Master project report and verification
├── README.md                   # Quickstart, architecture overview, SMTP setup
├── docs/                       # Technical specifications
│   ├── API_DOCUMENTATION.md    # REST API endpoints and payload schemas
│   ├── ARCHITECTURE.md         # Architecture diagrams & sequence workflows
│   ├── DATABASE_SCHEMA.md      # Data dictionary and indexing strategy
│   ├── DEPLOYMENT_GUIDE.md     # Production deployment instructions
│   ├── SECURITY.md             # Threat model, RBAC, input sanitization
│   └── TESTING.md              # Test execution guidelines
├── package.json                # Root monorepo orchestrator (npm workspaces: server, client)
├── package-lock.json
├── postman/                    # Postman collection for API validation
├── wrangler.jsonc              # Cloudflare Workers / Pages deployment config
├── client/                     # Frontend Application (React 18 + Vite)
│   ├── public/
│   │   └── _redirects          # Cloudflare SPA fallback rule (/* /index.html 200)
│   ├── src/
│   │   ├── App.jsx             # React Router routing & route guards
│   │   ├── main.jsx            # React root bootstrap & Redux Provider
│   │   ├── components/
│   │   │   ├── admin/          # AdminSidebar, MovieModal, ShowModal, StatCard
│   │   │   ├── booking/        # HoldCountdown, PaymentModal, SeatGrid, SeatLegend
│   │   │   ├── common/         # Navbar, Footer, AdminRoute, ProtectedRoute, ErrorBoundary, LoadingSpinner
│   │   │   └── movies/         # MovieCard, MovieFilter, TrailerModal
│   │   ├── layouts/            # MainLayout (Customer) & AdminLayout (Admin)
│   │   ├── pages/              # 14 Full pages (Public, Customer, Admin)
│   │   │   ├── HomePage.jsx
│   │   │   ├── MoviesPage.jsx
│   │   │   ├── MovieDetailsPage.jsx
│   │   │   ├── TheatresPage.jsx
│   │   │   ├── SeatSelectionPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── VerifyEmailPage.jsx
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   ├── ResetPasswordPage.jsx
│   │   │   ├── BookingConfirmationPage.jsx
│   │   │   ├── UserBookingsPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── NotFoundPage.jsx
│   │   │   └── admin/          # AdminDashboardPage, AdminMoviesPage, AdminTheatresPage, AdminShowsPage, AdminBookingsPage, AdminUsersPage
│   │   ├── services/           # Axios HTTP client, service wrappers, Socket client
│   │   ├── store/              # Redux Toolkit store (authSlice, bookingSlice)
│   │   ├── styles/             # Obsidian and Crimson cinema design tokens
│   │   ├── test/               # 10 Vitest + RTL test files (44 passing tests)
│   │   └── utils/              # Client redirect sanitizer
│   ├── package.json
│   ├── vite.config.js
│   └── wrangler.jsonc
└── server/                     # Backend API & Real-Time Engine (Node + Express)
    ├── .env.example            # Documented environment variables
    ├── vitest.config.js        # Vitest configuration for backend integration tests
    ├── src/
    │   ├── app.js              # Express app, security middleware, route registration
    │   ├── server.js           # HTTP and Socket.IO initialization, DB connect, background jobs
    │   ├── config/             # db.js, environment.js (fail-closed checks), cors.js
    │   ├── controllers/        # 10 Express controllers
    │   ├── jobs/               # seatExpiryJob.js (15s interval hold cleanup worker)
    │   ├── middleware/         # auth.js, errorHandler.js, rateLimiter.js, upload.js, validator.js
    │   ├── models/             # 10 Mongoose schemas (User, Movie, Theatre, Screen, Show, ShowSeat, Booking, Payment, Notification, WebhookEvent)
    │   ├── routes/             # Versioned REST endpoints mounted under /api/v1
    │   ├── scripts/            # seed.js, createAdmin.js, checkDb.js, migrateEmailVerification.js
    │   ├── services/           # seatReservationService.js, paymentService.js, emailService.js
    │   ├── sockets/            # socketHandler.js (show-scoped rooms, rate limiting)
    │   ├── utils/              # apiResponse.js, constants.js, crypto.js, logger.js, regex.js, token.js
    │   └── validators/         # express-validator schemas for all route inputs
    └── tests/                  # 8 Integration test suites (104 passing tests)
```

---

## 4. Application Modules

The system is organized into **eight distinct functional modules**:

1. **Authentication & Identity Module**:
   - Manages user registration, bcrypt credential hashing (12 salt rounds), dual email verification (OTP + token link), login, JWT generation, session invalidation via `tokenVersion`, forgot/reset password flow, and profile management.
2. **Movie Catalog Module**:
   - Public catalog discovery, text search across titles, synopses, genres, and directors; status filtering (`now_showing`, `coming_soon`); YouTube trailer previews; and administrative Movie CRUD.
3. **Venues & Infrastructure Module**:
   - Manages multiplex theatres (`theatres`), cities, screen auditoriums (`screens`), screen formats (IMAX Laser, 4DX, Dolby Atmos), and customizable 2D grid seating layouts with tiered rows (Silver, Gold, Platinum) and aisle flags.
4. **Show Scheduling Module**:
   - Manages show instances (`shows`) linking movie, theatre, and screen with specific start/end timestamps. Enforces automated conflict detection preventing overlapping shows on the same screen. Immediately generates `ShowSeat` inventory upon creation.
5. **Real-Time Seat Reservation Engine**:
   - Controls live seat inventory (`showseats`). Orchestrates atomic holds, concurrency conflict detection, WebSocket synchronization across show rooms (`show:${showId}`), hold timer countdown (8 minutes), and 15-second background expiry cleanup.
6. **Payment & Checkout Module**:
   - Abstracts payment operations through `paymentService.js` supporting an out-of-the-box sandbox simulator and production Razorpay integration. Handles webhook signature verification and replay prevention (`WebhookEvent`).
7. **Booking & Ticketing Module**:
   - Confirms reservations, generates unique human-readable booking references (`IMV-XXXX-YYYY`), produces QR code data URLs (`qrcode`), supports printable ticket styles, enforces 2-hour pre-show cancellation rules, and triggers automated refunds.
8. **Administration & Analytics Module**:
   - Computes database-aggregated metrics (total revenue from verified payments, active movies, upcoming shows, confirmed bookings, registered users), provides audit logs, booking search, administrative cancellation overrides, and user account suspension.

---

## 5. Technical Architecture

### 5.1 Architecture Description
The iMovie architecture is a **Decoupled Client-Server Monorepo** featuring:
- A Single-Page Application (SPA) frontend in React 18, hosted on Cloudflare Pages / Workers static CDN.
- A Stateless REST API and Stateful WebSocket Server in Node.js / Express, hosted on Render.
- A Document Database in MongoDB Atlas.

### 5.2 Component Inventory & Interaction
- **React Client**: Renders the presentation layer, holds client-side state in Redux Toolkit, and interacts via two parallel channels:
  - **Axios HTTP Client**: Communicates with the Express REST API via JSON requests with `Authorization: Bearer <token>` and CSRF custom headers (`X-Requested-With`, `X-IMovies-Client`).
  - **Socket.IO Client**: Establishes a persistent bi-directional WebSocket connection with the backend, subscribing to `show:${showId}` rooms for live seat updates.
- **Express Server**: Exposes API endpoints under `/api/v1`. Employs a defense-in-depth middleware pipeline (`helmet`, `cors`, `trust proxy`, `express-rate-limit`, `express-mongo-sanitize`, JWT verification, and `express-validator`).
- **Domain Services**:
  - `seatReservationService`: Executes atomic MongoDB conditional queries (`ShowSeat.updateMany` checking status `AVAILABLE` or expired `HELD`).
  - `paymentService`: Adapter for Sandbox Simulator and Razorpay.
  - `emailService`: Dispatches transactional emails via Brevo HTTPS API or Nodemailer SMTP with development mock fallback.
- **MongoDB Atlas**: Stores 10 persistent collections. Show-specific seat inventory is denormalized into `showseats` for O(1) atomic reservation without document locking bottlenecks.

### 5.3 Data Travel Workflow (End-to-End)
1. **User Request**: User selects seats and clicks *Hold & Checkout*.
2. **HTTP Transmission**: Axios dispatches `POST /api/v1/bookings/hold` with `showId` and `seats: ['C4', 'C5']`.
3. **Middleware Interception**: Request passes rate limiters, JWT validation (`authenticate`), and body validation (`holdSeatsValidator`).
4. **Service Execution**: `seatReservationService.holdSeats` executes an atomic conditional `updateMany` in MongoDB.
5. **Race Condition Handling**: If another user claimed a seat 1 millisecond earlier, `modifiedCount !== seatNumbers.length`. The server immediately rolls back any claimed seats and returns `409 Conflict`.
6. **Socket Broadcast**: On successful lock, the server generates a `holdToken`, creates a `pending` Booking, and broadcasts `seat-hold-created` to room `show:${showId}`.
7. **Client Synchronization**: All connected clients viewing that show receive the WebSocket event and immediately render the seats as held (amber).
8. **Payment & Confirmation**: Upon user payment, `POST /api/v1/bookings/confirm` atomically sets `ShowSeat` status to `BOOKED`, creates a `Payment` audit record, generates a QR code, triggers a confirmation email, and broadcasts `booking-confirmed`.

---

## 6. Database Entities and ER Relationships

### 6.1 Database Models (Mongoose Schemas)

#### 1. User (`users`)
- **Purpose**: Accounts for customers and administrators.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `name`: String (required, max 100)
  - `email`: String (required, unique, lowercase, trimmed)
  - `passwordHash`: String (required, bcrypt)
  - `role`: String (enum: `['user', 'admin']`, default: `'user'`)
  - `phone`: String (optional)
  - `avatar`: String (optional URL)
  - `accountStatus`: String (enum: `['active', 'suspended', 'deleted']`, default: `'active'`)
  - `tokenVersion`: Number (default: 0) — used for immediate session revocation on logout or password reset
  - `isEmailVerified`: Boolean (default: false, indexed)
  - `isVerified`, `emailVerified`: Booleans (backward compatibility sync)
  - `emailVerifiedAt`: Date (nullable)
  - `emailVerificationTokenHash`: String (SHA-256 hash, nullable)
  - `emailVerificationOtpHash`: String (SHA-256 hash, nullable)
  - `emailVerificationExpiresAt`: Date (nullable, indexed)
  - `emailVerificationAttempts`: Number (default: 0)
  - `emailVerificationLockedUntil`: Date (nullable)
  - `emailVerificationLastSentAt`: Date (nullable)
  - `passwordResetTokenHash`: String (SHA-256 hash, nullable)
  - `passwordResetExpiresAt`: Date (nullable)
  - `createdAt`, `updatedAt`: Date (timestamps)
- **Indexes**: `{ email: 1 }` (unique), `{ isEmailVerified: 1 }`, `{ emailVerificationExpiresAt: 1 }`.

#### 2. Movie (`movies`)
- **Purpose**: Catalogue of feature films.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `title`: String (required, trimmed)
  - `slug`: String (required, unique, lowercase)
  - `synopsis`: String (required)
  - `posterUrl`: String (required)
  - `backdropUrl`: String (optional)
  - `trailerUrl`: String (optional)
  - `genres`: [String] (required)
  - `languages`: [String] (required, default: `['English']`)
  - `duration`: Number (required, minutes)
  - `releaseDate`: Date (required)
  - `certification`: String (enum: `['U', 'UA', 'A', 'PG', 'PG-13', 'R']`, default: `'UA'`)
  - `director`: String
  - `cast`: [{ name: String, role: String, avatar: String }]
  - `rating`: Number (0–10, default: 8.5)
  - `status`: String (enum: `['now_showing', 'coming_soon', 'archived']`, default: `'now_showing'`)
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ title: 'text', synopsis: 'text', genres: 'text', director: 'text' }`, `{ status: 1, releaseDate: -1 }`.

#### 3. Theatre (`theatres`)
- **Purpose**: Physical cinema venue or multiplex.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `name`: String (required, trimmed)
  - `slug`: String (required, unique, lowercase)
  - `description`: String
  - `address`: String (required)
  - `city`: String (required, indexed)
  - `state`: String
  - `postalCode`: String
  - `country`: String (default: `'India'`)
  - `amenities`: [String]
  - `isActive`: Boolean (default: true)
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ city: 1, isActive: 1 }`.

#### 4. Screen (`screens`)
- **Purpose**: Auditorium within a theatre.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `theatre`: ObjectId (FK -> Theatre, required, indexed)
  - `name`: String (required, e.g. `'Audi 1 - IMAX'`)
  - `screenType`: String (enum: `['Standard', 'IMAX', '4DX', 'Dolby Atmos', 'Gold Class']`, default: `'Dolby Atmos'`)
  - `totalSeats`: Number (required, min: 1)
  - `seatingLayout`: Object containing `rows: [{ rowLetter, category, priceMultiplier, seats: [{ seatNumber, number, isAisle }] }]`
  - `isActive`: Boolean (default: true)
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ theatre: 1, name: 1 }` (unique compound index).

#### 5. Show (`shows`)
- **Purpose**: Scheduled movie screening session.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `movie`: ObjectId (FK -> Movie, required, indexed)
  - `theatre`: ObjectId (FK -> Theatre, required, indexed)
  - `screen`: ObjectId (FK -> Screen, required, indexed)
  - `startTime`: Date (required, indexed)
  - `endTime`: Date (required)
  - `basePrice`: Number (required, min: 50)
  - `seatPricing`: Object `{ silver: Number, gold: Number, platinum: Number }`
  - `status`: String (enum: `['scheduled', 'running', 'completed', 'cancelled']`, default: `'scheduled'`)
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ movie: 1, startTime: 1 }`, `{ theatre: 1, screen: 1, startTime: 1, endTime: 1 }`.

#### 6. ShowSeat (`showseats`)
- **Purpose**: Authoritative per-show seat inventory record.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `show`: ObjectId (FK -> Show, required, indexed)
  - `seatNumber`: String (required, e.g. `'C4'`)
  - `row`: String (required, e.g. `'C'`)
  - `number`: Number (required, e.g. `4`)
  - `category`: String (enum: `['SILVER', 'GOLD', 'PLATINUM']`, default: `'SILVER'`)
  - `price`: Number (required, min: 0)
  - `status`: String (enum: `['AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED']`, default: `'AVAILABLE'`)
  - `heldBy`: ObjectId (FK -> User, default: null)
  - `heldUntil`: Date (default: null, indexed)
  - `holdToken`: String (default: null, indexed)
  - `booking`: ObjectId (FK -> Booking, default: null)
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ show: 1, seatNumber: 1 }` (unique), `{ show: 1, status: 1, heldUntil: 1 }`.

#### 7. Booking (`bookings`)
- **Purpose**: Customer ticket purchase record.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `bookingReference`: String (required, unique, uppercase, e.g. `'IMV-8K9P2X'`)
  - `user`: ObjectId (FK -> User, required, indexed)
  - `show`: ObjectId (FK -> Show, required, indexed)
  - `seats`: [{ seatNumber: String, category: String, price: Number }]
  - `totalAmount`: Number (required)
  - `convenienceFee`: Number (default: 0)
  - `grandTotal`: Number (required)
  - `status`: String (enum: `['pending', 'confirmed', 'cancelled', 'expired']`, default: `'pending'`, indexed)
  - `paymentStatus`: String (enum: `['pending', 'success', 'failed', 'refunded']`, default: `'pending'`, indexed)
  - `paymentReference`: String (default: '')
  - `holdToken`: String (default: '', indexed)
  - `expiresAt`: Date (default: null, indexed)
  - `cancellationDetails`: Object `{ cancelledAt: Date, cancellationReason: String, refundAmount: Number, refundStatus: String }`
  - `qrCode`: String (Base64 data URL)
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ bookingReference: 1 }` (unique), `{ user: 1, createdAt: -1 }`.

#### 8. Payment (`payments`)
- **Purpose**: Financial audit log and transaction tracking.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `booking`: ObjectId (FK -> Booking, required, indexed)
  - `user`: ObjectId (FK -> User, required, indexed)
  - `amount`: Number (required, min: 0)
  - `currency`: String (default: `'INR'`)
  - `provider`: String (enum: `['simulated', 'razorpay', 'stripe']`, default: `'simulated'`)
  - `providerOrderId`: String (default: '')
  - `providerPaymentId`: String (default: '', sparse unique index for idempotency)
  - `status`: String (enum: `['pending', 'success', 'failed', 'refunded']`, default: `'pending'`, indexed)
  - `method`: String (enum: `['card', 'upi', 'netbanking', 'wallet', 'simulator']`, default: `'simulator'`)
  - `metadata`: Mixed (default: `{}`)
  - `refundId`: String (default: '')
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ providerPaymentId: 1 }` (unique, sparse), `{ booking: 1, status: 1 }`.

#### 9. Notification (`notifications`)
- **Purpose**: User in-app notifications and alerts.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `user`: ObjectId (FK -> User, required, indexed)
  - `type`: String (enum: `['booking_confirmed', 'booking_cancelled', 'hold_expired', 'reminder', 'system']`, default: `'system'`)
  - `title`: String (required)
  - `message`: String (required)
  - `bookingReference`: String (default: null)
  - `read`: Boolean (default: false)
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ user: 1, read: 1, createdAt: -1 }`.

#### 10. WebhookEvent (`webhookevents`)
- **Purpose**: Replay protection and idempotency tracking for payment provider webhooks.
- **Fields**:
  - `_id`: ObjectId (PK)
  - `eventId`: String (required, unique, indexed)
  - `provider`: String (required, default: `'razorpay'`)
  - `eventType`: String (default: `'custom'`)
  - `receivedAt`: Date (default: Date.now, indexed)
  - `createdAt`, `updatedAt`: Date
- **Indexes**: `{ eventId: 1 }` (unique), `{ createdAt: 1 }` with `expireAfterSeconds: 604800` (7-day TTL cleanup).

### 6.2 Entity Relationships & Cardinalities

| Primary Entity | Foreign Entity | Cardinality | Implementation / FK Field | Description |
| :--- | :--- | :---: | :--- | :--- |
| **Theatre** | **Screen** | 1 : N (One-to-Many) | `Screen.theatre` (ObjectId ref) | A multiplex contains one or more auditoriums. |
| **Theatre** | **Show** | 1 : N (One-to-Many) | `Show.theatre` (ObjectId ref) | A theatre hosts multiple scheduled shows. |
| **Screen** | **Show** | 1 : N (One-to-Many) | `Show.screen` (ObjectId ref) | An auditorium hosts shows across different time slots. |
| **Movie** | **Show** | 1 : N (One-to-Many) | `Show.movie` (ObjectId ref) | A movie is scheduled across multiple shows. |
| **Show** | **ShowSeat** | 1 : N (One-to-Many) | `ShowSeat.show` (ObjectId ref) | A show has an authoritative set of seats matching the screen layout. |
| **User** | **Booking** | 1 : N (One-to-Many) | `Booking.user` (ObjectId ref) | A registered user can place multiple bookings. |
| **Show** | **Booking** | 1 : N (One-to-Many) | `Booking.show` (ObjectId ref) | A show contains multiple customer bookings. |
| **Booking** | **Payment** | 1 : 1 (One-to-One) | `Payment.booking` (ObjectId ref) | Each confirmed booking corresponds to one verified payment audit record. |
| **User** | **Payment** | 1 : N (One-to-Many) | `Payment.user` (ObjectId ref) | A user makes payments across their transactions. |
| **User** | **Notification** | 1 : N (One-to-Many) | `Notification.user` (ObjectId ref) | A user receives system and booking notifications. |
| **ShowSeat** | **User** | N : 0..1 (Many-to-Optional) | `ShowSeat.heldBy` (ObjectId ref) | Seats are held by a user during an active 8-minute hold window. |
| **ShowSeat** | **Booking** | N : 0..1 (Many-to-Optional) | `ShowSeat.booking` (ObjectId ref) | Confirmed seats are permanently linked to the Booking ID. |

---

## 7. Features and Implementation Status

| Feature Name | Module | Main Functionality | Allowed Role | Frontend Component | Backend API / Service | DB Entities | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **User Sign Up** | Auth | Register new account with validation | Guest | `RegisterPage.jsx` | `POST /api/v1/auth/register` | `User` | **Implemented** |
| **Email Verification** | Auth | Verify account via 6-digit OTP or link | Guest / User | `VerifyEmailPage.jsx` | `POST /api/v1/auth/verify-email` | `User` | **Implemented** |
| **Resend OTP** | Auth | Resend verification email with rate limit | Guest / User | `VerifyEmailPage.jsx` | `POST /api/v1/auth/resend-verification` | `User` | **Implemented** |
| **User Login** | Auth | Authenticate and issue JWT + cookie | Guest | `LoginPage.jsx` | `POST /api/v1/auth/login` | `User` | **Implemented** |
| **Password Reset** | Auth | Forgot password request & token reset | Guest | `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx` | `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password` | `User` | **Implemented** |
| **User Logout** | Auth | Invalidate token via tokenVersion increment | User, Admin | `Navbar.jsx` | `POST /api/v1/auth/logout` | `User` | **Implemented** |
| **User Profile** | Auth | View profile & update details | User, Admin | `ProfilePage.jsx` | `GET /api/v1/auth/me`, `PATCH /api/v1/auth/profile` | `User` | **Implemented** |
| **Movie Discovery** | Catalog | Search, filter by status, genre, language | Public | `HomePage.jsx`, `MoviesPage.jsx`, `MovieFilter.jsx` | `GET /api/v1/movies` | `Movie` | **Implemented** |
| **Movie Details** | Catalog | View synopsis, cast, certification, duration | Public | `MovieDetailsPage.jsx` | `GET /api/v1/movies/:id` | `Movie`, `Show`, `Theatre` | **Implemented** |
| **Trailer Preview** | Catalog | Modal iframe preview of YouTube trailer | Public | `TrailerModal.jsx` | N/A (Frontend modal with URL sanitizer) | `Movie` | **Implemented** |
| **Theatre Discovery** | Venues | Browse cinema locations, cities, amenities | Public | `TheatresPage.jsx` | `GET /api/v1/theatres` | `Theatre`, `Screen` | **Implemented** |
| **Auditorium Seat Map** | Booking | Interactive visual seat map by category | Public | `SeatSelectionPage.jsx`, `SeatGrid.jsx`, `SeatLegend.jsx` | `GET /api/v1/shows/:showId/seats` | `ShowSeat`, `Show` | **Implemented** |
| **Live Seat Sync** | Booking | WebSocket room broadcast of seat holds | Public | `SeatSelectionPage.jsx` | Socket.IO `join-show`, `seat-hold-created`, `seat-hold-released` | In-memory / Sockets | **Implemented** |
| **Atomic Seat Hold** | Booking | 8-min hold with race condition rollback | Verified User | `SeatSelectionPage.jsx` | `POST /api/v1/bookings/hold` | `ShowSeat`, `Booking` | **Implemented** |
| **Hold Countdown** | Booking | Visual countdown timer with auto-release | Verified User | `HoldCountdown.jsx` | `seatExpiryJob.js` (background) | `ShowSeat`, `Booking` | **Implemented** |
| **Payment Simulator** | Payments | Card, UPI, NetBanking sandbox checkout | Verified User | `PaymentModal.jsx` | `POST /api/v1/payments/simulate`, `POST /api/v1/bookings/create-order` | `Payment`, `Booking` | **Implemented** |
| **Razorpay Integration**| Payments | Order creation & HMAC signature check | Verified User | `PaymentModal.jsx` (backend ready) | `paymentService.js` (Razorpay adapter) | `Payment`, `Booking` | **Implemented** (backend), Simulator in UI |
| **Stripe Provider** | Payments | Stripe checkout intent integration | Verified User | N/A | `models/Payment.js` (enum present) | `Payment` | **Partially Implemented** (Enum exists, adapter planned) |
| **Webhook Handler** | Payments | Idempotent webhook processing | Public / Provider | N/A | `POST /api/v1/payments/webhook` | `WebhookEvent`, `Payment`, `Booking` | **Implemented** |
| **Booking Confirmation**| Ticketing | Confirms booking, issues QR e-ticket | Verified User | `BookingConfirmationPage.jsx` | `POST /api/v1/bookings/confirm`, `GET /api/v1/bookings/:id` | `Booking`, `ShowSeat`, `Payment`, `Notification` | **Implemented** |
| **Printable E-Ticket** | Ticketing | Clean printable ticket with QR code | Verified User | `BookingConfirmationPage.jsx` | `GET /api/v1/bookings/:id/ticket` | `Booking` | **Implemented** |
| **My Bookings** | Ticketing | View user booking history | Verified User | `UserBookingsPage.jsx` | `GET /api/v1/bookings/my` | `Booking` | **Implemented** |
| **Booking Cancellation**| Ticketing | Cancel booking (>= 2h cutoff) & refund | Verified User, Admin | `UserBookingsPage.jsx`, `AdminBookingsPage.jsx` | `POST /api/v1/bookings/:id/cancel` | `Booking`, `ShowSeat`, `Payment` | **Implemented** |
| **User Notifications** | User | In-app alerts on booking/cancellation | Verified User | `Navbar.jsx` | `GET /api/v1/users/notifications`, `PATCH /read` | `Notification` | **Implemented** |
| **Admin Analytics** | Admin | Dashboard metrics (revenue, tickets, users) | Admin | `AdminDashboardPage.jsx`, `StatCard.jsx` | `GET /api/v1/admin/analytics` | `Booking`, `Payment`, `User`, `Movie`, `Theatre` | **Implemented** |
| **Admin Movie CRUD** | Admin | Create, edit, archive movies, upload image | Admin | `AdminMoviesPage.jsx`, `MovieModal.jsx` | `POST/PATCH/DELETE /api/v1/movies`, `POST /upload` | `Movie` | **Implemented** |
| **Admin Venue CRUD** | Admin | Manage theatres and auditoriums | Admin | `AdminTheatresPage.jsx` | `POST/PATCH/DELETE /api/v1/theatres`, `/screens` | `Theatre`, `Screen` | **Implemented** |
| **Admin Show Scheduling**| Admin | Schedule shows with overlap prevention | Admin | `AdminShowsPage.jsx`, `ShowModal.jsx` | `POST/PATCH/DELETE /api/v1/shows` | `Show`, `ShowSeat` | **Implemented** |
| **Admin Booking Audit**| Admin | View all bookings & override refund | Admin | `AdminBookingsPage.jsx` | `GET /api/v1/admin/bookings`, `POST /:id/cancel` | `Booking`, `Payment` | **Implemented** |
| **Admin User Mgmt** | Admin | View users & toggle suspension | Admin | `AdminUsersPage.jsx` | `GET /api/v1/admin/users`, `PATCH /users/:id/status` | `User` | **Implemented** |

---

## 8. User Roles and Permissions

The system defines **two explicit roles**: `'user'` (Customer) and `'admin'` (System Administrator), plus an unauthenticated guest state.

```
                           +----------------------+
                           |   Unauthenticated    |
                           |        Guest         |
                           +----------+-----------+
                                      |
                     [Register & Verify / Login]
                                      v
                           +----------------------+
                           |     Authenticated    |
                           |    Verified User     |
                           +----------+-----------+
                                      |
                           [Role Flag: role='admin']
                                      v
                           +----------------------+
                           |    Administrator     |
                           +----------------------+
```

### 8.1 Detailed Role Matrix

| Action / Capability | Guest | Verified User (`'user'`) | Administrator (`'admin'`) | Enforcement Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| Browse Movies, Showtimes & Venues | Yes | Yes | Yes | Public Routes |
| View Auditorium Seating Availability | Yes | Yes | Yes | `optionalAuth` on `/shows/:showId/seats` |
| View YouTube Movie Trailer Modal | Yes | Yes | Yes | Client UI |
| Register Account & Verify Email | Yes | N/A | N/A | Public Auth Routes |
| Request Password Reset | Yes | Yes | Yes | `POST /api/v1/auth/forgot-password` |
| Hold Cinema Seats (8-min lock) | No | Yes | Yes | `authenticate` + `isVerifiedAccount()` check |
| Checkout & Confirm Booking | No | Yes | Yes | `authenticate` + ownership check |
| View Confirmed Ticket & QR Code | No | Yes (Own only) | Yes (All) | `authenticate` + ownership check |
| View My Bookings History | No | Yes (Own only) | Yes (All) | `GET /api/v1/bookings/my` |
| Cancel Booking (>= 2h cutoff) | No | Yes (Own only) | Yes (Any cutoff) | Cutoff checked unless `isAdmin === true` |
| Update Personal Profile | No | Yes | Yes | `PATCH /api/v1/auth/profile` |
| Access Admin Dashboard & Analytics | No | No | Yes | `AdminRoute.jsx` + `requireAdmin` middleware |
| Movie Management (Create/Update/Delete) | No | No | Yes | `requireAdmin` on `/api/v1/movies` |
| Media Upload (Poster images) | No | No | Yes | `requireAdmin` on `/api/v1/movies/upload` |
| Theatre & Screen Configuration | No | No | Yes | `requireAdmin` on `/api/v1/theatres`, `/screens` |
| Show Scheduling (with collision check) | No | No | Yes | `requireAdmin` on `/api/v1/shows` |
| Audit All Bookings & Process Overrides | No | No | Yes | `requireAdmin` on `/api/v1/admin/bookings` |
| Manage User Accounts & Suspend Users | No | No | Yes | `requireAdmin` on `/api/v1/admin/users` |

---

## 9. User Flows and Decision Points

### 9.1 Registration & Dual Email Verification Flow
1. **User enters registration details**: Name, Email, Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special symbol), Confirm Password.
2. **Input Validation**: `registerValidator` validates formats. If invalid, returns 400 with field errors.
3. **Account Creation**: Account created in MongoDB with `isEmailVerified: false` and `accountStatus: 'active'`.
4. **Credential Generation**:
   - 32-byte cryptographically secure random token (`crypto.randomBytes(32)`).
   - 6-digit numeric OTP (`crypto.randomInt(100000, 1000000)`).
   - Hashes (`emailVerificationTokenHash`, `emailVerificationOtpHash`) stored in MongoDB. Raw tokens are never persisted.
5. **Email Dispatch**: Nodemailer / Brevo sends branded email containing both the link (`/verify-email?token=...`) and the 6-digit OTP.
6. **Verification Branch**:
   - **Path A (One-click link)**: Frontend `/verify-email` reads `?token=...` query param, calls `POST /api/v1/auth/verify-email { token }`.
   - **Path B (Manual OTP entry)**: User enters email + 6 digits, calls `POST /api/v1/auth/verify-email { email, otp }`.
7. **Outcome**:
   - If invalid/expired (> 60 mins): returns 400.
   - If max attempts reached (5 failed attempts): account verification is locked for 15 minutes.
   - On success: `isEmailVerified = true`, `emailVerifiedAt = new Date()`, hashes cleared. User proceeds to login.

### 9.2 Seat Selection, Concurrency Lock & Payment Flow
1. **Entry**: Customer navigates to `/book/:showId`.
2. **WebSocket Handshake**: Frontend emits `join-show { showId }`. Server adds socket to room `show:${showId}` and returns authoritative seat layout.
3. **Selection**: Customer toggles up to 10 seats. Live estimate subtotal and convenience fee are calculated.
4. **Hold Request**: Customer clicks *Hold & Checkout*.
   - If unauthenticated: redirected to `/login?redirect=/book/:showId`.
   - If authenticated: calls `POST /api/v1/bookings/hold { showId, seats: ['C4', 'C5'] }`.
5. **Server Concurrency Decision**:
   - Server runs atomic conditional `updateMany` for seats matching `showId` and `seatNumber` where status is `AVAILABLE` (or expired `HELD`).
   - **Conflict Branch**: If `modifiedCount !== seatNumbers.length`, another user claimed one of the seats. Server reverts any modified seats, returns `409 Conflict`. Frontend alerts user and refreshes seat map.
   - **Success Branch**: Server sets seats to `HELD` with `heldUntil: now + 8m`, creates `pending` Booking, broadcasts `seat-hold-created` to `show:${showId}`, returns `holdToken` and `grandTotal`.
6. **Checkout Modal**:
   - 8-minute countdown timer begins.
   - Customer selects payment method (Card, UPI, NetBanking).
   - Clicks *Pay Now* -> calls `POST /api/v1/bookings/create-order` then `POST /api/v1/payments/simulate`.
7. **Confirmation Decision**:
   - Calls `POST /api/v1/bookings/confirm { bookingId, paymentId, method }`.
   - Server checks:
     - Has hold expired (`expiresAt < now`)? If expired: triggers automated refund via `paymentService.refundPayment`, marks booking `EXPIRED`, releases seats, returns 410.
     - Is amount matching? If mismatch: returns 400.
     - Has payment ID been reused? (Idempotency check).
   - If valid: Server atomically sets `ShowSeat` status to `BOOKED`, updates Booking to `confirmed`, creates `Payment` audit record, creates `Notification`, dispatches confirmation email, and broadcasts `booking-confirmed`.
8. **Completion**: Confetti triggers on frontend; customer views printable e-ticket with QR code at `/booking-confirmation/:id`.

---

## 10. MVC Pattern and Actual File Mapping

### 10.1 Architectural Classification
IMovies does **NOT** follow traditional monolithic server-rendered MVC (such as Express + Pug/EJS).  
Instead, it follows a **Decoupled SPA + REST API Architecture**, which maps cleanly to a Modern Tiered MVC variant:

```
+-------------------------------------------------------------------------------+
|                                    VIEW                                       |
|  React 18 SPA (Vite)                                                          |
|  - Pages: HomePage, SeatSelectionPage, BookingConfirmationPage, AdminPages    |
|  - Components: SeatGrid, HoldCountdown, PaymentModal, MovieCard, Navbar       |
|  - Client State: Redux Toolkit (authSlice, bookingSlice)                      |
+---------------------------------------+---------------------------------------+
                                        |  Axios HTTP (JSON REST)
                                        |  Socket.IO (WebSocket events)
                                        v
+-------------------------------------------------------------------------------+
|                                 CONTROLLER                                    |
|  Express 4 Request Handlers & Route Dispatchers                               |
|  - Routes: /api/v1/auth, /movies, /theatres, /shows, /bookings, /admin        |
|  - Middleware: auth.js, rateLimiter.js, validator.js, errorHandler.js         |
|  - Controllers: authController, bookingController, movieController, etc.      |
+---------------------------------------+---------------------------------------+
                                        |  Invokes Domain Services
                                        v
+-------------------------------------------------------------------------------+
|                               SERVICE LAYER                                   |
|  Domain Logic & External Orchestration                                        |
|  - seatReservationService: Atomic hold, race rollback, pricing, confirmation  |
|  - paymentService: Simulator & Razorpay adapter, refund orchestration         |
|  - emailService: Brevo HTTPS API & Nodemailer SMTP delivery                   |
|  - seatExpiryJob: Scheduled background worker (15s interval)                   |
+---------------------------------------+---------------------------------------+
                                        |  Mongoose ODM Queries & Updates
                                        v
+-------------------------------------------------------------------------------+
|                                    MODEL                                      |
|  Persistent MongoDB Data Models & Lifecycle Hooks                             |
|  - Models: User, Movie, Theatre, Screen, Show, ShowSeat, Booking, Payment,     |
|            Notification, WebhookEvent                                         |
+-------------------------------------------------------------------------------+
```

### 10.2 Concrete File Mapping

| Tier | Responsibility | Primary Files |
| :--- | :--- | :--- |
| **Model** | MongoDB schemas, validation, hooks, indexing | [server/src/models/User.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/User.js)<br>[server/src/models/Movie.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Movie.js)<br>[server/src/models/Theatre.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Theatre.js)<br>[server/src/models/Screen.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Screen.js)<br>[server/src/models/Show.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Show.js)<br>[server/src/models/ShowSeat.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/ShowSeat.js)<br>[server/src/models/Booking.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Booking.js)<br>[server/src/models/Payment.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Payment.js)<br>[server/src/models/Notification.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Notification.js)<br>[server/src/models/WebhookEvent.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/WebhookEvent.js) |
| **View** | Presentation, UI components, pages, Redux store | [client/src/pages/HomePage.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/pages/HomePage.jsx)<br>[client/src/pages/SeatSelectionPage.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/pages/SeatSelectionPage.jsx)<br>[client/src/pages/BookingConfirmationPage.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/pages/BookingConfirmationPage.jsx)<br>[client/src/components/booking/SeatGrid.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/components/booking/SeatGrid.jsx)<br>[client/src/components/booking/PaymentModal.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/components/booking/PaymentModal.jsx)<br>[client/src/pages/admin/AdminDashboardPage.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/pages/admin/AdminDashboardPage.jsx) |
| **Controller** | Request parsing, validation dispatch, HTTP response formatting | [server/src/controllers/authController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/authController.js)<br>[server/src/controllers/bookingController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/bookingController.js)<br>[server/src/controllers/movieController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/movieController.js)<br>[server/src/controllers/theatreController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/theatreController.js)<br>[server/src/controllers/screenController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/screenController.js)<br>[server/src/controllers/showController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/showController.js)<br>[server/src/controllers/paymentController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/paymentController.js)<br>[server/src/controllers/adminController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/adminController.js)<br>[server/src/controllers/userController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/userController.js) |
| **Service Layer** | Atomic business transactions, provider integration | [server/src/services/seatReservationService.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/services/seatReservationService.js)<br>[server/src/services/paymentService.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/services/paymentService.js)<br>[server/src/services/emailService.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/services/emailService.js)<br>[server/src/jobs/seatExpiryJob.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/jobs/seatExpiryJob.js) |

---

## 11. API Endpoints and Their Responsibilities

All endpoints are mounted under `/api/v1` in [server/src/routes/index.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/routes/index.js):

### 11.1 Auth Routes (`/api/v1/auth`)
- `POST /register`: Register a new customer account (`authLimiter`, `registerValidator`).
- `POST /verify-email`: Verify account via token link or 6-digit OTP (`verificationLimiter`, `verifyEmailValidator`).
- `POST /resend-verification`: Resend verification email (`resendLimiter`, `resendVerificationValidator`).
- `POST /forgot-password`: Request password reset email (`authLimiter`, `forgotPasswordValidator`).
- `POST /reset-password`: Reset password using token with session revocation (`authLimiter`, `resetPasswordValidator`).
- `POST /login`: Authenticate credentials, issue JWT (`authLimiter`, `loginValidator`).
- `POST /logout`: Invalidate session via `tokenVersion` increment (`authenticate`).
- `GET /me`: Fetch authenticated user profile (`authenticate`).
- `PATCH /profile`: Update profile; triggers re-verification if email changed (`authenticate`, `updateProfileValidator`).

### 11.2 Movie Routes (`/api/v1/movies`)
- `GET /`: List movies with search & filter query params (Public).
- `GET /:id`: Get single movie by ID with cast and metadata (Public).
- `POST /`: Create movie (`authenticate`, `requireAdmin`, `createMovieValidator`).
- `PATCH /:id`: Update movie details (`authenticate`, `requireAdmin`, `updateMovieValidator`).
- `DELETE /:id`: Delete/archive movie (`authenticate`, `requireAdmin`).
- `POST /upload`: Upload movie poster image (`authenticate`, `requireAdmin`, Multer).

### 11.3 Theatre & Screen Routes (`/api/v1/theatres`, `/api/v1/screens`)
- `GET /theatres`: List active theatres filtered by city (Public).
- `GET /theatres/:id`: Get theatre by ID (Public).
- `POST /theatres`: Create theatre (`authenticate`, `requireAdmin`).
- `PATCH /theatres/:id`: Update theatre (`authenticate`, `requireAdmin`).
- `DELETE /theatres/:id`: Delete theatre (`authenticate`, `requireAdmin`).
- `GET /theatres/:theatreId/screens`: List screens for theatre (Public).
- `POST /theatres/:theatreId/screens`: Create screen with layout (`authenticate`, `requireAdmin`).
- `GET /screens/:id`: Get screen layout (Public).
- `PATCH /screens/:id`: Update screen layout (`authenticate`, `requireAdmin`).
- `DELETE /screens/:id`: Delete screen (`authenticate`, `requireAdmin`).

### 11.4 Show & Seat Routes (`/api/v1/shows`, `/api/v1/shows/:showId/seats`)
- `GET /shows`: Query scheduled shows by movie, theatre, date, city (Public).
- `GET /shows/:id`: Get show details with populated references (Public).
- `POST /shows`: Schedule show with automated overlap detection (`authenticate`, `requireAdmin`).
- `PATCH /shows/:id`: Update show timing or pricing (`authenticate`, `requireAdmin`).
- `DELETE /shows/:id`: Cancel show (`authenticate`, `requireAdmin`).
- `GET /shows/:showId/seats`: Fetch authoritative seat inventory (`optionalAuth`).

### 11.5 Booking Routes (`/api/v1/bookings`)
- `POST /hold`: Claim atomic temporary seat hold (8 mins) (`authenticate`, `holdLimiter`).
- `POST /create-order`: Create payment order payload (`authenticate`, `paymentLimiter`).
- `POST /confirm`: Confirm verified payment & convert seats to booked (`authenticate`, `paymentLimiter`).
- `GET /my`: Get authenticated user's booking history (`authenticate`).
- `GET /:id`: Get specific booking by ID (`authenticate`).
- `POST /:id/cancel`: Cancel booking & trigger refund (`authenticate`).
- `GET /:id/ticket`: Get printable ticket data URL & QR payload (`authenticate`).

### 11.6 Payment Routes (`/api/v1/payments`)
- `POST /simulate`: Sandbox simulator payment endpoint (`authenticate`, disabled in production with 403).
- `GET /:id/status`: Check payment transaction status (`authenticate`).
- `POST /webhook`: Ingest payment provider webhook with replay protection (`handlePaymentWebhook`).

### 11.7 Admin & User Routes (`/api/v1/admin`, `/api/v1/users`)
- `GET /admin/analytics`: Aggregated executive metrics (`authenticate`, `requireAdmin`).
- `GET /admin/bookings`: Audit all bookings with search/pagination (`authenticate`, `requireAdmin`).
- `GET /admin/users`: List all users with account statuses (`authenticate`, `requireAdmin`).
- `PATCH /admin/users/:id/status`: Toggle user active / suspended (`authenticate`, `requireAdmin`).
- `GET /users/notifications`: Fetch user notification inbox (`authenticate`).
- `PATCH /users/notifications/:id/read`: Mark notification read (`authenticate`).
- `PATCH /users/notifications/read-all`: Mark all notifications read (`authenticate`).

---

## 12. External Services and Integrations

1. **Transactional Email Service (Dual Provider)**:
   - **Brevo HTTPS API**: Active when `BREVO_API_KEY` is present or `EMAIL_PROVIDER=brevo`. Dispatches transactional emails via HTTPS `https://api.brevo.com/v3/smtp/email`.
   - **Nodemailer SMTP**: Active when `SMTP_USER` and `SMTP_PASS` are provided (Gmail, SES, SendGrid). Automatically handles Gmail SPF/DKIM From-header alignment.
   - **Dev Mock Transport**: When no SMTP or Brevo credentials are provided, safely logs OTPs and verification links to terminal without crashing.
2. **Payment Gateways**:
   - **Simulated Payment Engine**: Custom in-engine simulator generating verifiable transaction IDs (`SIM_PAY_...`), supporting Card, UPI, and NetBanking, with simulated decline toggle.
   - **Razorpay**: Integrated via Orders API (`https://api.razorpay.com/v1/orders`), HMAC-SHA256 signature verification, and Refunds API (`/payments/:id/refund`).
   - **Stripe**: Configured in environment and database schemas; adapter stub present.
3. **Database Hosting**:
   - **MongoDB Atlas**: Cloud multi-tenant replica set with reconnection resilience.
   - **MongoDB Memory Server (`mongodb-memory-server`)**: Automatic embedded development/test fallback when local MongoDB daemon is offline.
4. **Hosting Platforms**:
   - **Cloudflare Pages / Workers**: Client static asset CDN (`wrangler.jsonc`, `client/public/_redirects`).
   - **Render**: Backend Node.js / Express Web Service with reverse proxy trust (`trust proxy: 1`).

---

## 13. Security and Authentication

- **Password Policy**: Bcrypt with 12 salt rounds. Automatic transparent re-hashing on login for legacy accounts. Registration enforces minimum 8 characters, uppercase, lowercase, number, and special symbol.
- **Session Revocation**: `tokenVersion` stored on User model and encoded in JWT payload. Logging out or resetting passwords increments `tokenVersion`, instantly invalidating existing tokens across all devices.
- **Email Verification Guard**: Unverified users receive `403 Forbidden` (`EMAIL_NOT_VERIFIED`) on login and are blocked by `ProtectedRoute.jsx` and `AdminRoute.jsx` on the client.
- **Anti-Enumeration Protection**: Duplicate registration and forgot-password requests respond with neutral, identical messages without leaking account existence. Constant-time comparisons are utilized for verification tokens.
- **NoSQL Injection Defense**: `express-mongo-sanitize` strips `$` and `.` operators from all incoming requests.
- **ReDoS Protection**: Search queries escape special regex characters via `escapeRegex()` utility.
- **Strict Media Upload Guard**: SVG and XML file uploads are strictly rejected to prevent Stored Cross-Site Scripting (XSS). Uploads directory serves files with `X-Content-Type-Options: nosniff`.
- **YouTube Embed Validation**: Trailer URLs are strictly validated to official YouTube domains (`youtube.com`, `youtu.be`) to prevent arbitrary iframe injection.
- **Open Redirect Sanitization**: The `redirect` query parameter on login is validated through `sanitizeRedirectPath()` to prevent open redirection.

---

## 14. Evidence and Source File References

- **Monorepo Workspaces**: [package.json:L6-9](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/package.json#L6-L9)
- **Production Fail-Closed Validation**: [server/src/config/environment.js:L8-56](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/config/environment.js#L8-L56)
- **Reverse Proxy & Sanitization**: [server/src/app.js:L24-49](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/app.js#L24-L49)
- **Token Version Invalidation**: [server/src/middleware/auth.js:L51-56](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/middleware/auth.js#L51-L56)
- **Atomic Concurrency Hold**: [server/src/services/seatReservationService.js:L179-217](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/services/seatReservationService.js#L179-L217)
- **Hold Expiry Background Worker**: [server/src/jobs/seatExpiryJob.js:L7-33](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/jobs/seatExpiryJob.js#L7-L33)
- **Show-Scoped WebSocket Rooms**: [server/src/sockets/socketHandler.js:L59-87](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/sockets/socketHandler.js#L59-L87)
- **Show Collision Scheduler**: [server/src/controllers/showController.js:L81-99](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/showController.js#L81-L99)
- **Payment Verification & Hold Expiry Refund**: [server/src/services/seatReservationService.js:L337-380](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/services/seatReservationService.js#L337-L380)
- **Client Route Guards**: [client/src/components/common/ProtectedRoute.jsx:L20-30](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/components/common/ProtectedRoute.jsx#L20-L30), [client/src/components/common/AdminRoute.jsx:L20-27](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/components/common/AdminRoute.jsx#L20-L27)

---

## 15. Missing Information and Uncertainties

1. **Stripe Client-Side Checkout**: While `PAYMENT_PROVIDERS.STRIPE` is defined as a schema enum and config variable, no frontend Stripe Elements form is present; only the simulator and Razorpay backend logic exist.
2. **Third-Party OAuth (Google/Apple Sign-In)**: The login page only supports local email/password credentials. Social login is NOT implemented.
3. **Multi-Tenant Theatre Staff Accounts**: Currently, only global `admin` and `user` roles exist. There are no intermediate roles like "Theatre Branch Manager" or "Box Office Staff".
4. **Physical Seat Map Layout Editor**: The admin interface allows configuring row counts and seat pricing, but full graphical drag-and-drop seat layout editing is not implemented; layouts are configured via JSON/form row specifications.

---

## 16. Recommendations for Diagram Generation

When generating the six project diagrams, ensure the following constraints are respected:
- **Do NOT label the project as an Apple product or video editor**.
- **Do NOT invent a microservices architecture**. The backend is a modular monolithic Express REST + Socket.IO server.
- **Do NOT invent Redis**. Seat hold expirations and locks are handled directly in MongoDB with in-memory background worker intervals (`seatExpiryJob.js`).
- **Clearly distinguish the 10 real MongoDB models** and their exact relations.
- **Explicitly illustrate the 8-minute hold state and decision branches** for concurrency conflicts and hold expiration.
