---
name: SMS / BulkSMS architecture
description: How the SMS notification system is wired — BulkSMS client, server route, coach/scout entry points, and idToken flow
---

## Core stack
- `src/lib/bulksms.ts` — raw BulkSMS client: `sendBulkSMS(recipients, body)`, `normalizePhone()`, SMS message builders
- `src/lib/sms.ts` — thin wrapper: `sendSMS(to, msg)` and `sendSMSBatch(numbers[], msg)` both calling bulksms.ts
- `src/app/api/sms/send/route.ts` — POST endpoint; verifies Firebase Bearer token; accepts `{ batch: string[], message }` or `{ to, message }`; returns `{ success, sent, failed }`

## BulkSMS credentials
- Endpoint: `https://api.bulksms.com/v1/messages` (NOT bulksmsnigeria.com)
- Auth: Basic `BULKSMS_USERNAME:BULKSMS_PASSWORD` base64-encoded
- Sender: `BULKSMS_SENDER_ID` env var (optional, falls back to 'TalentGraph')
- User still needs to provide BULKSMS_USERNAME and BULKSMS_PASSWORD secrets

## idToken pattern for coach pages
```typescript
const [idToken, setIdToken] = useState<string | null>(null);
useEffect(() => { user?.getIdToken().then(setIdToken); }, [user]);
```
Then pass `idToken` to `SendNotificationDialog` as `userToken` prop.

## Notification dialog flow (coach)
1. Coach creates training session (training/page.tsx) or schedule event (schedule/page.tsx)
2. `handleCreate*` sets `notifyEvent` state and opens `SendNotificationDialog`
3. Dialog fetches athletes where `affiliatedClubId == clubId` (or uses pre-fetched `athletes` prop from training page)
4. On confirm: `POST /api/sms/send` with `{ batch: phones[], message }`, then writes to `notifications` Firestore collection
5. Notification Centre page at `/coach-dashboard/notifications` shows history via `NotificationCenter` component

## Invitations flow (scout)
1. Scout fills form in `InvitationFormTab` (new 'invitations' tab in scout dashboard)
2. Creates doc in `invitations` Firestore collection
3. Calls `POST /api/invitations/send` → sends SMS via BulkSMS with invite URL `/invite/{id}`
4. Public landing page at `/invite/[id]/page.tsx` lets players Accept/Decline (updates Firestore)

## Firestore collections
- `notifications` — { clubId, clubName, coachName, type, eventTitle, date, message, recipientCount, successCount, failedCount, status, createdAt }
- `invitations` — { scoutId, scoutName, playerName, phone, email, teamName, position, message, inviteUrl, status, smsStatus, createdAt }

**Why:** BulkSMS.com requires username+password Basic auth not API token; Nigerian endpoint was wrong provider.
