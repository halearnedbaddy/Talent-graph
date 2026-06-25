---
name: Security audit decisions
description: Key findings and architectural decisions from the full security audit of Talent Graph Kenya
---

## Firebase API Key — False Positive
`AIzaSy...` in `src/firebase/config.ts` and `src/lib/server-auth.ts` is intentionally public — it's a Firebase project identifier, not a secret. SAST scanners flag it but it is by design. Recommend Google Cloud Console HTTP referrer restriction as mitigation.

## No Firebase Admin SDK
The app verifies tokens via Identity Toolkit REST API (`identitytoolkit.googleapis.com/v1/accounts:lookup`). Token revocation is NOT enforced — revoked tokens remain valid up to 1 hour. This is a documented architectural risk.

## Internal Service Auth
`verifyBearerOrInternal()` in `src/lib/server-auth.ts` accepts `Authorization: Internal {SMS_SECRET}` for server-to-server calls. This secret must be rotated and never logged.

## Fixed Vulnerabilities (June 2026)
- XSS in match-entry print: `document.write()` with unescaped user data — fixed with `escHtml()` helper (31 call sites)
- `Math.random()` in `generateTempPassword()` — replaced with `crypto.randomInt`
- Missing HTTP security headers — added CSP, HSTS, X-Frame-Options, etc. to next.config.ts
- No edge middleware — created src/middleware.ts for dashboard route protection
- Upload MIME type not validated — added allowlist + path-to-MIME enforcement, reduced max from 500MB to 50MB
- Overly permissive Firestore rules — fixed live_matches, live_match_events, match_invitations, club_conversations, support_threads/messages

## Key Remaining Risks
- No rate limiting on any API endpoint (priority: add to /api/contact and /api/ai/*)
- Temporary password returned in /api/staff/create response (by design, but risky)
- 15 HIGH dependency vulnerabilities (run `npm audit fix`)
- `/users` and `/athletes` readable by scouts — PII field segregation needed for true privacy
- No CSRF protection beyond SameSite cookies

## CSP Notes
Google Analytics (googletagmanager.com) must be explicitly allowed in script-src and connect-src — added in next.config.ts.
