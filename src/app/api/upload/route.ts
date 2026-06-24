import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, FIREBASE_PROJECT_ID, FIREBASE_API_KEY } from '@/lib/server-auth';

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

const CANDIDATE_BUCKETS = [
  `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
  `${FIREBASE_PROJECT_ID}.appspot.com`,
];

const AUTH_STRATEGIES = ['firebase', 'bearer'] as const;
type AuthStrategy = (typeof AUTH_STRATEGIES)[number];

function buildHeaders(strategy: AuthStrategy, idToken: string, contentType: string) {
  const base: Record<string, string> = { 'Content-Type': contentType };
  if (strategy === 'firebase') base['Authorization'] = `Firebase ${idToken}`;
  if (strategy === 'bearer') base['Authorization'] = `Bearer ${idToken}`;
  return base;
}

/** Check whether the bucket exists and is accessible. Returns null if OK, or an error string. */
async function checkBucket(bucket: string, idToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${bucket}/`,
      { headers: { Authorization: `Firebase ${idToken}` } }
    );
    if (res.status === 404) return 'Firebase Storage bucket not found';
    if (res.status === 403 || res.status === 401) return null; // Bucket exists, auth issue handled below
    return null;
  } catch {
    return null;
  }
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
    body: buffer as unknown as BodyInit,
  });

  if (res.ok) {
    const data = await res.json();
    console.log(`[upload] ✓ bucket: ${bucket}, auth: ${strategy}`);
    return { ok: true, data, bucket };
  }

  const errData = await res.json().catch(() => ({}));
  const message = errData?.error?.message || `HTTP ${res.status}`;
  console.warn(`[upload] ✗ ${bucket}/${strategy} → ${res.status}: ${message}`);
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
      return NextResponse.json({ error: `File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit` }, { status: 413 });
    }

    const uid = await verifyIdToken(idToken);
    if (!uid) {
      return NextResponse.json({ error: 'Invalid or expired auth token — please sign out and back in' }, { status: 401 });
    }

    const allowedPrefixes = [
      `profile-photos/${uid}/`,
      `profile-videos/${uid}/`,
      `club-logos/`,
      `club-media/`,
    ];
    if (!allowedPrefixes.some((prefix) => storagePath.startsWith(prefix))) {
      return NextResponse.json({ error: 'Forbidden: path not allowed' }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = file.type || 'application/octet-stream';
    const encodedPath = encodeURIComponent(storagePath);

    // Check if at least one bucket is accessible before trying all combos
    let bucketFound = false;
    for (const bucket of CANDIDATE_BUCKETS) {
      const bucketError = await checkBucket(bucket, idToken);
      if (bucketError === null) { bucketFound = true; break; }
    }

    if (!bucketFound) {
      const msg = 'Firebase Storage is not set up. Go to Firebase Console → Storage → Get started, then publish your Storage rules.';
      console.error('[upload] No accessible bucket found:', CANDIDATE_BUCKETS);
      return NextResponse.json({ error: msg }, { status: 404 });
    }

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

        // On 404 (bucket wrong) try next bucket. On auth errors try next strategy first.
        if (result.status !== 404 && result.status !== 401 && result.status !== 403) break;
      }
    }

    // Give actionable error messages based on what happened
    let userMessage = lastError.message;
    if (lastError.status === 403 || lastError.status === 401) {
      userMessage = 'Storage permission denied — publish your Firebase Storage rules in the Firebase Console.';
    } else if (lastError.status === 404) {
      userMessage = 'Firebase Storage bucket not found — enable Storage in Firebase Console and publish the storage rules.';
    }

    console.error('[upload] All strategies exhausted. Last error:', lastError);
    return NextResponse.json({ error: userMessage }, { status: lastError.status });
  } catch (err: any) {
    console.error('[upload] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
