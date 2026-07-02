import { NextRequest } from 'next/server';
import { verifyBearerToken } from '@/lib/server-auth';
import { FIRESTORE_BASE, executeCampaignSend } from '@/lib/campaign-sender';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: campaignId } = await params;
  const origin = req.nextUrl.origin;
  const camRes = await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${campaignId}`);
  if (!camRes.ok) return Response.json({ error: 'Campaign not found' }, { status: 404 });
  const camDoc = await camRes.json();
  const f = camDoc.fields || {};
  const status = f.status?.stringValue;
  if (status === 'sent' || status === 'sending') {
    return Response.json({ error: 'Campaign already sent or sending' }, { status: 400 });
  }
  const result = await executeCampaignSend(campaignId, f, origin);
  return Response.json({ success: true, ...result });
}
