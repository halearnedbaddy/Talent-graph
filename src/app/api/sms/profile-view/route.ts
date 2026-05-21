import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { athletePhone, athleteName, viewerName, viewerRole } = await req.json();
    if (!athletePhone || !athleteName) {
      return NextResponse.json({ skipped: true });
    }
    const role = viewerRole === 'scout' ? 'Scout' : viewerRole === 'club' ? 'Club rep' : 'Someone';
    const msg = `Hi ${athleteName}, ${role} ${viewerName || ''} just viewed your Talent Graph profile. Keep your profile updated to attract more interest. talent-graph.com`;
    const result = await sendSMS(athletePhone, msg.trim());
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
