---
name: Firestore listener hygiene
description: Root causes and fixes for INTERNAL ASSERTION FAILED (ID: ca9) / ve:-1 in Firestore 11.x, including navigation-triggered crashes.
---

## The rule
Every Firestore collection must have at most ONE active `onSnapshot` listener at any time. Multiple components subscribing to the same collection path simultaneously corrupts the WebSocket stream state → `INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9) CONTEXT: {"ve":-1}`.

**Why:** The Firestore SDK 11.x `WatchChangeAggregator.TargetState` asserts `ve >= 0` when processing watch stream updates. When multiple listeners for the same path are open, they share a transport-level stream; a race between subscribe/unsubscribe and an incoming server snapshot leaves a target's `currentStatusVersion` at -1 → assertion fires.

**How to apply:**
1. Lift all shared collection reads to the lowest common parent component. Pass data down as props or context. Example: layout subscribes to `users/{uid}`, child pages consume from context — no child creates its own listener.
2. Never subscribe to the same path in more than one component at a time.
3. `useCollection` dependency must be the query *object reference* (from `useMemoFirebase`/`useMemo`), NOT a derived path string.

## Navigation crash pattern (Next.js App Router)
Clicking between tabs crashes with "This page couldn't load" even when no explicit duplicates exist. Cause: rapid unmount/mount during navigation causes subscribe/unsubscribe to interleave.

**Fix — use `isActive` + `unsubscribeRef` in hooks:**
```ts
const unsubscribeRef = useRef<(() => void) | null>(null);
useEffect(() => {
  // Eagerly cancel previous subscription BEFORE creating the new one
  if (unsubscribeRef.current) {
    try { unsubscribeRef.current(); } catch {}
    unsubscribeRef.current = null;
  }
  let isActive = true;
  const unsub = onSnapshot(ref, (snap) => {
    if (!isActive) return; // ignore stale callbacks
    // handle snap
  }, (err) => {
    if (!isActive) return;
    // handle err
  });
  unsubscribeRef.current = unsub;
  return () => {
    isActive = false;
    try { unsub(); } catch { /* swallow Firebase assertion */ }
    unsubscribeRef.current = null;
  };
}, [stableDep]);
```

## Use stable primitive deps, not object refs
Firebase `User` objects can get new references on every auth state tick. Using the full `user` object as a `useMemoFirebase` dep recreates queries on every tick → rapid unsubscribe/resubscribe cycles mid-navigation.

```ts
// WRONG — user object reference changes on auth ticks
useMemoFirebase(() => (...), [firestore, user]);

// CORRECT — uid string is stable
useMemoFirebase(() => (...), [firestore, user?.uid]);
```

## Firebase Logger intercept
Firebase SDK logs assertion failures via `Logger.error → Logger.defaultLogHandler → console.error` — NOT as an uncaught exception. `window.addEventListener('error')` does NOT catch these. Must override `console.error` directly in `client-provider.tsx` to detect and trigger Firestore stream recovery.

## Recovery pattern (client-provider.tsx)
1. Override `console.error`, detect `INTERNAL ASSERTION FAILED` / `ID: ca9` pattern
2. Set `streamError = true` after 800ms debounce
3. React unmounts all children (drops every `onSnapshot`)
4. After 300ms, call `buildServices()` to get fresh `Firestore` instance
5. Children remount, all listeners restart cleanly
