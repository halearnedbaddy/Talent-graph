import { NextRequest, NextResponse } from 'next/server';
import { generateScoutingReport, type AthleteInput } from '@/ai/flows/scouting-report';

async function verifyToken(token: string): Promise<boolean> {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return false;
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

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized — missing token' }, { status: 401 });
    }

    const valid = await verifyToken(token);
    if (!valid) {
      return NextResponse.json({ error: 'Unauthorized — invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const athleteData: AthleteInput = body.athlete;

    if (!athleteData?.firstName || !athleteData?.lastName) {
      return NextResponse.json({ error: 'Invalid request — athlete data required' }, { status: 400 });
    }

    const report = await generateScoutingReport(athleteData);

    return NextResponse.json({ report }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AI Scouting Report] Error:', message);
    return NextResponse.json({ error: `Failed to generate report: ${message}` }, { status: 500 });
  }
}
