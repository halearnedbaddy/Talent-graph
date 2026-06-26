import { NextRequest, NextResponse } from 'next/server';
import { sendSMSBatch } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { phones, clubName, senderName, message } = await req.json();
    if (!phones?.length || !message) return NextResponse.json({ skipped: true });

    const clubLabel = clubName ? `[${clubName}]` : '[Club]';
    const sender = senderName ? ` ${senderName}` : '';
    const smsBody = `📢 ${clubLabel}${sender}: ${message}`;

    const result = await sendSMSBatch(phones, smsBody);
    return NextResponse.json({ success: true, sent: result.sent, failed: result.failed });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
