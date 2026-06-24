import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';
import { sendCampaignEmail } from '@/lib/email';
import { createHash } from 'crypto';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function hashContact(c: string) {
  return createHash('sha256').update(c.trim().toLowerCase()).digest('hex');
}

async function buildSuppressedSet(emails: string[]): Promise<Set<string>> {
  const suppressed = new Set<string>();
  await Promise.all(
    emails.map(async email => {
      const res = await fetch(`${FIRESTORE_BASE}/suppression_list/${hashContact(email)}`);
      if (res.ok) suppressed.add(email);
    })
  );
  return suppressed;
}

async function sendBatch(
  users: any[],
  suppressed: Set<string>,
  subject: string,
  body: string,
  campaignId: string,
  origin: string,
): Promise<number> {
  let sent = 0;
  for (const u of users) {
    const uf = u.fields || {};
    const email = uf.email?.stringValue;
    if (!email || suppressed.has(email)) continue;
    const firstName = uf.firstName?.stringValue || uf.displayName?.stringValue?.split(' ')[0] || 'there';
    const role = uf.role?.stringValue || '';
    const ok = await sendCampaignEmail({ to: email, firstName, role, subject, rawBody: body, campaignId, unsubscribeBaseUrl: origin });
    if (ok) sent++;
  }
  return sent;
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
  const defaultSubject  = f.template?.mapValue?.fields?.subject?.stringValue   ?? '(no subject)';
  const defaultBody     = f.template?.mapValue?.fields?.emailBody?.stringValue  ?? '';
  const smsBody         = f.template?.mapValue?.fields?.smsBody?.stringValue    ?? '';
  const segmentId       = f.segmentId?.stringValue;
  const isAbTest        = f.abTest?.mapValue?.fields?.enabled?.booleanValue === true;

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

  // Fetch and filter users
  let allUsers: any[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${FIRESTORE_BASE}/users?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const usersRes = await fetch(url);
    const usersData = await usersRes.json();
    allUsers = allUsers.concat(usersData.documents || []);
    pageToken = usersData.nextPageToken;
  } while (pageToken && allUsers.length < 500);

  const cutoff = lastActiveDaysFilter ? Date.now() - lastActiveDaysFilter * 864e5 : null;
  const eligible = allUsers.filter((u: any) => {
    const uf = u.fields || {};
    if (roleFilter && uf.role?.stringValue !== roleFilter) return false;
    if (cutoff && uf.lastActiveAt?.timestampValue) {
      if (new Date(uf.lastActiveAt.timestampValue).getTime() < cutoff) return false;
    }
    if (countryFilter && uf.geography?.mapValue?.fields?.country?.stringValue !== countryFilter) return false;
    return true;
  });

  let emailSent = 0;
  let smsSent = 0;
  let sentA = 0;
  let sentB = 0;

  // ── Email sending ───────────────────────────────────────────────────────────
  if (channel === 'email' || channel === 'both') {
    const emailUsers = eligible.filter((u: any) => u.fields?.email?.stringValue);
    const allEmails = emailUsers.map((u: any) => u.fields.email.stringValue);
    const suppressed = await buildSuppressedSet(allEmails);

    if (isAbTest) {
      // A/B split: 50/50
      const abFields = f.abTest.mapValue.fields;
      const subjectA = abFields.variantA?.mapValue?.fields?.subject?.stringValue   || defaultSubject;
      const bodyA    = abFields.variantA?.mapValue?.fields?.emailBody?.stringValue  || defaultBody;
      const subjectB = abFields.variantB?.mapValue?.fields?.subject?.stringValue   || defaultSubject;
      const bodyB    = abFields.variantB?.mapValue?.fields?.emailBody?.stringValue  || defaultBody;

      const mid = Math.floor(emailUsers.length / 2);
      const groupA = emailUsers.slice(0, mid);
      const groupB = emailUsers.slice(mid);

      [sentA, sentB] = await Promise.all([
        sendBatch(groupA, suppressed, subjectA, bodyA, campaignId, origin),
        sendBatch(groupB, suppressed, subjectB, bodyB, campaignId, origin),
      ]);
      emailSent = sentA + sentB;
    } else {
      emailSent = await sendBatch(emailUsers, suppressed, defaultSubject, defaultBody, campaignId, origin);
    }
  }

  // ── SMS sending ─────────────────────────────────────────────────────────────
  if ((channel === 'sms' || channel === 'both') && smsBody) {
    const phoneUsers = eligible.filter((u: any) => u.fields?.phone?.stringValue?.length > 5);
    smsSent = phoneUsers.length;
    if (process.env.BULKSMS_USERNAME && process.env.BULKSMS_PASSWORD) {
      await Promise.all(
        phoneUsers.slice(0, 200).map((u: any) =>
          fetch('https://api.bulksms.com/v1/messages', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(`${process.env.BULKSMS_USERNAME}:${process.env.BULKSMS_PASSWORD}`).toString('base64')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ to: u.fields.phone.stringValue, body: smsBody }),
          }).catch(() => {})
        )
      );
    }
  }

  const totalSent = emailSent + smsSent;

  // ── Determine initial A/B winner (by sent ratio — real winner by open rate later) ──
  const winner = isAbTest ? null : undefined;

  // ── Write final analytics to Firestore ──────────────────────────────────────
  const updateFields: Record<string, any> = {
    status:     { stringValue: 'sent' },
    sentAt:     { stringValue: now },
    updatedAt:  { stringValue: now },
    analytics: {
      mapValue: {
        fields: {
          sent:      { integerValue: totalSent },
          delivered: { integerValue: totalSent },
          opened:    { integerValue: 0 },
          clicked:   { integerValue: 0 },
          bounced:   { integerValue: 0 },
          optedOut:  { integerValue: 0 },
          converted: { integerValue: 0 },
        },
      },
    },
  };

  if (isAbTest) {
    updateFields.abTest = {
      mapValue: {
        fields: {
          ...f.abTest.mapValue.fields,
          analyticsA: {
            mapValue: {
              fields: {
                sent:      { integerValue: sentA },
                opened:    { integerValue: 0 },
                clicked:   { integerValue: 0 },
                converted: { integerValue: 0 },
              },
            },
          },
          analyticsB: {
            mapValue: {
              fields: {
                sent:      { integerValue: sentB },
                opened:    { integerValue: 0 },
                clicked:   { integerValue: 0 },
                converted: { integerValue: 0 },
              },
            },
          },
          winner: { nullValue: null },
        },
      },
    };
  }

  const maskFields = ['status', 'analytics', 'sentAt', 'updatedAt', ...(isAbTest ? ['abTest'] : [])];
  await fetch(
    `${FIRESTORE_BASE}/marketing_campaigns/${campaignId}?${maskFields.map(m => `updateMask.fieldPaths=${m}`).join('&')}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: updateFields }),
    }
  );

  return Response.json({ success: true, emailSent, smsSent, totalSent, ...(isAbTest ? { sentA, sentB } : {}) });
}
