import { NextRequest, NextResponse } from 'next/server';
import { shortlistAthletes, type ShortlistInput } from '@/ai/flows/shortlist-athletes';

async function verifyToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const valid = await verifyToken(token);
    if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as ShortlistInput;
    if (!body.criteria || !body.athletes?.length) {
      return NextResponse.json({ error: 'criteria and athletes are required' }, { status: 400 });
    }

    const result = await shortlistAthletes(body);
    return NextResponse.json({ result }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AI Shortlist] Error:', message);
    return NextResponse.json({ error: `Failed to shortlist: ${message}` }, { status: 500 });
  }
}
