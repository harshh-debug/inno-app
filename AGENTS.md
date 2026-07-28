# Innogeeks Backend Agent Guide

## Source of Truth

Read [`.codex/PRD.md`](./.codex/PRD.md) for product behavior and [`.codex/IMPLEMENTATION_PLAN.md`](./.codex/IMPLEMENTATION_PLAN.md) for implementation order. If this guide conflicts with the PRD, the PRD wins.

Use [`.codex/BACKEND_ARCHITECTURE.md`](./.codex/BACKEND_ARCHITECTURE.md) for module ownership and folder-boundary decisions.

## Architecture

* Use Node.js, Express.js, Prisma, PostgreSQL, and pnpm.
* This repository is one modular monolith, not a monorepo or pnpm workspace.
* Business code lives under `src/modules` and follows:

```text
routes -> controller -> service -> repository -> Prisma
```

* Although Express is used, organize modules in a NestJS-inspired, class-based style.
* Controllers, services, and repositories should be classes with clearly named methods.
* Pass dependencies through constructors and instantiate them once during application startup.
* Routes only connect middleware and controller methods.
* Controllers handle HTTP concerns only.
* Services own business rules, authorization checks, workflows, and transaction boundaries.
* Repositories own Prisma queries.
* Never instantiate services or repositories inside request handlers.
* Do not use NestJS decorators, NestJS modules, or a dependency-injection framework.
* Keep configuration, database wiring, shared middleware, health checks, and generic errors outside business modules.


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

### Dynamic forms

- Form fields remain editable after registrations exist; do not add blanket form locking or form versioning.
- Public form queries and new-submission validation use only `isActive = true` fields.
- Deleting a field with no `FormInputSubmission` rows deletes it permanently.
- Deleting a field with submitted answers sets `isActive = false` and preserves answers.
- Historical views use `FormInputSubmission` snapshots, not only current active fields.
- Never backfill new fields or migrate existing answers.

## Validation, Errors, and Tests

- Validate request bodies, parameters, queries, and dynamic form answers with Zod.
- Use stable `AppError` codes and central error handling.
- Do not call Prisma from controllers.
- Verify each module through its required end-to-end API scenarios with manual `curl` requests against running services.
- Do not start the next implementation module until the current module's manual end-to-end scenarios, typecheck, Prisma validation, and build pass.
