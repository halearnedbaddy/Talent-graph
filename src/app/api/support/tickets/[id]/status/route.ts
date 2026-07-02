import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';
import { sendTicketResolvedNotification } from '@/lib/email';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const updates = await req.json();
  const now = new Date().toISOString();
  const fields: Record<string, any> = { updatedAt: { stringValue: now } };
  const mask = ['updatedAt'];
  if (updates.status) { fields.status = { stringValue: updates.status }; mask.push('status'); }
  if (updates.priority) { fields.priority = { stringValue: updates.priority }; mask.push('priority'); }
  if (updates.assignedAgentId !== undefined) { fields.assignedAgentId = updates.assignedAgentId ? { stringValue: updates.assignedAgentId } : { nullValue: null }; mask.push('assignedAgentId'); }
  if (updates.tags) { fields.tags = { arrayValue: { values: updates.tags.map((t: string) => ({ stringValue: t })) } }; mask.push('tags'); }
  const maskQuery = mask.map(m => `updateMask.fieldPaths=${m}`).join('&');
  await fetch(`${FIRESTORE_BASE}/support_tickets/${id}?${maskQuery}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  });
  if (updates.status === 'resolved') {
    const ticketRes = await fetch(`${FIRESTORE_BASE}/support_tickets/${id}`);
    if (ticketRes.ok) {
      const ticketDoc = await ticketRes.json();
      const f = ticketDoc.fields || {};
      const senderEmail = f.senderEmail?.stringValue;
      const senderName = f.senderName?.stringValue || senderEmail;
      const subject = f.subject?.stringValue || '(no subject)';
      if (senderEmail) {
        sendTicketResolvedNotification({ ticketId: id, subject, senderName: senderName || senderEmail, senderEmail, csatBaseUrl: req.nextUrl.origin }).catch(err => console.error('[email]', err));
      }
    }
  }
  return Response.json({ success: true });
}
