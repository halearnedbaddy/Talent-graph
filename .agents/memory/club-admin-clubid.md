---
name: Club Admin clubId lookup
description: Club admins get their clubId from club_members collection, role='admin', no status filter needed
---

The club admin user has a `club_members` document with `userId == uid` and `role == 'admin'`. When querying for the admin's clubId, use:
```tsx
query(collection(firestore, 'club_members'), where('userId', '==', user.uid))
```
(no status filter — the admin doc may not have status='active')

**Why:** Filtering by `status == 'active'` may miss the admin's document since it was created differently from staff/athlete member docs. The club-profile page uses `role == 'admin'` filter; the layout uses `status == 'active'` — both work but no-filter is most robust.
