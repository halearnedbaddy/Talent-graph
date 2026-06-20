import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = params.id;

  const camRes = await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${campaignId}`);
  if (!camRes.ok) return Response.json({ error: 'Campaign not found' }, { status: 404 });
  const camDoc = await camRes.json();
  const status = camDoc.fields?.status?.stringValue;
  if (status === 'sent' || status === 'sending') {
    return Response.json({ error: 'Campaign already sent or sending' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const mask = ['status', 'sentAt', 'updatedAt'];
  const maskQuery = mask.map(f => `updateMask.fieldPaths=${f}`).join('&');

  await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${campaignId}?${maskQuery}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'sending' },
        sentAt: { stringValue: now },
        updatedAt: { stringValue: now },
      },
    }),
  });

  const segmentId = camDoc.fields?.segmentId?.stringValue;
  const channel = camDoc.fields?.channel?.stringValue ?? 'email';
  const smsBody = camDoc.fields?.template?.mapValue?.fields?.smsBody?.stringValue ?? '';

  let sentCount = 0;

  if (segmentId && (channel === 'sms' || channel === 'both') && smsBody) {
    const usersRes = await fetch(`${FIRESTORE_BASE}/users?pageSize=200`);
    const usersData = await usersRes.json();
    const users = usersData.documents || [];

    const roleFilter = camDoc.fields?.filterCriteria?.mapValue?.fields?.role?.stringValue;

    const eligible = users.filter((u: any) => {
      const f = u.fields || {};
      if (roleFilter && f.role?.stringValue !== roleFilter) return false;
      const phone = f.phone?.stringValue;
      return phone && phone.length > 5;
    });

    sentCount = eligible.length;

    if (eligible.length > 0 && process.env.BULKSMS_USERNAME && process.env.BULKSMS_PASSWORD) {
      const numbers = eligible.map((u: any) => u.fields?.phone?.stringValue).filter(Boolean);
      for (const number of numbers.slice(0, 100)) {
        await fetch('https://api.bulksms.com/v1/messages', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.BULKSMS_USERNAME}:${process.env.BULKSMS_PASSWORD}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to: number, body: smsBody }),
        }).catch(() => {});
      }
    }
  }

  const sentMask = ['status', 'analytics.sent', 'sentAt'];
  const sentMaskQuery = sentMask.map(f => `updateMask.fieldPaths=${f}`).join('&');
  await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${campaignId}?${sentMaskQuery}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'sent' },
        'analytics.sent': { integerValue: sentCount },
        sentAt: { stringValue: now },
      },
    }),
  });

  return Response.json({ success: true, sentCount });
}
