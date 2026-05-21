import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';
import { lookupPhone, lookupName, isRateLimited } from '@/lib/sms-server';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { athleteId, scoutName, scoutOrg } = await req.json();
    if (!athleteId) return NextResponse.json({ skipped: true });

    if (isRateLimited('connection-request', athleteId)) {
      return NextResponse.json({ skipped: true, reason: 'rate-limited' });
    }

    const [phone, athleteName] = await Promise.all([
      lookupPhone(athleteId, 'athletes'),
      lookupName('athletes', athleteId),
    ]);

    if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' });

    const org = scoutOrg ? ` (${scoutOrg})` : '';
    const msg = `Hi ${athleteName}, scout ${scoutName || 'Someone'}${org} has sent you a connection request on Talent Graph. Log in to review it. talent-graph.com`;

    const result = await sendSMS(phone, msg);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
