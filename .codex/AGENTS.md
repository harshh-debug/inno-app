# AGENTS.md

## Purpose

This file gives coding agents the minimum implementation guidance required for the Innogeeks backend.

For complete product behavior, user states, recruitment flow, admin responsibilities, scope, and open decisions, read:

```text
PRD.md
```

`PRD.md` is the product source of truth.

When a task is unclear or affects business behavior, consult `PRD.md` before implementing.

---

## Project Direction

The backend serves:

- The mobile app.
- The Next.js admin panel.
- A future web registration form.

Use:

- Node.js.
- Express.js.
- Prisma.
- PostgreSQL.
- pnpm.

Use `pnpm`, not `npm`.

This is not a monorepo.

Do not introduce:

- pnpm workspaces.
- A packages-based monorepo structure.
- Multiple business services without a clear requirement.

The backend is a single modular monolith.

It owns:

- APIs.
- Authentication and authorization.
- Business logic.
- Prisma.
- PostgreSQL access.
- Registration.
- Payment verification.
- Activation.
- Recruitment timeline.
- Selection.
- Domain assignment.
- Admin operations.

A separate lightweight email worker only sends emails.

The worker must not:

- Access the database.
- Use Prisma.
- Own business rules.
- Change applicant state.
- Decide whether an email should be sent.

---

## Product State Rules

Do not collapse these into one status:

- Authentication.
- Registration.
- Payment verification.
- Activation-code issuance.
- Activation-code redemption.
- Paid-user state.
- Recruitment decision.
- Domain assignment.
- Platform role.

Important rules:

1. Registration does not make the user paid.
2. Payment verification does not make the user paid.
3. Successful activation-code redemption makes the user paid.
4. A paid user is not automatically selected.
5. Only admins finalize selection.
6. Admins assign final domains.
7. Registration-domain preferences are not assignments.
8. Only selected users receive final domain assignments.

Read `PRD.md` for the complete state model and recruitment flow.

---

## Express Architecture

Although this is Express.js, write code in a modular, class-based style similar to NestJS.

Use domain modules such as:

```text
auth
users
forms
registrations
payments
activation
recruitment
domains
admin
email
```

A module may contain:

```text
registration/
  registration.controller.ts
  registration.service.ts
  registration.repository.ts
  registration.routes.ts
  registration.validation.ts
  registration.types.ts
```

Follow the existing repository layout when it already provides a clear equivalent.

---

## Controllers

Use controller classes.

Controllers should:

- Receive Express requests.
- Read validated input.
- Call service methods.
- Return HTTP responses.
- Map known application errors to HTTP status codes.

Controllers should not:

- Contain business logic.
- Call Prisma directly.
- Decide eligibility.
- Generate activation codes.
- Send emails directly.

Prefer constructor injection.

```ts
export class RegistrationController {
  constructor(
    private readonly registrationService: RegistrationService,
  ) {}

  submit = async (req: Request, res: Response) => {
    const result = await this.registrationService.submit({
      userId: req.user.id,
      input: req.body,
    });

    res.status(201).json(result);
  };
}
```

Use arrow methods or bind methods correctly so `this` is preserved.

---

## Services

Services own business logic and state transitions.

Examples:

- Submit a registration.
- Verify payment.
- Issue an activation code.
- Redeem an activation code.
- Build a timeline.
- Finalize a decision.
- Assign domains.

Use service classes with constructor-injected dependencies.

Do not create one large service for the whole application.

---

## Repositories and Prisma

Prisma exists only inside the main backend.

Repositories should contain database queries.

Services should contain business decisions.

Do not call Prisma from controllers.

Use Prisma transactions when related changes must succeed or fail together.

Examples:

- Payment verification and activation-code creation.
- Decision update and audit record.
- Domain assignment and audit record.

Construct Prisma, repositories, services, and controllers once in the application composition layer.

Do not instantiate them inside each request handler.

---

## Dynamic Forms

The backend controls the registration form.

The app and future web form render the backend definition.

The backend must validate every submission.

Published forms must preserve historical submissions through form versioning or an equivalent explicit mechanism.

Read `PRD.md` before changing form behavior, submission rules, or versioning.

---

## Activation and Email

Activation codes must:

- Be generated securely.
- Be stored as hashes.
- Expire.
- Limit invalid attempts.
- Be invalidated after successful use.
- Support admin-authorized reissue.
- Never be logged.
- Never be exposed through admin APIs.

The backend decides when an email should be sent and prepares the email payload.

The email worker only delivers it.

Do not move recruitment logic into the worker.

---

## Validation and Errors

Use runtime request validation.

Prefer the validation library already present in the repository.

Validate:

- Request bodies.
- Route parameters.
- Query parameters.
- Dynamic-form answers.
- Admin actions.

Use stable application error codes, such as:

```text
REGISTRATION_ALREADY_SUBMITTED
PAYMENT_NOT_VERIFIED
ACTIVATION_CODE_INVALID
ACTIVATION_CODE_EXPIRED
ACTIVATION_ALREADY_COMPLETED
USER_NOT_ELIGIBLE_FOR_SELECTION
DOMAIN_ASSIGNMENT_REQUIRES_SELECTION
```

---

## Authorization and Audit

Protect all admin endpoints in the backend.

Do not trust the client to determine roles.

Audit sensitive actions, including:

- Payment verification.
- Activation-code reissue.
- Form publication.
- Timeline updates.
- Decision changes.
- Domain assignment changes.

Audit records belong in the main PostgreSQL database.

---

## Scope Control

Current scope includes:

- Authentication.
- Dynamic forms.
- Registration.
- Manual payment verification.
- Activation codes.
- Email-worker integration.
- Timeline.
- Test and interview details.
- Final selection.
- Domain assignment.
- Authorization.
- Audit logging.

Do not implement the following unless explicitly requested:

- Payment gateway.
- Resources.
- Sessions.
- Attendance.
- Attendance analytics.
- Push notifications.
- Mobile UI decisions.

Read `PRD.md` for the detailed scope and future product direction.

---

## Agent Rules

1. Read `PRD.md` when product behavior is unclear.
2. Inspect the existing code before introducing a new pattern.
3. Use `pnpm`, not `npm`.
4. Keep one Express modular monolith.
5. Do not introduce a monorepo or pnpm workspaces.
6. Keep Prisma and PostgreSQL inside the backend.
7. Keep the email worker simple and database-free.
8. Use NestJS-like classes, constructors, controllers, services, and repositories.
9. Keep controllers thin.
10. Keep business logic in services.
11. Keep Prisma queries out of controllers.
12. Preserve separate registration, payment, activation, selection, and domain states.
13. Admins finalize selected users and domain assignments.
14. Do not add mobile UI decisions.
15. Do not implement future scope without an explicit task.
16. Add or update tests when business behavior changes.
17. When code and `PRD.md` conflict, do not guess; identify the conflict before changing behavior.
