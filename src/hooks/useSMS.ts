export async function smsSend(endpoint: string, body: Record<string, unknown>) {
  try {
    await fetch(`/api/sms/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // SMS is non-blocking — never break the UI
  }
}
