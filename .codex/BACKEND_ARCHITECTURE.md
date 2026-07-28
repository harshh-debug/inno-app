# Innogeeks Backend Architecture — Phase 1

## Purpose

This is one Express.js modular monolith shared by the public registration website, the Next.js admin panel, and the Android app. Modules are code-ownership boundaries inside the same backend process; they are not separate services or databases.

```text
/api/v1/public/*  Public registration website
/api/v1/admin/*   Admin panel
/api/v1/app/*     Android app
```

Controllers may differ by client, but shared business rules live in services and all Prisma access remains in repositories.

```text
controller -> service -> repository -> Prisma
```

## Module Structure

```text
src/
├── modules/
│   ├── users/
│   ├── recruitment-cycles/
│   ├── registrations/
│   │   ├── form/
│   │   ├── public/
│   │   └── admin/
│   ├── authentication/
│   ├── timeline/
│   ├── test-slots/
│   └── notifications/
├── common/
├── config/
├── database/
└── health/
```

### `users`

Owns global identity: normalized-email lookup, provisional user creation, student detail updates, suspension, and derived account state. A person is not duplicated for each recruitment cycle.

### `recruitment-cycles`

Owns admin-managed recruitment sessions such as `2025-26` and `2026-27`. A cycle scopes forms, registrations, timeline events, and test slots. Only one cycle is active. Public and app clients never choose or receive a cycle ID; backend services resolve the active cycle. Admin APIs use cycle IDs for configuration and historical data.

### `registrations`

Owns the application lifecycle: form configuration, public form retrieval, submission, answer snapshots, duplicate prevention, payment state, and final decisions.

`public` has anonymous form controllers and routes. `admin` has admin operations. Both use the same services and repositories, preventing business rules from diverging.

Form fields remain dynamic after submissions exist. New submissions use only active fields; historical answers use the snapshots stored on `FormInputSubmission`. Removing an unused field deletes it permanently, while removing a field with answers sets `isActive` to `false`. No form locking, versioning, answer migration, or backfilling is used.

Payment stores only `UNPAID`/`PAID` and `paymentStatusUpdatedAt`. An admin can change a registration from `PAID` to `UNPAID` and back to `PAID` to request another registration-success email.

### `authentication`

Owns admin and student identity verification: authorization, app email gate, first-login email code, password-setup authorization, password creation, returning login, and access tokens. Password, code, and token rules stay separate from registration business rules.

### `timeline`

Owns recruitment timeline events and shared interview-day details. Admins manage visibility and order. The app receives only visible events. Interviews have no booking feature in Phase 1.

### `test-slots`

Owns test-slot configuration and booking. It validates payment, active-cycle ownership, visibility, capacity, and one selected slot per registration. Phase 1 uses the generic name `TestSlot`, not `OnlineTestSlot`.

### `notifications`

Prepares complete messages for the email worker. It does not decide product eligibility or access Prisma. Registration requests a registration-success email after every actual `UNPAID -> PAID` transition. Authentication requests the separate first-login verification email.

## Data Ownership

```text
User (global identity)
└── RegistrationSubmission (one per user per cycle)
    ├── FormInputSubmission[]
    ├── paymentStatus + paymentStatusUpdatedAt
    ├── decision
    └── TestSlotBooking?

RecruitmentCycle (admin-managed session)
├── Form -> FormField[]
├── RegistrationSubmission[]
├── RecruitmentTimelineEvent[]
└── TestSlot[] -> TestSlotBooking[]
```

No fee amount, payment reference, payment note, payment-verifier identity, email-send timestamp, email-delivery status, or send count is stored.
