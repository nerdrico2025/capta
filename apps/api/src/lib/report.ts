/**
 * report.ts — reporte de usuário sobre uma oportunidade. Cria um DataAlert do
 * tipo correspondente e força recheck (linkCheckedAt = null) no próximo job.
 */
import type { PrismaClient } from '@prisma/client';

export const REPORT_REASON_TO_ALERT = {
  EXPIRED: 'EXPIRED_NOT_DEACTIVATED',
  LINK_BROKEN: 'SCRAPE_FAILED',
  NOT_AN_EDITAL: 'VALIDATION_FAILED',
} as const;

export type ReportReason = keyof typeof REPORT_REASON_TO_ALERT;
export const REPORT_REASONS = Object.keys(REPORT_REASON_TO_ALERT) as [
  ReportReason,
  ...ReportReason[],
];

export async function recordOpportunityReport(
  prisma: PrismaClient,
  opportunityId: string,
  reason: ReportReason,
): Promise<{ ok: boolean; type?: string }> {
  const opp = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true },
  });
  if (!opp) return { ok: false };

  const type = REPORT_REASON_TO_ALERT[reason];
  await prisma.dataAlert.create({
    data: { opportunityId, type, message: `Reporte de usuário: ${reason}` },
  });
  // Força recheck no próximo job de revalidação/validação.
  await prisma.opportunity.update({ where: { id: opportunityId }, data: { linkCheckedAt: null } });

  return { ok: true, type };
}
