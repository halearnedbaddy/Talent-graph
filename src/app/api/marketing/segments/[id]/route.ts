import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await fetch(`${FIRESTORE_BASE}/marketing_segments/${params.id}`, { method: 'DELETE' });
  return Response.json({ success: true });
}
