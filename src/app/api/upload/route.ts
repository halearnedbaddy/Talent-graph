import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// Firebase projects created before ~2024 use .appspot.com; newer ones use .firebasestorage.app.
// We try both so the route works regardless of which bucket Firebase actually provisioned.
const CANDIDATE_BUCKETS = [
  `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
  `${FIREBASE_PROJECT_ID}.appspot.com`,
];

async function tryUpload(
  bucket: string,
  encodedPath: string,
  buffer: Buffer,
  contentType: string,
  idToken: string,
): Promise<{ ok: true; data: Record<string, string> } | { ok: false; status: number; message: string }> {
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodedPath}`;
  console.log('[upload] Trying bucket:', bucket, '— path:', encodedPath);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Firebase ${idToken}`,
      'Content-Type': contentType,
    },
    body: buffer,
  });

  if (res.ok) {
    const data = await res.json();
    return { ok: true, data };
  }

  const errData = await res.json().catch(() => ({}));
  const message = errData?.error?.message || `HTTP ${res.status}`;
  console.warn(`[upload] Bucket ${bucket} → ${res.status}: ${message}`);
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

    // Try each candidate bucket in order; stop at the first success.
    let successBucket: string | null = null;
    let successData: Record<string, string> | null = null;
    let lastError = { status: 500, message: 'Unknown error' };

    for (const bucket of CANDIDATE_BUCKETS) {
      const result = await tryUpload(bucket, encodedPath, buffer, contentType, idToken);
      if (result.ok) {
        successBucket = bucket;
        successData = result.data;
        break;
      }
      lastError = { status: result.status, message: result.message };
      // Only fall through to the next bucket on a 404 (bucket not found).
      // A 403 means the bucket exists but access is denied — no point trying another bucket.
      if (result.status !== 404) break;
    }

    if (!successBucket || !successData) {
      console.error('[upload] All buckets failed. Last error:', lastError);
      return NextResponse.json({ error: lastError.message }, { status: lastError.status });
    }

    const downloadToken = successData.downloadTokens;
    const downloadUrl = downloadToken
      ? `https://firebasestorage.googleapis.com/v0/b/${successBucket}/o/${encodedPath}?alt=media&token=${downloadToken}`
      : `https://firebasestorage.googleapis.com/v0/b/${successBucket}/o/${encodedPath}?alt=media`;

    console.log('[upload] Success with bucket:', successBucket);
    return NextResponse.json({ url: downloadUrl });
  } catch (err: any) {
    console.error('[upload] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
