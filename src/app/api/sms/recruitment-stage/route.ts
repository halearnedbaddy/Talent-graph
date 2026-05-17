import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';

const STAGE_MESSAGES: Record<string, string> = {
  shortlisted: 'Great news! You have been shortlisted by a club on Talent Graph. Log in to view your recruitment status.',
  offer_extended: 'A club on Talent Graph has extended an offer to you! Log in immediately to review it.',
  evaluating: 'A club is now actively evaluating your Talent Graph profile. Keep your stats up to date.',
  signed: 'Congratulations! You have been signed via Talent Graph. Wishing you great success!',
};

export async function POST(req: NextRequest) {
  try {
    const { athletePhone, athleteName, stage, clubName } = await req.json();
    if (!athletePhone || !athleteName || !stage) return NextResponse.json({ skipped: true });
    const template = STAGE_MESSAGES[stage];
    if (!template) return NextResponse.json({ skipped: true, reason: 'no message for stage' });
    const msg = `Hi ${athleteName}, ${template}${clubName ? ` — ${clubName}` : ''}`;
    const result = await sendSMS(athletePhone, msg);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
