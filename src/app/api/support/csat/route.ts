import { NextRequest, NextResponse } from 'next/server';
import { FIREBASE_PROJECT_ID } from '@/lib/server-auth';

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

const RATING_LABELS: Record<string, string> = {
  '1': 'Very bad',
  '2': 'Bad',
  '3': 'OK',
  '4': 'Good',
  '5': 'Excellent',
};

const RATING_COLORS: Record<string, string> = {
  '1': '#EF4444',
  '2': '#F97316',
  '3': '#EAB308',
  '4': '#84CC16',
  '5': '#22C55E',
};

export async function GET(req: NextRequest) {
  const ticketId = req.nextUrl.searchParams.get('ticketId');
  const rating = req.nextUrl.searchParams.get('rating');

  if (!ticketId || !rating || !['1', '2', '3', '4', '5'].includes(rating)) {
    return new NextResponse(errorPage('Invalid rating link.'), {
      status: 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    });
  }

  // Save CSAT rating to Firestore ticket document
  try {
    await fetch(
      `${FIRESTORE_BASE}/support_tickets/${ticketId}?updateMask.fieldPaths=csatRating&updateMask.fieldPaths=updatedAt`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            csatRating: { stringValue: rating },
            updatedAt: { stringValue: new Date().toISOString() },
          },
        }),
      }
    );
  } catch {
    // non-fatal — still show thank you page
  }

  const label = RATING_LABELS[rating] ?? rating;
  const color = RATING_COLORS[rating] ?? '#6B7280';

  return new NextResponse(thankYouPage(rating, label, color), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

function thankYouPage(rating: string, label: string, color: string): string {
  const stars = Array.from({ length: 5 }, (_, i) =>
    `<span style="font-size:32px;opacity:${i < parseInt(rating) ? '1' : '0.2'};">★</span>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Thanks for your feedback — Talent Graph Kenya</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0F172A;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#1E293B;border-radius:20px;padding:48px 40px;max-width:420px;width:100%;text-align:center;border:1px solid #334155}
    .badge{display:inline-block;background:${color}20;border:1.5px solid ${color}60;color:${color};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:4px 14px;border-radius:999px;margin-bottom:24px}
    .icon{font-size:56px;margin-bottom:12px}
    h1{color:#F8FAFC;font-size:22px;font-weight:900;margin-bottom:8px}
    p{color:#94A3B8;font-size:14px;line-height:1.6;margin-bottom:24px}
    .stars{margin-bottom:8px}
    .label{color:${color};font-size:16px;font-weight:800;margin-bottom:28px}
    .btn{display:inline-block;background:#4F46E5;color:#fff;font-size:13px;font-weight:800;text-decoration:none;padding:12px 32px;border-radius:10px;letter-spacing:0.5px}
    .footer{margin-top:28px;font-size:11px;color:#475569}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Feedback received</div>
    <div class="icon">🎉</div>
    <h1>Thank you!</h1>
    <p>Your rating helps us improve our support. We're glad you took a moment to let us know how we did.</p>
    <div class="stars">${stars}</div>
    <div class="label">${label}</div>
    <a class="btn" href="/">Back to Talent Graph</a>
    <p class="footer">Talent Graph Kenya · Client Support</p>
  </div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function errorPage(msg: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Error</title>
  <style>body{background:#0F172A;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#94A3B8;font-size:14px;}</style>
  </head><body><p>${escHtml(msg)}</p></body></html>`;
}
