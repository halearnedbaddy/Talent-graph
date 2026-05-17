import { NextRequest, NextResponse } from 'next/server';
import { sendSMSBatch } from '@/lib/sms';

export async function POST(req: NextRequest) {
  try {
    const { scoutPhones, scorer, minute, homeTeam, awayTeam, homeScore, awayScore } = await req.json();
    if (!scoutPhones?.length) return NextResponse.json({ skipped: true });
    const msg = `⚽ GOAL — ${minute}' | ${scorer} | ${homeTeam} ${homeScore}–${awayScore} ${awayTeam} [Talent Graph Live]`;
    await sendSMSBatch(scoutPhones, msg);
    return NextResponse.json({ success: true, sent: scoutPhones.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
