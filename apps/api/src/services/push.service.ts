import webpush from 'web-push';
import type { PrismaClient } from '@prisma/client';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@capta.app';

// Only configure VAPID if keys are provided — graceful degradation in dev
const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (PUSH_ENABLED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export { VAPID_PUBLIC_KEY };

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

// Send a push notification to every subscription belonging to an organization.
// Stale subscriptions (HTTP 410) are automatically removed.
export async function sendPushToOrg(
  prisma: PrismaClient,
  organizationId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  if (!PUSH_ENABLED) return { sent: 0, failed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { organizationId },
  });

  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err) {
        failed++;
        // 410 Gone — subscription was revoked by the browser; remove it
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        console.error(`[push] Delivery failed for sub ${sub.id}: ${err}`);
      }
    }),
  );

  return { sent, failed };
}

// Send push to all orgs that match the given opportunity (grouped, no spam).
export async function sendPushForAlerts(
  prisma: PrismaClient,
  alerts: Array<{
    organizationId: string;
    triggerDays: number;
    opportunityId: string;
    opportunityTitle: string;
  }>,
): Promise<{ sent: number; failed: number }> {
  if (!PUSH_ENABLED || alerts.length === 0) return { sent: 0, failed: 0 };

  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

  // Group by org so we send one push per org (potentially multiple editais)
  const byOrg = new Map<string, typeof alerts>();
  for (const a of alerts) {
    if (!byOrg.has(a.organizationId)) byOrg.set(a.organizationId, []);
    byOrg.get(a.organizationId)!.push(a);
  }

  let totalSent = 0;
  let totalFailed = 0;

  for (const [orgId, orgAlerts] of byOrg) {
    const first = orgAlerts[0];
    const days = first.triggerDays;
    const plural = days !== 1;

    const payload: PushPayload = {
      title: `⏰ Edital fecha em ${days} dia${plural ? 's' : ''}`,
      body:
        orgAlerts.length === 1
          ? first.opportunityTitle
          : `${first.opportunityTitle} e mais ${orgAlerts.length - 1} edital${orgAlerts.length - 1 !== 1 ? 'is' : ''}`,
      icon: `${webUrl}/icon-192.png`,
      url:
        orgAlerts.length === 1
          ? `${webUrl}/opportunity/${first.opportunityId}`
          : `${webUrl}/opportunities/saved`,
    };

    const { sent, failed } = await sendPushToOrg(prisma, orgId, payload);
    totalSent += sent;
    totalFailed += failed;
  }

  return { sent: totalSent, failed: totalFailed };
}
