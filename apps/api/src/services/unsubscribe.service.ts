import { createHmac, timingSafeEqual } from 'node:crypto';

function getSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? 'dev-secret-change-in-production';
}

export function generateUnsubscribeToken(cnpj: string): string {
  return createHmac('sha256', getSecret()).update(cnpj).digest('hex');
}

export function verifyUnsubscribeToken(cnpj: string, token: string): boolean {
  try {
    const expected = generateUnsubscribeToken(cnpj);
    if (expected.length !== token.length) return false;
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(token, 'hex'));
  } catch {
    return false;
  }
}

export function buildUnsubscribeUrl(cnpj: string, baseUrl?: string): string {
  const token = generateUnsubscribeToken(cnpj);
  const base = baseUrl ?? process.env.API_URL ?? 'http://localhost:3001';
  return `${base}/api/alerts/unsubscribe/${token}`;
}
