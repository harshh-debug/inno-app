function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character] ?? character;
  });
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — Innogeeks</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.5rem; }
  form { margin-top: 24px; }
  input[type="email"] { width: 100%; padding: 10px; font-size: 1rem; box-sizing: border-box; }
  button { margin-top: 12px; padding: 10px 20px; font-size: 1rem; cursor: pointer; }
  .notice { background: #fff4e5; border: 1px solid #f0c36d; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }
  .error { background: #fdeaea; border: 1px solid #e57373; padding: 12px 16px; border-radius: 6px; margin: 16px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function renderDeleteAccountFormPage(): string {
  return page(
    "Delete your account",
    `
<h1>Delete your Innogeeks account</h1>
<p>Enter the college email you registered with. We'll send you a confirmation link — clicking it starts the deletion process immediately.</p>
<div class="notice">
  <strong>Before you continue:</strong> once confirmed, your account is scheduled for deletion in 14 days.
  Logging back in to the Innogeeks app during that window cancels it automatically. After 14 days, your
  name, phone number, and personal email are permanently erased; recruitment records tied to your
  application are kept in anonymized form for legal/audit purposes.
</div>
<form method="POST" action="/delete-account">
  <label for="collegeEmail">College email</label>
  <input type="email" id="collegeEmail" name="collegeEmail" required maxlength="320" placeholder="you@example.edu">
  <button type="submit">Send confirmation link</button>
</form>
<p>Questions? Write to innogeeks@kiet.edu.</p>
`,
  );
}

export function renderDeleteAccountRequestedPage(): string {
  return page(
    "Check your email",
    `
<h1>Check your email</h1>
<p>If that email matches an Innogeeks account, we've sent a confirmation link to it. The link expires in 15 minutes.</p>
<p>Nothing happens to your account until you click that link.</p>
`,
  );
}

export function renderDeleteAccountConfirmedPage(scheduledFor: Date): string {
  return page(
    "Deletion scheduled",
    `
<h1>Your account is scheduled for deletion</h1>
<p>Your account will be permanently deleted on <strong>${escapeHtml(scheduledFor.toDateString())}</strong>.</p>
<p>Changed your mind? Just log back in to the Innogeeks app before that date to cancel automatically.</p>
<p>Questions? Write to innogeeks@kiet.edu.</p>
`,
  );
}

export function renderDeleteAccountErrorPage(message: string): string {
  return page(
    "Link invalid",
    `
<h1>This link isn't valid</h1>
<div class="error">${escapeHtml(message)}</div>
<p><a href="/delete-account">Request a new confirmation link</a></p>
`,
  );
}

export function renderValidationErrorPage(): string {
  return page(
    "Enter a valid email",
    `
<h1>Enter a valid email</h1>
<div class="error">That doesn't look like a valid email address.</div>
<p><a href="/delete-account">Try again</a></p>
`,
  );
}

export function renderPrivacyPolicyPage(): string {
  return page(
    "Privacy Policy",
    `
<h1>Innogeeks Privacy Policy</h1>
<p>Innogeeks is a club recruitment app. This page explains what data we collect, why, and how to delete it.</p>

<h2>What we collect</h2>
<p>When you register through the public recruitment form, we collect: full name, phone number, college email,
personal email, batch, and academic year, plus your answers to the recruitment form. We do not use any
third-party analytics, advertising, or crash-reporting SDKs — your data is never shared with anyone outside
Innogeeks.</p>

<h2>Why we collect it</h2>
<p>This data is used solely to run recruitment: verifying eligibility, scheduling tests and interviews,
communicating decisions, and (if selected) organizing you into a domain team.</p>

<h2>How long we keep it</h2>
<p>We keep your data for as long as your account is active. If you request deletion, your personal data
(name, phone, personal email, login credentials) is permanently erased within 14 days. Your recruitment
application record is retained in anonymized form afterward — with your name and contact details removed —
so that the recruitment history and decisions for a given cycle remain intact for other applicants and for
audit purposes.</p>

<h2>Deleting your account</h2>
<p>You can request deletion from inside the Innogeeks app (Profile → Account &amp; Data → Delete my account)
or from this website at <a href="/delete-account">/delete-account</a>. Either path starts the same 14-day
process; logging back into the app during that window cancels it.</p>

<h2>Contact</h2>
<p>Questions about this policy or your data: <a href="mailto:innogeeks@kiet.edu">innogeeks@kiet.edu</a>.</p>
`,
  );
}
