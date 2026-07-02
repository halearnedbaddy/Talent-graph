import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { note, agentName } = await req.json();
  if (!note?.trim()) return Response.json({ error: 'Note text required' }, { status: 400 });
  const now = new Date().toISOString();
  await fetch(`${FIRESTORE_BASE}/support_tickets/${id}/internalNotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { agentId: { stringValue: uid }, agentName: { stringValue: agentName || 'Agent' }, note: { stringValue: note }, createdAt: { stringValue: now } } }),
  });
  return Response.json({ success: true });
}
