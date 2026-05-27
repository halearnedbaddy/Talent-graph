---
name: MessagesHub defaultConversationId async sync
description: MessagesHub needs a useEffect to react when defaultConversationId arrives after mount
---

`MessagesHub` initializes `activeConvId` with `useState(defaultConversationId || null)`. If the parent passes `defaultConversationId` asynchronously (e.g., after a Firestore read resolves), MessagesHub never updates because useState only reads its initial value once.

**Why:** The club messages page computes groupConvId after fetching the user's clubId from Firestore, which arrives after the first render. Without a sync effect, MessagesHub stays stuck on null.

**How to apply:** The fix (already in place) is a useEffect in MessagesHub:
```tsx
useEffect(() => {
  if (defaultConversationId && !activeConvId) {
    setActiveConvId(defaultConversationId);
  }
}, [defaultConversationId, activeConvId]);
```
