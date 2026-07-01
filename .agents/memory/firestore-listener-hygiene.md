---
name: Firestore listener hygiene
description: Root causes and fixes for INTERNAL ASSERTION FAILED (ID: ca9) / ve:-1 in Firestore 11.x
---

## The rule
Every Firestore collection must have at most ONE active `onSnapshot` listener at any time. Multiple components subscribing to the same collection path simultaneously corrupts the WebSocket stream state → `INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9) CONTEXT: {"ve":-1}`.

**Why:** The Firestore SDK 11.x `WatchChangeAggregator.TargetState` asserts `ve >= 0` when processing watch stream updates. When multiple listeners for the same path are open, they share a transport-level stream; a race between subscribe/unsubscribe and an incoming server snapshot leaves a target's `currentStatusVersion` at -1 → assertion fires.

**How to apply:**
1. Lift all shared collection reads to the lowest common parent component. Pass data down as props.
2. Never subscribe to `collection(firestore, 'athletes')` in more than one component at a time. In the scout dashboard, `athletes`, `savedSearches`, `connections`, and `privateNotes` are all owned by `dashboard-client.tsx` and passed as props.
3. `useCollection` dependency must be the query *object reference* (from `useMemoFirebase`/`useMemo`), NOT a derived path string. A path string cannot encode filter conditions, so two different queries on the same collection share the same key and the effect never re-subscribes.

## Firebase Logger intercept
Firebase SDK logs assertion failures via `Logger.error → Logger.defaultLogHandler → console.error` — NOT as an uncaught exception. `window.addEventListener('error')` does NOT catch these. Must override `console.error` directly in `client-provider.tsx` to detect and trigger Firestore stream recovery.

## Recovery pattern (client-provider.tsx)
1. Override `console.error`, detect `INTERNAL ASSERTION FAILED` / `ID: ca9` pattern
2. Set `streamError = true` after 800ms debounce
3. React unmounts all children (drops every `onSnapshot`)
4. After 300ms, call `buildServices()` to get fresh `Firestore` instance
5. Children remount, all listeners restart cleanly
