---
name: Firebase assertion suppression in Next.js 15
description: How to prevent Firestore INTERNAL ASSERTION FAILED (ca9) from appearing in Next.js dev overlay — plain overrides fail; defineProperty getter/setter is required.
---

## The rule
Suppress Firebase Firestore `INTERNAL ASSERTION FAILED (ID: ca9)` in Next.js 15 dev mode using `Object.defineProperty` with a getter/setter on `console.error`, placed in an inline `<script dangerouslySetInnerHTML>` as the **first child of `<head>`** in `layout.tsx`.

**Why:** Next.js 15 dev overlay wraps `console.error` at overlay-chunk load time. Any override registered in `useEffect`, module-level code, or even `strategy="beforeInteractive"` Script runs _after_ Next.js wraps it. Next.js's wrapper captures the call for devtools display _before_ calling the original, so returning early from the original doesn't help.

`Object.defineProperty` with a setter means: when Next.js does `console.error = theirWrapper`, our setter intercepts and re-wraps `theirWrapper` with our filter. Firebase's call then hits our getter's function first — before Next.js captures it.

**How to apply:** See `src/app/layout.tsx` — the inline `<script>` is the first child of `<head>`.

## Pattern matched
```
'INTERNAL ASSERTION FAILED', 'ID: ca9', 'FIRESTORE_INTERNAL'
```

## Reconnect signalling
The inline script dispatches `window.dispatchEvent(new CustomEvent('tg:firebase-assertion'))` when it suppresses. `FirebaseClientProvider` (`src/firebase/client-provider.tsx`) listens for this event and triggers the "Connection interrupted – Reconnect" banner.

## What does NOT work (already tried)
- Plain `console.error = ourFn` in `<head>` script — Next.js wraps our fn, captures before our return
- `useEffect` capture-phase `window.addEventListener('error', ...)` — registers after Next.js overlay loads
- `strategy="beforeInteractive"` `<Script>` outside `<head>` — hydration error in Next.js 15 App Router
- Watching `console.warn` for the suppressed pattern — too fragile
