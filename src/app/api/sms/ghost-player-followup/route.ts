import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { phone, playerName, claimUrl } = await req.json();
    if (!phone?.trim()) return NextResponse.json({ skipped: true });

    const msg = `Hi${playerName ? ` ${playerName}` : ''}! A reminder that your match stats are waiting on Talent Graph. Claim your free profile: ${claimUrl}`;
    const result = await sendSMS(phone, msg);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
