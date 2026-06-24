import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';
import { sendAgentReplyNotification } from '@/lib/email';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { body, agentName } = await req.json();
  if (!body?.trim()) return Response.json({ error: 'Message body required' }, { status: 400 });

  const now = new Date().toISOString();
  const ticketId = params.id;

  await fetch(`${FIRESTORE_BASE}/support_tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        senderType: { stringValue: 'agent' },
        senderName: { stringValue: agentName || 'Support Agent' },
        body: { stringValue: body },
        sentVia: { stringValue: 'app' },
        sentAt: { stringValue: now },
      },
    }),
  });

  await fetch(
    `${FIRESTORE_BASE}/support_tickets/${ticketId}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=lastMessage`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          status: { stringValue: 'pending_user' },
          updatedAt: { stringValue: now },
          lastMessage: { stringValue: body.slice(0, 100) },
        },
      }),
    }
  );

  // Fetch ticket to get sender details for email notification
  const ticketRes = await fetch(`${FIRESTORE_BASE}/support_tickets/${ticketId}`);
  if (ticketRes.ok) {
    const ticketDoc = await ticketRes.json();
    const f = ticketDoc.fields || {};
    const senderEmail = f.senderEmail?.stringValue;
    const senderName = f.senderName?.stringValue || senderEmail;
    const subject = f.subject?.stringValue || '(no subject)';

    if (senderEmail) {
      sendAgentReplyNotification({
        ticketId,
        subject,
        replyBody: body,
        agentName: agentName || 'Support Agent',
        senderName: senderName || senderEmail,
        senderEmail,
      }).catch(err => console.error('[email] Failed to send reply notification:', err));
    }
  }

  return Response.json({ success: true });
}
