export const FIREBASE_API_KEY = 'AIzaSyDLmugbxMX_0QGxxKRzuUR-9nqtiFBgDQ0';
export const FIREBASE_PROJECT_ID = 'studio-1186001190-d08bc';
export const STORAGE_BUCKET = 'studio-1186001190-d08bc.appspot.com';

/**
 * Verifies a Firebase ID token via the Identity Toolkit REST API.
 * Returns the user's UID on success, or null if the token is missing/invalid.
 * No Firebase Admin SDK required.
 */
export async function verifyIdToken(idToken: string): Promise<string | null> {
  if (!idToken) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.users?.[0]?.localId) return null;
    return data.users[0].localId as string;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies a Bearer token from the Authorization header.
 * Returns the UID or null.
 */
export async function verifyBearerToken(
  request: { headers: { get(name: string): string | null } }
): Promise<string | null> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return verifyIdToken(header.slice(7).trim());
}

/**
 * Returns a 401 NextResponse JSON body — use when auth check fails.
 */
export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
