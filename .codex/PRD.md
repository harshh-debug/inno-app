# Innogeeks Platform — Product Requirements Document

## 1. Document Purpose

This document is the product source of truth for Phase 1 of the Innogeeks first-year recruitment platform.

Phase 1 covers:

- Public web registration.
- Creation of first-year users in the shared database.
- Manual payment verification by admins.
- Registration-success email after an admin marks the registration paid.
- Paid-only app login.
- First-login email verification and password setup.
- Recruitment timeline.
- Test-slot booking.
- Final recruitment decision.
- Admin operations required for these flows.

Coding agents must consult this document whenever product behavior is unclear.

This document intentionally does not define mobile UI layouts or visual design.

---

## 2. Product Summary

Innogeeks is building a platform to manage first-year student recruitment.

There are three clients:

1. Public web registration form.
2. First-year mobile app.
3. Next.js admin panel.

All clients use:

- One Express.js backend.
- One PostgreSQL database.
- The same user and registration records.

There is no app-based registration or signup flow in Phase 1.

Every first-year student must first register through the public web form. The app is used only after an admin has verified payment and marked the registration as paid.

---

## 3. High-Level User Types

```text
FIRST_YEAR_STUDENT
COORDINATOR
ADMIN
```

These are platform roles.

The following are states, not roles:

- Registered.
- Unpaid.
- Paid.
- Selected.
- Waitlisted.
- Rejected.

Do not create roles such as:

```text
PAID_USER
UNPAID_USER
SELECTED_USER
```

### 3.1 First-Year Student

Phase 1 recruitment flows apply only to first-year students.

A first-year student:

- Registers through the public web form.
- Is initially unpaid.
- Is manually marked paid by an admin.
- Receives a registration-success email.
- Logs into the app using the registered email.
- Verifies the email and creates a password on first login.
- Views the recruitment timeline.
- Books a test slot.
- Later sees the final recruitment decision.

### 3.2 Coordinator

Coordinator functionality is deferred.

Future coordinator features may include:

- Attendance.
- Resource sharing.
- Sessions.
- Domain-specific operations.

Coordinators do not use the first-year registration and payment flow.

### 3.3 Admin

Admins use the Next.js admin panel.

In Phase 1, admins manage:

- Dynamic web registration fields.
- Registered first-year users.
- Paid and unpaid state.
- Recruitment timeline details.
- Test slots.
- Final selected, waitlisted, or rejected decisions.

Domain assignment is excluded from Phase 1.

---

## 4. Technical Direction

Use:

- Node.js.
- Express.js.
- Prisma.
- PostgreSQL.
- Next.js for the admin panel.
- pnpm as the package manager.

This is not a monorepo.

Do not introduce:

- pnpm workspaces.
- A packages-based monorepo structure.
- Multiple business services without a real requirement.

The backend is one modular monolith.

Although it uses Express.js, code should follow a modular, class-based style similar to NestJS:

```text
controller -> service -> repository
```

Use:

- Controller classes.
- Service classes.
- Repository classes.
- Constructor-injected dependencies.
- Separate modules for separate business areas.

Prisma calls should remain inside repositories or the established data-access layer.

A separate lightweight email worker only sends emails.

The worker must not:

- Access PostgreSQL.
- Use Prisma.
- Decide whether an email should be sent.
- Change payment state.
- Create or update users.
- Verify login eligibility.
- Change recruitment state.

The backend prepares a complete email payload and sends it to the worker.

---

## 5. Shared Database and Identity

The web form, app, and admin panel use the same backend and PostgreSQL database.

When a first-year student submits the web form, the backend immediately creates or reuses a `User` record.

The normalized email is the identity-matching key.

Example normalization:

```text
Student@Example.com -> student@example.com
```

Only one user may exist for a normalized email.

A new web-created user starts with:

```text
role = FIRST_YEAR_STUDENT
passwordHash = null
emailVerifiedAt = null
isSuspended = false
```

The same operation also creates:

- The student's basic details.
- A registration submission for the active recruitment cycle.
- The submitted form answers.
- An initial payment status of `UNPAID`.

The app must never create another user for the same registered email.

---

## 6. Recruitment Cycle

A recruitment cycle represents one first-year recruitment round, such as:

```text
Innogeeks Recruitment 2026–27
```

It groups:

- The active registration form.
- All registrations for that recruitment round.
- Recruitment timeline events.
- Test slots.
- Final decisions.

Only one recruitment cycle should normally be active at a time.

Recruitment cycles are administered through the admin panel and used internally
by the backend to keep historical data separate. The public website and app do
not select or receive a recruitment-cycle identifier.

A user may have only one registration submission in a particular recruitment cycle.

---

# 7. Authoritative First-Year Flow

## 7.1 Web Registration

The student fills the public web registration form without logging in.

The backend:

1. Normalizes the submitted email.
2. Finds an existing user with that normalized email.
3. Creates a new provisional first-year user if none exists.
4. Stores or updates the student's basic details.
5. Creates a registration submission for the active recruitment cycle.
6. Stores each submitted answer.
7. Sets payment status to `UNPAID`.

Initial state:

```text
User exists
Registration exists
passwordHash = null for a new web user
emailVerifiedAt = null for a new web user
paymentStatus = UNPAID
```

If the user already has a registration for the active cycle, reject the duplicate submission.

## 7.2 Manual Payment

There is no payment-gateway integration in Phase 1.

The student pays outside the platform.

An admin searches for the registration and changes its payment state.

Supported actions:

- Mark as paid.
- Mark as unpaid.

Marking a registration unpaid should require a confirmation dialog in the admin panel to prevent accidental changes.

The backend remains responsible for validating and applying the state transition.

## 7.3 Registration-Success Email

When a registration transitions from `UNPAID` to `PAID`, the backend sends a registration-success email.

The email may include:

- Confirmation that registration was completed successfully.
- Instructions to install or open the Innogeeks app.
- A link to download or access the app.
- A note to log in using the same registered email.

This email does not contain an activation code.

This email does not verify the user's email.

This email does not set the user's password.

Every real `UNPAID` to `PAID` transition sends this email. An admin may retry a
missing email by marking the registration `UNPAID` and then marking it `PAID`
again. Repeating the same status does not send an email.

---

## 8. App Email Gate

There is no signup option in the app.

The first-year student starts by entering the email used in the web registration.

The backend checks:

1. A user exists for the normalized email.
2. A registration exists for the active recruitment cycle.
3. The registration is marked `PAID`.
4. The user is not suspended.

If any required condition fails, app login is blocked.

Examples:

```text
No registered user -> block
Registered but UNPAID -> block
Registration rejected or unavailable -> block
Suspended user -> block
Registered and PAID -> continue
```

Only paid registered users may enter the login or first-time password-setup flow.

---

## 9. First-Time Login: Email Verification and Password Setup

There is no activation code in the product.

If the paid registered user has:

```text
passwordHash = null
```

the app starts first-time email verification.

Flow:

```text
Student enters registered email
  -> backend confirms registered + PAID
  -> backend sends an email verification code
  -> student enters the code
  -> backend verifies the code
  -> backend issues short-lived password-setup authorization
  -> student creates a password
  -> passwordHash is stored
  -> emailVerifiedAt is set
  -> student is logged in
```

The verification code proves that the student controls the registered email address.

It is not an activation code and must not be described as one in APIs, schemas, emails, or UI copy.

The system must update the existing web-created user. It must not create a new user or registration.

---

## 10. Returning Login

If the paid registered user already has:

```text
passwordHash != null
```

the app skips email-code verification and shows the password screen directly.

Flow:

```text
Student enters registered email
  -> backend confirms registered + PAID
  -> backend detects password exists
  -> student enters password
  -> backend authenticates user
  -> student enters the app
```

If the registration is later changed to `UNPAID`, the user must no longer pass the paid-user gate even if the password is correct.

Payment status is therefore checked before both first-time setup and returning login.

---

## 11. Email Verification Code

Phase 1 uses an email verification code only for first-time password setup.

Suggested purpose:

```text
EMAIL_VERIFICATION
```

A future forgot-password flow may use:

```text
PASSWORD_RESET
```

Every code must:

- Be tied to the user and normalized email.
- Be generated securely.
- Be stored only as a hash.
- Have an expiry time.
- Have a resend cooldown.
- Limit invalid attempts.
- Be invalidated when a newer code is issued.
- Be consumed after successful verification.
- Never be stored or logged in raw form.
- Never be exposed through admin APIs.

A code created for email verification must not be accepted for password reset.

Before accepting the code, the backend must recheck that the registration remains `PAID`.

---

## 12. Password-Setup Authorization

Successful email-code verification should not directly accept a password in the same unprotected request.

After the code is verified, the backend issues a short-lived, hashed, single-use password-setup authorization.

The authorization must:

- Be scoped to the user.
- Have an expiry time.
- Be single use.
- Be stored as a hash if persisted.
- Be invalidated after password creation.
- Not be logged in raw form.

When the password is submitted, the backend checks:

- The authorization is valid.
- The user still has no password.
- The registration is still `PAID`.
- The user is not suspended.

Interrupted setup must be recoverable:

- If the authorization is still valid, the student may continue setting the password.
- If it has expired, the student repeats email verification.

---

## 13. Derived Account State

Do not store a separate account-status column if it can contradict actual account fields.

Derive state from:

```text
passwordHash
emailVerifiedAt
isSuspended
```

Conceptual logic:

```text
isSuspended = true
  -> SUSPENDED

passwordHash = null
  -> PENDING_PASSWORD_SETUP

passwordHash exists and emailVerifiedAt = null
  -> PENDING_EMAIL_VERIFICATION

passwordHash exists and emailVerifiedAt exists
  -> ACTIVE
```

For the finalized web-only flow, a newly registered student normally begins in `PENDING_PASSWORD_SETUP`.

---

## 14. Post-Login Recruitment Experience

After successful first-time setup or returning login, the student can access Phase 1 recruitment features.

The app may show:

- Registration confirmation.
- Payment confirmation.
- Recruitment timeline.
- Test details.
- Available test slots.
- Current decision state.
- Relevant instructions and links.

The backend should return structured state and timeline data.

The app must not independently reconstruct business rules.

---

## 15. Recruitment Timeline

Admins control timeline details shown in the app.

Timeline events may include:

- Registration completed.
- Payment confirmed.
- Test-slot booking opened.
- Test date.
- Interview date.
- Final decision date.
- Custom recruitment notices.

Interviews happen on one common day for all relevant students.

There is no interview-slot booking.

An interview may still appear as a shared timeline event containing:

- Date and time.
- Location.
- Instructions.
- Applicant-visible notes.

Timeline events should support:

- Title.
- Description.
- Event type.
- Scheduled date and time.
- Location.
- Meeting link.
- Instructions.
- Display order.
- Visibility.

Only visible events are returned to first-year students.

---

## 16. Test Slots

Slot booking in Phase 1 is only for tests.

The app contains a test-slot booking section where paid first-year students can view the slot options configured by the admin.

Each test-slot option contains:

Date.
Start time.
End time.
Display order.
Visible or hidden state.
Seat capacity (configurable by admin).

Admins control which test-slot dates, timings, and seat capacities are shown in the app.

Paid first-year students can:

View the currently visible test-slot options.
Select one test slot.
View their selected test slot.

Only one selected test slot is allowed per registration submission for the active recruitment cycle.

At booking time, the backend must:

Confirm that the user is authenticated.
Confirm that the registration belongs to the user.
Confirm that the registration is PAID.
Confirm that the slot belongs to the active recruitment cycle.
Confirm that the slot is currently visible.
Confirm that the slot has remaining capacity.
Confirm that the registration does not already have another selected slot.
Store the selected test slot and decrement available capacity.

Phase 1 does not include:

Capacity-based waiting lists.
Slot cancellation workflows.
Last-seat concurrency handling.

A slot is considered available when it is configured, visible in the app, and has remaining capacity.

---

## 17. Final Recruitment Decision

Only admins may set the final recruitment decision.

Supported values:

```text
PENDING
SELECTED
WAITLISTED
REJECTED
```

Only `PAID` registrations may receive a decision other than `PENDING`.

The decision must never be inferred automatically from:

- Payment.
- Test-slot booking.
- Test attendance.
- Timeline progress.
- Interview attendance.

The admin may add an optional applicant-visible decision note.

Domain assignment is excluded from Phase 1.

---

## 18. Dynamic Registration Form

There is one form for the active recruitment cycle.

Admins can manage fields before the form is locked.

A form field may contain:

- Stable key.
- Title.
- Help text.
- Type.
- Placeholder.
- Required state.
- Display order.
- Select options.
- Minimum and maximum length.
- Minimum and maximum numeric value.
- Additional validation rules.

Supported types:

```text
TEXT
TEXTAREA
EMAIL
PHONE
NUMBER
DATE
SELECT
MULTI_SELECT
CHECKBOX
```

The web client renders the form using backend-provided fields.

The backend validates every submission.

Client-side validation is not authoritative.

---

## 19. Form Locking and Historical Submissions

Phase 1 does not implement form versioning.

The form becomes locked after its first registration submission.

Once locked, admins cannot:

- Add fields.
- Edit field meanings.
- Reorder fields.
- Enable or disable fields.
- Delete fields.

This prevents old and new submissions from using different structures without a versioning system.

Every submitted answer should also snapshot:

- Field key.
- Field title.
- Field type.

This preserves readability if minor non-behavioral metadata changes occur before the form is locked.

If live form editing during recruitment is required later, introduce proper form versioning in a future phase.

---

## 20. Admin Panel Requirements

### 20.1 Forms

Admins can:

- Create the form for a recruitment cycle.
- Add fields.
- Edit fields.
- Reorder fields.
- Enable or disable fields.
- View the current field set.

Changes are blocked after the form receives its first submission.

### 20.2 Registrations

Admins can:

- Search by name.
- Search by email.
- Search by application number.
- Filter by payment status.
- Filter by decision.
- View submitted answers.
- View the student's selected test slot.
- View account setup state.

### 20.3 Payment

Admins can:

- Mark a registration paid.
- Mark a registration unpaid.

Marking unpaid requires a confirmation dialog in the admin panel.

### 20.4 Timeline

Admins can:

- Create timeline events.
- Edit timeline events.
- Reorder timeline events.
- Show or hide timeline events.
- Add shared interview-day details.
- Add test information.

### 20.5 Test Slots

Admins can:

Create test-slot options.
Set the date of each slot.
Set the start and end time.
Configure the seat capacity of each slot.
Edit slot dates and timings.
Edit slot capacity.
Reorder slot options.
Show or hide slot options in the app.
View the students who selected each slot.
View the number of booked and remaining seats for each slot.

A test slot is shown as available to students only when:

It belongs to the active recruitment cycle.
It is marked visible.
It has remaining seat capacity.

The admin registration details may show the test slot selected by the student.

Phase 1 does not include:

Slot waiting lists.
Slot cancellation workflows.
Automatic reassignment when a slot becomes unavailable.

### 20.6 Decisions

Admins can:

- Set `SELECTED`.
- Set `WAITLISTED`.
- Set `REJECTED`.
- Return a decision to `PENDING` when authorized.
- Add an optional note.

Domain assignment is not included.

---

## 21. Admin Authorization

All admin endpoints must be protected server-side.

The backend must not trust:

- Hidden buttons.
- Client-provided roles.
- Client-provided admin identifiers.
- Frontend routing.

The authenticated backend identity determines whether the request is authorized.

---

## 22. Email Responsibilities

Phase 1 has two relevant email events.

### 22.1 Registration Confirmation Email

Triggered when:

```text
paymentStatus changes from UNPAID to PAID
```

Contains:

- Registration confirmation.
- Payment verification confirmation.
- App access instructions.
- App link.

Does not contain a verification code.

### 22.2 First-Login Verification Email

Triggered when:

```text
registered + PAID user enters email
and passwordHash is null
```

Contains:

- Email verification code.
- Expiry information.
- Basic first-login instructions.

The email worker only sends the prepared email.

The backend decides eligibility and generates the code.

---

## 23. Basic Traceability

A full generic audit-log system is optional in Phase 1.

Important decision actions should store actor and timestamp fields directly.

Payment fields may include:

```text
paymentStatus
paymentStatusUpdatedAt
```

Decision fields may include:

```text
decision
decidedAt
decidedById
decisionNote
```

A generic audit system may be added later if more detailed history is required.

---

## 24. Product Invariants
  There are three platform roles: first-year student, coordinator, and admin.
  The first-year recruitment flow applies only to first-year students.
  There is no app signup or app registration path in Phase 1.
  All registrations originate from the public web form.
  The web form does not require login.
  The web form, app, and admin panel use the same backend and database.
  Only one user may exist for a normalized email.
  Only one registration may exist for a user in a recruitment cycle.
  Web registration creates or reuses the user immediately.
  A newly created web user initially has passwordHash = null.
  Every new registration starts with paymentStatus = UNPAID.
  Only admins may change a registration’s payment status.
  There is no payment-gateway integration in Phase 1.
  Every transition from UNPAID to PAID sends a registration-success email without a verification code.
  Only registered and paid users may proceed beyond the app email gate.
  A paid user without a password receives an email verification code during first login.
  There is no activation code.
  Successful email verification allows the user to set a password on the existing account.
  A paid user who already has a password proceeds directly to password login.
  Payment status is checked before both first-time password setup and returning login.
  The app provides a test-slot booking section for paid first-year students.
  Admins control the test-slot dates, timings, display order, visibility, and seat capacities shown in the app.
  A test slot is available only when it is visible and has remaining seat capacity.
  A first-year student may select only one test slot for their registration in the active recruitment cycle.
  A test-slot booking reduces the remaining capacity of the selected slot.
  A student cannot book a slot whose configured capacity has already been reached.
  Phase 1 does not include capacity-based waiting lists.
  Phase 1 does not include slot cancellation workflows.
  Interviews use a shared date and do not use slot booking.
  Test-slot selection must not automatically influence the final recruitment decision.
  Only admins may set the final recruitment decision.
  Domain assignment is excluded from Phase 1.
  Resources, coordinator flows, sessions, and attendance are deferred.
  The email worker must never access the database or own business logic.

---

## 25. Out of Scope

Phase 1 does not include:

- App signup.
- App registration.
- Payment gateway.
- Domain assignment.
- Coordinator-domain associations.
- Resource sharing.
- Session management.
- Attendance.
- Attendance analytics.
- Coordinator onboarding.
- Admin onboarding.
- Interview-slot booking.
- Push notifications.
- Real-time WebSockets.
- Forgot-password implementation.
- Generic support-ticket flow.
- Full generic audit engine.
- Form versioning.

---

## 26. Open Decisions

Do not silently assume:

Verification-code length.
Verification-code expiry duration.
Verification-code resend cooldown.
Maximum invalid verification attempts.
Password-setup authorization expiry.
Email provider.
Transport between the backend and email worker.
Whether a student may change their selected test slot after booking.
Whether changing a selected slot should restore capacity to the previous slot.
Whether admins may edit a test slot after students have selected it.
Whether admins may hide a test slot after students have selected it.
What should happen to existing bookings if an admin changes a slot’s date or time.
Whether an admin may reduce slot capacity below the number of existing bookings.
Whether hidden slots remain visible to students who already selected them.
Whether students may edit registration answers after submission.
Whether rejected or waitlisted decision notes are visible to students.
Whether a generic audit log is required in a later phase.

Until these decisions are finalized:

A student should not be allowed to change a selected slot.
Existing bookings should remain stored if a slot is hidden.
Admins should not be allowed to reduce capacity below the current booking count.
Admins should receive a warning before editing a slot that already has bookings.

---

## 27. Phase 1 Definition of Done

Phase 1 is complete when:

A first-year student can submit the public web form without logging in.
The backend creates or reuses a user using the normalized email.
A newly created web user has no password.
The backend stores the student’s details and submitted form answers.
The backend creates an unpaid registration for the active recruitment cycle.
Duplicate users and registrations are prevented.
Admins can search and inspect registrations.
Admins can mark registrations paid or unpaid.
Every UNPAID to PAID transition sends a registration-success email containing app-access instructions.
The registration-success email does not contain a verification or activation code.
The app has no signup or registration path.
The app checks whether the entered email belongs to a paid registration.
Unregistered, unpaid, or suspended users are blocked.
Paid users without a password receive an email verification code during first login.
The verification code can be securely validated.
A short-lived password-setup authorization is issued after successful verification.
The user can set a password on the existing account.
Paid users with an existing password can log in directly.
The app can return the recruitment timeline and visible recruitment details.
Admins can create test-slot options.
Admins can configure each slot’s date, start time, end time, display order, visibility, and seat capacity.
Admins can view the number of bookings and remaining seats for each slot.
Paid first-year students can view test slots that are visible and have remaining capacity.
A paid first-year student can select one test slot.
The backend prevents multiple test-slot selections for the same registration.
The backend prevents a student from selecting a slot whose capacity has been reached.
Booking a slot stores the student’s selection and reduces the slot’s remaining capacity.
Students can view their selected test slot in the app.
Admins can view the students assigned to each test slot.
Interviews are represented as shared timeline details and do not use slot booking.
Admins can manage timeline and interview-day information.
Admins can set selected, waitlisted, or rejected decisions.
Domain assignment remains unimplemented.
Attendance, resources, sessions, and coordinator operations remain deferred.
