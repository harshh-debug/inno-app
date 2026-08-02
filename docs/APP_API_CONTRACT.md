# Innogeeks Android App API Contract

Contract version: `0.1.1`  
Last updated: `2026-08-02`  
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
  authorization decisions.
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
```

The product term is **email verification code**, never activation code.

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

- The user exists and has the first-year-student role.
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
JWT valid for seven days. Phase 1 has no refresh-token endpoint.

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

## 9. Android integration requirements

- Store access tokens in secure credential storage.
- Never log access tokens, password-setup tokens, passwords, or verification
  codes.
- Preserve the college email across the first-time setup screens.
- Preserve verification codes as strings.
- Disable repeated submit taps while a request is in flight.
- Treat unknown `nextStep` or error-code values as an unsupported server/app
  version instead of silently mapping them to a known value.
- Do not add app signup, app registration, forgot-password, or refresh-token
  screens in Phase 1.

## 10. Contract change policy

- This file documents implemented Android app endpoints only.
- Add a new endpoint only after its backend module and manual end-to-end gate
  are complete.
- Backward-compatible additions increment the minor contract version.
- Renamed or removed fields, changed types, and changed enum semantics require
  a major-version review with the app team.
- Backend code and this document must change together whenever an implemented
  Android endpoint contract changes.
