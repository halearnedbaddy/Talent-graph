import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function docToCampaign(doc: any) {
  const f = doc.fields || {};
  const id = doc.name?.split('/').pop();
  const str = (k: string) => f[k]?.stringValue ?? null;
  const num = (k: string) => f[k]?.integerValue ? Number(f[k].integerValue) : (f[k]?.doubleValue ?? 0);
  const ts = (k: string) => f[k]?.timestampValue ?? f[k]?.stringValue ?? null;
  const tmpl = f.template?.mapValue?.fields || {};
  const analytics = f.analytics?.mapValue?.fields || {};
  return {
    id,
    name: str('name') ?? '',
    channel: str('channel') ?? 'email',
    segmentId: str('segmentId') ?? '',
    status: str('status') ?? 'draft',
    scheduledAt: ts('scheduledAt'),
    sentAt: ts('sentAt'),
    template: {
      subject: tmpl.subject?.stringValue ?? '',
      emailBody: tmpl.emailBody?.stringValue ?? '',
      smsBody: tmpl.smsBody?.stringValue ?? '',
    },
    analytics: {
      sent: analytics.sent?.integerValue ? Number(analytics.sent.integerValue) : 0,
      delivered: analytics.delivered?.integerValue ? Number(analytics.delivered.integerValue) : 0,
      opened: analytics.opened?.integerValue ? Number(analytics.opened.integerValue) : 0,
      clicked: analytics.clicked?.integerValue ? Number(analytics.clicked.integerValue) : 0,
      bounced: analytics.bounced?.integerValue ? Number(analytics.bounced.integerValue) : 0,
      optedOut: analytics.optedOut?.integerValue ? Number(analytics.optedOut.integerValue) : 0,
      converted: analytics.converted?.integerValue ? Number(analytics.converted.integerValue) : 0,
    },
    createdAt: ts('createdAt') ?? '',
    createdBy: str('createdBy') ?? '',
  };
}

export async function GET(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await fetch(`${FIRESTORE_BASE}/marketing_campaigns?pageSize=50`);
  const data = await res.json();
  const campaigns = (data.documents || []).map(docToCampaign);
  return Response.json({ campaigns });
}

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, channel, segmentId, template, scheduledAt } = await req.json();
  if (!name?.trim() || !channel || !segmentId) {
    return Response.json({ error: 'Name, channel, and segment are required' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const res = await fetch(`${FIRESTORE_BASE}/marketing_campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        name: { stringValue: name },
        channel: { stringValue: channel },
        segmentId: { stringValue: segmentId },
        status: { stringValue: scheduledAt ? 'scheduled' : 'draft' },
        scheduledAt: scheduledAt ? { stringValue: scheduledAt } : { nullValue: null },
        sentAt: { nullValue: null },
        template: {
          mapValue: {
            fields: {
              subject: { stringValue: template?.subject ?? '' },
              emailBody: { stringValue: template?.emailBody ?? '' },
              smsBody: { stringValue: template?.smsBody ?? '' },
            },
          },
        },
        analytics: {
          mapValue: {
            fields: {
              sent: { integerValue: 0 },
              delivered: { integerValue: 0 },
              opened: { integerValue: 0 },
              clicked: { integerValue: 0 },
              bounced: { integerValue: 0 },
              optedOut: { integerValue: 0 },
              converted: { integerValue: 0 },
            },
          },
        },
        createdAt: { stringValue: now },
        createdBy: { stringValue: uid },
      },
    }),
  });

  if (!res.ok) return Response.json({ error: 'Failed to create campaign' }, { status: 500 });
  const doc = await res.json();
  return Response.json({ success: true, id: doc.name?.split('/').pop() });
}
