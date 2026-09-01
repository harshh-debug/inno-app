# Innogeeks Android App API Contract

Contract version: `0.6.0`  
Last updated: `2026-09-01`  
API namespace: `/api/v1/app`

This document contains only Android app endpoints that are currently
implemented in the backend. It does not document public-web endpoints, admin
panel endpoints, or planned backend modules.

## 1. Implemented endpoints

| Method and path | Purpose | Authentication |
|---|---|---|
| `POST /auth/email-gate` | Check app eligibility and choose setup or login | None |
| `POST /auth/verification-code` | Email a first-login verification code | None |
| `POST /auth/verify-code` | Verify the code and issue a password-setup token | None |
| `POST /auth/set-password` | Set the first password and issue an access token | Setup token in body |
| `POST /auth/login` | Authenticate a returning student | None |
| `POST /auth/password-reset/request` | Email a password-reset verification code to a student who already has a password | None |
| `POST /auth/password-reset/verify` | Verify the reset code and issue a password-reset token | None |
| `POST /auth/password-reset/complete` | Set a new password using the reset token and issue an access token | Reset token in body |
| `POST /auth/logout` | Revoke the current access token | Bearer token |
| `GET /me` | Read the authenticated student's profile | Bearer token |
| `PATCH /me` | Update the authenticated student's editable profile fields (`fullName`, `phone`) | Bearer token |
| `GET /recruitment` | Read the authenticated student's payment, decision, test-slot, and interview status | Bearer token |
| `GET /test-slot-booking` | Read the student's own admin-assigned test slot | Bearer token |
| `GET /interview-booking` | Read the student's own admin-assigned interview slot | Bearer token |

There is no app signup or app registration endpoint. A student must already
have a paid registration created through the public registration flow.

## 2. Common contract

### Base URL

The deployment owner supplies the environment-specific host:

```text
Development: http://<development-host>:3000/api/v1/app
Production:  https://<production-host>/api/v1/app
```

Do not hardcode `localhost` in Android. An emulator treats `localhost` as the
emulator itself.

### Request headers

```http
Content-Type: application/json
Accept: application/json
```

Authenticated requests (§9 onward) additionally require:

```http
Authorization: Bearer <accessToken>
```

### Success envelope

All successful responses use:

```json
{
  "data": {}
}
```

### Error envelope

All errors use:

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Readable message",
    "details": []
  }
}
```

The app must branch on `error.code`, not `error.message`. The backend may
change readable messages without changing the error meaning.

For `VALIDATION_ERROR`, `details` may contain Zod validation issues. The app
may use them for diagnostics, but their internal shape is not a stable UI
contract.

### Data conventions

- JSON property names use `camelCase`.
- College email is the identity key and should be preserved across the complete
  authentication flow.
- Verification codes are strings, not numbers, so leading zeroes are retained.
- Tokens are opaque strings. The app must not parse them to make business or
  authorization decisions. This still holds after 401/403 — see §9. The app
  reads `error.code` to decide why access failed, never the token contents.
- The app never sends or receives a recruitment-cycle ID. The backend resolves
  the active cycle internally.

## 3. Authentication flow

```text
Enter registered college email
  -> POST /auth/email-gate
     -> PASSWORD_SETUP
        -> POST /auth/verification-code
        -> POST /auth/verify-code
        -> POST /auth/set-password
        -> store accessToken
     -> PASSWORD_LOGIN
        -> POST /auth/login
        -> store accessToken

Forgot password (student already has a password)
  -> POST /auth/password-reset/request
  -> POST /auth/password-reset/verify
  -> POST /auth/password-reset/complete
  -> store accessToken

Logout
  -> POST /auth/logout (bearer token)
  -> discard stored accessToken locally regardless of response
```

The product term is **email verification code**, never activation code. The
same term applies to the password-reset code — it is a verification code,
never a "reset code" or "OTP", in any user-facing copy.

## 4. Check email and choose the next screen

### Request

```http
POST /api/v1/app/auth/email-gate
```

```json
{
  "collegeEmail": "student@example.edu"
}
```

Input:

| Field | Type | Required | Validation |
|---|---|---|---|
| `collegeEmail` | string | Yes | Valid email, maximum 320 characters |

The backend normalizes the email before identity matching. The student is
eligible only when all of these are true:

- The user exists and has the registered-student role.
- The user has a registration in the internally resolved active cycle.
- That registration is `PAID`.
- The user is not suspended.

### Success

Status: `200 OK`

```json
{
  "data": {
    "nextStep": "PASSWORD_SETUP"
  }
}
```

`nextStep` is one of:

| Value | App action |
|---|---|
| `PASSWORD_SETUP` | Open the first-login email-verification flow |
| `PASSWORD_LOGIN` | Open the returning-user password screen |

### Errors

| HTTP | Code | Meaning |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid request or email format |
| `403` | `APP_ACCESS_DENIED` | No eligible paid registration or the user is suspended/incompatible |

Use one generic access-denied message for `APP_ACCESS_DENIED`; the backend does
not expose which eligibility check failed.

## 5. Request a first-login verification code

### Request

```http
POST /api/v1/app/auth/verification-code
```

```json
{
  "collegeEmail": "student@example.edu"
}
```

Input:

| Field | Type | Required | Validation |
|---|---|---|---|
| `collegeEmail` | string | Yes | Valid email, maximum 320 characters |

### Success

Status: `202 Accepted`

```json
{
  "data": {
    "requested": true
  }
}
```

Behavior:

- The code is exactly six digits.
- The code expires after 10 minutes.
- Resend is available after 60 seconds.
- Five invalid attempts invalidate the code.
- Requesting a new code invalidates an older unused code.
- Start the app's resend countdown only after receiving `202`.

### Errors

| HTTP | Code | App action |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Correct the request |
| `403` | `APP_ACCESS_DENIED` | Stop the login flow and show access denied |
| `409` | `PASSWORD_ALREADY_SET` | Route to the returning-user password screen |
| `429` | `VERIFICATION_CODE_COOLDOWN` | Keep resend disabled until the cooldown ends |
| `503` | `EMAIL_QUEUE_UNAVAILABLE` | Show retry; the failed code was invalidated |

## 6. Verify the first-login code

### Request

```http
POST /api/v1/app/auth/verify-code
```

```json
{
  "collegeEmail": "student@example.edu",
  "code": "123456"
}
```

Inputs:

| Field | Type | Required | Validation |
|---|---|---|---|
| `collegeEmail` | string | Yes | Valid email, maximum 320 characters |
| `code` | string | Yes | Exactly six numeric characters |

### Success

Status: `200 OK`

```json
{
  "data": {
    "passwordSetupToken": "opaque-short-lived-token"
  }
}
```

`passwordSetupToken` is single-use and expires after 10 minutes. Keep it only
for the current setup flow. It is not an authenticated-session token.

### Errors

| HTTP | Code | App action |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Correct the request |
| `400` | `VERIFICATION_CODE_INVALID` | Show invalid/expired code; allow retry or resend |
| `403` | `APP_ACCESS_DENIED` | Stop the login flow and show access denied |
| `409` | `PASSWORD_ALREADY_SET` | Route to the returning-user password screen |

`VERIFICATION_CODE_INVALID` intentionally covers wrong, expired, consumed,
superseded, and attempt-limited codes.

## 7. Set the first password

### Request

```http
POST /api/v1/app/auth/set-password
```

```json
{
  "passwordSetupToken": "opaque-short-lived-token",
  "password": "student-password"
}
```

Inputs:

| Field | Type | Required | Validation |
|---|---|---|---|
| `passwordSetupToken` | string | Yes | Minimum 20 characters |
| `password` | string | Yes | 8–128 characters |

### Success

Status: `200 OK`

```json
{
  "data": {
    "accessToken": "access-jwt"
  }
}
```

Store `accessToken` in Android secure credential storage. It is an access-only
JWT valid for seven days. See §9 for session semantics; there is no
refresh-token endpoint.

### Errors

| HTTP | Code | App action |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Correct the request/password length |
| `400` | `PASSWORD_SETUP_TOKEN_INVALID` | Restart email verification |
| `403` | `PASSWORD_SETUP_NOT_ALLOWED` | Stop setup; password exists or eligibility was removed |

## 8. Returning-user login

### Request

```http
POST /api/v1/app/auth/login
```

```json
{
  "collegeEmail": "student@example.edu",
  "password": "student-password"
}
```

Inputs:

| Field | Type | Required | Validation |
|---|---|---|---|
| `collegeEmail` | string | Yes | Valid email, maximum 320 characters |
| `password` | string | Yes | 8–128 characters |

### Success

Status: `200 OK`

```json
{
  "data": {
    "accessToken": "access-jwt"
  }
}
```

Store the access token in secure credential storage. The backend rechecks that
the active-cycle registration is paid and the user is not suspended on every
login.

### Errors

| HTTP | Code | App action |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Correct the request |
| `401` | `INVALID_CREDENTIALS` | Show invalid email/password |
| `403` | `APP_ACCESS_DENIED` | Stop login and show registration/payment/access message |

## 9. Session semantics: 401 vs 403

These two codes mean different things everywhere in the `/app` namespace, not
just at login, and the app must handle them differently:

- **`401 UNAUTHORIZED`** — the token itself is the problem: missing,
  malformed, expired, or logged out. Clear the stored token, drop to guest
  mode, show "Session expired — please log in again."
- **`403 APP_ACCESS_DENIED`** — the token is valid, but the student is no
  longer eligible right now (suspended, or the active-cycle registration is
  no longer `PAID`). Do not silently drop to guest mode with the same message
  as `401`; this is a different situation and should say something like
  "Your account no longer has app access" rather than implying the student
  should just log back in.

Every authenticated endpoint in this contract rechecks suspension and
active-cycle-paid-registration on every call, not only at login. A student
who loses eligibility mid-session gets `403` on their very next authenticated
request, not after some longer window.

There is no refresh-token endpoint. A 7-day re-login cadence is expected
product behavior.

## 10. Password reset

Use only when the student already has a password (returning-user state) and
has forgotten it. A student who has never set a password should go through
§5–§7 instead; the reset endpoints reject that case.

### 10.1 Request a reset code

```http
POST /api/v1/app/auth/password-reset/request
```

```json
{
  "collegeEmail": "student@example.edu"
}
```

Behavior is identical to §5 (six-digit code, 10-minute expiry, 60-second
resend cooldown, five invalid attempts, new code invalidates the old one),
using a separate code namespace so a code minted for this flow can never be
used for first-login setup or vice versa.

#### Success

Status: `202 Accepted`

```json
{ "data": { "requested": true } }
```

#### Errors

| HTTP | Code | App action |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Correct the request |
| `403` | `APP_ACCESS_DENIED` | Stop the flow and show access denied |
| `409` | `PASSWORD_NOT_SET` | Route to the first-login flow (§5) instead — there is no password to reset yet |
| `429` | `PASSWORD_RESET_COOLDOWN` | Keep resend disabled until the cooldown ends |
| `503` | `EMAIL_QUEUE_UNAVAILABLE` | Show retry; the failed code was invalidated |

### 10.2 Verify the reset code

```http
POST /api/v1/app/auth/password-reset/verify
```

```json
{
  "collegeEmail": "student@example.edu",
  "code": "123456"
}
```

#### Success

Status: `200 OK`

```json
{ "data": { "passwordResetToken": "opaque-short-lived-token" } }
```

`passwordResetToken` is single-use and expires after 10 minutes, same as
`passwordSetupToken`. It is not an authenticated-session token and must not
be confused with `passwordSetupToken` — the two are never interchangeable.

#### Errors

| HTTP | Code | App action |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Correct the request |
| `400` | `PASSWORD_RESET_CODE_INVALID` | Show invalid/expired code; allow retry or resend |
| `403` | `APP_ACCESS_DENIED` | Stop the flow and show access denied |
| `409` | `PASSWORD_NOT_SET` | Route to the first-login flow (§5) instead |

### 10.3 Complete the reset

```http
POST /api/v1/app/auth/password-reset/complete
```

```json
{
  "passwordResetToken": "opaque-short-lived-token",
  "password": "new-student-password"
}
```

#### Success

Status: `200 OK`

```json
{ "data": { "accessToken": "access-jwt" } }
```

This immediately logs the student in with the new password; no separate
login call is needed after this.

#### Errors

| HTTP | Code | App action |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Correct the request/password length |
| `400` | `PASSWORD_RESET_TOKEN_INVALID` | Restart the reset flow from §10.1 |
| `403` | `APP_ACCESS_DENIED` | Stop the flow; eligibility was lost mid-reset |

## 11. Logout

```http
POST /api/v1/app/auth/logout
Authorization: Bearer <accessToken>
```

No request body. Revokes the presented token immediately; any further
request with that same token returns `401 UNAUTHORIZED`, even though the
token's own 7-day expiry hasn't passed.

### Success

Status: `200 OK`

```json
{ "data": { "loggedOut": true } }
```

Always delete the locally stored token on logout regardless of the response —
if this call fails (e.g. no network), the app has still done the correct
client-side thing, and the token will still expire naturally within 7 days.

## 12. Student profile

```http
GET /api/v1/app/me
Authorization: Bearer <accessToken>
```

### Success

Status: `200 OK`

```json
{
  "data": {
    "collegeEmail": "student@example.edu",
    "fullName": "Student Name",
    "phone": "9999999999",
    "batch": "CSE 2024-2028",
    "year": 2,
    "role": "REGISTERED",
    "domain": null
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `collegeEmail` | string | identity key |
| `fullName` | string \| null | captured at registration; may be null if not provided |
| `phone` | string \| null | captured at registration |
| `batch` | string \| null | free-text as captured at registration (e.g. "CSE 2024-2028"); not a structured branch/section field |
| `year` | number \| null | captured at registration |
| `role` | string | one of `REGISTERED`, `MEMBER`, `COORDINATOR`, `ADMIN` (an admin account can technically reach `/app` endpoints too, but Phase 1's onboarding/registration flow only ever produces `REGISTERED`) |
| `domain` | string \| null | one of `ANDROID`, `WEB`, `ML`, `IOT`, `AR_VR`, or `null`. Always `null` for `REGISTERED`; set by an admin when promoting to `MEMBER`/`COORDINATOR` (optional for `ADMIN`). Not embedded in the access token — always read fresh here, so re-fetch on splash/app-resume to pick up a promotion made mid-session. |

`enrollmentNumber`, `branch`, `section`, `semester`, and `CGPA` are **not**
returned because they are not captured anywhere in the current data model.
Do not add UI slots for these fields yet; wait for a follow-up contract
version if that data ever gets collected.

### Errors

| HTTP | Code | App action |
|---|---|---|
| `401` | `UNAUTHORIZED` | Session expired, drop to guest mode |
| `403` | `APP_ACCESS_DENIED` | Show access-denied state, not session-expired |

### Update profile

```http
PATCH /api/v1/app/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "fullName": "Student Name",
  "phone": "9999999999"
}
```

Both fields are optional but at least one must be present (partial update).
Only `fullName` and `phone` are editable — `collegeEmail` is the immutable
login identity, and `batch`/`year`/`role`/`domain` are admin-panel-only:
`batch`/`year` describe the student's registration record, and `role`/`domain`
change only through the admin promotion flow, never self-service.

`fullName`, if present, is trimmed and must be 1-200 characters. `phone`, if
present, may contain digits, spaces, hyphens, and an optional leading `+`; it
is normalized by stripping spaces and hyphens before storage (e.g.
`"+91 98765 43210"` is stored as `"+919876543210"`), and must contain 7-15
digits after normalization.

Response shape is identical to `GET /me` (`200 OK`, same envelope and field
set) reflecting the values just written, so the client can replace its local
copy directly instead of re-fetching.

### Errors

| HTTP | Code | App action |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Show the field error (e.g. empty string, over length limit, phone not 7-15 digits, neither field present) |
| `401` | `UNAUTHORIZED` | Session expired, drop to guest mode |
| `403` | `APP_ACCESS_DENIED` | Show access-denied state, not session-expired |
| `404` | `USER_NOT_FOUND` | Treat as session-invalid; drop to guest mode (rare race: account removed between requests) |

## 13. Recruitment status

```http
GET /api/v1/app/recruitment
Authorization: Bearer <accessToken>
```

### Success

Status: `200 OK`

```json
{
  "data": {
    "paid": true,
    "decision": "PENDING",
    "decisionNote": null,
    "testSlot": {
      "booked": false,
      "startTime": null,
      "endTime": null
    },
    "interview": {
      "assigned": false,
      "startTime": null,
      "endTime": null,
      "location": null,
      "meetingUrl": null
    }
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `paid` | boolean | current payment status of the active-cycle registration |
| `decision` | string | one of `PENDING`, `SELECTED`, `WAITLISTED`, `REJECTED` |
| `decisionNote` | string \| null | applicant-visible note set by an admin alongside the decision |
| `testSlot.booked` | boolean | whether an admin has assigned the student a test slot |
| `testSlot.startTime`, `testSlot.endTime` | string (ISO 8601) \| null | only present when `booked` is true |
| `interview.assigned` | boolean | whether an admin has assigned the student an interview slot |
| `interview.startTime`, `interview.endTime` | string (ISO 8601) \| null | only present when `assigned` is true |
| `interview.location`, `interview.meetingUrl` | string \| null | only present when `assigned` is true; either or both may still be null (e.g. in-person interview has no `meetingUrl`) |

There is no separate "stage" field — `decision` plus `testSlot.booked` plus
`interview.assigned` are the facts that define where a student stands.
Neither test-slot nor interview scheduling is student-driven: an admin
assigns both (§14, §15); this endpoint only reads the current state.

### Errors

| HTTP | Code | App action |
|---|---|---|
| `401` | `UNAUTHORIZED` | Session expired, drop to guest mode |
| `403` | `APP_ACCESS_DENIED` | Show access-denied state, not session-expired |

## 14. Test-slot booking

An admin assigns each paid first-year student a test slot from the admin
panel/API — there is no student-facing slot list or booking action. The app
only ever reads its own assignment.

### Read my assigned slot

```http
GET /api/v1/app/test-slot-booking
Authorization: Bearer <accessToken>
```

#### Success

Status: `200 OK`

```json
{
  "data": {
    "testSlotId": "8f14e...",
    "startTime": "2026-09-10T09:00:00.000Z",
    "endTime": "2026-09-10T10:00:00.000Z",
    "bookedAt": "2026-09-01T12:00:00.000Z"
  }
}
```

`bookedAt` is when the admin made (or last changed) the assignment, not
something the student set. Poll or refresh this on app-resume to pick up a
new or changed assignment made while the student wasn't looking — it is not
pushed to the app.

#### Errors

| HTTP | Code | App action |
|---|---|---|
| `401` | `UNAUTHORIZED` | Session expired, drop to guest mode |
| `403` | `APP_ACCESS_DENIED` | Show access-denied state, not session-expired |
| `404` | `TEST_SLOT_NOT_BOOKED` | Show the "no slot assigned yet" empty state |

## 15. Interview scheduling

Same model as test-slot booking (§14): an admin assigns each student an
interview slot; there is no student-facing slot list or booking action.

### Read my assigned interview

```http
GET /api/v1/app/interview-booking
Authorization: Bearer <accessToken>
```

#### Success

Status: `200 OK`

```json
{
  "data": {
    "interviewSlotId": "8f14e...",
    "startTime": "2026-09-15T09:00:00.000Z",
    "endTime": "2026-09-15T09:30:00.000Z",
    "location": "Room 204, Innovation Block",
    "meetingUrl": null,
    "bookedAt": "2026-09-01T12:00:00.000Z"
  }
}
```

`location` and `meetingUrl` are each independently nullable — an in-person
interview has no `meetingUrl`, a remote one may have no physical `location`.
`bookedAt` is when the admin made (or last changed) the assignment. Poll or
refresh this on app-resume, same as §14.

#### Errors

| HTTP | Code | App action |
|---|---|---|
| `401` | `UNAUTHORIZED` | Session expired, drop to guest mode |
| `403` | `APP_ACCESS_DENIED` | Show access-denied state, not session-expired |
| `404` | `INTERVIEW_SLOT_NOT_BOOKED` | Show the "no interview assigned yet" empty state |

## 16. Android integration requirements

- Store access tokens in secure credential storage.
- Never log access tokens, password-setup tokens, password-reset tokens,
  passwords, or verification codes.
- Preserve the college email across the first-time setup and password-reset
  screens.
- Preserve verification codes as strings.
- Disable repeated submit taps while a request is in flight.
- Treat unknown `nextStep` or error-code values as an unsupported server/app
  version instead of silently mapping them to a known value.
- Do not add app signup or app registration screens in Phase 1.
- Always clear the locally stored token on logout, independent of whether the
  `POST /auth/logout` call succeeds.

## 17. Contract change policy

- This file documents implemented Android app endpoints only.
- Add a new endpoint only after its backend module and manual end-to-end gate
  are complete.
- Backward-compatible additions increment the minor contract version.
- Renamed or removed fields, changed types, and changed enum semantics require
  a major-version review with the app team.
- Backend code and this document must change together whenever an implemented
  Android endpoint contract changes.
