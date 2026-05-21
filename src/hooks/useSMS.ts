import { getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export async function smsSend(endpoint: string, body: Record<string, unknown>) {
  try {
    const apps = getApps();
    const token = apps.length > 0 ? await getAuth(apps[0]).currentUser?.getIdToken() : undefined;
    await fetch(`/api/sms/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    // SMS is non-blocking — never break the UI
  }
}
