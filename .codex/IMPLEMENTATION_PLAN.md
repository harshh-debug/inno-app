# Innogeeks Backend — Phase 1 Implementation Plan

## 1. Purpose and Delivery Rules

This plan implements the behavior defined in [`PRD.md`](./PRD.md) using the modular monolith described in [`BACKEND_ARCHITECTURE.md`](./BACKEND_ARCHITECTURE.md).

The public registration website, admin panel, and Android app use one Express backend and one PostgreSQL database. A separate email-worker process consumes BullMQ jobs from Redis and sends prepared messages through SMTP.

Implementation proceeds one module at a time. A module is complete only when:

1. Its targeted unit and integration tests pass.
2. All tests from earlier modules still pass.
3. Prisma validation and TypeScript typechecking pass.
4. The application build passes.

Do not begin the next module until the current module passes this gate.

## 2. Target Folder Structure

```text
src/
├── app.ts
├── server.ts
├── modules/
│   ├── users/
│   │   ├── user.repository.ts
│   │   ├── user.service.ts
│   │   ├── user.types.ts
│   │   ├── account-state.ts
│   │   ├── users.module.ts
│   │   └── *.test.ts
│   ├── notifications/
│   │   ├── email-queue.ts
│   │   ├── email-payload.ts
│   │   ├── notification.service.ts
│   │   ├── notifications.module.ts
│   │   └── *.test.ts
│   ├── authentication/
│   │   ├── admin-auth.controller.ts
│   │   ├── app-auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.middleware.ts
│   │   ├── auth.schemas.ts
│   │   ├── password.ts
│   │   ├── verification-code.ts
│   │   ├── token.ts
│   │   ├── authentication.module.ts
│   │   └── *.test.ts
│   ├── recruitment-cycles/
│   │   ├── recruitment-cycle.controller.ts
│   │   ├── recruitment-cycle.service.ts
│   │   ├── recruitment-cycle.repository.ts
│   │   ├── recruitment-cycle.schemas.ts
│   │   ├── recruitment-cycle.routes.ts
│   │   ├── recruitment-cycles.module.ts
│   │   └── *.test.ts
│   ├── registrations/
│   │   ├── form/
│   │   ├── public/
│   │   ├── admin/
│   │   ├── registration.service.ts
│   │   ├── registration.repository.ts
│   │   ├── registration.types.ts
│   │   ├── registration-validation.ts
│   │   ├── registrations.module.ts
│   │   └── *.test.ts
│   ├── timeline/
│   │   ├── timeline.controller.ts
│   │   ├── timeline.service.ts
│   │   ├── timeline.repository.ts
│   │   ├── timeline.schemas.ts
│   │   ├── timeline.routes.ts
│   │   ├── timeline.module.ts
│   │   └── *.test.ts
│   └── test-slots/
│       ├── test-slot.controller.ts
│       ├── test-slot.service.ts
│       ├── test-slot.repository.ts
│       ├── test-slot.schemas.ts
│       ├── test-slot.routes.ts
│       ├── test-slots.module.ts
│       └── *.test.ts
├── workers/
│   └── email/
│       ├── server.ts
│       ├── email.worker.ts
│       ├── smtp-client.ts
│       └── *.test.ts
├── common/
│   ├── errors/
│   ├── http/
│   └── validation/
├── config/
├── database/
└── health/
```

Each business module follows:

```text
controller -> service -> repository -> Prisma
```

Controllers translate HTTP requests and responses. Services own business rules. Repositories own Prisma calls and transactions.

## 3. Phase 0 — Cleanup and Foundation

### Folder and code cleanup

- Move corrected user repository, service, types, account-state logic, and tests into `src/modules/users`.
- Delete the old `src/users` and `src/auth` folders after their useful code and tests have moved.
- Replace empty module `index.ts` placeholders with module composition functions.
- Move email normalization into the users module.
- Move password hashing, code generation, verification hashing, and token generation into authentication.
- Keep generic application errors, validation helpers, and Prisma error detection under `common`.
- Keep health, configuration, database connection, server startup, and graceful shutdown behavior.

### HTTP foundation

Add route groups:

```text
/api/v1/public/*
/api/v1/admin/*
/api/v1/app/*
```

Add:

- Zod request validation middleware.
- Central application-error middleware.
- Not-found middleware.
- Request size limits.
- A consistent response format:

```json
{ "data": {} }
```

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message",
    "details": []
  }
}
```

### Database foundation

- Replace transitional development migrations with one clean Phase 1 baseline.
- Retain non-conflicting future interview-slot and audit-log models without exposing Phase 1 routes for them.
- Enforce unique normalized college email, unique academic year, one registration per user per cycle, and one test-slot booking per registration.
- Add a PostgreSQL partial unique index allowing at most one active recruitment cycle.
- Add check constraints for positive test-slot capacity and end time after start time.
- Regenerate Prisma Client.
- Update environment examples and the README.
- Add the required BullMQ, Redis client, Nodemailer, JWT, and HTTP-test dependencies.

### Phase 0 test gate

- Baseline migration applies to an empty PostgreSQL database.
- Prisma schema validation and client generation pass.
- Health tests pass.
- Typecheck and production build pass.

## 4. Module 1 — Users

### Responsibilities

- Normalize and find identities using `collegeEmail`.
- Create provisional first-year students.
- Update an existing student's submitted basic details.
- Retrieve role and suspension state.
- Derive account state.
- Provide a separate operation for controlled admin provisioning.

Public registration must never accept credential, role, or suspension fields. A newly created student always starts with:

```text
role = FIRST_YEAR_STUDENT
passwordHash = null
emailVerifiedAt = null
isSuspended = false
```

The corrected service must:

- Reuse a matching normalized college email.
- Update submitted profile details for a matching student.
- Reject a matching identity with an incompatible role.
- Support transaction-bound repositories for atomic registration.
- Expose no standalone public user-creation endpoint.

### Module 1 test gate

- Email normalization.
- Provisional student creation.
- Existing-student reuse and profile update.
- Unique-email race recovery.
- Incompatible-role rejection.
- Public input cannot set password, verification, role, or suspension.
- Full regression, typecheck, and build pass.

## 5. Module 2 — Notifications and Email Worker

Phase 1 has exactly two email use cases:

### `REGISTRATION_SUCCESS`

Queued after every real `UNPAID -> PAID` transition.

The email tells the student that registration completed successfully and may include app access instructions. It contains no verification code, activation code, fee, or payment details.

### `EMAIL_VERIFICATION`

Queued when a registered, paid, non-suspended student with no password starts first-time app login.

The email contains the first-login verification code and expiry instructions. It is separate from the registration-success email.

### Queue and worker design

- Use one BullMQ email queue backed by Redis.
- The backend decides eligibility and prepares the complete payload:

```ts
interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}
```

- The worker consumes the prepared payload and sends it using Nodemailer and SMTP.
- The worker imports no Prisma or database code.
- The worker contains no registration, payment, or authentication rules.
- Failed jobs retry five times with exponential backoff.
- Final failures are logged.
- PostgreSQL stores no email timestamp, delivery status, send count, or email payload.

### Module 2 test gate

- Both job types produce complete, correct payloads.
- Registration-success messages contain no verification or payment details.
- Verification messages contain the generated code.
- The worker sends the exact supplied payload.
- Worker dependency checks confirm no Prisma import.
- Retry configuration is correct.
- Full regression, typecheck, and build pass.

## 6. Module 3 — Authentication

### Admin authentication

Create initial admins using a controlled seed command with environment-provided college email and password.

```text
POST /api/v1/admin/auth/login
```

Admin login validates password, `ADMIN` role, and suspension state.

### App authentication

```text
POST /api/v1/app/auth/email-gate
POST /api/v1/app/auth/verification-code
POST /api/v1/app/auth/verify-code
POST /api/v1/app/auth/set-password
POST /api/v1/app/auth/login
```

The email gate internally resolves the active cycle and verifies:

- User exists and is a first-year student.
- Registration exists for the active cycle.
- Registration is `PAID`.
- User is not suspended.

It returns `PASSWORD_SETUP` or `PASSWORD_LOGIN`, without exposing cycle information.

Verification policy:

- Six-digit code.
- 10-minute expiry.
- 60-second resend cooldown.
- Five invalid attempts.
- New code invalidates older unused codes.
- Code is stored using HMAC with a server-side secret.
- Successful verification consumes the code.
- Password-setup authorization is random, hashed, single-use, and valid for 10 minutes.

Password and token policy:

- Passwords contain 8–128 characters and use scrypt.
- Password creation sets `passwordHash` and `emailVerifiedAt` together.
- Access-only JWTs are valid for seven days.
- Admin requests recheck role and suspension.
- Protected app requests recheck suspension and active-cycle paid registration.

If verification-email enqueueing fails, invalidate the newly issued code and return a service-unavailable error so the student can request another code.

### Module 3 test gate

- Admin seed and login.
- Wrong password, role, and suspension rejection.
- Unregistered, unpaid, and suspended app users are blocked.
- Correct password-setup/login routing.
- Code cooldown, expiry, invalid attempts, invalidation, and consumption.
- Raw codes and setup tokens never persist.
- Setup authorization expiry and single use.
- Password creation updates the existing user.
- Returning login rechecks payment.
- JWT and role middleware.
- Full regression, typecheck, and build pass.

## 7. Module 4 — Recruitment Cycles

Recruitment cycles are an admin-facing and backend-internal concept. Public and app clients never select or receive cycle IDs.

```text
POST  /api/v1/admin/recruitment-cycles
GET   /api/v1/admin/recruitment-cycles
GET   /api/v1/admin/recruitment-cycles/:cycleId
PATCH /api/v1/admin/recruitment-cycles/:cycleId
PATCH /api/v1/admin/recruitment-cycles/:cycleId/activate
```

Implement:

- Name and unique academic year.
- Current and historical cycle listing.
- Atomic activation that deactivates the previous active cycle.
- Historical-data preservation.
- Admin-only authorization.

### Module 4 test gate

- Creation and duplicate-year rejection.
- Admin-only access.
- At most one active cycle.
- Atomic activation and rollback.
- Old-cycle records remain unchanged.
- Public/app responses expose no cycle identifier.
- Full regression, typecheck, and build pass.

## 8. Module 5 — Registrations

### Form administration

```text
POST  /api/v1/admin/recruitment-cycles/:cycleId/form
GET   /api/v1/admin/recruitment-cycles/:cycleId/form
PATCH /api/v1/admin/forms/:formId
POST  /api/v1/admin/forms/:formId/fields
PATCH /api/v1/admin/forms/:formId/fields/:fieldId
DELETE /api/v1/admin/forms/:formId/fields/:fieldId
PUT   /api/v1/admin/forms/:formId/fields/order
```

Support all PRD field types and validation properties. Once the first submission exists, block field addition, editing, reordering, visibility changes, and deletion.

### Public registration

```text
GET  /api/v1/public/registration-form
POST /api/v1/public/registrations
```

The backend resolves the active cycle. Submission runs in one transaction:

1. Load the active cycle and form.
2. Validate student details and all dynamic answers.
3. Normalize college email.
4. Create or reuse the provisional student.
5. Update existing student details.
6. Reject an incompatible identity or duplicate same-cycle registration.
7. Create the `UNPAID` registration.
8. Snapshot and store form answers.
9. Roll back everything on failure.

Students cannot edit submissions in Phase 1.

### Admin registration operations

```text
GET   /api/v1/admin/recruitment-cycles/:cycleId/registrations
GET   /api/v1/admin/registrations/:registrationId
PATCH /api/v1/admin/registrations/:registrationId/payment-status
PATCH /api/v1/admin/registrations/:registrationId/decision
```

Support search by name, college email, application number, payment status, decision, explicit cycle, and pagination.

Payment transitions:

| Current | Requested | Behavior |
|---|---|---|
| `UNPAID` | `PAID` | Update timestamp and queue `REGISTRATION_SUCCESS` |
| `PAID` | `UNPAID` | Update timestamp; no email |
| `PAID` | `PAID` | No state change or email |
| `UNPAID` | `UNPAID` | No state change or email |

If Redis enqueueing fails after a paid transition, keep the payment update and return `emailQueued: false`. An admin retries using `PAID -> UNPAID -> PAID`.

Only paid registrations may receive a decision other than `PENDING`. Applicant responses include the optional decision note.

### Module 5 test gate

- Form CRUD, validation, ordering, and locking.
- Every supported field type and validation rule.
- Unknown, duplicate, and inactive answers are rejected.
- Atomic user, registration, and answer creation.
- Duplicate registration and concurrency handling.
- Registration search, filters, and pagination.
- Every payment transition and email-queue rule.
- Paid-only final decisions.
- No fee or payment-detail persistence.
- Full regression, typecheck, and build pass.

## 9. Module 6 — Timeline

```text
GET    /api/v1/admin/recruitment-cycles/:cycleId/timeline
POST   /api/v1/admin/recruitment-cycles/:cycleId/timeline
PATCH  /api/v1/admin/timeline/:eventId
DELETE /api/v1/admin/timeline/:eventId
PUT    /api/v1/admin/recruitment-cycles/:cycleId/timeline/order

GET /api/v1/app/timeline
```

Implement title, description, type, scheduled time, location, meeting link, instructions, visibility, display order, and shared interview-day details. The app receives only visible events for its internally resolved active-cycle paid registration.

### Module 6 test gate

- Admin-only mutations.
- Ordering and cycle isolation.
- Hidden events excluded from general app results.
- Unpaid and suspended students blocked.
- No cycle identifier exposed to the app.
- Full regression, typecheck, and build pass.

## 10. Module 7 — Test Slots

```text
GET   /api/v1/admin/recruitment-cycles/:cycleId/test-slots
POST  /api/v1/admin/recruitment-cycles/:cycleId/test-slots
PATCH /api/v1/admin/test-slots/:slotId
PUT   /api/v1/admin/recruitment-cycles/:cycleId/test-slots/order
GET   /api/v1/admin/test-slots/:slotId/bookings

GET  /api/v1/app/test-slots
GET  /api/v1/app/test-slot-booking
POST /api/v1/app/test-slot-booking
```

Implement:

- Start/end time, order, visibility, and capacity.
- Booking count and derived remaining seats.
- One booking per registration.
- Paid, authenticated, active-cycle ownership checks.
- No student cancellation or slot change in Phase 1.
- Hidden selected slots remain visible to the student who booked them.
- Capacity cannot be reduced below current bookings.
- Editing a booked slot's date/time requires explicit admin confirmation.
- Serialize booking of a slot so concurrent requests cannot overbook it.

### Module 7 test gate

- Slot validation, visibility, and ordering.
- Paid-user, ownership, and cycle checks.
- Duplicate and full-capacity rejection.
- Concurrent last-seat booking.
- Hidden selected-slot behavior.
- Capacity and booked-slot editing restrictions.
- Full regression, typecheck, and build pass.

## 11. Module 8 — App Recruitment Summary

```text
GET /api/v1/app/recruitment
```

Return backend-derived:

- Registration confirmation.
- Payment confirmation.
- Account state.
- Current decision and applicant-visible note.
- Selected test-slot summary.
- Relevant instructions.

Do not expose cycle IDs, admin-only fields, password hashes, verification records, internal actor IDs, or queue details.

### Module 8 test gate

- Suspended and unpaid access rejection.
- Pending setup and active account states.
- Every final-decision value.
- Selected, unselected, and hidden selected slots.
- Full end-to-end flow from public registration through app recruitment state.
- Full regression, typecheck, and production build pass.

## 12. Final Acceptance

Phase 1 backend is complete only when:

- PostgreSQL and Redis start through Docker Compose.
- The clean migration applies to an empty database.
- Admin seed succeeds.
- Backend and email worker start independently.
- The worker has no Prisma or product-business dependency.
- Public registration, admin management, paid/unpaid transitions, both email cases, first app login, returning login, timeline, test-slot booking, and final decisions work end to end.
- No fee or email-delivery data is stored in PostgreSQL.
- Prisma validation, generated-client consistency, typecheck, all unit/integration/concurrency tests, and production build pass.

