import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from '@/lib/server-auth';
import { sendNewTicketNotification } from '@/lib/email';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function docToTicket(doc: any) {
  const f = doc.fields || {};
  const id = doc.name?.split('/').pop();
  const str = (k: string) => f[k]?.stringValue ?? null;
  const bool = (k: string) => f[k]?.booleanValue ?? false;
  const arr = (k: string) => f[k]?.arrayValue?.values?.map((v: any) => v.stringValue) ?? [];
  const ts = (k: string) => f[k]?.timestampValue ?? f[k]?.stringValue ?? null;
  return {
    id,
    senderUserId: str('senderUserId'),
    senderEmail: str('senderEmail') ?? '',
    senderName: str('senderName') ?? '',
    source: str('source') ?? 'in_app',
    subject: str('subject') ?? '',
    status: str('status') ?? 'open',
    priority: str('priority') ?? 'medium',
    tags: arr('tags'),
    assignedAgentId: str('assignedAgentId'),
    slaDeadline: ts('slaDeadline') ?? '',
    csatRating: str('csatRating'),
    accountProvisioned: bool('accountProvisioned'),
    provisionedUserId: str('provisionedUserId'),
    lastMessage: str('lastMessage'),
    createdAt: ts('createdAt') ?? '',
    updatedAt: ts('updatedAt') ?? '',
  };
}

export async function GET(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const status = params.get('status');
  const priority = params.get('priority');

  try {
    const url = `${FIRESTORE_BASE}/support_tickets?orderBy=updatedAt desc&pageSize=50`;
    const res = await fetch(url);
    const data = await res.json();
    let tickets = (data.documents || []).map(docToTicket);
    if (status && status !== 'all') tickets = tickets.filter((t: any) => t.status === status);
    if (priority && priority !== 'all') tickets = tickets.filter((t: any) => t.priority === priority);
    return Response.json({ tickets });
  } catch {
    return Response.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    senderEmail,
    senderName,
    subject,
    message,
    priority = 'medium',
    tag = 'technical',
    source = 'in_app',
  } = body;

  if (!senderEmail || !subject || !message) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const slaHours = priority === 'high' ? 1 : priority === 'medium' ? 4 : 24;
  const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

  const ticketData = {
    fields: {
      senderUserId: { stringValue: uid },
      senderEmail: { stringValue: senderEmail },
      senderName: { stringValue: senderName || senderEmail },
      source: { stringValue: source },
      subject: { stringValue: subject },
      status: { stringValue: 'open' },
      priority: { stringValue: priority },
      tags: { arrayValue: { values: [{ stringValue: tag }] } },
      assignedAgentId: { nullValue: null },
      slaDeadline: { stringValue: slaDeadline },
      csatRating: { nullValue: null },
      accountProvisioned: { booleanValue: false },
      provisionedUserId: { nullValue: null },
      lastMessage: { stringValue: message.slice(0, 100) },
      createdAt: { stringValue: now },
      updatedAt: { stringValue: now },
    },
  };

  const ticketRes = await fetch(`${FIRESTORE_BASE}/support_tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData),
  });

  if (!ticketRes.ok) return Response.json({ error: 'Failed to create ticket' }, { status: 500 });
  const ticket = await ticketRes.json();
  const ticketId = ticket.name?.split('/').pop();

  await fetch(`${FIRESTORE_BASE}/support_tickets/${ticketId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        senderType: { stringValue: 'user' },
        senderName: { stringValue: senderName || senderEmail },
        body: { stringValue: message },
        sentVia: { stringValue: source },
        sentAt: { stringValue: now },
      },
    }),
  });

  // Send email notification (fire-and-forget — never blocks the response)
  sendNewTicketNotification({
    ticketId,
    subject,
    message,
    priority,
    tag,
    senderName: senderName || senderEmail,
    senderEmail,
    slaDeadline,
  }).catch(err => console.error('[email] Failed to send ticket notification:', err));

  return Response.json({ success: true, ticketId });
}
