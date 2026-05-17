import { NextRequest, NextResponse } from 'next/server';

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
    adminApp = initializeApp({ credential: cert(svcAccount) });
  } else {
    adminApp = initializeApp({ credential: applicationDefault() });
  }
  return adminApp;
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'name, email, and message are required' }, { status: 400 });
    }

    if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid input types' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    let app: import('firebase-admin/app').App;
    try {
      app = getAdminApp()!;
    } catch (initErr: any) {
      console.error('[contact] Admin SDK init failed:', initErr.message);
      return NextResponse.json({ error: 'Server not configured.' }, { status: 503 });
    }

    const { getFirestore } = require('firebase-admin/firestore');
    const db = getFirestore(app);

    await db.collection('contact_inquiries').add({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: 'new',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[contact] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
