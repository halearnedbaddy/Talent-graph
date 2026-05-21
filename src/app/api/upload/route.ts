import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, STORAGE_BUCKET } from '@/lib/server-auth';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

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
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o?uploadType=media&name=${encodedPath}`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Firebase ${idToken}`,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errData = await uploadRes.json().catch(() => ({}));
      const msg = errData?.error?.message || `Storage upload failed (${uploadRes.status})`;
      console.error('[upload] Firebase Storage error:', msg);
      return NextResponse.json({ error: msg }, { status: uploadRes.status });
    }

    const uploadData = await uploadRes.json();
    const downloadToken = uploadData.downloadTokens;
    const downloadUrl = downloadToken
      ? `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${downloadToken}`
      : `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;

    return NextResponse.json({ url: downloadUrl });
  } catch (err: any) {
    console.error('[upload] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
