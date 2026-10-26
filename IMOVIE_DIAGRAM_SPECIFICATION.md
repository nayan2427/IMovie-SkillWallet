# iMovie Diagram Specification & Claude Generation Guide

**Document Version**: 1.0.0  
**Date**: October 26, 2026  
**Target Consumer**: Claude (or any senior diagramming AI agent)  
**Source Repository**: `nayan2427/IMovie-SkillWallet` (Verified against live codebase and 148 automated tests)

---

## Guide for Claude Diagram Generation

This document provides six mathematically verified, code-accurate specifications for generating professional architectural diagrams for the **iMovie** cinema management and online ticketing platform.

### Core Rules for Claude:
1. **Never assume Apple iMovie**: This project is a full-stack MERN cinema ticketing application named IMovies.
2. **Never invent Redis or RabbitMQ**: Concurrency holds and expirations are strictly handled directly in MongoDB with an in-memory 15-second background interval (`seatExpiryJob.js`).
3. **Never invent Microservices**: The backend is a modular monolithic Node.js / Express REST API and Socket.IO real-time server.
4. **Never invent OAuth / Social Login**: The application uses local email and bcrypt password credentials with dual-mode email verification (OTP + token link).
5. **Strictly adhere to the 10 real MongoDB models**: `User`, `Movie`, `Theatre`, `Screen`, `Show`, `ShowSeat`, `Booking`, `Payment`, `Notification`, and `WebhookEvent`.

---

# Diagram 1: Technical Architecture Diagram

### 1. Title and Objective
- **Title**: *IMovies — Full-Stack Technical Architecture & Communication Flow*
- **Objective**: Illustrate the complete system topology, separating frontend client concerns, backend middleware and services, database persistence, and third-party integrations.

### 2. Exact Nodes and Modules
- **Client Tier**:
  - `React SPA (React 18 + Vite)`
  - `Redux Store (authSlice, bookingSlice)`
  - `Axios HTTP Client (Bearer JWT + CSRF Headers)`
  - `Socket.IO Client (show room subscriptions)`
- **Server Tier**:
  - `Reverse Proxy Trust & Security Layer (Helmet, CORS, MongoSanitize, RateLimiters)`
  - `Express 4 REST Router (/api/v1/...)`
  - `Authentication & Guard Middleware (authenticate, requireAdmin, express-validator)`
  - `Socket.IO Real-Time Engine (Show-scoped rooms show:showId)`
  - `Seat Reservation Service (Atomic conditional locking & pricing)`
  - `Payment Service Abstraction (Simulator & Razorpay adapter)`
  - `Centralized Email Service (Brevo HTTPS API & Nodemailer SMTP)`
  - `Background Hold Expiry Job (15s interval worker)`
- **Data & Storage Tier**:
  - `MongoDB Atlas (10 Mongoose Collections)`
  - `Local Uploads Storage (/uploads with nosniff)`
- **External Services**:
  - `Brevo Transactional Email HTTPS API`
  - `Razorpay Payment Gateway API & Webhooks`
  - `SMTP Relay (Gmail / SES fallback)`

### 3. Relationships, Connections & Cardinalities
- `React SPA` dispatches actions to `Redux Store`.
- `React SPA` triggers HTTP requests through `Axios HTTP Client`.
- `Axios HTTP Client` sends REST requests to `Express 4 REST Router` via HTTPS.
- `React SPA` establishes persistent bi-directional WebSocket connection via `Socket.IO Client` to `Socket.IO Real-Time Engine`.
- `Express 4 REST Router` passes requests through `Reverse Proxy Trust & Security Layer` and `Authentication & Guard Middleware`.
- Middleware routes to `Seat Reservation Service`, `Payment Service Abstraction`, and `Centralized Email Service`.
- `Seat Reservation Service` executes atomic reads/writes to `MongoDB Atlas`.
- `Background Hold Expiry Job` scans `MongoDB Atlas` every 15s and invokes `Socket.IO Real-Time Engine` to broadcast releases.
- `Payment Service Abstraction` calls `Razorpay Payment Gateway API`.
- `Centralized Email Service` calls `Brevo Transactional Email HTTPS API` or `SMTP Relay`.

### 4. Direction of Arrows and Labels
- Client -> Server: `HTTPS REST (JSON)` and `WSS (Bi-directional)`
- Server -> Database: `Mongoose Queries (Atomic conditional updates)`
- Server -> External Services: `HTTPS REST / SMTP`
- Server -> Client: `Socket.IO Event Broadcast (show:showId)`

### 5. Prohibited / Unverified Details
- Do NOT include Redis, Kafka, RabbitMQ, Elasticsearch, Docker Swarm, or Kubernetes clusters.

### 6. Suggested Format
- **Type**: C4 Level 2 Container / Component Architecture Diagram.
- **Layout**: Top-to-Bottom or Left-to-Right layout with clear tier boundaries.

### 7. Syntactically Valid Mermaid Draft

```mermaid
flowchart TB
    subgraph ClientTier["Frontend Client (Cloudflare Pages CDN)"]
        SPA["React 18 SPA (Vite)"]
        Redux["Redux Toolkit Store\n(authSlice, bookingSlice)"]
        AxiosClient["Axios HTTP Client\n(Bearer JWT + CSRF Headers)"]
        SocketClient["Socket.IO Client\n(show:showId subscriptions)"]

        SPA <--> Redux
        SPA --> AxiosClient
        SPA <--> SocketClient
    end

    subgraph BackendTier["Backend Web Service (Render / Node.js 22 LTS)"]
        SecMW["Security Pipeline\n(Helmet, CORS, MongoSanitize, RateLimiters)"]
        Router["Express 4 REST Router\n(/api/v1/auth, movies, shows, bookings)"]
        AuthMW["Auth & Role Guards\n(JWT + tokenVersion + isEmailVerified)"]
        SocketEngine["Socket.IO Server\n(Show-Scoped Rooms: show:showId)"]
        
        subgraph DomainServices["Domain Service Layer"]
            SeatService["SeatReservationService\n(Atomic Hold, Race Rollback, Pricing)"]
            PayService["PaymentService\n(Simulator & Razorpay Adapter)"]
            EmailService["EmailService\n(Brevo HTTPS API & SMTP Transporter)"]
            ExpiryWorker["SeatExpiryJob\n(15-second Interval Hold Worker)"]
        end
    end

    subgraph DataTier["Persistence Tier (MongoDB Atlas)"]
        Mongo[("MongoDB Database\n(10 Collections via Mongoose 8)")]
        Uploads[("Static Media Directory\n/uploads (nosniff)")]
    end

    subgraph ExternalTier["External Integrations"]
        BrevoAPI["Brevo HTTPS API\n(v3/smtp/email)"]
        SMTPRelay["Gmail / Custom SMTP Relay"]
        RazorpayAPI["Razorpay Orders & Webhook API"]
    end

    AxiosClient -->|"HTTPS REST (JSON)"| SecMW
    SecMW --> Router
    Router --> AuthMW
    AuthMW --> SeatService
    AuthMW --> PayService
    AuthMW --> EmailService

    SocketClient <-->|"WSS (join-show, seat-hold-created)"| SocketEngine
    ExpiryWorker -->|"Scan Expired Holds (15s)"| Mongo
    ExpiryWorker -->|"Broadcast Releases"| SocketEngine
    SeatService -->|"Broadcast Hold & Confirmed"| SocketEngine

    SeatService -->|"Atomic updateMany (O(1))"| Mongo
    PayService -->|"Audit Transactions"| Mongo
    Router -->|"Upload Poster / Backdrop"| Uploads

    EmailService -->|"HTTPS REST"| BrevoAPI
    EmailService -->|"TLS 587/465"| SMTPRelay
    PayService -->|"Create Order & Verify Signature"| RazorpayAPI
```

---

# Diagram 2: Entity-Relationship (ER) Diagram

### 1. Title and Objective
- **Title**: *IMovies — Relational Data Schema & Entity Constraints*
- **Objective**: Model the exact 10 database entities, their primary keys, foreign keys, unique constraints, and relationship cardinalities as declared in Mongoose.

### 2. Exact Entities and Attributes

1. **USER (`users`)**:
   - `_id`: ObjectId [PK]
   - `email`: String [UK]
   - `passwordHash`: String
   - `role`: Enum ('user', 'admin')
   - `accountStatus`: Enum ('active', 'suspended', 'deleted')
   - `tokenVersion`: Number
   - `isEmailVerified`: Boolean
   - `emailVerificationTokenHash`: String
   - `emailVerificationOtpHash`: String
   - `passwordResetTokenHash`: String
2. **THEATRE (`theatres`)**:
   - `_id`: ObjectId [PK]
   - `name`: String
   - `slug`: String [UK]
   - `city`: String
   - `address`: String
   - `isActive`: Boolean
3. **SCREEN (`screens`)**:
   - `_id`: ObjectId [PK]
   - `theatre`: ObjectId [FK -> THEATRE]
   - `name`: String
   - `screenType`: Enum ('Standard', 'IMAX', '4DX', 'Dolby Atmos', 'Gold Class')
   - `totalSeats`: Number
   - `seatingLayout`: Object
   - `isActive`: Boolean
   - *Index*: `[theatre, name]` [UK]
4. **MOVIE (`movies`)**:
   - `_id`: ObjectId [PK]
   - `title`: String
   - `slug`: String [UK]
   - `duration`: Number
   - `certification`: Enum ('U', 'UA', 'A', 'PG', 'PG-13', 'R')
   - `status`: Enum ('now_showing', 'coming_soon', 'archived')
   - `genres`: Array
5. **SHOW (`shows`)**:
   - `_id`: ObjectId [PK]
   - `movie`: ObjectId [FK -> MOVIE]
   - `theatre`: ObjectId [FK -> THEATRE]
   - `screen`: ObjectId [FK -> SCREEN]
   - `startTime`: Date
   - `endTime`: Date
   - `basePrice`: Number
   - `status`: Enum ('scheduled', 'running', 'completed', 'cancelled')
6. **SHOW_SEAT (`showseats`)**:
   - `_id`: ObjectId [PK]
   - `show`: ObjectId [FK -> SHOW]
   - `seatNumber`: String
   - `category`: Enum ('SILVER', 'GOLD', 'PLATINUM')
   - `price`: Number
   - `status`: Enum ('AVAILABLE', 'HELD', 'BOOKED', 'BLOCKED')
   - `heldBy`: ObjectId [FK -> USER, Nullable]
   - `heldUntil`: Date [Nullable]
   - `holdToken`: String [Nullable]
   - `booking`: ObjectId [FK -> BOOKING, Nullable]
   - *Index*: `[show, seatNumber]` [UK]
7. **BOOKING (`bookings`)**:
   - `_id`: ObjectId [PK]
   - `bookingReference`: String [UK]
   - `user`: ObjectId [FK -> USER]
   - `show`: ObjectId [FK -> SHOW]
   - `totalAmount`: Number
   - `convenienceFee`: Number
   - `grandTotal`: Number
   - `status`: Enum ('pending', 'confirmed', 'cancelled', 'expired')
   - `paymentStatus`: Enum ('pending', 'success', 'failed', 'refunded')
   - `holdToken`: String
   - `expiresAt`: Date
   - `qrCode`: String
8. **PAYMENT (`payments`)**:
   - `_id`: ObjectId [PK]
   - `booking`: ObjectId [FK -> BOOKING]
   - `user`: ObjectId [FK -> USER]
   - `amount`: Number
   - `provider`: Enum ('simulated', 'razorpay', 'stripe')
   - `providerPaymentId`: String [UK, Sparse]
   - `status`: Enum ('pending', 'success', 'failed', 'refunded')
   - `method`: String
9. **NOTIFICATION (`notifications`)**:
   - `_id`: ObjectId [PK]
   - `user`: ObjectId [FK -> USER]
   - `type`: Enum ('booking_confirmed', 'booking_cancelled', 'hold_expired', 'reminder', 'system')
   - `title`: String
   - `read`: Boolean
10. **WEBHOOK_EVENT (`webhookevents`)**:
    - `_id`: ObjectId [PK]
    - `eventId`: String [UK]
    - `provider`: String
    - `receivedAt`: Date [TTL 7 days]

### 3. Relationship Cardinalities
- `THEATRE` 1 -- * `SCREEN`
- `THEATRE` 1 -- * `SHOW`
- `SCREEN` 1 -- * `SHOW`
- `MOVIE` 1 -- * `SHOW`
- `SHOW` 1 -- * `SHOW_SEAT`
- `USER` 1 -- * `BOOKING`
- `SHOW` 1 -- * `BOOKING`
- `BOOKING` 1 -- 1 `PAYMENT`
- `USER` 1 -- * `PAYMENT`
- `USER` 1 -- * `NOTIFICATION`
- `SHOW_SEAT` * -- 0..1 `USER` (`heldBy`)
- `SHOW_SEAT` * -- 0..1 `BOOKING` (`booking`)

### 4. Syntactically Valid Mermaid Draft

```mermaid
erDiagram
    USER ||--o{ BOOKING : "places"
    USER ||--o{ PAYMENT : "makes"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ SHOW_SEAT : "holds (heldBy)"

    THEATRE ||--|{ SCREEN : "contains"
    THEATRE ||--o{ SHOW : "hosts"
    SCREEN ||--o{ SHOW : "screens"
    MOVIE ||--o{ SHOW : "features"

    SHOW ||--|{ SHOW_SEAT : "inventories"
    SHOW ||--o{ BOOKING : "contains"

    BOOKING ||--|| PAYMENT : "generates"
    BOOKING ||--o{ SHOW_SEAT : "reserves (booking)"

    USER {
        ObjectId id PK
        string email UK
        string passwordHash
        string role
        string accountStatus
        int tokenVersion
        boolean isEmailVerified
        string emailVerificationTokenHash
        string emailVerificationOtpHash
        date emailVerifiedAt
    }

    THEATRE {
        ObjectId id PK
        string name
        string slug UK
        string city
        string address
        boolean isActive
    }

    SCREEN {
        ObjectId id PK
        ObjectId theatre FK
        string name
        string screenType
        int totalSeats
        object seatingLayout
        boolean isActive
    }

    MOVIE {
        ObjectId id PK
        string title
        string slug UK
        string synopsis
        int duration
        string certification
        string status
        float rating
    }

    SHOW {
        ObjectId id PK
        ObjectId movie FK
        ObjectId theatre FK
        ObjectId screen FK
        date startTime
        date endTime
        float basePrice
        string status
    }

    SHOW_SEAT {
        ObjectId id PK
        ObjectId show FK
        string seatNumber
        string row
        int number
        string category
        float price
        string status
        ObjectId heldBy FK
        date heldUntil
        string holdToken
        ObjectId booking FK
    }

    BOOKING {
        ObjectId id PK
        string bookingReference UK
        ObjectId user FK
        ObjectId show FK
        float totalAmount
        float convenienceFee
        float grandTotal
        string status
        string paymentStatus
        date expiresAt
        string qrCode
    }

    PAYMENT {
        ObjectId id PK
        ObjectId booking FK
        ObjectId user FK
        float amount
        string provider
        string providerPaymentId UK
        string status
        string method
    }

    NOTIFICATION {
        ObjectId id PK
        ObjectId user FK
        string type
        string title
        string message
        boolean read
    }

    WEBHOOK_EVENT {
        ObjectId id PK
        string eventId UK
        string provider
        date receivedAt
    }
```

---

# Diagram 3: Feature Map & Functional Hierarchy

### 1. Title and Objective
- **Title**: *IMovies — Comprehensive Feature Decomposition & Functional Map*
- **Objective**: Display the hierarchical organization of implemented features divided into customer discovery, booking/concurrency engine, payment workflows, and administration tools.

### 2. Main Feature Groups
1. **Identity & Security**: Registration, Dual Email Verification (OTP + link), Login, Session Invalidation (`tokenVersion`), Password Reset, Profile Management.
2. **Movie & Venue Discovery**: Text Search (ReDoS-protected), Filters (Genres, Languages, Now Showing, Coming Soon), YouTube Trailer Modal, City/Auditorium Format Browsing.
3. **Seating & Real-Time Engine**: Interactive SVG/DOM Seat Map, Silver/Gold/Platinum Tiers, Live Socket.IO Updates (`show:${showId}`), Atomic Concurrency Hold, 8-Min Countdown.
4. **Checkout & Ticketing**: Server-authoritative Pricing, Sandbox Simulator, Razorpay Order Creation & HMAC Verification, Printable Ticket with QR Code, 2-Hour Cancellation Rule.
5. **Administration Suite**: Executive Dashboard Metrics (Real DB Revenue), Movie Management, Screen Layout Editor, Overlap Collision Prevention Scheduler, Booking Audit & Override Refund, User Suspension.

### 3. Syntactically Valid Mermaid Draft

```mermaid
flowchart TD
    Root["IMovies Platform Features"]

    subgraph M1["1. Identity & Security Module"]
        M1_1["User Registration with Complexity Rules"]
        M1_2["Dual Verification (6-digit OTP & 32-byte Link)"]
        M1_3["Anti-Enumeration Neutral Responses"]
        M1_4["Session Revocation via tokenVersion"]
        M1_5["Forgot & Reset Password Workflow"]
        M1_6["Profile Update with Reverification"]
    end

    subgraph M2["2. Discovery & Catalog Module"]
        M2_1["Movie Search with ReDoS Sanitization"]
        M2_2["Status Filtering (Now Showing / Coming Soon)"]
        M2_3["YouTube Safe Iframe Trailer Preview"]
        M2_4["Multiplex & Screen Format Discovery (IMAX, 4DX)"]
    end

    subgraph M3["3. Real-Time Seat Engine"]
        M3_1["Tiered Seat Grid (Silver, Gold, Platinum)"]
        M3_2["Authoritative Show-Scoped Socket.IO Rooms"]
        M3_3["Atomic Conditional Hold (All-or-Nothing)"]
        M3_4["8-Minute Hold Countdown Timer"]
        M3_5["15-Second Background Hold Expiry Worker"]
    end

    subgraph M4["4. Payments & Ticketing Module"]
        M4_1["Server-Authoritative Pricing & Fees"]
        M4_2["Interactive Development Payment Simulator"]
        M4_3["Razorpay HMAC-SHA256 Signature Verification"]
        M4_4["Printable E-Tickets with Scannable QR Codes"]
        M4_5["2-Hour Cutoff Cancellation & Automatic Refunds"]
        M4_6["In-App User Notifications"]
    end

    subgraph M5["5. Administration Suite"]
        M5_1["Executive Dashboard (Verified Revenue Analytics)"]
        M5_2["Movie CRUD & Secure Media Upload"]
        M5_3["Auditorium & Seating Layout Manager"]
        M5_4["Intelligent Scheduler with Overlap Collision Blocking"]
        M5_5["Booking Audit & Administrative Refund Override"]
        M5_6["Customer Account Suspension Toggle"]
    end

    Root --> M1
    Root --> M2
    Root --> M3
    Root --> M4
    Root --> M5
```

---

# Diagram 4: Roles and Responsibilities (RBAC & Use Case)

### 1. Title and Objective
- **Title**: *IMovies — Role-Based Access Control (RBAC) & Use Case Diagram*
- **Objective**: Contrast the exact access privileges, boundaries, and capabilities of Unauthenticated Guests, Verified Customers, and System Administrators.

### 2. Actors & Boundaries
- **Actor 1: Guest (Unauthenticated Visitor)**
  - Access to public pages (`/`, `/movies`, `/theatres`, `/book/:showId` read-only).
  - Can submit registration and password recovery.
- **Actor 2: Verified Customer (`role: 'user'`)**
  - Requires `isEmailVerified: true` and `accountStatus: 'active'`.
  - Can claim 8-minute seat holds.
  - Can checkout, pay, view QR tickets, view `/my-bookings`, and cancel eligible tickets.
- **Actor 3: Administrator (`role: 'admin'`)**
  - Inherits all customer privileges.
  - Guarded by `AdminRoute.jsx` and `requireAdmin` middleware.
  - Full access to `/admin/*` operations.

### 3. Syntactically Valid Mermaid Draft

```mermaid
flowchart LR
    Guest["Guest\n(Unauthenticated)"]
    Customer["Customer\n(role: 'user', verified)"]
    Admin["Administrator\n(role: 'admin')"]

    subgraph PublicBoundary["Public Customer Scope"]
        UC1["Browse Movies & Search Catalog"]
        UC2["Preview Trailers (YouTube Modal)"]
        UC3["View Auditorium Seat Layout"]
        UC4["Register Account & Verify OTP/Link"]
        UC5["Login & Request Password Reset"]
    end

    subgraph CustomerBoundary["Verified Customer Scope (Auth Guard)"]
        UC6["Claim Atomic Seat Hold (Max 10 seats)"]
        UC7["Complete Sandbox / Gateway Payment"]
        UC8["View & Print QR Code E-Ticket"]
        UC9["View My Booking History"]
        UC10["Cancel Booking (>= 2h Cutoff)"]
        UC11["Update Profile & Change Email"]
    end

    subgraph AdminBoundary["Administration Scope (Admin Guard)"]
        UC12["View Executive Revenue & Booking Analytics"]
        UC13["Movie CRUD & Media Uploads"]
        UC14["Theatre & Screen Layout Configuration"]
        UC15["Schedule Shows (Overlap Blocked)"]
        UC16["Audit All Bookings & Override Cancellation"]
        UC17["Toggle User Suspension"]
    end

    Guest --> UC1
    Guest --> UC2
    Guest --> UC3
    Guest --> UC4
    Guest --> UC5

    Customer --> UC1
    Customer --> UC2
    Customer --> UC3
    Customer --> UC6
    Customer --> UC7
    Customer --> UC8
    Customer --> UC9
    Customer --> UC10
    Customer --> UC11

    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
    Admin --> UC12
    Admin --> UC13
    Admin --> UC14
    Admin --> UC15
    Admin --> UC16
    Admin --> UC17
```

---

# Diagram 5: End-to-End User Flow & Decision Points

### 1. Title and Objective
- **Title**: *IMovies — Complete Ticket Reservation, Concurrency & Payment Lifecycle*
- **Objective**: Document the exact user journey with all branching logic (unauthenticated, seat conflict, hold expiry, payment decline, and successful ticket issuance).

### 2. Decision Branches
- `Is User Authenticated & Verified?` -> If No: redirect to `/login?redirect=...`.
- `Are Selected Seats Available?` -> Atomic update test:
  - If `modifiedCount !== seatNumbers.length`: 409 Conflict rollback -> Alert user and reload seat inventory.
  - If Success: Lock seats, start 8-minute timer.
- `Has 8-minute Hold Expired before Payment Confirmation?`
  - If Yes: Trigger automatic refund path, release seats, return 410 Expired.
  - If No: Convert seats to `BOOKED`, generate QR code, trigger confirmation email.

### 3. Syntactically Valid Mermaid Draft

```mermaid
flowchart TD
    Start(["User visits IMovies"]) --> Browse["Browse Catalog on HomePage / MoviesPage"]
    Browse --> SelectMovie["Selects Movie & Views Details / Trailer"]
    SelectMovie --> ChooseShow["Chooses Theatre, Date & Showtime"]
    ChooseShow --> OpenSeatMap["Opens SeatSelectionPage (/book/:showId)"]
    OpenSeatMap --> WSJoin["Client joins Socket.IO room (show:showId)"]
    WSJoin --> PickSeats["Selects Seats (1 to 10 seats)"]

    PickSeats --> ClickHold{"Clicks 'Hold & Checkout'"}
    ClickHold --> CheckAuth{"Is User Authenticated\n& Verified?"}
    
    CheckAuth -- "No" --> RedirectLogin["Redirect to /login?redirect=/book/:showId"]
    RedirectLogin --> AuthSuccess["User logs in or verifies email"] --> PickSeats

    CheckAuth -- "Yes" --> PostHold["POST /api/v1/bookings/hold"]
    PostHold --> AtomicUpdate{"Atomic MongoDB updateMany:\nmodifiedCount == requestedCount?"}

    AtomicUpdate -- "No (Seats Taken)" --> ConflictRollback["Rollback touched seats\nReturn 409 Conflict"]
    ConflictRollback --> ConflictAlert["Display toast warning\nAuto-refresh authoritative seats"] --> PickSeats

    AtomicUpdate -- "Yes (Locked)" --> CreatePending["Create pending Booking (expiresAt: now + 8m)\nGenerate holdToken"]
    CreatePending --> WSBroadcast["Broadcast 'seat-hold-created' to room"]
    WSBroadcast --> OpenModal["Open PaymentModal with 8-min Countdown"]

    OpenModal --> SelectPayment["Selects Payment Method\n(Card / UPI / NetBanking)"]
    SelectPayment --> SubmitPay["Clicks 'Pay Now'"]
    SubmitPay --> OrderGen["POST /bookings/create-order & /payments/simulate"]

    OrderGen --> ConfirmPost["POST /api/v1/bookings/confirm"]
    ConfirmPost --> ExpiryCheck{"Has 8-min Hold Expired\nor Seats Invalid?"}

    ExpiryCheck -- "Yes (Hold Expired)" --> AutoRefund["Trigger Payment Refund\nMark Booking EXPIRED (410)"]
    AutoRefund --> ReleaseSeats["Release seats to AVAILABLE\nAlert Customer"] --> OpenSeatMap

    ExpiryCheck -- "No (Valid)" --> FinalizeBooking["Atomically mark seats BOOKED\nGenerate QR Code Data URL\nRecord Payment Audit Log"]
    FinalizeBooking --> DispatchEmail["Send Confirmation Email (Brevo / SMTP)\nCreate In-App Notification"]
    DispatchEmail --> ConfirmedWS["Broadcast 'booking-confirmed' to room"]
    ConfirmedWS --> ConfirmationPage["Redirect to /booking-confirmation/:id\nDisplay Confetti & Printable E-Ticket"]
    ConfirmationPage --> End(["Booking Complete"])
```

---

# Diagram 6: Modern Decoupled MVC Interaction Flow

### 1. Title and Objective
- **Title**: *IMovies — Modern Decoupled MVC Pattern & Request Lifecycle*
- **Objective**: Explain how the React SPA presentation layer (View), Express controllers and routing (Controller), domain services, and Mongoose ODM models (Model) interact.

### 2. Layer Definitions & Real Source File Anchors
- **View (Presentation Layer)**:
  - React 18 Components & Pages ([client/src/pages/SeatSelectionPage.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/pages/SeatSelectionPage.jsx), [PaymentModal.jsx](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/components/booking/PaymentModal.jsx)).
  - Client state in Redux Toolkit ([bookingSlice.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/client/src/store/bookingSlice.js)).
- **Controller (Coordination Layer)**:
  - Express Route Dispatchers ([routes/bookingRoutes.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/routes/bookingRoutes.js)).
  - Controller request handlers ([bookingController.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/controllers/bookingController.js)).
  - Middleware guards (`authenticate`, `holdLimiter`, `holdSeatsValidator`).
- **Service Layer (Domain Business Logic)**:
  - Business transactions ([services/seatReservationService.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/services/seatReservationService.js)).
  - Payment adapter ([services/paymentService.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/services/paymentService.js)).
- **Model (Persistence & Schema Layer)**:
  - Mongoose models ([models/ShowSeat.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/ShowSeat.js), [models/Booking.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Booking.js), [models/Payment.js](file:///c:/Users/nayan/OneDrive/Desktop/WEB%20COURESE/4_th/IMovie-SkillWallet/server/src/models/Payment.js)).
  - MongoDB database engine.

### 3. Syntactically Valid Mermaid Draft

```mermaid
sequenceDiagram
    autonumber
    participant V as View (React 18 SPA / Redux)
    participant C as Controller (Express Route & bookingController)
    participant S as Service Layer (seatReservationService)
    participant M as Model (Mongoose: ShowSeat, Booking, Payment)
    participant DB as Database (MongoDB Atlas)
    participant WS as Real-Time Engine (Socket.IO show:showId)

    Note over V,DB: Step 1: Requesting Temporary Concurrency Hold
    V->>C: POST /api/v1/bookings/hold { showId, seats: ['C4', 'C5'] }
    C->>C: Run holdLimiter, authenticate & holdSeatsValidator
    C->>S: holdSeats({ showId, seatNumbers, user })
    S->>M: ShowSeat.updateMany({ show, seatNumber, status: AVAILABLE })
    M->>DB: Atomic conditional update
    DB-->>M: WriteResult (modifiedCount: 2)
    M-->>S: updateResult
    S->>M: Booking.create({ status: 'pending', expiresAt: +8m })
    M->>DB: Insert Booking document
    DB-->>M: Created Booking Record
    S->>WS: broadcastSeatHold(showId, ['C4', 'C5'], expiresAt)
    WS-->>V: WebSocket Event 'seat-hold-created' (amber seat lock)
    S-->>C: { bookingId, holdToken, grandTotal, expiresAt }
    C-->>V: 201 Created JSON Response

    Note over V,DB: Step 2: Payment Execution & Booking Confirmation
    V->>C: POST /api/v1/bookings/confirm { bookingId, paymentId, method }
    C->>S: confirmBookingPayment({ bookingId, paymentResult, user })
    S->>M: Booking.findById(bookingId) & ShowSeat.find(heldUntil > now)
    M->>DB: Query booking & active holds
    DB-->>M: Verified active records
    S->>M: ShowSeat.updateMany({ holdToken }, { status: 'BOOKED' })
    M->>DB: Atomic convert HELD -> BOOKED
    S->>M: Payment.create({ bookingId, providerPaymentId, status: SUCCESS })
    M->>DB: Insert Payment audit log
    S->>M: Booking.save({ status: 'confirmed', qrCode })
    M->>DB: Update Booking record
    S->>WS: broadcastBookingConfirmed(showId, ['C4', 'C5'])
    WS-->>V: WebSocket Event 'booking-confirmed' (dark red/booked)
    S-->>C: Confirmed Booking Entity with QR Code
    C-->>V: 200 OK JSON Response with E-Ticket Data
    V->>V: Render BookingConfirmationPage & trigger confetti burst
```

---

## Summary Checklist for Claude

When Claude is prompted to generate final images or diagrams from this specification:
1. Use Diagram 1 for **Architecture**.
2. Use Diagram 2 for **Database / ER Modeling**.
3. Use Diagram 3 for **Features & Product Capabilities**.
4. Use Diagram 4 for **User Roles, RBAC & Use Cases**.
5. Use Diagram 5 for **User Journey & Concurrency Decision Flow**.
6. Use Diagram 6 for **Decoupled MVC Pattern & Request Lifecycle**.
