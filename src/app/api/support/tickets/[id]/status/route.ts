import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const updates = await req.json();
  const now = new Date().toISOString();

  const fields: Record<string, any> = { updatedAt: { stringValue: now } };
  const mask = ['updatedAt'];

  if (updates.status) { fields.status = { stringValue: updates.status }; mask.push('status'); }
  if (updates.priority) { fields.priority = { stringValue: updates.priority }; mask.push('priority'); }
  if (updates.assignedAgentId !== undefined) { fields.assignedAgentId = updates.assignedAgentId ? { stringValue: updates.assignedAgentId } : { nullValue: null }; mask.push('assignedAgentId'); }
  if (updates.tags) { fields.tags = { arrayValue: { values: updates.tags.map((t: string) => ({ stringValue: t })) } }; mask.push('tags'); }

  const maskQuery = mask.map(f => `updateMask.fieldPaths=${f}`).join('&');
  await fetch(`${FIRESTORE_BASE}/support_tickets/${params.id}?${maskQuery}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  return Response.json({ success: true });
}
