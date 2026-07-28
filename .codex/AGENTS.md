# Innogeeks Backend Agent Guide

## Source of Truth

Read [`PRD.md`](./PRD.md) for product behavior and [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) for implementation order. If this guide conflicts with the PRD, the PRD wins.

## Architecture

- Use Node.js, Express.js, Prisma, PostgreSQL, and pnpm.
- This repository is one modular monolith, not a monorepo and not a pnpm workspace.
- Business code lives under `src/modules` and follows:

```text
controller -> service -> repository -> Prisma
```

- Controllers handle HTTP only. Services own business rules. Repositories own Prisma calls.
- Instantiate dependencies once in application composition; never construct repositories or services in request handlers.
- Use transactions whenever related records must succeed or fail together.
- Keep health, configuration, database wiring, generic HTTP middleware, and generic errors outside business modules.

## Client Boundaries

```text
/api/v1/public/*  Public registration website
/api/v1/admin/*   Admin panel
/api/v1/app/*     Android app
```

All admin endpoints require server-side `ADMIN` authorization. Public and app clients never choose or receive a recruitment-cycle ID; backend services resolve the active cycle internally.

## Email Worker

The backend owns all eligibility decisions and sends complete email payloads to BullMQ. The separate worker process only sends those payloads through SMTP.

The worker must not:

- Access PostgreSQL or Prisma.
- Decide whether an email should be sent.
- Change payment, authentication, registration, or recruitment state.

Phase 1 uses only two email job types:

- `REGISTRATION_SUCCESS` after every actual `UNPAID -> PAID` transition.
- `EMAIL_VERIFICATION` for an eligible paid student's first app login when no password exists.

## Product Rules

- There is no app signup or app registration.
- Public web registration creates or reuses the global user and creates an unpaid registration in the active cycle.
- Payment status is only `UNPAID` or `PAID`; store no fee amount, payment reference, payment note, verifier, or email-delivery state.
- A registration-success email is not a verification email and contains no verification code.
- Verification codes are for first-time password setup only; never call them activation codes.
- Interviews are shared timeline information; Phase 1 has no interview-slot booking.
- Test slots are the only slot-booking feature.
- Do not add coordinator, domains, attendance, resources, sessions, forgot-password, or generic audit behavior to Phase 1 routes.

## Validation, Errors, and Tests

- Validate request bodies, parameters, queries, and dynamic form answers with Zod.
- Use stable `AppError` codes and central error handling.
- Do not call Prisma from controllers.
- Add targeted unit/integration tests with each module.
- Do not start the next implementation module until the current module's tests, complete regression suite, typecheck, Prisma validation, and build pass.
