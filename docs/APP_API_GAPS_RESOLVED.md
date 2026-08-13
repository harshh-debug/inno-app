# Android App API Gaps — Resolved

Responds to: `APP_API_GAPS.md`, raised against contract v0.1.1
Resolved in: contract v0.2.0
Written: 2026-08-08
Author: Backend team

This replaces the earlier status-only response. Everything marked **Fixed**
below has working backend code behind it — new endpoints, new schemas, new
services — not just a plan. See `APP_API_CONTRACT.md` for the full request/
response shapes; this doc summarizes what changed and why.

---

## 1. Password reset — Fixed

**Blocking → resolved.** Three new endpoints, mirroring §5–§7 exactly as you
suggested, using the `PASSWORD_RESET` enum value that was already sitting
unused in the schema:

```
POST /auth/password-reset/request   { collegeEmail }        -> 202 { requested: true }
POST /auth/password-reset/verify    { collegeEmail, code }  -> 200 { passwordResetToken }
POST /auth/password-reset/complete  { passwordResetToken, password } -> 200 { accessToken }
```

Same code shape and limits as first-login verification (six digits, 10-minute
expiry, 60-second resend cooldown, five invalid attempts) but on a
**separate code and token namespace** — a code or token issued for password
reset can never be accepted by the first-login flow, and vice versa. That's
enforced at the database query level (`purpose: PASSWORD_RESET` vs
`purpose: EMAIL_VERIFICATION`), not just by convention.

One deliberate asymmetry: this flow is only for a student who **already has**
a password. Calling `password-reset/request` before first-login setup
returns `409 PASSWORD_NOT_SET` and points back at §5 instead — there's
nothing to "reset" yet, so we didn't want a request that silently no-ops or
sends a confusing email.

Eligibility (paid, active cycle, not suspended) is rechecked at request time
**and again at completion**, same principle as the existing `setPassword`
recheck — a student who gets suspended mid-reset can't finish setting a new
password.

New email template (`PASSWORD_RESET` job type) added to the notification
worker; the worker itself needed no changes since it's payload-agnostic by
design.

**What we didn't build:** an admin-side "reset this student's password"
action. That's still a real manual-DB-update situation if a student can't
receive email at all. Worth a follow-up if that turns out to matter in
practice.

---

## 2. Student profile (`GET /me`) — Fixed, with honest scope

**Blocking → resolved**, but only for the fields that actually exist:

```
GET /api/v1/app/me
Authorization: Bearer <accessToken>

200 {
  "data": {
    "collegeEmail": "...",
    "fullName": "...",
    "phone": "...",
    "batch": "...",
    "year": 2,
    "role": "FIRST_YEAR_STUDENT"
  }
}
```

`enrollmentNumber`, `branch`, `section`, `semester`, `CGPA`, and
`domainPreferences` are **not** in the response, because they're not in the
data model — `batch` is free text captured at registration (e.g. "CSE
2024-2028"), not a structured branch/section pair, and domain assignment is
explicitly out of Phase-1 scope per the PRD, not just unbuilt. Shipping fake
or null values for fields that don't exist felt worse than an honest,
smaller profile — same instinct you already applied to the placeholder
screen.

If Profile needs those fields for real, that's new columns on `User` plus
probably a registration-form change to actually collect them. Flag it
separately if it's needed for launch — it's bigger than this endpoint.

`role` comes from the JSON body, never the JWT — confirmed the token stays
opaque exactly as §2 requires.

---

## 3. Recruitment status — Fixed, simpler than proposed

**Needed → resolved**, but the shape is deliberately smaller than the
five-stage tracker originally suggested, because that's what the real data
supports:

```
GET /api/v1/app/recruitment
Authorization: Bearer <accessToken>

200 {
  "data": {
    "paid": true,
    "decision": "PENDING",
    "decisionNote": null,
    "testSlot": { "booked": false, "startTime": null, "endTime": null }
  }
}
```

Answers to the open questions from the original gap doc:

- **Rejected outcome is shown.** `decision` is one of `PENDING | SELECTED |
  WAITLISTED | REJECTED`, with an optional applicant-visible `decisionNote`.
- **Test slots are visible before they happen**, not only after — this
  endpoint reads the real `TestSlotBooking` relation, so once a student books
  a slot, `testSlot.booked` and its times show immediately.
- **It's read-only.** No stage confirmation or offer acceptance in Phase 1 —
  the only student-initiated action is booking a slot, which is a separate,
  not-yet-built endpoint (test-slot booking UI doesn't exist on the backend
  yet either).
- **There's no generic "Test → Interview" pipeline.** Interviews exist in the
  schema but are explicitly retained-for-future and unused in Phase 1 — don't
  build a stage for something that can't happen yet.

Design Home around `decision` + `testSlot.booked` as two independent facts,
not a multi-step tracker. A separate `GET /app/timeline` for scheduled
events (test day, interview day, custom milestones) is still just planned,
not built — that's what would eventually feed a chronological "what's next"
view alongside this.

---

## 4. Token lifetime and expiry behaviour — Confirmed, now documented

**No code change was needed** — this was already correct, we just hadn't
written it down. §9 of the contract now says explicitly:

- `401 UNAUTHORIZED` = the token itself is the problem (missing, malformed,
  expired, or logged out). Drop to guest, show "session expired."
- `403 APP_ACCESS_DENIED` = valid token, but the student lost eligibility
  (suspended, or registration flipped back to unpaid). Different message,
  not "log back in."
- This recheck happens on **every** authenticated call, not just login, so a
  student who loses eligibility mid-session gets `403` on their very next
  request — not a stale 7-day window.
- No refresh endpoint. Weekly re-login stands as accepted behavior.

Implement session handling against this exactly as described; nothing here
changed, it's just now written into the contract instead of implied.

---

## 5. Logout — Fixed

**Question → resolved.** New endpoint:

```
POST /api/v1/app/auth/logout
Authorization: Bearer <accessToken>

200 { "data": { "loggedOut": true } }
```

Access tokens are stateless JWTs, so logout can't literally delete the
token — instead every token now carries a unique ID (`jti`), and logout adds
that ID to a **Redis-backed denylist** with a TTL matching the token's own
remaining lifetime. Any further request with that token gets `401`
immediately, even though the JWT signature is still technically valid and
its 7-day expiry hasn't passed.

This reuses the Redis instance already running for the email queue — no new
infrastructure, no new service to operate. The denylist entry expires on its
own at the token's `exp`, so nothing ever needs a cleanup job and it never
grows unbounded.

This directly closes the shared/lost-device exposure you flagged: instead of
"stays valid for up to 7 days after logout," it's now "invalid the instant
logout succeeds."

**Still true, and fine to leave:** if the app can't reach the server on
logout (offline device), the token remains valid until natural expiry.
That's an inherent limit of client-initiated revocation, not something worth
solving here — same as any mobile app.

---

## 6. Content endpoints — Still open, action items given

**Not fixed — still needs product scoping, not backend work.** No change
here. Two separate asks, two separate answers:

- **Public content (domains/events/achievements):** genuinely not scoped as
  a module yet. It's real work — a new admin-editable content model, not a
  quick addition — and belongs as its own conversation rather than riding
  along with auth/profile work.
- **Event registration button:** our recommendation stands — remove it now.
  There is no backend concept of event attendance at all, so it's currently
  a button that lies about what it does.

If this becomes a priority, say so explicitly and we'll scope it as its own
module rather than bolt it onto what shipped here.

---

## 7. Two email addresses per student — Confirmed, no code change needed

**Confirmed**, not a bug or gap — verified directly against the code:

- `collegeEmail` is the only identity key. `normalizedEmail` (what every
  login actually checks against) is derived from `collegeEmail` alone.
- `personalEmail` exists on `User`, is captured at registration, but is
  never read by any auth code path. It's contact info, not a login option.
- There is no backend-mailed-password flow anywhere in the codebase. Every
  password is student-chosen through the verification-code flow (first-login
  or, now, reset). `PASSWORD_LOGIN` from the email gate always means "this
  student already finished first-login setup," never anything else.

**Action for the app:** copy should say "choose a password" / "check your
email for your verification code" — never "check your email for your
password," since that flow doesn't exist.

---

## 8. Secure credential storage — No backend action

Unchanged from the original response: this is entirely app-side, no
disagreement, no backend follow-up needed.

---

## Summary

| # | Gap | Status | What shipped |
|---|---|---|---|
| 1 | Password reset | **Fixed** | 3 new endpoints, separate code/token namespace, new email template |
| 2 | `GET /me` | **Fixed** (reduced scope) | New endpoint; only real schema fields — enrollment/branch/section/semester/CGPA need a separate scoping pass |
| 3 | Recruitment status | **Fixed** (simpler shape) | New endpoint; `decision` + `testSlot`, no fake pipeline stages |
| 4 | Token expiry semantics | **Confirmed, documented** | No code change; written into contract §9 |
| 5 | Logout | **Fixed** | New endpoint, Redis-backed `jti` denylist, no new infra |
| 6 | Content + event registration | **Still open** | Needs product scoping; remove the Register button now |
| 7 | Two-email clarification | **Confirmed** | No code change; copy guidance given |
| 8 | Secure storage | **No action needed** | App-side only |

Six of eight gaps have real endpoints behind them now (1, 2, 3, 4, 5, 7 —
counting 4 and 7 as "confirmed correct" rather than "built"). Gap 6 remains
a genuine open scoping question, not an oversight — raise it separately when
ready and we'll size it properly instead of guessing at a content schema now.

See `APP_API_CONTRACT.md` (v0.2.0) for the authoritative request/response
shapes, including the full error-code tables for every new endpoint.
