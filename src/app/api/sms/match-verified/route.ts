import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';

export async function POST(req: NextRequest) {
  try {
    const { athletePhone, athleteName, clubName } = await req.json();
    if (!athletePhone || !athleteName) return NextResponse.json({ skipped: true });
    const msg = `Congrats ${athleteName}! Your profile has been verified by ${clubName || 'a club'} on Talent Graph. Your data is now institutional truth — scouts can trust your stats.`;
    const result = await sendSMS(athletePhone, msg);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
