import { NextRequest, NextResponse } from 'next/server';
import { FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'name, email, and message are required' }, { status: 400 });
    }
    if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid input types' }, { status: 400 });
    }
    if (name.length > 100 || email.length > 200 || message.length > 5000) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const docBody = {
      fields: {
        name: { stringValue: name.trim() },
        email: { stringValue: email.trim().toLowerCase() },
        message: { stringValue: message.trim() },
        createdAt: { stringValue: new Date().toISOString() },
        status: { stringValue: 'new' },
      },
    };

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/contact_inquiries?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docBody),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[contact] Firestore error:', err?.error?.message);
      return NextResponse.json({ error: 'Failed to submit. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[contact] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
