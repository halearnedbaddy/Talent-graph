---
name: Firestore concurrent listener limit
description: Too many simultaneous onSnapshot listeners on the same Firestore collection causes INTERNAL ASSERTION FAILED crash. Fix pattern for coach dashboard.
---

## The Rule
Never subscribe to the same Firestore collection independently from multiple sibling components. Share the data via React context from the nearest common ancestor (typically the layout).

**Why:** Firestore's watch stream has an internal assertion limit. When 14 pages + layout + notifications hook all call `onSnapshot` on `club_members` simultaneously (16+ listeners), the SDK crashes with `INTERNAL ASSERTION FAILED: Unexpected state`.

**How to apply:**
- Coach dashboard uses `CoachClubContext` (`src/app/coach-dashboard/coach-context.tsx`) to share `{ clubId, clubName, membershipsLoaded }` from the layout's single subscription.
- Child pages consume via `useCoachClub()` — zero additional `club_members` listeners.
- The layout keeps exactly two `club_members` subscriptions: active membership (for clubId/clubName) and pending invites (for invite badge).
- `membershipsLoaded = !membershipLoading` (true once the query resolves, even if empty).
- Pages that previously used `memberLoading` for their own loading gate now derive it as `!membershipsLoaded`.
