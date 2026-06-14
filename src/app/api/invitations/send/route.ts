import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/server-auth';
import { sendSMS } from '@/lib/sms';

export async function POST(req: NextRequest) {
  const uid = await verifyBearerToken(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { phone, playerName, teamName, position, senderName, message, inviteUrl } = body;

    if (!phone || !playerName || !teamName) {
      return NextResponse.json({ error: 'phone, playerName, teamName are required' }, { status: 400 });
    }

    const smsBody = [
      `Talent Graph Invitation ⚽`,
      `Hi ${playerName}!`,
      `You have been invited to join ${teamName}.`,
      position ? `Position: ${position}` : null,
      `From: ${senderName || 'A scout'}`,
      message?.trim() ? message.trim() : null,
      inviteUrl ? `View invite: ${inviteUrl}` : null,
      `Reply STOP to opt out.`,
    ].filter(Boolean).join('\n');

    const result = await sendSMS(phone, smsBody);
    return NextResponse.json({ success: result.success, smsStatus: result.success ? 'sent' : 'failed', error: result.error }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Invitation Send] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
