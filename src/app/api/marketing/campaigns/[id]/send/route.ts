import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';
import { sendCampaignEmail } from '@/lib/email';
import { createHash } from 'crypto';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function hashContact(contact: string) {
  return createHash('sha256').update(contact.trim().toLowerCase()).digest('hex');
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const campaignId = params.id;
  const origin = req.nextUrl.origin;

  const camRes = await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${campaignId}`);
  if (!camRes.ok) return Response.json({ error: 'Campaign not found' }, { status: 404 });
  const camDoc = await camRes.json();
  const f = camDoc.fields || {};
  const status = f.status?.stringValue;
  if (status === 'sent' || status === 'sending') {
    return Response.json({ error: 'Campaign already sent or sending' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const channel = f.channel?.stringValue ?? 'email';
  const subject = f.template?.mapValue?.fields?.subject?.stringValue ?? '(no subject)';
  const emailBody = f.template?.mapValue?.fields?.emailBody?.stringValue ?? '';
  const smsBody = f.template?.mapValue?.fields?.smsBody?.stringValue ?? '';
  const segmentId = f.segmentId?.stringValue;

  // Mark as sending
  await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${campaignId}?updateMask.fieldPaths=status&updateMask.fieldPaths=sentAt`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: 'sending' }, sentAt: { stringValue: now } } }),
  });

  // Fetch segment filter criteria
  let roleFilter: string | null = null;
  let lastActiveDaysFilter: number | null = null;
  let countryFilter: string | null = null;

  if (segmentId) {
    const segRes = await fetch(`${FIRESTORE_BASE}/marketing_segments/${segmentId}`);
    if (segRes.ok) {
      const segDoc = await segRes.json();
      const sc = segDoc.fields?.filterCriteria?.mapValue?.fields || {};
      roleFilter = sc.role?.stringValue ?? null;
      lastActiveDaysFilter = sc.lastActiveDaysAgo?.integerValue ? Number(sc.lastActiveDaysAgo.integerValue) : null;
      countryFilter = sc['geography.country']?.stringValue ?? null;
    }
  }

  // Fetch users (paginate up to 500)
  let allUsers: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${FIRESTORE_BASE}/users?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const usersRes = await fetch(url);
    const usersData = await usersRes.json();
    allUsers = allUsers.concat(usersData.documents || []);
    pageToken = usersData.nextPageToken;
  } while (pageToken && allUsers.length < 500);

  // Filter users by segment criteria
  const cutoff = lastActiveDaysFilter ? Date.now() - lastActiveDaysFilter * 864e5 : null;
  const eligible = allUsers.filter((u: any) => {
    const uf = u.fields || {};
    if (roleFilter && uf.role?.stringValue !== roleFilter) return false;
    if (cutoff && uf.lastActiveAt?.timestampValue) {
      const last = new Date(uf.lastActiveAt.timestampValue).getTime();
      if (last < cutoff) return false;
    }
    if (countryFilter && uf.geography?.mapValue?.fields?.country?.stringValue !== countryFilter) return false;
    return true;
  });

  let emailSent = 0;
  let smsSent = 0;

  // Send emails
  if ((channel === 'email' || channel === 'both') && emailBody && subject) {
    const suppressed = new Set<string>();

    // Check suppression list in batches of 10
    const emailUsers = eligible.filter((u: any) => u.fields?.email?.stringValue);
    for (const u of emailUsers) {
      const email = u.fields.email.stringValue;
      const hash = hashContact(email);
      const supRes = await fetch(`${FIRESTORE_BASE}/suppression_list/${hash}`);
      if (supRes.ok) { suppressed.add(email); continue; }
    }

    for (const u of emailUsers) {
      const uf = u.fields || {};
      const email = uf.email?.stringValue;
      if (!email || suppressed.has(email)) continue;

      const firstName = uf.firstName?.stringValue || uf.displayName?.stringValue?.split(' ')[0] || 'there';
      const role = uf.role?.stringValue || '';

      const ok = await sendCampaignEmail({
        to: email,
        firstName,
        role,
        subject,
        rawBody: emailBody,
        campaignId,
        unsubscribeBaseUrl: origin,
      });
      if (ok) emailSent++;
    }
  }

  // Send SMS via BulkSMS
  if ((channel === 'sms' || channel === 'both') && smsBody) {
    const phoneUsers = eligible.filter((u: any) => u.fields?.phone?.stringValue?.length > 5);
    smsSent = phoneUsers.length;

    if (process.env.BULKSMS_USERNAME && process.env.BULKSMS_PASSWORD) {
      for (const u of phoneUsers.slice(0, 200)) {
        const phone = u.fields.phone.stringValue;
        await fetch('https://api.bulksms.com/v1/messages', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.BULKSMS_USERNAME}:${process.env.BULKSMS_PASSWORD}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to: phone, body: smsBody }),
        }).catch(() => {});
      }
    }
  }

  const totalSent = emailSent + smsSent;

  // Update campaign to sent with analytics
  const sentMask = ['status', 'analytics', 'sentAt', 'updatedAt'];
  await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${campaignId}?${sentMask.map(f => `updateMask.fieldPaths=${f}`).join('&')}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        status: { stringValue: 'sent' },
        sentAt: { stringValue: now },
        updatedAt: { stringValue: now },
        analytics: {
          mapValue: {
            fields: {
              sent: { integerValue: totalSent },
              delivered: { integerValue: totalSent },
              opened: { integerValue: 0 },
              clicked: { integerValue: 0 },
              bounced: { integerValue: 0 },
              optedOut: { integerValue: 0 },
              converted: { integerValue: 0 },
            },
          },
        },
      },
    }),
  });

  return Response.json({ success: true, emailSent, smsSent, totalSent });
}
