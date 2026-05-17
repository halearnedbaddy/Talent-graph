const BULKSMS_API_KEY = process.env.BULKSMS_API_KEY!;
const SENDER_ID = process.env.BULKSMS_SENDER_ID || 'XpressKard';
const API_URL = 'https://api.bulksmsnigeria.com/api/v1/sms/create';

export interface SMSResult {
  success: boolean;
  error?: string;
}

export async function sendSMS(to: string, message: string): Promise<SMSResult> {
  if (!BULKSMS_API_KEY) {
    console.warn('[SMS] BULKSMS_API_KEY not set — skipping send');
    return { success: false, error: 'API key not configured' };
  }

  const phone = normalizePhone(to);
  if (!phone) {
    return { success: false, error: `Invalid phone number: ${to}` };
  }

  try {
    const params = new URLSearchParams({
      api_token: BULKSMS_API_KEY,
      from: SENDER_ID,
      to: phone,
      body: message,
      dnd: '2',
    });

    const res = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.status === 'error') {
      console.error('[SMS] Send failed:', data);
      return { success: false, error: data?.message || `HTTP ${res.status}` };
    }

    console.log('[SMS] Sent to', phone, '—', data?.status);
    return { success: true };
  } catch (err: any) {
    console.error('[SMS] Network error:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

export async function sendSMSBatch(numbers: string[], message: string): Promise<void> {
  await Promise.allSettled(numbers.map(n => sendSMS(n, message)));
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('07') && digits.length === 10) return '254' + digits.slice(1);
  if (digits.startsWith('01') && digits.length === 10) return '254' + digits.slice(1);
  if (digits.startsWith('7') && digits.length === 9) return '254' + digits;
  if (digits.startsWith('1') && digits.length === 9) return '254' + digits;
  if (digits.startsWith('0') && digits.length >= 10) return '254' + digits.slice(1);
  return digits.length >= 7 ? digits : null;
}
