import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${params.id}`, { method: 'DELETE' });
  return Response.json({ success: true });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Clone campaign
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const camRes = await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${params.id}`);
  if (!camRes.ok) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  const camDoc = await camRes.json();
  const f = camDoc.fields || {};
  const now = new Date().toISOString();

  const clonedFields = {
    ...f,
    name: { stringValue: `${f.name?.stringValue ?? 'Campaign'} (Copy)` },
    status: { stringValue: 'draft' },
    sentAt: { nullValue: null },
    createdAt: { stringValue: now },
    createdBy: { stringValue: uid },
    analytics: {
      mapValue: {
        fields: {
          sent: { integerValue: 0 },
          delivered: { integerValue: 0 },
          opened: { integerValue: 0 },
          clicked: { integerValue: 0 },
          bounced: { integerValue: 0 },
          optedOut: { integerValue: 0 },
          converted: { integerValue: 0 },
        },
      },
    },
  };

  const res = await fetch(`${FIRESTORE_BASE}/marketing_campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: clonedFields }),
  });

  if (!res.ok) return Response.json({ error: 'Clone failed' }, { status: 500 });
  const doc = await res.json();
  return Response.json({ success: true, id: doc.name?.split('/').pop() });
}
