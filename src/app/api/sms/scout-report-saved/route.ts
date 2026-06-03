import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';
import { lookupPhone, lookupName, isRateLimited } from '@/lib/sms-server';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { athleteId, scoutName, recommendation } = await req.json();
    if (!athleteId) return NextResponse.json({ skipped: true });

    if (isRateLimited('scout-report-saved', athleteId)) {
      return NextResponse.json({ skipped: true, reason: 'rate-limited' });
    }

    const [phone, athleteName] = await Promise.all([
      lookupPhone(athleteId, 'athletes'),
      lookupName('athletes', athleteId),
    ]);

    if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' });

    const recText = recommendation ? ` Verdict: ${recommendation}.` : '';
    const msg = `Hi ${athleteName}, scout ${scoutName || 'A scout'} has saved an AI scouting analysis to your Talent Graph profile.${recText} Log in to view it: talent-graph.com`;

    const result = await sendSMS(phone, msg);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
