import { sendBulkSMS, normalizePhone } from './bulksms';

export interface SMSResult {
  success: boolean;
  sent?: number;
  failed?: number;
  error?: string;
}

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  try {
    const result = await sendBulkSMS([{ phone: to, name: 'Recipient' }], message);
    return { success: result.sent > 0, sent: result.sent, failed: result.failed };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SMS] sendSMS error:', msg);
    return { success: false, sent: 0, failed: 1, error: msg };
  }
}

export async function sendSMSBatch(numbers: string[], message: string): Promise<{ sent: number; failed: number }> {
  const recipients = numbers.filter(Boolean).map(phone => ({ phone: normalizePhone(phone), name: 'Recipient' }));
  try {
    const result = await sendBulkSMS(recipients, message);
    return { sent: result.sent, failed: result.failed };
  } catch (err: unknown) {
    console.error('[SMS] sendSMSBatch error:', err instanceof Error ? err.message : err);
    return { sent: 0, failed: recipients.length };
  }
}
