import { NextRequest, NextResponse } from 'next/server';
import { sendSMS, sendSMSBatch } from '@/lib/sms';
import { verifyBearerToken } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { to, message, batch } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    if (batch && Array.isArray(batch)) {
      const batchResult = await sendSMSBatch(batch, message);
      return NextResponse.json({ success: batchResult.sent > 0, sent: batchResult.sent, failed: batchResult.failed });
    }

    if (!to) {
      return NextResponse.json({ error: 'to or batch is required' }, { status: 400 });
    }

    const result = await sendSMS(to, message);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}
