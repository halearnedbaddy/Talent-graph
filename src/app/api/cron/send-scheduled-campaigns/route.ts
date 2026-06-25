import { NextRequest } from 'next/server';
import { FIRESTORE_BASE, executeCampaignSend } from '@/lib/campaign-sender';

/**
 * GET /api/cron/send-scheduled-campaigns
 *
 * Called every 5 minutes by Vercel Cron (configured in vercel.json).
 * Also callable manually by admins via the marketing dashboard.
 *
 * Authorization: Vercel sets Authorization: Bearer <CRON_SECRET> automatically.
 * For manual calls, pass the same secret in the Authorization header.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();
  const origin = req.nextUrl.origin;

  // Query all scheduled campaigns
  const res = await fetch(
    `${FIRESTORE_BASE}/marketing_campaigns?pageSize=50`,
    { cache: 'no-store' }
  );

  if (!res.ok) {
    return Response.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }

  const data = await res.json();
  const allCampaigns: any[] = data.documents || [];

  // Filter to campaigns that are scheduled and due
  const dueCampaigns = allCampaigns.filter((doc: any) => {
    const f = doc.fields || {};
    const status = f.status?.stringValue;
    const scheduledAt = f.scheduledAt?.stringValue;
    if (status !== 'scheduled' || !scheduledAt) return false;
    return new Date(scheduledAt) <= now;
  });

  if (dueCampaigns.length === 0) {
    return Response.json({
      success: true,
      processed: 0,
      message: 'No campaigns due for sending',
      checkedAt: now.toISOString(),
    });
  }

  // Send each due campaign
  const results: Array<{
    campaignId: string;
    name: string;
    status: 'sent' | 'error';
    totalSent?: number;
    error?: string;
  }> = [];

  for (const doc of dueCampaigns) {
    const campaignId = doc.name?.split('/').pop() as string;
    const f = doc.fields || {};
    const campaignName = f.name?.stringValue ?? campaignId;

    try {
      const result = await executeCampaignSend(campaignId, f, origin);
      results.push({
        campaignId,
        name: campaignName,
        status: 'sent',
        totalSent: result.totalSent,
      });
      console.log(`[cron] Sent campaign "${campaignName}" (${campaignId}): ${result.totalSent} recipients`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron] Failed to send campaign "${campaignName}" (${campaignId}):`, message);
      results.push({ campaignId, name: campaignName, status: 'error', error: message });
    }
  }

  return Response.json({
    success: true,
    processed: results.length,
    checkedAt: now.toISOString(),
    results,
  });
}
