import { NextRequest, NextResponse } from 'next/server';

const BUCKET = 'studio-1186001190-d08bc.appspot.com';

let adminApp: import('firebase-admin/app').App | null = null;

function getAdminApp() {
  if (adminApp) return adminApp;

  const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const svcAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (svcAccountStr) {
    const svcAccount = JSON.parse(svcAccountStr);
    adminApp = initializeApp({
      credential: cert(svcAccount),
      storageBucket: BUCKET,
    });
  } else {
    // Try Application Default Credentials (works on Google Cloud / Firebase App Hosting)
    adminApp = initializeApp({
      credential: applicationDefault(),
      storageBucket: BUCKET,
    });
  }

  return adminApp;
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

    // Initialise Admin SDK (requires FIREBASE_SERVICE_ACCOUNT secret)
    let app: import('firebase-admin/app').App;
    try {
      app = getAdminApp()!;
    } catch (initErr: any) {
      console.error('[upload] Admin SDK init failed:', initErr.message);
      return NextResponse.json(
        { error: 'Server storage not configured. Please set the FIREBASE_SERVICE_ACCOUNT secret.' },
        { status: 503 }
      );
    }

    // Verify the ID token — confirms the caller is authenticated
    const { getAuth } = require('firebase-admin/auth');
    let uid: string;
    try {
      const decoded = await getAuth(app).verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (authErr: any) {
      console.error('[upload] Token verification failed:', authErr.message);
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }

    // Enforce path ownership: only allow writes to the user's own folders
    const allowedPrefixes = [`profile-photos/${uid}/`, `profile-videos/${uid}/`];
    if (!allowedPrefixes.some(prefix => storagePath.startsWith(prefix))) {
      return NextResponse.json({ error: 'Forbidden: path not owned by user' }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload via Admin SDK (no CORS, no auth issues)
    const { getStorage } = require('firebase-admin/storage');
    const bucket = getStorage(app).bucket();
    const fileRef = bucket.file(storagePath);

    // Generate a download token so the URL matches the Firebase client SDK format
    const downloadToken = require('crypto').randomUUID();

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type || 'application/octet-stream',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });

    const encodedPath = encodeURIComponent(storagePath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return NextResponse.json({ url: downloadUrl });
  } catch (err: any) {
    console.error('[upload] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
