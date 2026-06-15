import { NextRequest, NextResponse } from 'next/server';
import { FIREBASE_API_KEY } from '@/lib/server-auth';

const APP_URL = 'https://talent-graph.vercel.app';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/login?error=google_cancelled`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = `${APP_URL}/api/auth/google/callback`;

  try {
    // 1. Exchange code for Google tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      console.error('[google/callback] token exchange failed:', tokenData);
      return NextResponse.redirect(`${APP_URL}/login?error=google_failed`);
    }

    const googleIdToken: string = tokenData.id_token;

    // 2. Sign into Firebase using the Google ID token via Identity Toolkit REST API
    const firebaseRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postBody: `id_token=${googleIdToken}&providerId=google.com`,
          requestUri: redirectUri,
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      }
    );

    const firebaseData = await firebaseRes.json();
    if (!firebaseRes.ok || !firebaseData.idToken) {
      console.error('[google/callback] Firebase signInWithIdp failed:', firebaseData);
      return NextResponse.redirect(`${APP_URL}/login?error=firebase_failed`);
    }

    const { idToken, localId, email, displayName, photoUrl, isNewUser } = firebaseData;

    // 3. Redirect to client page to complete sign-in
    const params = new URLSearchParams({
      token: idToken,
      uid: localId,
      email: email ?? '',
      name: displayName ?? '',
      photo: photoUrl ?? '',
      isNew: isNewUser ? '1' : '0',
    });

    return NextResponse.redirect(`${APP_URL}/auth/google-complete?${params.toString()}`);
  } catch (err: any) {
    console.error('[google/callback] unhandled error:', err);
    return NextResponse.redirect(`${APP_URL}/login?error=server_error`);
  }
}
