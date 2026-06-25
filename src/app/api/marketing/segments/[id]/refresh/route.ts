import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const segRes = await fetch(`${FIRESTORE_BASE}/marketing_segments/${id}`);
  if (!segRes.ok) return Response.json({ error: 'Segment not found' }, { status: 404 });

  const segDoc = await segRes.json();
  const sc = segDoc.fields?.filterCriteria?.mapValue?.fields || {};
  const roleFilter = sc.role?.stringValue ?? null;
  const lastActiveDaysFilter = sc.lastActiveDaysAgo?.integerValue ? Number(sc.lastActiveDaysAgo.integerValue) : null;
  const countryFilter = sc['geography.country']?.stringValue ?? null;

  // Count users matching criteria
  let allUsers: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${FIRESTORE_BASE}/users?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const usersRes = await fetch(url);
    const usersData = await usersRes.json();
    allUsers = allUsers.concat(usersData.documents || []);
    pageToken = usersData.nextPageToken;
  } while (pageToken && allUsers.length < 2000);

  const cutoff = lastActiveDaysFilter ? Date.now() - lastActiveDaysFilter * 864e5 : null;

  const count = allUsers.filter((u: any) => {
    const uf = u.fields || {};
    if (roleFilter && uf.role?.stringValue !== roleFilter) return false;
    if (cutoff && uf.lastActiveAt?.timestampValue) {
      const last = new Date(uf.lastActiveAt.timestampValue).getTime();
      if (last < cutoff) return false;
    }
    if (countryFilter && uf.geography?.mapValue?.fields?.country?.stringValue !== countryFilter) return false;
    return true;
  }).length;

  const now = new Date().toISOString();
  await fetch(
    `${FIRESTORE_BASE}/marketing_segments/${id}?updateMask.fieldPaths=memberCount&updateMask.fieldPaths=lastRefreshedAt`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          memberCount: { integerValue: count },
          lastRefreshedAt: { stringValue: now },
        },
      }),
    }
  );

  return Response.json({ success: true, memberCount: count });
}
