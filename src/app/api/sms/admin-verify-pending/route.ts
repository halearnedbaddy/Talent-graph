import { NextRequest, NextResponse } from 'next/server';
import { sendSMSBatch } from '@/lib/sms';

export async function POST(req: NextRequest) {
  try {
    const { adminPhones, athleteName, clubName } = await req.json();
    if (!adminPhones?.length) return NextResponse.json({ skipped: true });
    const msg = `[Talent Graph Admin] ${athleteName} from ${clubName || 'a club'} has a match awaiting verification. Log in to review.`;
    await sendSMSBatch(adminPhones, msg);
    return NextResponse.json({ success: true, sent: adminPhones.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
