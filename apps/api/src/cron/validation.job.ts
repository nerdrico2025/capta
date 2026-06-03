import type { PrismaClient } from '@prisma/client';

const STALE_THRESHOLD_DAYS = 15;
const URL_CHECK_TIMEOUT_MS = 8_000;
const MAX_STALE_TO_CHECK = 50; // cap HTTP checks per run

export interface ValidationJobResult {
  expiredDeactivated: number;
  staleAlertsFlagged: number;
  staleFreshResolved: number; // stale alerts resolved because URL still live
  staleDeadResolved: number; // stale alerts flagged SCRAPE_FAILED
  missingAiSummaryFlagged: number;
  errors: string[];
}

export async function runValidationJob(prisma: PrismaClient): Promise<ValidationJobResult> {
  const result: ValidationJobResult = {
    expiredDeactivated: 0,
    staleAlertsFlagged: 0,
    staleFreshResolved: 0,
    staleDeadResolved: 0,
    missingAiSummaryFlagged: 0,
    errors: [],
  };

  // ── 1. Deactivate opportunities past their deadline ───────────────────────
  try {
    const { count } = await prisma.opportunity.updateMany({
      where: { isActive: true, deadline: { lt: new Date() } },
      data: { isActive: false },
    });
    result.expiredDeactivated = count;

    if (count > 0) {
      console.log(`[validation] Deactivated ${count} expired opportunity/ies`);
    }
  } catch (err) {
    const msg = `deactivateExpired: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[validation] ${msg}`);
  }

  // ── 2. Flag stale active opportunities (not updated in >N days) ───────────
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - STALE_THRESHOLD_DAYS);

  try {
    const stale = await prisma.opportunity.findMany({
      where: { isActive: true, updatedAt: { lt: staleThreshold } },
      select: { id: true, sourceUrl: true, source: true },
      take: MAX_STALE_TO_CHECK,
    });

    for (const opp of stale) {
      const existing = await prisma.dataAlert.findFirst({
        where: { opportunityId: opp.id, type: 'STALE_DATA', resolvedAt: null },
      });

      if (!existing) {
        await prisma.dataAlert.create({
          data: {
            opportunityId: opp.id,
            type: 'STALE_DATA',
            message: `Não atualizado há mais de ${STALE_THRESHOLD_DAYS} dias (fonte: ${opp.source})`,
          },
        });
        result.staleAlertsFlagged++;
      }
    }

    // ── 3. Try to re-verify stale opportunities via HTTP HEAD ───────────────
    const openStaleAlerts = await prisma.dataAlert.findMany({
      where: { type: 'STALE_DATA', resolvedAt: null },
      include: { opportunity: { select: { id: true, sourceUrl: true } } },
      take: MAX_STALE_TO_CHECK,
    });

    await Promise.allSettled(
      openStaleAlerts.map(async (alert) => {
        const url = alert.opportunity.sourceUrl;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), URL_CHECK_TIMEOUT_MS);

          const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'User-Agent': 'CaptaBot/1.0 (+https://capta.app)' },
          });
          clearTimeout(timeout);

          if (res.ok || res.status === 405) {
            // URL is live (405 = HEAD not allowed but server responded — still live)
            await prisma.dataAlert.update({
              where: { id: alert.id },
              data: {
                resolvedAt: new Date(),
                message: `URL verificada e acessível (HTTP ${res.status})`,
              },
            });
            result.staleFreshResolved++;
          } else if (res.status >= 400) {
            // URL returned a client/server error — create or update SCRAPE_FAILED alert
            await ensureDataAlert(
              prisma,
              alert.opportunity.id,
              'SCRAPE_FAILED',
              `URL retornou HTTP ${res.status}`,
            );
            result.staleDeadResolved++;
          }
        } catch {
          // Network/timeout error — flag as SCRAPE_FAILED
          await ensureDataAlert(
            prisma,
            alert.opportunity.id,
            'SCRAPE_FAILED',
            'URL inacessível (timeout ou erro de rede)',
          );
          result.staleDeadResolved++;
        }
      }),
    );
  } catch (err) {
    const msg = `staleCheck: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[validation] ${msg}`);
  }

  // ── 4. Flag active opportunities missing AI summary ───────────────────────
  try {
    const missing = await prisma.opportunity.findMany({
      where: { isActive: true, aiSummary: null },
      select: { id: true },
    });

    for (const opp of missing) {
      await ensureDataAlert(prisma, opp.id, 'MISSING_SUMMARY', 'Resumo de IA não gerado');
      result.missingAiSummaryFlagged++;
    }
  } catch (err) {
    const msg = `missingSummary: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[validation] ${msg}`);
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureDataAlert(
  prisma: PrismaClient,
  opportunityId: string,
  type: 'STALE_DATA' | 'SCRAPE_FAILED' | 'MISSING_SUMMARY' | 'EXPIRED_NOT_DEACTIVATED',
  message: string,
): Promise<void> {
  const existing = await prisma.dataAlert.findFirst({
    where: { opportunityId, type, resolvedAt: null },
  });
  if (!existing) {
    await prisma.dataAlert.create({ data: { opportunityId, type, message } });
  }
}
