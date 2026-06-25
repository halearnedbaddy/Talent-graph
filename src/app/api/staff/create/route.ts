import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from '@/lib/server-auth';
import { randomInt } from 'crypto';

// ── Cryptographically secure password generation ──────────────────────────────
function generateTempPassword(): string {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#!';
  const all     = upper + lower + digits;

  const pick = (charset: string) => charset[randomInt(charset.length)];

  // Guarantee at least one of each required character class
  const required = [
    pick(upper), pick(upper),
    pick(lower), pick(lower),
    pick(digits), pick(digits),
    pick(special),
  ];

  // Fill remaining characters from the full set
  const extra: string[] = [];
  for (let i = 0; i < 5; i++) extra.push(pick(all));

  // Fisher-Yates shuffle using crypto.randomInt
  const chars = [...required, ...extra];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function toFirestoreValue(val: unknown): unknown {
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return { integerValue: String(val) };
  if (val === null || val === undefined) return { nullValue: null };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function buildFirestoreBody(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

async function firestorePatch(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
  bearerToken?: string
) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(buildFirestoreBody(data)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Firestore write failed: ${res.status}`);
  }
  return res.json();
}

async function firestorePost(
  collection: string,
  data: Record<string, unknown>,
  bearerToken?: string
) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?key=${FIREBASE_API_KEY}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildFirestoreBody(data)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Firestore write failed: ${res.status}`);
  }
  return res.json();
}

async function firestoreGet(collection: string, docId: string, bearerToken?: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const headers: Record<string, string> = {};
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  return res.json();
}

// ── Input validation helpers ──────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ['coach', 'assistant_coach', 'analyst', 'gk_coach', 'scout'] as const;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const adminIdToken = authHeader.slice(7).trim();
    const adminUid = await verifyIdToken(adminIdToken);
    if (!adminUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, displayName, role, clubId, clubName, phone } = body as {
      email: string;
      displayName: string;
      role: string;
      clubId: string;
      clubName: string;
      phone?: string;
    };

    if (!email || !displayName || !role || !clubId) {
      return NextResponse.json({ error: 'Missing required fields: email, displayName, role, clubId' }, { status: 400 });
    }

    // Validate email format
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Validate display name length
    if (displayName.trim().length < 2 || displayName.length > 100) {
      return NextResponse.json({ error: 'Display name must be 2–100 characters' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role as any)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Strategy 1: The club owner's UID IS the clubId
    const isDirectOwner = adminUid === clubId || clubId === `club_${adminUid}`;

    // Strategy 2: Check users/{adminUid}.role === 'club'
    let isClubRoleUser = false;
    if (!isDirectOwner) {
      const userDoc = await firestoreGet('users', adminUid, adminIdToken);
      const userRole = userDoc?.fields?.role?.stringValue;
      const userClubId = userDoc?.fields?.clubId?.stringValue;
      if (userRole === 'club' && (!userClubId || userClubId === clubId)) {
        isClubRoleUser = true;
      }
    }

    // Strategy 3: Explicit admin entry in club_members
    let isClubMemberAdmin = false;
    if (!isDirectOwner && !isClubRoleUser) {
      const adminCheckRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminIdToken}` },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'club_members' }],
              where: {
                compositeFilter: {
                  op: 'AND',
                  filters: [
                    { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: adminUid } } },
                    { fieldFilter: { field: { fieldPath: 'clubId' }, op: 'EQUAL', value: { stringValue: clubId } } },
                    { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
                  ],
                },
              },
              limit: 1,
            },
          }),
        }
      );
      const adminCheckData = await adminCheckRes.json();
      isClubMemberAdmin = Array.isArray(adminCheckData) && adminCheckData.some((r: any) => r.document);
    }

    const isAdmin = isDirectOwner || isClubRoleUser || isClubMemberAdmin;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: you are not an admin of this club' }, { status: 403 });
    }

    const tempPassword = generateTempPassword();

    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: tempPassword, displayName, returnSecureToken: true }),
      }
    );
    const signUpData = await signUpRes.json();
    if (!signUpRes.ok) {
      const msg = signUpData?.error?.message || 'Failed to create account';
      if (msg === 'EMAIL_EXISTS') {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const newUid: string = signUpData.localId;
    const newUserIdToken: string = signUpData.idToken;

    const nameParts = displayName.trim().split(' ');
    const firstName = nameParts[0] ?? displayName;
    const lastName = nameParts.slice(1).join(' ') || '';
    const now = new Date().toISOString();

    const userRole = role === 'analyst' ? 'analyst' : role === 'scout' ? 'scout' : 'coach';

    await firestorePatch('users', newUid, {
      id: newUid,
      email,
      firstName,
      lastName,
      creationTimestamp: now,
      isEmailVerified: true,
      role: userRole,
      profileCompleted: true,
      onboardingStep: 'complete',
      displayName,
      phone: phone ?? '',
      createdByAdmin: adminUid,
      updatedAt: now,
    }, newUserIdToken);

    await firestorePost('club_members', {
      userId: newUid,
      clubId,
      clubName,
      role,
      status: 'active',
      displayName,
      firstName,
      lastName,
      joinedAt: now,
      invitedAt: now,
      invitedBy: adminUid,
      createdAt: now,
    }, adminIdToken);

    // NOTE: tempPassword is returned intentionally so the admin can hand it to the new staff member.
    // This is a deliberate UX trade-off. Ensure this response is only transmitted over HTTPS and
    // the admin is instructed to share via a secure channel (not email in plaintext).
    return NextResponse.json({
      success: true,
      uid: newUid,
      email,
      displayName,
      role,
      tempPassword,
      message: `Account created. Share these credentials securely with ${displayName}.`,
    });
  } catch (err: any) {
    // Never expose raw error messages to the client
    console.error('[staff/create]', err?.message ?? err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
