import { NextRequest } from 'next/server';
import { verifyBearerToken, FIREBASE_PROJECT_ID } from '@/lib/server-auth';
import { fetchEligibleUsers, buildSuppressedSet, FIRESTORE_BASE } from '@/lib/campaign-sender';

export interface DryRunRecipient {
  name: string;
  role: string;
  hasEmail: boolean;
  hasPhone: boolean;
  emailMasked?: string;
  phoneMasked?: string;
}

export interface DryRunResult {
  total: number;
  emailEligible: number;
  smsEligible: number;
  suppressed: number;
  channel: string;
  recipients: DryRunRecipient[];
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.length > 2 ? local.slice(0, 2) : local[0] ?? '';
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${phone.slice(0, Math.max(0, phone.length - 4))}****`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await verifyBearerToken(req);
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: campaignId } = await params;

  const camRes = await fetch(`${FIRESTORE_BASE}/marketing_campaigns/${campaignId}`);
  if (!camRes.ok) return Response.json({ error: 'Campaign not found' }, { status: 404 });

  const camDoc = await camRes.json();
  const f = camDoc.fields || {};
  const channel: string = f.channel?.stringValue ?? 'email';
  const segmentId: string | null = f.segmentId?.stringValue ?? null;

  const { allUsers: eligible } = await fetchEligibleUsers(segmentId);

  const emailUsers = eligible.filter((u: any) => u.fields?.email?.stringValue);
  const smsUsers   = eligible.filter((u: any) => {
    const p = u.fields?.phone?.stringValue;
    return p && p.length > 5;
  });

  // Check suppression for email channel only (same logic as real send)
  let suppressedCount = 0;
  if (channel === 'email' || channel === 'both') {
    const allEmails = emailUsers.map((u: any) => u.fields.email.stringValue as string);
    const suppressed = await buildSuppressedSet(allEmails);
    suppressedCount = suppressed.size;
  }

  const recipients: DryRunRecipient[] = eligible.slice(0, 50).map((u: any) => {
    const uf = u.fields || {};
    const firstName  = uf.firstName?.stringValue  ?? '';
    const lastName   = uf.lastName?.stringValue   ?? '';
    const displayName = uf.displayName?.stringValue ?? '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || displayName || '(no name)';
    const role = uf.role?.stringValue ?? 'unknown';
    const email = uf.email?.stringValue;
    const phone = uf.phone?.stringValue;
    return {
      name,
      role,
      hasEmail: !!email,
      hasPhone: !!(phone && phone.length > 5),
      emailMasked: email ? maskEmail(email) : undefined,
      phoneMasked: phone ? maskPhone(phone) : undefined,
    };
  });

  const result: DryRunResult = {
    total: eligible.length,
    emailEligible: emailUsers.length,
    smsEligible: smsUsers.length,
    suppressed: suppressedCount,
    channel,
    recipients,
  };

  return Response.json(result);
}
