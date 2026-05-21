import { NextRequest, NextResponse } from 'next/server';
import { sendSMSBatch } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { phones, message } = await req.json();
    if (!phones?.length || !message) return NextResponse.json({ skipped: true });
    await sendSMSBatch(phones, message);
    return NextResponse.json({ success: true, sent: phones.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
