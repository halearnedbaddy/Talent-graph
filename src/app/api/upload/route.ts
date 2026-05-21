import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, FIREBASE_PROJECT_ID, FIREBASE_API_KEY } from '@/lib/server-auth';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// Try every combination of bucket × auth header so we don't need any specific
// Firebase Console rule configuration.
const CANDIDATE_BUCKETS = [
  `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
  `${FIREBASE_PROJECT_ID}.appspot.com`,
];

// Auth strategies to attempt for each bucket.
// 'firebase' = Authorization: Firebase <token>  (Firebase Security Rules)
// 'bearer'   = Authorization: Bearer <token>    (Google OAuth2 / newer GCS)
// 'key'      = no auth header, API key in URL   (rules must allow unauthenticated)
const AUTH_STRATEGIES = ['firebase', 'bearer'] as const;

type AuthStrategy = (typeof AUTH_STRATEGIES)[number];

function buildHeaders(strategy: AuthStrategy, idToken: string, contentType: string) {
  const base: Record<string, string> = { 'Content-Type': contentType };
  if (strategy === 'firebase') base['Authorization'] = `Firebase ${idToken}`;
  if (strategy === 'bearer') base['Authorization'] = `Bearer ${idToken}`;
  return base;
}

async function tryUpload(
  bucket: string,
  strategy: AuthStrategy,
  encodedPath: string,
  buffer: Buffer,
  contentType: string,
  idToken: string,
): Promise<{ ok: true; data: Record<string, string>; bucket: string } | { ok: false; status: number; message: string }> {
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}&key=${FIREBASE_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(strategy, idToken, contentType),
    body: buffer,
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`[upload] ✓ Success — bucket: ${bucket}, auth: ${strategy}`);
    return { ok: true, data, bucket };
  }

  const errData = await res.json().catch(() => ({}));
  const message = errData?.error?.message || `HTTP ${res.status}`;
  console.warn(`[upload] ✗ ${bucket} / ${strategy} → ${res.status}: ${message}`);
  return { ok: false, status: res.status, message };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const storagePath = formData.get('path') as string | null;
    const idToken = formData.get('token') as string | null;

    if (!file || !storagePath || !idToken) {
      return NextResponse.json({ error: 'Missing file, path, or token' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File exceeds 15 MB limit' }, { status: 413 });
    }

    const uid = await verifyIdToken(idToken);
    if (!uid) {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }

    const allowedPrefixes = [
      `profile-photos/${uid}/`,
      `profile-videos/${uid}/`,
      `club-logos/`,
    ];
    if (!allowedPrefixes.some((prefix) => storagePath.startsWith(prefix))) {
      return NextResponse.json({ error: 'Forbidden: path not allowed' }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || 'application/octet-stream';
    const encodedPath = encodeURIComponent(storagePath);

    let lastError = { status: 500, message: 'Upload failed' };

    for (const bucket of CANDIDATE_BUCKETS) {
      for (const strategy of AUTH_STRATEGIES) {
        const result = await tryUpload(bucket, strategy, encodedPath, buffer, contentType, idToken);

        if (result.ok) {
          const downloadToken = result.data.downloadTokens;
          const downloadUrl = downloadToken
            ? `https://firebasestorage.googleapis.com/v0/b/${result.bucket}/o/${encodedPath}?alt=media&token=${downloadToken}`
            : `https://firebasestorage.googleapis.com/v0/b/${result.bucket}/o/${encodedPath}?alt=media`;
          return NextResponse.json({ url: downloadUrl });
        }

        lastError = { status: result.status, message: result.message };

        // Only try another bucket on 404 (bucket not found).
        // On auth errors (401/403) try next auth strategy first before moving bucket.
        if (result.status !== 404 && result.status !== 401 && result.status !== 403) break;
      }
    }

    console.error('[upload] All strategies exhausted. Last error:', lastError);
    return NextResponse.json({ error: lastError.message }, { status: lastError.status });
  } catch (err: any) {
    console.error('[upload] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
