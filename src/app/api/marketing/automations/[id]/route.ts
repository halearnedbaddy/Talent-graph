import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await fetch(`${FIRESTORE_BASE}/marketing_automations/${params.id}`, { method: 'DELETE' });
  return Response.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { status } = await req.json();
  if (!status) return Response.json({ error: 'Status required' }, { status: 400 });

  await fetch(
    `${FIRESTORE_BASE}/marketing_automations/${params.id}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          status: { stringValue: status },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    }
  );
  return Response.json({ success: true });
}
