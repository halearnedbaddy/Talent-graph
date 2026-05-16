import { NextRequest, NextResponse } from 'next/server';
import webpush, { PushSubscription } from 'web-push';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@talentgraph.ke';

export async function POST(req: NextRequest) {
  try {
    const { subscriptions, title, body, url, tag } = (await req.json()) as {
      subscriptions: PushSubscription[];
      title: string;
      body: string;
      url?: string;
      tag?: string;
    };

    if (!subscriptions?.length || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const payload = JSON.stringify({ title, body, url: url || '/club-dashboard', tag });

    const results = await Promise.allSettled(
      subscriptions.map((sub) => webpush.sendNotification(sub, payload))
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({ sent, failed });
  } catch (err: any) {
    console.error('[push/send]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
