import type { PrismaClient, Prisma } from '@prisma/client';
import type { EmailService } from './email/email.service.js';
import { buildUnsubscribeUrl } from './unsubscribe.service.js';
import { sendPushForAlerts } from './push.service.js';

const TRIGGER_DAYS = [15, 7, 1] as const;
type TriggerDay = (typeof TRIGGER_DAYS)[number];

const DAY_TO_TYPE: Record<TriggerDay, 'DAYS_15' | 'DAYS_7' | 'DAYS_1'> = {
  15: 'DAYS_15',
  7: 'DAYS_7',
  1: 'DAYS_1',
};

export interface AlertJobResult {
  triggeredOn: Date;
  alertsCreated: number;
  emailsSent: number;
  emailsFailed: number;
  pushSent: number;
  pushFailed: number;
  errors: string[];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function processAlerts(
  prisma: PrismaClient,
  emailService: EmailService,
): Promise<AlertJobResult> {
  const result: AlertJobResult = {
    triggeredOn: new Date(),
    alertsCreated: 0,
    emailsSent: 0,
    emailsFailed: 0,
    pushSent: 0,
    pushFailed: 0,
    errors: [],
  };

  for (const days of TRIGGER_DAYS) {
    try {
      const created = await createPendingAlertsForDay(prisma, days);
      result.alertsCreated += created;
    } catch (err) {
      const msg = `createPendingAlerts(${days}d): ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
      console.error(`[alert:service] ${msg}`);
    }
  }

  const pendingAlertsForPush: Array<{
    organizationId: string;
    triggerDays: number;
    opportunityId: string;
    opportunityTitle: string;
  }> = [];

  try {
    const { sent, failed, alertsForPush } = await sendPendingAlerts(prisma, emailService);
    result.emailsSent = sent;
    result.emailsFailed = failed;
    pendingAlertsForPush.push(...alertsForPush);
  } catch (err) {
    const msg = `sendPendingAlerts: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[alert:service] ${msg}`);
  }

  // Send push notifications for the same alerts (non-blocking)
  try {
    const { sent, failed } = await sendPushForAlerts(prisma, pendingAlertsForPush);
    result.pushSent = sent;
    result.pushFailed = failed;
  } catch (err) {
    const msg = `sendPushForAlerts: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[alert:service] ${msg}`);
  }

  return result;
}

// ─── Step 1: Find matching opportunities and create PENDING alerts ────────────

async function createPendingAlertsForDay(prisma: PrismaClient, days: TriggerDay): Promise<number> {
  const targetDate = dayOffset(days);

  const opportunities = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      deadline: {
        gte: startOfDay(targetDate),
        lte: endOfDay(targetDate),
      },
    },
    select: {
      id: true,
      title: true,
      source: true,
      value: true,
      deadline: true,
      portalUrl: true,
      areas: true,
    },
  });

  if (opportunities.length === 0) return 0;

  let created = 0;

  for (const opp of opportunities) {
    const preferences = await findMatchingPreferences(prisma, opp.areas, days);

    for (const pref of preferences) {
      const alertType = DAY_TO_TYPE[days];

      // Idempotency: skip if alert already exists for this combination
      const existing = await prisma.alert.findFirst({
        where: {
          organizationId: pref.organizationId,
          opportunityId: opp.id,
          type: alertType,
        },
      });
      if (existing) continue;

      await prisma.alert.create({
        data: {
          organizationId: pref.organizationId,
          opportunityId: opp.id,
          triggerDays: days,
          type: alertType,
          email: pref.email,
          status: 'PENDING',
        },
      });

      created++;
    }
  }

  return created;
}

async function findMatchingPreferences(
  prisma: PrismaClient,
  opportunityAreas: string[],
  days: TriggerDay,
) {
  const areaFilter: Prisma.AlertPreferenceWhereInput[] = [
    { areas: { isEmpty: true } }, // empty = all areas
  ];

  if (opportunityAreas.length > 0) {
    areaFilter.push({ areas: { hasSome: opportunityAreas } });
  }

  return prisma.alertPreference.findMany({
    where: {
      emailEnabled: true,
      days: { has: days },
      OR: areaFilter,
    },
    select: {
      organizationId: true,
      email: true,
      organization: { select: { name: true, cnpj: true } },
    },
  });
}

// ─── Step 2: Send all PENDING alerts in batches ───────────────────────────────

async function sendPendingAlerts(
  prisma: PrismaClient,
  emailService: EmailService,
): Promise<{
  sent: number;
  failed: number;
  alertsForPush: Array<{
    organizationId: string;
    triggerDays: number;
    opportunityId: string;
    opportunityTitle: string;
  }>;
}> {
  const pending = await prisma.alert.findMany({
    where: { status: 'PENDING', email: { not: null } },
    include: {
      opportunity: {
        select: {
          title: true,
          source: true,
          value: true,
          deadline: true,
          portalUrl: true,
          areas: true,
        },
      },
      organization: { select: { name: true, cnpj: true } },
    },
  });

  if (pending.length === 0) return { sent: 0, failed: 0, alertsForPush: [] };

  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

  const payloads = pending.map((alert) => ({
    to: alert.email!,
    alertId: alert.id,
    templateData: {
      recipientName: alert.organization.name,
      daysLeft: alert.triggerDays,
      opportunity: {
        title: alert.opportunity.title,
        source: alert.opportunity.source,
        value: alert.opportunity.value ? Number(alert.opportunity.value) : null,
        deadline: alert.opportunity.deadline.toISOString(),
        portalUrl: alert.opportunity.portalUrl,
        areas: alert.opportunity.areas,
      },
      unsubscribeUrl: buildUnsubscribeUrl(alert.organization.cnpj),
      webUrl,
    },
  }));

  // Send in rate-limited batches (max 50/min)
  const results = await emailService.batchSend(payloads, 50);

  // Update each alert status based on send result
  let sent = 0;
  let failed = 0;

  await Promise.all(
    results.map(async (result, i) => {
      const alertId = payloads[i].alertId;
      if (result.success) {
        await prisma.alert.update({
          where: { id: alertId },
          data: { status: 'SENT', sentAt: new Date() },
        });
        sent++;
      } else {
        await prisma.alert.update({
          where: { id: alertId },
          data: { status: 'FAILED' },
        });
        failed++;
        console.error(`[alert:send] Failed for alert ${alertId}: ${result.error}`);
      }
    }),
  );

  // Build push payload list from successfully sent alerts
  const alertsForPush = results
    .map((r, i) => ({ result: r, alert: pending[i] }))
    .filter(({ result }) => result.success)
    .map(({ alert }) => ({
      organizationId: alert.organizationId,
      triggerDays: alert.triggerDays,
      opportunityId: alert.opportunityId,
      opportunityTitle: alert.opportunity.title,
    }));

  return { sent, failed, alertsForPush };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dayOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
