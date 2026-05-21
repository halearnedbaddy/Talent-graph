import { FIREBASE_PROJECT_ID, FIREBASE_API_KEY } from './server-auth';

type FSCollection = 'athletes' | 'scouts' | 'users' | 'clubs';

async function fetchDoc(collection: FSCollection, uid: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${uid}?key=${FIREBASE_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.fields ?? null;
  } catch {
    return null;
  }
}

function str(fields: Record<string, any> | null, key: string): string {
  return fields?.[key]?.stringValue ?? '';
}

/** Returns the phone number for an athlete or scout (Kenya-format). */
export async function lookupPhone(uid: string, collection: FSCollection = 'athletes'): Promise<string | null> {
  const fields = await fetchDoc(collection, uid);
  return str(fields, 'phone') || str(fields, 'contactPhone') || null;
}

/** Returns a single string field from any Firestore document. */
export async function lookupField(collection: FSCollection, uid: string, field: string): Promise<string> {
  const fields = await fetchDoc(collection, uid);
  return str(fields, field);
}

/** Returns first + last name joined. */
export async function lookupName(collection: FSCollection, uid: string): Promise<string> {
  const fields = await fetchDoc(collection, uid);
  if (!fields) return 'Someone';
  const first = str(fields, 'firstName') || str(fields, 'name') || '';
  const last = str(fields, 'lastName') || '';
  return `${first} ${last}`.trim() || 'Someone';
}

// ─── In-memory rate limiter (prevents SMS spam per athlete) ──────────────────
// Key: `${event}:${recipientId}` → timestamp of last send
const _lastSent = new Map<string, number>();
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export function isRateLimited(event: string, recipientId: string): boolean {
  const key = `${event}:${recipientId}`;
  const last = _lastSent.get(key) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return true;
  _lastSent.set(key, Date.now());
  return false;
}
