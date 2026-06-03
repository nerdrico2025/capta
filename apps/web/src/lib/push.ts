const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Converts a URL-safe base64 string to a Uint8Array (required by pushManager.subscribe)
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getVapidKey(): Promise<string> {
  const res = await fetch(`${API_URL}/api/push/vapid-key`);
  if (!res.ok) throw new Error('Failed to fetch VAPID key');
  const { publicKey } = (await res.json()) as { publicKey: string };
  return publicKey;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(cnpj: string): Promise<void> {
  if (!isPushSupported()) throw new Error('Push not supported');

  // 1. Register (or retrieve existing) service worker
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  // 2. Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied');

  // 3. Fetch public VAPID key and subscribe
  const publicKey = await getVapidKey();
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
  });

  // 4. Send subscription to the backend
  const json = subscription.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  const res = await fetch(`${API_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cnpj,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error('Failed to save push subscription on server');
  }
}

export async function unsubscribeFromPush(cnpj: string): Promise<void> {
  const existing = await getExistingSubscription();
  if (!existing) return;

  const endpoint = existing.endpoint;

  // Unsubscribe from browser
  await existing.unsubscribe();

  // Remove from server (best-effort)
  await fetch(`${API_URL}/api/push/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cnpj, endpoint }),
  }).catch(() => {});
}
