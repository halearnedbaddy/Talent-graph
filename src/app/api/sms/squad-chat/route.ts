import { NextRequest, NextResponse } from 'next/server';
import { sendSMSBatch } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { memberPhones, senderName, message } = await req.json();
    if (!memberPhones?.length) return NextResponse.json({ skipped: true });
    const preview = message?.length > 100 ? message.slice(0, 100) + '…' : message;
    const msg = `[Squad Hub] ${senderName}: ${preview}`;
    await sendSMSBatch(memberPhones, msg);
    return NextResponse.json({ success: true, sent: memberPhones.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
