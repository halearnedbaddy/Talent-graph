import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';
import { lookupPhone, lookupName, isRateLimited } from '@/lib/sms-server';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { scoutId, athleteName } = await req.json();
    if (!scoutId) return NextResponse.json({ skipped: true });

    if (isRateLimited('connection-accepted', scoutId)) {
      return NextResponse.json({ skipped: true, reason: 'rate-limited' });
    }

    const phone = await lookupPhone(scoutId, 'scouts');
    if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' });

    const scoutName = await lookupName('scouts', scoutId);
    const msg = `Hi ${scoutName}, ${athleteName || 'An athlete'} has accepted your connection request on Talent Graph. You can now message them directly. talent-graph.com`;

    const result = await sendSMS(phone, msg);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
