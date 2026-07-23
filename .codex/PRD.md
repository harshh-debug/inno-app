# Innogeeks Platform — Product Requirements Document

## 1. Document Purpose

This document defines the current product behavior, backend-facing requirements, user states, and business rules for the Innogeeks platform.

It is the product source of truth for:

- First-year student onboarding.
- Web and app registration.
- Email verification.
- Password setup.
- Manual payment verification.
- Paid-user access.
- Recruitment timelines.
- Selection.
- Domain assignment.
- Admin responsibilities.
- Future coordinator, resource, session, and attendance features.

This document does not define mobile UI layouts, navigation styling, or visual design.

Coding agents should consult this file whenever product behavior is unclear or when a task affects registration, authentication, payment, recruitment, selection, or domain assignment.

---

## 2. Product Summary

Innogeeks is a technical club platform used to manage first-year recruitment and, later, internal club operations.

The platform has three clients:

1. The mobile app.
2. The Next.js admin panel.
3. The public web registration form.

All three clients use the same backend and the same PostgreSQL database.

The current implementation priority is:

- First-year student account creation.
- Dynamic registration forms.
- Web and app registration.
- Manual payment verification.
- Email-code verification.
- Password setup.
- Paid-user access.
- Recruitment timeline.
- Final selection.
- Domain assignment.

Later phases may include:

- Coordinator resource sharing.
- Session creation.
- Attendance.
- Attendance analytics.

---

## 3. High-Level User Types

The platform has three high-level user types:

```text
FIRST_YEAR_STUDENT
COORDINATOR
ADMIN
```

These are platform roles.

Payment, registration, and selection are separate states and must not be represented as roles.

---

## 4. First-Year Student

A first-year student may:

- Fill the public web registration form.
- Create an account directly in the mobile app.
- Verify their email.
- Complete password setup.
- Submit the Join Innogeeks registration form.
- Complete the registration-fee payment.
- Become a paid user after admin verification.
- View the recruitment timeline.
- Participate in tests and interviews.
- Receive a final decision.
- Receive domain assignments if selected.

All onboarding, payment, recruitment, and selection flows in this document apply only to first-year students.

---

## 5. Coordinator

A coordinator is generally a second-year student associated with one or more Innogeeks domains.

Future coordinator capabilities may include:

- Publishing resources.
- Creating classes or sessions.
- Selecting the session domain.
- Marking which coordinators were present.
- Recording attendance for selected first-year students.

Coordinators do not use:

- The first-year Join Innogeeks registration form.
- The first-year payment flow.
- The first-year recruitment timeline.
- The first-year selection process.

Coordinator provisioning is outside the current phase.

---

## 6. Admin

An admin is an authorized platform operator using the Next.js admin panel.

Admins currently manage:

- Dynamic registration-form definitions.
- First-year student records.
- Registration submissions.
- Manual payment verification.
- Registration email corrections.
- Test and interview details.
- Final decisions.
- Domain assignments.
- Relevant audit history.

All admin permissions must be enforced by the backend.

The admin panel is only a client and must not contain authoritative business rules.

---

## 7. Technical Direction

Use:

- Node.js.
- Express.js.
- Prisma.
- PostgreSQL.
- pnpm.

Use `pnpm`, not `npm`.

The backend is a single modular monolith.

It owns:

- API routes.
- Authentication.
- Authorization.
- Business logic.
- Prisma.
- PostgreSQL access.
- Dynamic forms.
- User records.
- Student profiles.
- Registration records.
- Payment state.
- Email-code generation.
- Password setup.
- Recruitment timelines.
- Selection.
- Domain assignment.
- Admin operations.
- Audit logging.

There is a separate lightweight email worker.

The email worker only sends emails.

It must not:

- Access PostgreSQL.
- Use Prisma.
- Decide whether an email should be sent.
- Verify payments.
- Create users.
- Update passwords.
- Change registration state.
- Change recruitment decisions.
- Assign domains.

The main backend prepares the email payload and passes it to the worker through the transport chosen by the project.

---

## 8. Shared Database Model

The web form, mobile app, and admin panel all use the same backend and the same PostgreSQL database.

There are no separate web and app user databases.

A first-year student's identity must remain the same regardless of whether they begin from the web form or the mobile app.

The normalized email address is the main identity-matching key for first-year onboarding.

Duplicate users must not be created for the same normalized email.

---

## 9. Core Product Distinctions

The following concepts are separate:

- User database record.
- Login-enabled account.
- Email verification.
- Password setup.
- Student profile.
- Registration submission.
- Payment state.
- Paid-user access.
- Recruitment decision.
- Domain assignment.
- Platform role.

Do not collapse them into one status.

Examples:

- A user can exist without a password.
- A user can exist with an unverified email.
- A user can have an active account but no registration for the current cycle.
- A registered user can remain unpaid.
- A paid user can remain pending in recruitment.
- A selected user can remain without a final domain assignment.

---

## 10. Recruitment Cycles

Recruitment should be modeled by cycle.

A cycle may contain:

- Name.
- Academic year.
- Registration start and end dates.
- Registration fee.
- Active form version.
- Test details.
- Interview details.
- Decision period.
- Status.

Suggested cycle states:

```text
DRAFT
ACTIVE
COMPLETED
ARCHIVED
```

The current registration fee is expected to be ₹50, but it should remain configurable per cycle.

A first-year student should normally have only one registration per recruitment cycle.

---

## 11. Registration Channels

First-year students may register through:

1. The public web registration form.
2. The mobile app.

Both channels use:

- The same backend.
- The same PostgreSQL database.
- The same active form definition.
- The same validation rules.
- The same recruitment cycle.

The web form does not require login.

The app requires account creation and email verification before showing the Join Innogeeks form.

---

# 12. First-Year Flow A: Public Web Registration

## 12.1 Web Form Submission

The student fills the public web registration form without logging in.

The form may contain:

- Full name.
- Email.
- Phone.
- Batch or year.
- Domain interests.
- Short-answer questions.
- Other active dynamic fields.

When the form is submitted, the backend performs one controlled operation:

1. Normalize the submitted email.
2. Find an existing user with that email.
3. Create a new provisional user if none exists.
4. Create or update the student's profile where appropriate.
5. Create the registration for the active recruitment cycle.
6. Link the registration to the user.
7. Store the exact submitted answers and form version.

At this stage:

```text
User exists
Role = FIRST_YEAR_STUDENT
Registration exists
Registration is linked to the user
Payment status = UNPAID
Email may be unverified
Password may be absent
Account may be pending setup
```

For a new web-created user:

```text
passwordHash = null
emailVerified = false
accountStatus = PENDING_PASSWORD_SETUP
```

The student should not be able to log in with a password until password setup is completed.

## 12.2 Existing User During Web Submission

If a user already exists with the submitted email:

- Reuse the existing user.
- Do not create another user.
- Check whether a registration already exists for the active cycle.
- Reject a duplicate registration for the same cycle.
- Create the new registration only if none exists.

If the existing account already has a verified email and password, the student can later log in normally after payment is marked paid.

## 12.3 Web Submission Data

The backend stores both:

- Current profile information.
- Historical registration answers.

The profile may contain current reusable fields such as:

- Full name.
- Phone.
- Batch.
- Year.

The registration stores the exact submitted values for that cycle.

This intentional duplication preserves historical accuracy if the student changes profile information later.

---

## 13. Admin Payment Verification for Web Registration

The student pays the registration fee outside the platform.

For the current phase, payment verification is manual.

The admin:

1. Searches for the user or registration.
2. Opens registration details.
3. Confirms payment.
4. Marks the registration as paid.
5. Optionally records a payment reference or note.

The backend records:

- Previous payment state.
- New payment state.
- Admin actor.
- Verification timestamp.
- Verification source.
- Optional note.
- Optional payment reference.

Suggested verification source:

```text
ADMIN
```

A future payment gateway may use:

```text
PAYMENT_GATEWAY
```

After a web-created user's registration is marked paid, the backend may immediately send a verification code or make it available for resend when the user starts the app flow. The exact trigger may remain configurable.

---

# 14. Web-Created User Opens the App

The student opens the mobile app and enters the same email used in the web registration.

The backend checks:

- Whether a user exists for the normalized email.
- Whether a registration exists for the active cycle.
- Whether the registration is paid.
- Whether the email is verified.
- Whether a password exists.
- Whether the account is active or pending setup.

There are two main branches.

---

## 15. Web-Created User Without a Password

If the user exists but no password has been set:

```text
Student enters registered email
  -> backend finds existing provisional user
  -> verification code is sent or re-sent
  -> student enters verification code
  -> backend verifies email ownership
  -> backend issues short-lived password-setup authorization
  -> create-password screen is shown
  -> student sets password
  -> existing user record is updated
  -> email becomes verified
  -> account becomes ACTIVE
  -> paid-user access is granted
```

The backend must not create another user.

The student must not re-enter:

- Full name.
- Phone.
- Batch.
- Domain interests.
- Registration answers.

Those details already exist in the shared database.

The final password-setup operation should:

- Validate the setup authorization.
- Hash the password.
- Update the existing user.
- Mark the email verified.
- Mark the account active.
- Consume the verification code or setup token.
- Record activation time.
- Preserve the existing profile and registration.

Where practical, these changes should be completed atomically.

---

## 16. Interrupted Password Setup

The student may verify the code and close the app before creating a password.

To support this safely:

- Issue a short-lived password-setup token after successful code verification.
- Do not require the student to refill the registration form.
- Do not create a second user.
- Require the setup token when creating the password.
- Allow the student to restart verification if the token expires.

The system should not leave an unusable duplicate or partially created account.

---

## 17. Web-Created User With an Existing Password

A user may already have a password because:

- They previously created an app account with the same email.
- They completed account setup earlier.
- They already participated in another supported platform flow.

In this case:

```text
Student enters email
  -> backend detects password exists
  -> student enters existing password
  -> backend authenticates user
  -> backend confirms the paid registration belongs to the same user
  -> paid-user access is granted
```

Do not:

- Create another user.
- Create another registration.
- Ask the student to refill their details.

If the account email is not verified, require email verification before granting access.

---

# 18. First-Year Flow B: App Signup

## 18.1 Account Creation

A new student opens the app and chooses normal signup.

The student provides:

- Email.
- Password.
- Password confirmation.

The backend:

1. Normalizes the email.
2. Checks for an existing user.
3. Creates a new user only if none exists.
4. Stores the password hash.
5. Marks the account as pending email verification.
6. Sends an email verification code.

For a normal app-created user:

```text
passwordHash = set
emailVerified = false
accountStatus = PENDING_EMAIL_VERIFICATION
role = FIRST_YEAR_STUDENT
```

## 18.2 Existing Web-Created User During App Signup

If normal signup uses an email that already exists from the web form:

- Do not create another user.
- Detect whether a password exists.
- Detect whether the registration has been marked paid.

If no password exists:

```text
Existing provisional user found
  -> route to verification-code flow
  -> verify email
  -> create password
  -> activate existing account
```

If a password already exists:

```text
Existing active user found
  -> route to normal login
```

## 18.3 Email Verification

The student enters the email verification code.

On success:

- The email becomes verified.
- The account becomes active.
- The student is authenticated.
- The student enters the app.

This code is used for email verification.

It does not mark the user paid.

---

## 19. App Registration

After app login, the backend checks whether the user has a registration for the active cycle.

If no registration exists, the app shows the Join Innogeeks form.

The student fills and submits the form.

The backend:

1. Validates answers against the active form version.
2. Creates the registration.
3. Links it to the authenticated user.
4. Creates or updates the student profile.
5. Sets payment state to `UNPAID`.

At this stage:

```text
User exists
Password exists
Email is verified
Registration exists
Registration is linked
Payment status = UNPAID
```

No additional activation or claim code is required later.

---

## 20. Admin Marks App Registration Paid

The student pays outside the platform.

The admin finds the linked registration and marks it paid.

Because:

- The user account already exists.
- The password already exists.
- The email is already verified.
- The registration is already linked.

No additional email code is needed.

After the admin marks the registration paid, the backend state changes immediately.

The app changes its experience after fetching the latest state.

---

## 21. Paid-User UI Refresh

The mobile app should refresh the first-year student's current state:

- On login.
- When the app opens.
- When the app returns to the foreground.
- When the payment-pending screen opens.
- On manual refresh.

WebSockets are not required for the first version.

The backend should expose a structured state endpoint so the app does not reconstruct the user's state from many unrelated calls.

Example conceptual response:

```json
{
  "role": "FIRST_YEAR_STUDENT",
  "accountStatus": "ACTIVE",
  "emailVerified": true,
  "registration": {
    "status": "SUBMITTED",
    "paymentStatus": "PAID",
    "decision": "PENDING"
  },
  "access": {
    "canViewRecruitmentTimeline": true
  }
}
```

---

## 22. Unified Email-Code System

Use one technical email-code mechanism.

The same code service may support multiple purposes:

```text
EMAIL_VERIFICATION
PASSWORD_SETUP
PASSWORD_RESET
```

The user-facing code may look identical, but every code record must have a purpose and context.

A code created for one purpose must not work for another.

Examples:

- App signup uses `EMAIL_VERIFICATION`.
- Web-created user activation may use `PASSWORD_SETUP`.
- Password recovery uses `PASSWORD_RESET`.

Do not create separate technical code systems unless a future requirement requires it.

---

## 23. Email-Code Requirements

Every email code must:

- Be generated securely.
- Be tied to a normalized email or user ID.
- Have a clear purpose.
- Have an expiry time.
- Be stored as a hash.
- Limit invalid attempts.
- Enforce resend cooldown.
- Invalidate previous active codes when reissued.
- Be consumed after successful verification.
- Never be logged in raw form.
- Never be returned by admin APIs.

For web-created users, the backend must recheck the current registration and payment state before allowing password setup and paid access.

If payment is reversed before account setup completes, the setup flow must stop granting paid access.

---

## 24. Suggested User and Recruitment States

Exact enum names may follow the implementation, but the following distinctions must remain.

### Platform Role

```text
FIRST_YEAR_STUDENT
COORDINATOR
ADMIN
```

### Account Status

```text
PENDING_EMAIL_VERIFICATION
PENDING_PASSWORD_SETUP
ACTIVE
SUSPENDED
```

### Email Verification

```text
UNVERIFIED
VERIFIED
```

### Password Setup

This may be derived from whether `passwordHash` exists.

Conceptually:

```text
NOT_SET
SET
```

### Registration Status

```text
NOT_STARTED
DRAFT
SUBMITTED
```

### Payment Status

```text
UNPAID
PAID
REJECTED
```

### Recruitment Decision

```text
PENDING
SELECTED
WAITLISTED
REJECTED
```

Do not create roles called:

```text
UNPAID_USER
PAID_USER
SELECTED_USER
```

These are product states, not platform roles.

---

## 25. Dynamic Registration Form

The registration form is controlled from the admin panel.

The same form definition is used by:

- The public web form.
- The mobile app.

The backend is the source of truth for:

- Field key.
- Label.
- Description.
- Field type.
- Required state.
- Options.
- Validation rules.
- Display order.
- Active state.

Possible field types include:

- Short text.
- Long text.
- Email.
- Phone.
- Number.
- Date.
- Single select.
- Multi-select.
- Checkbox.

File upload should only be added when explicitly required.

---

## 26. Form Versioning

Published forms must be versioned.

Every registration must reference the exact form version used when submitted.

Changing the active form must not modify or invalidate previous submissions.

Admins may:

- Create draft versions.
- Add fields.
- Edit fields.
- Reorder fields.
- Disable fields.
- Publish a version.
- Archive older versions.

The backend validates every registration submission against the referenced form version.

---

## 27. Registration Validation

The backend must validate:

- Required fields.
- Data types.
- Allowed select values.
- Length limits.
- Number limits.
- Date rules.
- Email format.
- Phone format where applicable.
- Duplicate user rules.
- Duplicate registration rules.

Client-side validation is only for user experience.

The backend remains the final authority.

---

## 28. Duplicate and Conflict Rules

### 28.1 Duplicate User

Only one user should exist for a normalized email.

Examples such as:

```text
Student@Example.com
student@example.com
```

must be treated as the same email.

### 28.2 Duplicate Registration

Only one registration should normally exist for:

```text
user + recruitment cycle
```

A second submission should be rejected or routed to the existing registration.

### 28.3 Existing User Submits Web Form

If a user already exists with the web-form email:

- Reuse the existing user.
- Do not create another user.
- Create the registration only if none exists for the active cycle.

### 28.4 Existing Registration During App Flow

If a registration already exists for the authenticated user and active cycle:

- Do not show a blank Join form.
- Return the current registration and payment state.
- Do not create another registration.

### 28.5 Email Correction

Admins may correct a registration email before account setup is completed.

Such corrections must:

- Be authorized.
- Be audited.
- Recheck for duplicate users.
- Update the user email where appropriate.
- Update canonical registration email where appropriate.
- Invalidate active verification codes.
- Send future codes only to the corrected address.

After the account is active, email changes should follow a dedicated account-email-change flow.

---

## 29. Payment Verification

Payment state belongs to the registration for a recruitment cycle.

Do not rely only on a global field such as:

```text
User.isPaid
```

The admin can:

- Search registrations.
- Open registration details.
- Mark payment paid.
- Mark payment rejected where required.
- Add a payment reference.
- Add an internal note.
- Reverse payment under controlled authorization.

Every payment change should record:

- Actor.
- Timestamp.
- Previous state.
- New state.
- Verification source.
- Optional reference.
- Optional note.

A future payment gateway must call the same payment-verification business service used by the admin panel.

---

## 30. Paid-User Access

Paid-user access is derived from the active recruitment registration.

For an app-created user:

```text
active account
+
verified email
+
linked registration
+
payment status = PAID
```

For a web-created user:

```text
existing user
+
completed password setup
+
verified email
+
linked registration
+
payment status = PAID
```

The backend should expose explicit access flags rather than forcing clients to infer them.

---

## 31. Recruitment Timeline

Paid first-year students can view the recruitment timeline.

The timeline may include:

1. Registration submitted.
2. Payment confirmed.
3. Test scheduled.
4. Test completed.
5. Interview scheduled.
6. Interview completed.
7. Final decision.
8. Domain assignment.

Timeline items may contain:

- Title.
- Status.
- Date and time.
- Location.
- Meeting link.
- Instructions.
- Result.
- Applicant-visible note.

The backend returns timeline items in the correct order.

Clients should not independently recreate recruitment rules.

---

## 32. Recruitment Decision

Only admins can finalize recruitment decisions.

Suggested states:

```text
PENDING
SELECTED
WAITLISTED
REJECTED
```

Only paid first-year students may be selected.

Selection must never happen automatically.

A decision may include:

- Decision state.
- Internal admin note.
- Applicant-visible note.
- Decided by.
- Decision timestamp.

Decision changes must be audited.

---

## 33. Domain Assignment

Admins assign final domains to selected users.

Example domains include:

- Web.
- Machine Learning.
- Internet of Things.
- AR/VR.
- Web3.
- Android.

Domains should be stored in PostgreSQL.

Do not store final assignments as comma-separated strings.

Registration domain interests are preferences only.

Final domain assignments are separate relational records.

Only selected first-year students may receive final domain assignments.

The data model should support multiple domains unless a later product decision restricts assignment to one.

---

## 34. Admin Panel Requirements

The Next.js admin panel uses the same backend as the app and web form.

It does not own business logic.

### 34.1 Dynamic Forms

Admins can:

- Create form drafts.
- Add fields.
- Edit fields.
- Reorder fields.
- Enable or disable fields.
- Publish versions.
- View historical versions.

### 34.2 Users and Registrations

Admins can:

- Search by name.
- Search by email.
- Filter by account status.
- Filter by payment state.
- Filter by decision.
- View profile information.
- View registration answers.
- View account setup state.
- View audit history.

### 34.3 Payment

Admins can:

- Mark registrations paid.
- Reject payment where required.
- Reverse payment under controlled authorization.
- Add payment notes.
- Add references.
- Correct emails before account setup.

### 34.4 Recruitment

Admins can:

- Configure test details.
- Configure interview details.
- Update applicant-visible timeline information.
- Set selected, waitlisted, or rejected decisions.

### 34.5 Domain Assignment

Admins can:

- Assign domains to selected users.
- Change assignments.
- Remove assignments when authorized.
- View assignment history.

---

## 35. Coordinator and Admin Provisioning

Coordinator and admin accounts are outside the first-year flow.

They should not:

- Submit the Join Innogeeks form.
- Enter the first-year payment flow.
- Receive first-year recruitment timeline states.
- Be converted through first-year registration.

Their account creation and role assignment should use a separate controlled process.

The exact provisioning method is outside the current phase.

---

## 36. Database Ownership Model

### 36.1 User

The user represents platform identity.

Suggested fields include:

- User ID.
- Email.
- Password hash, nullable for provisional web users.
- Email verification status.
- Account status.
- Platform role.
- Created timestamp.
- Activated timestamp.

### 36.2 Student Profile

The profile contains current reusable student information.

Suggested fields include:

- User ID.
- Full name.
- Phone.
- Batch.
- Year.
- Other current profile details.

### 36.3 Registration

The registration represents one recruitment-cycle submission.

Suggested fields include:

- Registration ID.
- User ID.
- Recruitment cycle ID.
- Form version ID.
- Submitted name.
- Submitted email.
- Submitted phone.
- Dynamic answers.
- Domain interests.
- Registration status.
- Payment status.
- Recruitment decision.
- Submission timestamp.

Every registration is linked to a user.

A nullable registration `userId` is not required in the finalized model.

### 36.4 Verification Code

The verification-code record may include:

- User ID.
- Email.
- Purpose.
- Hashed code.
- Expiry.
- Attempt count.
- Resend count.
- Consumed timestamp.
- Created timestamp.

### 36.5 Domain Assignment

The domain assignment may include:

- User ID.
- Domain ID.
- Assigned by.
- Assigned timestamp.
- Optional note.

### 36.6 Audit Record

The audit record may include:

- Actor ID.
- Action.
- Target entity.
- Target ID.
- Previous state.
- New state.
- Timestamp.
- Optional note.

---

## 37. Backend Architecture Requirements

Although the backend uses Express.js, write it in a modular, class-based style similar to NestJS.

Use modules such as:

```text
auth
users
profiles
forms
registrations
payments
verification-codes
recruitment
domains
admin
email
audit
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

Controllers should remain thin.

Services own business logic and state transitions.

Repositories own Prisma queries.

Dependencies should be passed through constructors.

A dependency-injection framework is not required.

---

## 38. Security Requirements

The backend must:

- Protect admin endpoints.
- Enforce role-based authorization.
- Hash passwords securely.
- Hash email verification codes.
- Rate-limit code attempts.
- Rate-limit code resends.
- Normalize email addresses.
- Avoid logging secrets.
- Validate every request.
- Prevent duplicate users.
- Prevent duplicate registrations.
- Use transactions for sensitive multi-record changes.
- Audit sensitive admin actions.

---

## 39. Audit Requirements

Audit at least:

- User creation through web registration.
- User reuse during web submission.
- Payment confirmation.
- Payment rejection.
- Payment reversal.
- Registration email correction.
- Verification-code reissue.
- Password setup completion.
- Form publication.
- Timeline changes.
- Decision changes.
- Domain assignment changes.

Audit records must not contain:

- Raw passwords.
- Password hashes.
- Raw verification codes.
- Authentication tokens.

---

## 40. Email Worker Requirements

The email worker receives a prepared payload from the backend.

The payload may contain:

- Recipient email.
- Subject.
- Template identifier.
- Template variables.
- Delivery metadata.

The worker may:

- Render templates.
- Call the email provider.
- Retry transient failures.
- Log delivery success or failure.
- Report provider errors.

The worker must not:

- Query users.
- Query registrations.
- Access PostgreSQL.
- Use Prisma.
- Decide eligibility.
- Change business state.

---

## 41. Future Resources

In a later phase, coordinators may publish resources associated with their domain.

All selected first-year users should be able to view published resources regardless of their assigned domain.

Domain association describes resource ownership or categorization, not visibility restriction.

---

## 42. Future Sessions and Attendance

A future session flow may be:

1. A coordinator creates a class or session.
2. The coordinator selects a domain.
3. Present coordinators are recorded.
4. Attendance is recorded for selected first-year students of that domain.
5. Students can view attendance history and summaries.

Multiple coordinators may belong to a domain, but not all coordinators need to attend every session.

These features are outside the current phase.

---

## 43. Current Scope

The current phase includes:

- Shared backend and database.
- First-year web registration.
- First-year app signup.
- Email verification.
- Password setup for web-created users.
- Dynamic forms.
- Form versioning.
- Registration submission.
- User and registration deduplication.
- Manual payment verification.
- Paid-user access.
- Recruitment timeline.
- Test and interview information.
- Final decision.
- Domain assignment.
- Admin authorization.
- Audit logging.
- Email-worker integration.

---

## 44. Out of Scope

The current phase does not include:

- Mobile UI implementation details.
- Payment gateway.
- Resources.
- Sessions.
- Attendance.
- Attendance analytics.
- Push notifications.
- Coordinator onboarding.
- Admin onboarding.
- Real-time WebSocket state updates.
- File uploads unless explicitly added.

---

## 45. Product Invariants

The following must always remain true:

1. There are three high-level roles: first-year student, coordinator, and admin.
2. First-year recruitment flows do not apply to coordinators or admins.
3. The web form does not require login.
4. The web form, app, and admin panel use the same backend and database.
5. Web form submission creates or reuses a user.
6. Web form submission creates the student profile and registration.
7. Every registration is linked to a user.
8. A web-created user may initially have no password.
9. A web-created user cannot use password login until password setup is complete.
10. Normal app signup requires email verification.
11. Duplicate users must not be created for the same normalized email.
12. Duplicate registrations must not be created for the same user and cycle.
13. App-created registrations do not require another code after payment.
14. Admin payment confirmation changes paid-user access after the app refreshes state.
15. One email-code system may support multiple purposes.
16. Codes must be scoped by purpose.
17. Paid is a registration state, not a role.
18. Paid users are not automatically selected.
19. Only admins finalize selection.
20. Only selected first-year students receive final domain assignments.
21. Registration domain interests are not final assignments.
22. The email worker does not access the database.
23. The email worker does not own product logic.
24. Coordinator and admin accounts use separate provisioning.
25. Clients consume structured state from the backend.

---

## 46. Open Product Decisions

Do not silently assume answers for:

- Authentication token strategy.
- Verification-code length.
- Verification-code expiry.
- Resend cooldown.
- Maximum verification attempts.
- Email provider.
- Transport between backend and email worker.
- Whether web-created users receive the code immediately after payment verification or only when requested in the app.
- Whether users can edit submitted registrations.
- Whether selected users receive one domain or multiple domains.
- Whether test and interview schedules are cycle-wide or student-specific.
- Whether rejection reasons are visible to students.
- Whether the ₹50 fee changes by cycle.
- Whether admins may reverse payment after the account becomes active.
- Whether file-upload fields are supported.

When implementing these areas, follow the explicit task or keep the design configurable.

---

## 47. Definition of Done

The current phase is complete when:

1. A first-year student can submit the public web form without logging in.
2. The backend creates or reuses a user using the normalized email.
3. The backend creates or updates the student profile.
4. The backend creates the registration in the shared database.
5. A newly web-created user is stored without a password and with pending account setup.
6. An admin can search and inspect users and registrations.
7. An admin can mark a registration paid.
8. The backend can send a verification code through the email worker.
9. A web-created student can verify the code in the app.
10. The student can create a password for the existing user.
11. The backend activates the existing user without creating a duplicate.
12. A web-created user who already has a password can log in normally.
13. A new student can create an account directly in the app.
14. The app-signup email can be verified.
15. The verified app user can submit the Join Innogeeks form.
16. The app registration is linked to the authenticated user.
17. An admin can mark the linked app registration paid.
18. The app can fetch updated state and show paid-user recruitment content.
19. Admins can manage test and interview details.
20. Admins can finalize selected, waitlisted, or rejected decisions.
21. Admins can assign domains to selected users.
22. Duplicate users and registrations are prevented.
23. Invalid state transitions are rejected.
24. Sensitive admin actions are audited.
25. Coordinator and admin accounts remain outside the first-year flow.
