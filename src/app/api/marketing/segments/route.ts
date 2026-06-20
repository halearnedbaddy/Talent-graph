import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function docToSegment(doc: any) {
  const f = doc.fields || {};
  const id = doc.name?.split('/').pop();
  const str = (k: string) => f[k]?.stringValue ?? null;
  const num = (k: string) => f[k]?.integerValue ? Number(f[k].integerValue) : (f[k]?.doubleValue ?? 0);
  const ts = (k: string) => f[k]?.timestampValue ?? f[k]?.stringValue ?? null;
  const criteria = f.filterCriteria?.mapValue?.fields || {};
  return {
    id,
    name: str('name') ?? '',
    filterCriteria: {
      role: criteria.role?.stringValue ?? null,
      lastActiveDaysAgo: criteria.lastActiveDaysAgo?.integerValue ? Number(criteria.lastActiveDaysAgo.integerValue) : null,
      geography: {
        country: criteria['geography.country']?.stringValue ?? null,
        county: criteria['geography.county']?.stringValue ?? null,
      },
    },
    memberCount: num('memberCount'),
    createdBy: str('createdBy') ?? '',
    lastRefreshedAt: ts('lastRefreshedAt') ?? '',
    createdAt: ts('createdAt') ?? '',
  };
}

export async function GET(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${FIRESTORE_BASE}/marketing_segments?pageSize=50`);
  const data = await res.json();
  const segments = (data.documents || []).map(docToSegment);
  return Response.json({ segments });
}

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, filterCriteria } = await req.json();
  if (!name?.trim()) return Response.json({ error: 'Segment name required' }, { status: 400 });

  const now = new Date().toISOString();

  const criteriaFields: Record<string, any> = {};
  if (filterCriteria?.role) criteriaFields.role = { stringValue: filterCriteria.role };
  if (filterCriteria?.lastActiveDaysAgo) criteriaFields.lastActiveDaysAgo = { integerValue: filterCriteria.lastActiveDaysAgo };
  if (filterCriteria?.geography?.country) criteriaFields['geography.country'] = { stringValue: filterCriteria.geography.country };
  if (filterCriteria?.geography?.county) criteriaFields['geography.county'] = { stringValue: filterCriteria.geography.county };

  const res = await fetch(`${FIRESTORE_BASE}/marketing_segments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        name: { stringValue: name },
        filterCriteria: { mapValue: { fields: criteriaFields } },
        memberCount: { integerValue: 0 },
        createdBy: { stringValue: uid },
        lastRefreshedAt: { stringValue: now },
        createdAt: { stringValue: now },
      },
    }),
  });

  if (!res.ok) return Response.json({ error: 'Failed to create segment' }, { status: 500 });
  const doc = await res.json();
  return Response.json({ success: true, id: doc.name?.split('/').pop() });
}
