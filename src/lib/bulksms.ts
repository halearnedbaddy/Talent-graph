const BULKSMS_ENDPOINT = 'https://api.bulksms.com/v1/messages';

function getAuth(): string {
  const username = process.env.BULKSMS_USERNAME;
  const password = process.env.BULKSMS_PASSWORD;
  if (!username || !password) {
    throw new Error('BulkSMS credentials not configured. Set BULKSMS_USERNAME and BULKSMS_PASSWORD.');
  }
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s\-().]/g, '');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('00')) return `+${clean.slice(2)}`;
  if (clean.startsWith('0') && clean.length === 10) return `+254${clean.slice(1)}`;
  if (clean.length === 9 && !clean.startsWith('0')) return `+254${clean}`;
  return `+${clean}`;
}

export interface SMSRecipient {
  phone: string;
  name: string;
}

export interface SMSResult {
  sent: number;
  failed: number;
  total: number;
  error?: string;
}

export async function sendBulkSMS(recipients: SMSRecipient[], body: string): Promise<SMSResult> {
  const valid = recipients.filter(r => r.phone?.trim());
  if (!valid.length) return { sent: 0, failed: recipients.length, total: recipients.length };

  const sender = process.env.BULKSMS_SENDER_ID || 'TalentGraph';
  const to = valid.map(r => normalizePhone(r.phone));

  const payload = to.map(number => ({
    to: number,
    body,
    from: sender,
    encoding: 'UNICODE',
  }));

  const response = await fetch(BULKSMS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: getAuth(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BulkSMS API error ${response.status}: ${text}`);
  }

  const results = await response.json() as { status?: { type?: string } }[];
  const sent = Array.isArray(results)
    ? results.filter(r => r.status?.type !== 'ERROR').length
    : valid.length;

  return { sent, failed: valid.length - sent, total: recipients.length };
}

export function buildTrainingNotification(params: {
  teamName: string;
  date: string;
  time?: string;
  venue?: string;
  coachName: string;
  instructions?: string;
}): string {
  const lines = [
    `Training Reminder ⚽`,
    `Team: ${params.teamName}`,
    `Date: ${params.date}`,
  ];
  if (params.time) lines.push(`Time: ${params.time}`);
  if (params.venue) lines.push(`Venue: ${params.venue}`);
  lines.push(`Coach: ${params.coachName}`);
  if (params.instructions) lines.push(params.instructions);
  return lines.join('\n');
}

export function buildMatchNotification(params: {
  title: string;
  teamName: string;
  date: string;
  time?: string;
  venue?: string;
  coachName: string;
  instructions?: string;
}): string {
  const lines = [
    `Match Notice ⚽`,
    `${params.title}`,
    `Team: ${params.teamName}`,
    `Date: ${params.date}`,
  ];
  if (params.time) lines.push(`Time: ${params.time}`);
  if (params.venue) lines.push(`Venue: ${params.venue}`);
  lines.push(`Coach: ${params.coachName}`);
  if (params.instructions) lines.push(params.instructions);
  return lines.join('\n');
}

export function buildEventNotification(params: {
  type: string;
  title: string;
  teamName: string;
  date: string;
  time?: string;
  venue?: string;
  coachName: string;
  instructions?: string;
}): string {
  const lines = [
    `${params.type} Notice ⚽`,
    params.title,
    `Team: ${params.teamName}`,
    `Date: ${params.date}`,
  ];
  if (params.time) lines.push(`Time: ${params.time}`);
  if (params.venue) lines.push(`Venue: ${params.venue}`);
  lines.push(`Coach: ${params.coachName}`);
  if (params.instructions) lines.push(params.instructions);
  return lines.join('\n');
}

export function buildInvitationSMS(params: {
  playerName: string;
  teamName: string;
  position: string;
  senderName: string;
  message?: string;
  inviteUrl: string;
}): string {
  return [
    `Talent Graph Invitation ⚽`,
    `Hi ${params.playerName}!`,
    `You have been invited to join ${params.teamName}.`,
    `Position: ${params.position}`,
    `From: ${params.senderName}`,
    params.message ? params.message : '',
    `View invite: ${params.inviteUrl}`,
  ].filter(Boolean).join('\n');
}
