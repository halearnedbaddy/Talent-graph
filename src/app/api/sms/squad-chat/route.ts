import { NextRequest, NextResponse } from 'next/server';
import { sendSMSBatch } from '@/lib/sms';

export async function POST(req: NextRequest) {
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
