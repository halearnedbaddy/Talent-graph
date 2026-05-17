import { NextRequest, NextResponse } from 'next/server';
import { sendSMSBatch } from '@/lib/sms';

export async function POST(req: NextRequest) {
  try {
    const { phones, message } = await req.json();
    if (!phones?.length || !message) return NextResponse.json({ skipped: true });
    await sendSMSBatch(phones, message);
    return NextResponse.json({ success: true, sent: phones.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
