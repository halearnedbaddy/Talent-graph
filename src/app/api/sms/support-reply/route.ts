import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { phone, userName, agentName, ticketSubject } = await req.json();
  if (!phone || !ticketSubject) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const username = process.env.BULKSMS_USERNAME;
  const password = process.env.BULKSMS_PASSWORD;
  if (!username || !password) {
    return Response.json({ error: 'SMS not configured' }, { status: 503 });
  }

  const name = userName?.split(' ')[0] || 'there';
  const body = `Hi ${name}, your Talent Graph support ticket "${ticketSubject.slice(0, 40)}" has a new reply from ${agentName || 'our support team'}. Visit talentgraphkenya.com to respond.`;

  try {
    const res = await fetch('https://api.bulksms.com/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: phone, body }),
    });
    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: err }, { status: 500 });
    }
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err?.message ?? 'SMS send failed' }, { status: 500 });
  }
}
