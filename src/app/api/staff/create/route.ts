import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#!';
  const all = upper + lower + digits;
  let pw = '';
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += upper[Math.floor(Math.random() * upper.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += lower[Math.floor(Math.random() * lower.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += digits[Math.floor(Math.random() * digits.length)];
  pw += special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 5; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw.split('').sort(() => Math.random() - 0.5).join('');
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

async function firestorePatch(collection: string, docId: string, data: Record<string, unknown>) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildFirestoreBody(data)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Firestore write failed: ${res.status}`);
  }
  return res.json();
}

async function firestorePost(collection: string, data: Record<string, unknown>) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildFirestoreBody(data)),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Firestore write failed: ${res.status}`);
  }
  return res.json();
}

async function firestoreGet(collection: string, docId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.slice(7).trim();
    const adminUid = await verifyIdToken(idToken);
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

    const validRoles = ['coach', 'assistant_coach', 'analyst', 'gk_coach', 'scout'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Strategy 1: The club owner's UID IS the clubId (most common — club registered as a user,
    // their Firebase Auth UID becomes the clubs/{clubId} document ID).
    const isDirectOwner = adminUid === clubId;

    // Strategy 2: Check users/{adminUid}.role === 'club' (they are a club account type)
    // and their associated clubId matches, OR they own any club (role=club is enough for now).
    let isClubRoleUser = false;
    if (!isDirectOwner) {
      const userDoc = await firestoreGet('users', adminUid);
      const userRole = userDoc?.fields?.role?.stringValue;
      const userClubId = userDoc?.fields?.clubId?.stringValue;
      // Accept if role is 'club' and either their clubId matches or no clubId stored yet
      if (userRole === 'club' && (!userClubId || userClubId === clubId)) {
        isClubRoleUser = true;
      }
    }

    // Strategy 3: Explicit admin entry in club_members (for promoted admins)
    let isClubMemberAdmin = false;
    if (!isDirectOwner && !isClubRoleUser) {
      const adminCheckRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: 'club_members' }],
              where: {
                compositeFilter: {
                  op: 'AND',
                  filters: [
                    { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: adminUid } } },
                    { fieldFilter: { field: { fieldPath: 'clubId' }, op: 'EQUAL', value: { stringValue: clubId } } },
                    { fieldFilter: { field: { fieldPath: 'role' }, op: 'EQUAL', value: { stringValue: 'admin' } } },
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
        body: JSON.stringify({ email, password: tempPassword, displayName, returnSecureToken: false }),
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
    });

    await firestorePost('club_members', {
      userId: newUid,
      clubId,
      clubName,
      role,
      status: 'active',
      displayName,
      joinedAt: now,
      invitedAt: now,
      invitedBy: adminUid,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      uid: newUid,
      email,
      displayName,
      role,
      tempPassword,
      message: `Account created. Share these credentials with ${displayName}.`,
    });
  } catch (err: any) {
    console.error('[staff/create]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
