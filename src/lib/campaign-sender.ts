import { sendCampaignEmail } from '@/lib/email';
import { createHash } from 'crypto';
import { FIREBASE_PROJECT_ID } from '@/lib/server-auth';

export const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export function hashContact(c: string) {
  return createHash('sha256').update(c.trim().toLowerCase()).digest('hex');
}

export async function buildSuppressedSet(emails: string[]): Promise<Set<string>> {
  const suppressed = new Set<string>();
  await Promise.all(
    emails.map(async email => {
      const res = await fetch(`${FIRESTORE_BASE}/suppression_list/${hashContact(email)}`);
      if (res.ok) suppressed.add(email);
    })
  );
  return suppressed;
}

export async function sendEmailBatch(
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

export async function fetchEligibleUsers(segmentId: string | null): Promise<{
  allUsers: any[];
  roleFilter: string | null;
  lastActiveDaysFilter: number | null;
  countryFilter: string | null;
}> {
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

  return { allUsers: eligible, roleFilter, lastActiveDaysFilter, countryFilter };
}

export interface SendCampaignResult {
  emailSent: number;
  smsSent: number;
  totalSent: number;
  sentA?: number;
  sentB?: number;
}

export async function executeCampaignSend(
  campaignId: string,
  camFields: any,
  origin: string,
): Promise<SendCampaignResult> {
  const f = camFields;
  const now = new Date().toISOString();
  const channel = f.channel?.stringValue ?? 'email';
  const defaultSubject = f.template?.mapValue?.fields?.subject?.stringValue ?? '(no subject)';
  const defaultBody    = f.template?.mapValue?.fields?.emailBody?.stringValue ?? '';
  const smsBody        = f.template?.mapValue?.fields?.smsBody?.stringValue ?? '';
  const segmentId      = f.segmentId?.stringValue ?? null;
  const isAbTest       = f.abTest?.mapValue?.fields?.enabled?.booleanValue === true;

  // Mark as sending
  await fetch(
    `${FIRESTORE_BASE}/marketing_campaigns/${campaignId}?updateMask.fieldPaths=status&updateMask.fieldPaths=sentAt`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { status: { stringValue: 'sending' }, sentAt: { stringValue: now } } }),
    }
  );

  const { allUsers: eligible } = await fetchEligibleUsers(segmentId);

  let emailSent = 0;
  let smsSent = 0;
  let sentA = 0;
  let sentB = 0;

  // ── Email ────────────────────────────────────────────────────────────────────
  if (channel === 'email' || channel === 'both') {
    const emailUsers = eligible.filter((u: any) => u.fields?.email?.stringValue);
    const allEmails  = emailUsers.map((u: any) => u.fields.email.stringValue as string);
    const suppressed = await buildSuppressedSet(allEmails);

    if (isAbTest) {
      const abFields = f.abTest.mapValue.fields;
      const subjectA = abFields.variantA?.mapValue?.fields?.subject?.stringValue   || defaultSubject;
      const bodyA    = abFields.variantA?.mapValue?.fields?.emailBody?.stringValue  || defaultBody;
      const subjectB = abFields.variantB?.mapValue?.fields?.subject?.stringValue   || defaultSubject;
      const bodyB    = abFields.variantB?.mapValue?.fields?.emailBody?.stringValue  || defaultBody;

      const mid    = Math.floor(emailUsers.length / 2);
      const groupA = emailUsers.slice(0, mid);
      const groupB = emailUsers.slice(mid);

      [sentA, sentB] = await Promise.all([
        sendEmailBatch(groupA, suppressed, subjectA, bodyA, campaignId, origin),
        sendEmailBatch(groupB, suppressed, subjectB, bodyB, campaignId, origin),
      ]);
      emailSent = sentA + sentB;
    } else {
      emailSent = await sendEmailBatch(eligible.filter((u: any) => u.fields?.email?.stringValue), suppressed, defaultSubject, defaultBody, campaignId, origin);
    }
  }

  // ── SMS ──────────────────────────────────────────────────────────────────────
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

  // ── Write final analytics ────────────────────────────────────────────────────
  const updateFields: Record<string, any> = {
    status:    { stringValue: 'sent' },
    sentAt:    { stringValue: now },
    updatedAt: { stringValue: now },
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
            mapValue: { fields: { sent: { integerValue: sentA }, opened: { integerValue: 0 }, clicked: { integerValue: 0 }, converted: { integerValue: 0 } } },
          },
          analyticsB: {
            mapValue: { fields: { sent: { integerValue: sentB }, opened: { integerValue: 0 }, clicked: { integerValue: 0 }, converted: { integerValue: 0 } } },
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

  return { emailSent, smsSent, totalSent, ...(isAbTest ? { sentA, sentB } : {}) };
}
