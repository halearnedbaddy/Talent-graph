import { NextResponse } from 'next/server';

const APP_URL = 'https://talent-graph.vercel.app';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${APP_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'offline',
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.json({ url });
}
