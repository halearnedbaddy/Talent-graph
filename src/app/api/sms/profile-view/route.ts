import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { lookupPhone, lookupName, lookupField, isRateLimited } from '@/lib/sms-server';

// No auth required — any profile view (logged-in or anonymous) can trigger this.
// The rate limiter (30 min per athlete) prevents abuse.
export async function POST(req: NextRequest) {
  try {
    const { athleteId, viewerName, viewerRole } = await req.json();
    if (!athleteId) return NextResponse.json({ skipped: true });

    if (isRateLimited('profile-view', athleteId)) {
      return NextResponse.json({ skipped: true, reason: 'rate-limited' });
    }

    const [phone, athleteName] = await Promise.all([
      lookupPhone(athleteId, 'athletes'),
      lookupField('athletes', athleteId, 'firstName'),
    ]);

    if (!phone) return NextResponse.json({ skipped: true, reason: 'no phone' });

    const role =
      viewerRole === 'scout' ? 'Scout' :
      viewerRole === 'club'  ? 'Club rep' :
      viewerRole === 'athlete' ? 'Athlete' : 'Someone';

    const viewer = viewerName ? `${role} ${viewerName}` : role;
    const msg = `Hi ${athleteName || 'there'}, ${viewer} just viewed your Talent Graph profile. Keep it sharp to attract more interest. talent-graph.com`;

    const result = await sendSMS(phone, msg.trim());
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
