---
name: DM Conversation ID Separator
description: The deterministic DM conversation ID must use '_dm_' separator everywhere it's created or looked up
---

The canonical DM conversation ID helper is in `src/lib/relationships.ts`:
`[uid1, uid2].sort().join('_dm_')`

**Why:** If different parts of the app use a different separator (e.g. `_`), they create separate Firestore documents for the same pair, so existing conversations are invisible from new chat initializations.

**How to apply:** Any place that computes a DM conversation ID must use `_dm_` as the join separator — currently: UserSearchDialog, relationships.ts, squad page dmConvId helper.
