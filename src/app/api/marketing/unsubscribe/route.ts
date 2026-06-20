import { NextRequest } from 'next/server';
import { FIREBASE_PROJECT_ID } from '@/lib/server-auth';
import { createHash } from 'crypto';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function hashContact(contact: string) {
  return createHash('sha256').update(contact.trim().toLowerCase()).digest('hex');
}

export async function POST(req: NextRequest) {
  const { email, phone, source = 'campaign_unsubscribe' } = await req.json();

  const now = new Date().toISOString();
  const writes = [];

  if (email) {
    const hash = hashContact(email);
    writes.push(
      fetch(`${FIRESTORE_BASE}/suppression_list/${hash}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            type: { stringValue: 'email' },
            contact: { stringValue: email },
            reason: { stringValue: 'user_request' },
            source: { stringValue: source },
            createdAt: { stringValue: now },
          },
        }),
      })
    );
  }

  if (phone) {
    const hash = hashContact(phone);
    writes.push(
      fetch(`${FIRESTORE_BASE}/suppression_list/${hash}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            type: { stringValue: 'sms' },
            contact: { stringValue: phone },
            reason: { stringValue: 'user_request' },
            source: { stringValue: source },
            createdAt: { stringValue: now },
          },
        }),
      })
    );
  }

  await Promise.all(writes);
  return Response.json({ success: true });
}
